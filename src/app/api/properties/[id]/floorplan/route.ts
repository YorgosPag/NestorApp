/**
 * @fileoverview **POST /api/properties/[id]/floorplan** — η πόρτα της κάτοψης που παράγεται από το σχέδιο.
 * @related ADR-909 (Β1) · ADR-845 §7.17 (Κλάση Ο-35) · ../_shared/publish-property-material (ο κορμός)
 * @module app/api/properties/[id]/floorplan/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Ο ΠΕΛΑΤΗΣ ΣΤΕΛΝΕΙ ΤΡΙΑ ΠΡΑΓΜΑΤΑ — ΚΑΙ ΚΑΝΕΝΑ ΑΠΟ ΤΑ 13 ΠΕΔΙΑ ΔΗΜΟΣΙΕΥΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | στέλνει | ο διακομιστής |
 * |---|---|
 * | τα **bytes** (PNG) | ελέγχει υπογραφή και διαστάσεις πάνω στα **ίδια** τα bytes |
 * | το **`levelId`** | διαβάζει το επίπεδο: μισθωτής · **δεσμός με το ακίνητο** · ποιο αρχείο σκηνής · σε ποιο `revision` |
 * | τη **συνταγή** απόδοσης | δέχεται μόνο το τρέχον προφίλ, σε κλειστό σχήμα |
 *
 * Διαβάθμιση, ταυτότητα, κατηγορία, κάτοχος, κατάσταση, διαδρομή: **όλα** τα γράφει ο διακομιστής
 * *(ADR-845 §7.17 Α4)*. Ο πελάτης δεν ονομάζει ούτε το αρχείο.
 *
 * 🔴 **Η ΠΡΟΕΛΕΥΣΗ «ΜΕΤΡΗΜΕΝΗ» ΕΙΝΑΙ ΙΔΙΟΤΗΤΑ ΑΥΤΗΣ ΤΗΣ ΠΟΡΤΑΣ** *(Α1)*: γράφεται ως πρόθεμα της
 * `publicationIdentity`, πεδίο που ο browser δεν αγγίζει. Γι' αυτό η πόρτα **αρνείται** να γεννήσει
 * κάτοψη χωρίς αναγνώσιμη έκδοση σχεδίου — «μετρημένη» χωρίς να ξέρουμε **από τι** δεν είναι μετρημένη.
 *
 * ⛔ **ΟΧΙ περιεχόμενο.** Η πόρτα δεν αποκωδικοποιεί την εικόνα και δεν ξανασχεδιάζει· ο καθαρισμός και
 * η επανακωδικοποίηση είναι του ραφιού, όπως για κάθε εικόνα (ADR-909 §4, δηλωμένο όριο).
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import {
  FLOORPLAN_CONTENT_TYPE,
  FLOORPLAN_MAX_BYTES,
  buildPublishedFloorplanFileRecord,
} from '@/lib/listings/floorplan-file-record';
import { levelServesProperty } from '@/lib/listings/floorplan-level-binding';
import {
  PNG_HEADER_BYTES,
  decodeFloorplanRenderRecipe,
  recipeMatchesBytes,
  type FloorplanRecipeRefusal,
  type FloorplanRenderRecipe,
} from '@/lib/listings/floorplan-render-recipe';
import {
  declarePublishedFloorplan,
  declaredFloorplansOf,
  floorplanDeclarationHasRoom,
  type FloorplanDeclarationOutcome,
} from '@/services/listings/floorplan-declaration.service';
import type { ListingMediaRefreshOutcome } from '@/services/listings/listing-media-refresh';
import { createModuleLogger } from '@/lib/telemetry/Logger';

import {
  publishPropertyMaterial,
  type MaterialDoorEnv,
  type MaterialPublicationDoor,
} from '../_shared/publish-property-material';

const logger = createModuleLogger('PropertyFloorplanRoute');

export const dynamic = 'force-dynamic';

interface PropertyFloorplanResponse {
  readonly fileId: string;
  readonly storagePath: string;
  /** Η προηγούμενη παραγόμενη κάτοψη του **ίδιου επιπέδου** — κενό = πρώτη δημοσίευσή του. */
  readonly supersedes: readonly string[];
  readonly archived: readonly string[];
  /** Μπήκε στο `publishedFloorplans`; `full`/`failed` ⇒ ανέβηκε αλλά **δεν** φεύγει ακόμη στο κοινό. */
  readonly declared: FloorplanDeclarationOutcome;
  /** Τι έγινε στην αγγελία — η κάτοψη ανέβηκε σε **κάθε** τιμή. */
  readonly listing: ListingMediaRefreshOutcome;
}

interface FloorplanUpload {
  readonly file: File;
  readonly levelId: string;
  readonly sceneFileId: string;
  readonly recipe: FloorplanRenderRecipe;
}

/** Κάθε άρνηση της συνταγής έχει δικό της κωδικό **και** δική της κατάσταση HTTP. */
const RECIPE_REFUSAL: Readonly<Record<FloorplanRecipeRefusal, readonly [status: number, code: string]>> = {
  malformed: [400, 'FLOORPLAN_RECIPE_INVALID'],
  'unknown-profile': [400, 'FLOORPLAN_PROFILE_UNKNOWN'],
  // 409: το αίτημα είναι καλοσχηματισμένο· ο **πελάτης** είναι παλιός και οφείλει να ξαναφορτώσει.
  'stale-profile': [409, 'FLOORPLAN_PROFILE_STALE'],
};

const LEVEL_ID_MAX_LENGTH = 128;

function readLevelId(raw: unknown): string {
  const valid = typeof raw === 'string' && raw !== '' && raw.length <= LEVEL_ID_MAX_LENGTH && !raw.includes('/');
  if (!valid) throw new ApiError(400, 'FLOORPLAN_LEVEL_REQUIRED');
  return raw;
}

/** Τα bytes: είναι PNG, χωρά, και **λέει τις διαστάσεις που δηλώνει η συνταγή**. */
async function readFloorplanImage(formData: FormData): Promise<{ file: File; recipe: FloorplanRenderRecipe }> {
  const file = formData.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'FLOORPLAN_FILE_REQUIRED');
  if (file.type !== FLOORPLAN_CONTENT_TYPE) throw new ApiError(415, 'FLOORPLAN_TYPE_UNSUPPORTED');
  if (file.size === 0) throw new ApiError(400, 'FLOORPLAN_FILE_EMPTY');
  if (file.size > FLOORPLAN_MAX_BYTES) throw new ApiError(413, 'FLOORPLAN_FILE_TOO_LARGE');

  const reading = decodeFloorplanRenderRecipe(formData.get('recipe'));
  if (!reading.ok) throw new ApiError(...RECIPE_REFUSAL[reading.why]);

  // 🔑 Μόνο η κεφαλίδα: το πλήρες σώμα το διαβάζει ο κορμός **μία** φορά, όταν πρόκειται να το γράψει.
  const header = new Uint8Array(await file.slice(0, PNG_HEADER_BYTES).arrayBuffer());
  if (!recipeMatchesBytes(reading.recipe, header)) throw new ApiError(400, 'FLOORPLAN_BYTES_MISMATCH');

  return { file, recipe: reading.recipe };
}

/**
 * **Το επίπεδο, όπως το ξέρει η βάση** — ο πελάτης έδωσε μόνο το αναγνωριστικό του.
 *
 * 🔐 Ξένος μισθωτής = ανύπαρκτο (ίδιο 404, καμία διάκριση). Ο **δεσμός με το ακίνητο** κρίνεται από
 * δύο έγγραφα που ο πελάτης δεν ελέγχει — επίπεδο άλλου κτιρίου ή άλλου ορόφου **δεν** δημοσιεύεται εδώ.
 */
async function readSceneFileOfLevel(levelId: string, env: MaterialDoorEnv): Promise<string> {
  const snapshot = await env.adminDb.collection(COLLECTIONS.DXF_VIEWER_LEVELS).doc(levelId).get();
  const data = snapshot.data();
  if (data === undefined || !isPayloadOwnedByCompany(data, env.ctx.companyId)) {
    throw new ApiError(404, 'FLOORPLAN_LEVEL_NOT_FOUND');
  }
  const level: Record<string, unknown> = data;

  const binding = levelServesProperty(level, env.property);
  if (!binding.ok) {
    logger.warn('Κάτοψη επιπέδου που δεν εξυπηρετεί το ακίνητο — άρνηση', {
      levelId, propertyId: env.propertyId, why: binding.why,
    });
    throw new ApiError(
      422,
      binding.why === 'level-unplaced' ? 'FLOORPLAN_LEVEL_UNPLACED' : 'FLOORPLAN_LEVEL_NOT_OF_PROPERTY',
    );
  }

  const sceneFileId = level.sceneFileId;
  if (typeof sceneFileId !== 'string' || sceneFileId === '') throw new ApiError(422, 'FLOORPLAN_LEVEL_WITHOUT_DRAWING');
  return sceneFileId;
}

async function readFloorplanUpload(formData: FormData, env: MaterialDoorEnv): Promise<FloorplanUpload> {
  // ⚠️ Πρώτα ό,τι κρίνεται **χωρίς** ανάγνωση βάσης: ένα σπασμένο σώμα δεν αξίζει ούτε ένα `get()`.
  const levelId = readLevelId(formData.get('levelId'));
  const { file, recipe } = await readFloorplanImage(formData);
  const sceneFileId = await readSceneFileOfLevel(levelId, env);
  return { file, levelId, sceneFileId, recipe };
}

/**
 * 🏆 **Ό,ΤΙ ΕΙΝΑΙ ΤΗΣ ΚΑΤΟΨΗΣ** — ο κορμός κάνει όλα τα υπόλοιπα, με την **ίδια** σειρά που έχει και
 * για το μοντέλο. Καμία επαναπροβολή εδώ: είναι **μέσα** στον κορμό.
 */
const FLOORPLAN_DOOR: MaterialPublicationDoor<FloorplanUpload, FloorplanDeclarationOutcome> = {
  // 🔒 Η πρόθεση εγγραφής γράφεται **εδώ** (CHECK 3.100)· το **πότε** τρέχει το αποφασίζει ο κορμός — πρώτο.
  judgeProperty: (query) => requirePropertyInTenantScope({ ...query, intent: 'write' }),
  category: FILE_CATEGORIES.FLOORPLANS,
  codes: { notCapable: 'FLOORPLAN_PUBLICATION_NOT_CAPABLE', uploadFailed: 'FLOORPLAN_UPLOAD_FAILED' },
  read: readFloorplanUpload,
  fileOf: (upload) => upload.file,
  sceneFileIdsOf: (upload) => [upload.sceneFileId],
  recordOf: (upload, birth) => {
    // 🔴 **ΑΥΣΤΗΡΟΤΕΡΟ ΑΠΟ ΤΟ ΜΟΝΤΕΛΟ, ΕΠΙΤΗΔΕΣ** (ADR-909 §5): εκεί η έλλειψη έκδοσης αφήνει την
    //    παλαιότητα `unknown`· εδώ θα άφηνε «Μετρημένη» κάτοψη που κανείς δεν μπορεί να πει αν ισχύει.
    const [source, ...rest] = birth.sourceRevisions;
    if (source === undefined || rest.length > 0) throw new ApiError(422, 'FLOORPLAN_SOURCE_UNREADABLE');

    return buildPublishedFloorplanFileRecord({
      companyId: birth.companyId,
      propertyId: birth.propertyId,
      createdBy: birth.createdBy,
      levelId: upload.levelId,
      sourceRevisions: [source],
      renderRecipe: upload.recipe,
    });
  },
  // 🔑 **Πριν γραφτεί οτιδήποτε**: αρχείο που ανεβαίνει χωρίς να χωρά στη δήλωση θα ήταν δημόσιο στη
  //    βάση και αόρατο στο κοινό — και ο άνθρωπος θα έβλεπε «επιτυχία».
  beforeWrite: (_upload, verdict, env) => {
    if (!floorplanDeclarationHasRoom(declaredFloorplansOf(env.property), verdict.supersedes)) {
      throw new ApiError(409, 'FLOORPLAN_SHELF_FULL');
    }
  },
  afterSuccession: (_upload, verdict, env) =>
    declarePublishedFloorplan(env.adminDb, {
      propertyId: env.propertyId,
      companyId: env.ctx.companyId,
      fileId: verdict.fileId,
      performedBy: env.ctx.uid,
    }),
};

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ApiSuccessResponse<PropertyFloorplanResponse>>> {
  const published = await publishPropertyMaterial(request, ctx, FLOORPLAN_DOOR);
  const { propertyId, fileId, storagePath, supersedes, archived, listing } = published;
  // Ο κορμός επιστρέφει `undefined` μόνο για πόρτα **χωρίς** βήμα δήλωσης· αυτή έχει.
  const declared = published.declared ?? 'failed';

  logger.info('Κάτοψη ακινήτου δημοσιεύτηκε από το σχέδιο', {
    fileId, propertyId, companyId: ctx.companyId, bytes: published.bytes,
    levelId: published.parsed.levelId, supersedes: supersedes.length, archived: archived.length,
    declared, listing,
  });

  return apiSuccess<PropertyFloorplanResponse>({ fileId, storagePath, supersedes, archived, declared, listing });
}

export const POST = withHeavyRateLimit(
  withAuth<ApiSuccessResponse<PropertyFloorplanResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handlePost(request, ctx),
    { permissions: 'properties:properties:update' },
  ),
);
