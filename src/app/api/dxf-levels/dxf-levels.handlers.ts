/**
 * 📐 DXF LEVELS API — ENTERPRISE HANDLERS
 *
 * Centralizes DXF Viewer level creation through createEntity() (ADR-286).
 * Previously written directly via client-side setDoc — now routed through
 * the same SSOT pipeline as floors/units/parking/storage (ADR-238).
 *
 * @see ADR-286 — DXF Level Creation Centralization
 * @see ADR-237 — Polygon Overlay Bridge (original dxf_viewer_levels spec)
 * @see ADR-238 — Entity Creation Centralization
 */

import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import type { AuthContext } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
// 🛡️ ADR-714 — ο ΙΔΙΟΣ pure κανόνας που επιβάλλει ο client (ADR-399). Dependency-free
// (type-only imports), άρα ασφαλής για server bundle.
import { isCrossFloorSceneLink } from '@/subapps/dxf-viewer/systems/levels/cross-floor-link';
import { dxfLevelResource } from './_shared/dxf-level-ownership';
import { CreateDxfLevelSchema, UpdateDxfLevelSchema } from './dxf-levels.schemas';
import type {
  DxfLevelCreateResponse,
  DxfLevelDeleteResponse,
  DxfLevelDocument,
  DxfLevelsListResponse,
  DxfLevelUpdateResponse,
} from './dxf-levels.types';

const logger = createModuleLogger('DxfLevelsRoute');

/**
 * Φόρτωσε το επίπεδο ΚΑΙ βεβαιώσου ότι ανήκει στον καλούντα — η ΜΙΑ πύλη πριν από κάθε
 * τροποποίηση/διαγραφή.
 *
 * 🔄 **2026-08-01 (ADR-742 §7undecies)**: το σώμα αυτής της συνάρτησης —
 * `doc.get()` → `!exists ? 404 : ...` → σύγκριση `companyId` → `403` — ήταν
 * **τρίτο αντίγραφο** της ίδιας αλυσίδας (τα άλλα δύο στο
 * `dxf-dimension-styles.handlers.ts`). Τρία ελαττώματα έφυγαν **δομικά**:
 * το ξένο επίπεδο απαντούσε **403** ενώ το ανύπαρκτο **404** (μαντείο ύπαρξης,
 * §3.3)· η σύγκριση ήταν σκέτο `!==` (παγίδα του κενού, §4)· και ο bypass
 * ρωτούσε **συμβολοσειρά** αντί για `isRoleBypass` (§7.4).
 *
 * Μένει ως λεπτό δέσιμο γιατί οι δύο καλούντες θέλουν διαφορετικό τύπο
 * απάντησης· η **απόφαση** και η **σειρά** δεν ζουν πια εδώ.
 */
async function loadOwnedLevelRef(levelId: string, ctx: AuthContext, action: string) {
  const owned = await dxfLevelResource.load({
    docId: levelId,
    caller: ctx,
    action,
    refusal: dxfLevelResource.notFoundResponse,
  });

  return owned.refusal
    ? { response: owned.refusal, ref: undefined, data: undefined }
    : { response: undefined, ref: owned.doc.ref, data: owned.doc.data ?? {} };
}

/**
 * 🛡️ ADR-714 — SERVER-SIDE floor-scope guard για το `sceneFileId`.
 *
 * ## Γιατί εδώ και όχι μόνο στον client
 *
 * Το `sceneFileId` καθορίζει σε ΠΟΙΟ Storage blob γράφει ο επεξεργαστής ενός ορόφου.
 * Όταν δύο επίπεδα δείξουν στο ίδιο αρχείο, μοιράζονται ένα φυσικό `.scene.json` και
 * όποιος σώζει τελευταίος σβήνει τον άλλο — αυτό ακριβώς συνέβη στις 2026-07-26
 * (`lvl_2a7ff5cc` απέκτησε το αρχείο του `lvl_dabeb3bb`). Οι client-side φρουροί
 * (`isCrossFloorSceneLink` σε load και write path) είναι ταχύτεροι και δίνουν ανάδραση,
 * αλλά **ο client δεν είναι έμπιστος**: αρκεί ένας νέος καλών, ένα regression ή ένα
 * απευθείας PATCH για να ξαναγραφτεί ο λάθος σύνδεσμος. Αυτός εδώ είναι ο μόνος
 * έλεγχος που δεν μπορεί να παρακαμφθεί.
 *
 * ## Συντηρητικό εξ ορισμού
 *
 * Ο ίδιος ο κανόνας δεν ξαναγράφεται εδώ: χρησιμοποιείται το **υπάρχον pure predicate**
 * `isCrossFloorSceneLink` (ADR-399, `systems/levels/cross-floor-link.ts`) που είναι
 * dependency-free (μόνο type imports) και άρα εκτελείται αυτούσιο και στον διακομιστή.
 * Ένας ορισμός του «ανήκει σε άλλον όροφο», δύο σημεία επιβολής — αν αύριο ο κανόνας
 * χαλαρώσει ή σφίξει, αλλάζει σε ΕΝΑ αρχείο και ισχύει και στις δύο πλευρές.
 */
async function assertSceneFileBelongsToFloor(
  sceneFileId: string,
  levelFloorId: unknown,
): Promise<void> {
  if (typeof levelFloorId !== 'string' || !levelFloorId) return;

  const db = getAdminFirestore();
  const fileDoc = await db.collection(COLLECTIONS.FILES).doc(sceneFileId).get();
  if (!fileDoc.exists) {
    throw new ApiError(404, `Scene file ${sceneFileId} does not exist`);
  }

  const file = fileDoc.data() ?? {};
  if (!isCrossFloorSceneLink(file, levelFloorId)) return;

  throw new ApiError(
    409,
    `Scene file ${sceneFileId} belongs to floor ${file.entityId}, not ${levelFloorId} (ADR-714)`,
  );
}

export async function handleListDxfLevels(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfLevelsListResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const floorId = searchParams.get('floorId');
    const isSuperAdmin = ctx.globalRole === 'super_admin';

    const db = getAdminFirestore();
    let query = db.collection(COLLECTIONS.DXF_VIEWER_LEVELS).orderBy('order', 'asc');

    if (!isSuperAdmin) {
      query = query.where('companyId', '==', ctx.companyId);
    }
    if (floorId) {
      query = query.where('floorId', '==', floorId);
    }

    const snapshot = await query.get();
    const levels = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as DxfLevelDocument));

    logger.info('[DxfLevels/List] Found levels', {
      count: levels.length,
      companyId: ctx.companyId,
      floorId: floorId ?? 'all',
    });

    return NextResponse.json({
      success: true,
      levels,
      stats: {
        totalLevels: levels.length,
        floorId: floorId ?? undefined,
      },
      message: `Found ${levels.length} DXF levels`,
    });
  } catch (error) {
    logger.error('[DxfLevels/List] Error', {
      error: getErrorMessage(error),
      userId: ctx.uid,
    });
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch DXF levels',
      details: getErrorMessage(error),
    }, { status: 500 });
  }
}

export async function handleCreateDxfLevel(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ApiSuccessResponse<DxfLevelCreateResponse>>> {
  try {
    const parsed = safeParseBody(CreateDxfLevelSchema, await request.json());
    if (parsed.error) {
      throw new ApiError(400, 'Validation failed');
    }
    const body = parsed.data;

    logger.info('[DxfLevels/Create] Creating level', {
      companyId: ctx.companyId,
      userId: ctx.uid,
      floorId: body.floorId ?? null,
    });

    // Duplicate name check (per tenant)
    const db = getAdminFirestore();
    const duplicateCheck = await db
      .collection(COLLECTIONS.DXF_VIEWER_LEVELS)
      .where('companyId', '==', ctx.companyId)
      .where('name', '==', body.name)
      .select()
      .limit(1)
      .get();

    if (!duplicateCheck.empty) {
      throw new ApiError(409, `DXF level "${body.name}" already exists for this tenant`);
    }

    // 🛡️ ADR-714 — ίδιος φρουρός και στη δημιουργία: ένα νέο επίπεδο δεν γεννιέται
    // δείχνοντας στο αρχείο άλλου ορόφου.
    if (body.sceneFileId) {
      await assertSceneFileBelongsToFloor(body.sceneFileId, body.floorId);
    }

    const entitySpecificFields: Record<string, unknown> = {
      name: body.name,
      order: body.order,
      isDefault: body.isDefault ?? false,
      visible: body.visible ?? true,
      floorId: body.floorId ?? null,
      sceneFileId: body.sceneFileId ?? null,
      sceneFileName: body.sceneFileName ?? null,
    };

    const result = await createEntity('dxfLevel', {
      auth: ctx,
      parentId: body.floorId ?? null,
      entitySpecificFields,
      apiPath: '/api/dxf-levels (POST)',
    });

    return apiSuccess<DxfLevelCreateResponse>(
      { levelId: result.id },
      `DXF level "${body.name}" created successfully`
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[DxfLevels/Create] Error', { error: getErrorMessage(error), userId: ctx.uid });
    throw new ApiError(500, getErrorMessage(error, 'Failed to create DXF level'));
  }
}

/** Το σώμα του PATCH χωρίς τα δύο κλειδιά που ο handler αποδομεί (`levelId`, `_v`). */
type UpdateLevelBody = Omit<z.infer<typeof UpdateDxfLevelSchema>, 'levelId' | '_v'>;

/**
 * 🔴 **Η ALLOWLIST — η μοναδική διαδρομή από το συμβόλαιο στη βάση.**
 *
 * Το `UpdateDxfLevelSchema` κλείνει με `.passthrough()`, οπότε άγνωστο πεδίο **περνά την
 * επικύρωση**. Αυτή η συνάρτηση είναι που το **σταματά**: αντιγράφει ρητά, δεν κάνει spread.
 *
 * ⚠️ **Το τίμημα είναι σιωπηλό και επικίνδυνο**: πεδίο δηλωμένο στο Zod schema αλλά ξεχασμένο
 * εδώ περνά ως έγκυρο και **πετιέται**, ενώ ο πελάτης παίρνει `success: true` (ή, αν ήταν το
 * μόνο πεδίο, 400 «No fields to update» που διαβάζεται ως σφάλμα πελάτη). Με τον κανόνα Γ9 του
 * ADR-745 (πρώτα ο στόχος, μετά η προέλευση), αυτό γράφει provenance για εγγραφή που **δεν
 * έγινε ποτέ**. Άγκυρα: `__tests__/update-allowlist-parity.test.ts` — απαιτεί ότι **κάθε** πεδίο
 * του συμβολαίου έχει γραμμή εδώ.
 *
 * `?? null` παντού όπου το πεδίο είναι nullable: `null` = **ρητός καθαρισμός** από τον χρήστη,
 * και το Firestore δεν δέχεται `undefined`.
 */
function buildLevelUpdates(body: UpdateLevelBody): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.order !== undefined) updates.order = body.order;
  if (body.isDefault !== undefined) updates.isDefault = body.isDefault;
  if (body.visible !== undefined) updates.visible = body.visible;
  if (body.floorId !== undefined) updates.floorId = body.floorId ?? null;
  if (body.buildingId !== undefined) updates.buildingId = body.buildingId ?? null;
  if (body.sceneFileId !== undefined) updates.sceneFileId = body.sceneFileId ?? null;
  if (body.sceneFileName !== undefined) updates.sceneFileName = body.sceneFileName ?? null;
  // ADR-309 Phase 3: context-aware level fields
  if (body.floorplanType !== undefined) updates.floorplanType = body.floorplanType ?? null;
  if (body.entityLabel !== undefined) updates.entityLabel = body.entityLabel ?? null;
  if (body.projectId !== undefined) updates.projectId = body.projectId ?? null;
  // ADR-651 Φάση Ι: χειρόγραφος αριθμός φύλλου (null = πίσω στην αυτόματη αρίθμηση θέσης)
  if (body.sheetNumberOverride !== undefined) updates.sheetNumberOverride = body.sheetNumberOverride ?? null;
  // ADR-759 Φ3: μεταδεδομένα πινακίδας τοπογραφικού — ανήκουν στο ΦΥΛΛΟ, ποτέ στο έργο.
  if (body.studyDate !== undefined) updates.studyDate = body.studyDate ?? null;
  if (body.drawingType !== undefined) updates.drawingType = body.drawingType ?? null;
  if (body.scale !== undefined) updates.scale = body.scale ?? null;
  if (body.drawingNumber !== undefined) updates.drawingNumber = body.drawingNumber ?? null;
  // ADR-375 Phase B.2: per-view BIM render settings
  if (body.bimRenderSettings !== undefined) updates.bimRenderSettings = body.bimRenderSettings ?? null;
  // ADR-375 Phase B.3: FK → dxf_viewer_view_templates (or null = detached)
  if (body.appliedViewTemplateId !== undefined) updates.appliedViewTemplateId = body.appliedViewTemplateId ?? null;
  // ADR-396 P7: per-floor ETICS thermal envelope spec
  if (body.thermalEnvelopeSpec !== undefined) updates.thermalEnvelopeSpec = body.thermalEnvelopeSpec ?? null;
  return updates;
}

export async function handleUpdateDxfLevel(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfLevelUpdateResponse>> {
  try {
    const parsed = safeParseBody(UpdateDxfLevelSchema, await request.json());
    if (parsed.error) {
      return parsed.error as NextResponse<DxfLevelUpdateResponse>;
    }
    const { _v: expectedVersion, levelId, ...body } = parsed.data;

    const owned = await loadOwnedLevelRef(levelId, ctx, 'update');
    if (owned.response) {
      return owned.response as NextResponse<DxfLevelUpdateResponse>;
    }
    // withVersionCheck operates by (db, collection, docId); the ownership check
    // above is what `loadOwnedLevelRef` is for (its `ref` is not needed here).
    const db = getAdminFirestore();

    // 🛡️ ADR-714 — ένα επίπεδο δεν επιτρέπεται ΠΟΤΕ να δείξει σε αρχείο άλλου ορόφου.
    // Ο έλεγχος γίνεται με τον όροφο ΟΠΩΣ ΘΑ ΕΙΝΑΙ μετά το PATCH (το ίδιο αίτημα μπορεί
    // να αλλάζει και τα δύο πεδία), αλλιώς μια ταυτόχρονη αλλαγή ορόφου θα τον παρέκαμπτε.
    // Το ξε-linkάρισμα (`sceneFileId: null`) είναι πάντα επιτρεπτό — είναι η θεραπεία.
    //
    // ⚠️ Μένει **εδώ** και όχι μέσα στο `buildLevelUpdates`: είναι ασύγχρονος φρουρός που
    // διαβάζει τη βάση, ενώ εκείνη είναι καθαρή αντιγραφή πεδίων. Ανακατεμένα, ο φρουρός θα
    // κρυβόταν μέσα σε λίστα αναθέσεων και θα ήταν το πρώτο πράγμα που θα «απλοποιούσε» κάποιος.
    if (body.sceneFileId) {
      await assertSceneFileBelongsToFloor(
        body.sceneFileId,
        body.floorId !== undefined ? body.floorId : owned.data.floorId,
      );
    }

    const updates = buildLevelUpdates(body);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    // 🔎 TEMP DIAGNOSTIC (2026-06-13 — runaway PATCH loop hunt): log WHICH fields each
    // PATCH writes so we can identify the remaining ~3-5s writer. REMOVE after diagnosis.
    logger.info('[DxfLevels/Update] DIAG fields', { levelId, fields: Object.keys(updates) });

    const versionResult = await withVersionCheck({
      db,
      collection: COLLECTIONS.DXF_VIEWER_LEVELS,
      docId: levelId,
      expectedVersion,
      updates,
      userId: ctx.uid,
    });
    logger.info('[DxfLevels/Update] Level updated', { levelId, _v: versionResult.newVersion });

    return NextResponse.json({
      success: true,
      message: `DXF level "${levelId}" updated`,
      _v: versionResult.newVersion,
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json(error.body, { status: error.statusCode });
    }
    // 🛡️ ADR-714 — ένα ΤΥΠΟΠΟΙΗΜΕΝΟ σφάλμα είναι απάντηση, όχι αποτυχία. Χωρίς αυτό, το
    // 409 του cross-floor guard καταπινόταν και ο καλών έπαιρνε αδιάκριτο 500 — δηλαδή
    // «κάτι έσπασε» αντί για «αυτό απαγορεύεται και να γιατί». Ίδια μεταχείριση με τον
    // create handler παραπάνω, που ήδη ξαναπετά τα ApiError.
    if (error instanceof ApiError) throw error;
    logger.error('[DxfLevels/Update] Error', { error: getErrorMessage(error, 'Unknown') });
    return NextResponse.json({
      success: false,
      error: 'Failed to update DXF level',
      details: getErrorMessage(error, 'Unknown'),
    }, { status: 500 });
  }
}

export async function handleDeleteDxfLevel(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfLevelDeleteResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const levelId = searchParams.get('levelId');

    if (!levelId) {
      return NextResponse.json({ success: false, error: 'Level ID is required' }, { status: 400 });
    }

    const owned = await loadOwnedLevelRef(levelId, ctx, 'delete');
    if (owned.response) {
      return owned.response as NextResponse<DxfLevelDeleteResponse>;
    }

    await owned.ref.delete();
    logger.info('[DxfLevels/Delete] Level deleted', { levelId, userId: ctx.uid });

    return NextResponse.json({ success: true, message: `DXF level "${levelId}" deleted` });
  } catch (error) {
    logger.error('[DxfLevels/Delete] Error', { error: getErrorMessage(error, 'Unknown') });
    return NextResponse.json({
      success: false,
      error: 'Failed to delete DXF level',
      details: getErrorMessage(error, 'Unknown'),
    }, { status: 500 });
  }
}
