import 'server-only';

/**
 * @fileoverview 🏆 **Ο ΚΟΙΝΟΣ ΚΟΡΜΟΣ ΤΗΣ ΔΗΜΟΣΙΕΥΣΗΣ ΥΛΙΚΟΥ ΑΠΟ ΤΟ ΣΧΕΔΙΟ** (ADR-909 Β1 · ADR-845 §7.17).
 * @related ../model/route · ../floorplan/route (οι δύο πόρτες) · ./material-source-lookup · ./material-supersession
 * @module app/api/properties/[id]/_shared/publish-property-material
 *
 * ```
 * κηδεμονία (ο φρουρός ΤΗΣ ΠΟΡΤΑΣ) → δικαίωμα δημοσίευσης → ανάγνωση αιτήματος → revisions σχεδίων → εγγραφή (PENDING)
 *   → προκάτοχοι → [φρουρός της πόρτας] → bytes → READY → διαδοχή → [δήλωση της πόρτας] → ΕΠΑΝΑΠΡΟΒΟΛΗ
 * ```
 *
 * 🔴 **ΓΙΑΤΙ ΕΝΑΣ ΚΟΡΜΟΣ ΚΑΙ ΟΧΙ ΔΥΟ ROUTES ΠΟΥ ΜΟΙΑΖΟΥΝ.** Κάθε βήμα παραπάνω είναι απόφαση που
 * πληρώθηκε με περιστατικό στην πόρτα του μοντέλου: το *«ρωτάμε προκατόχους ΠΡΙΝ γράψουμε»* (Ο-27), το
 * *«το δικαίωμα ΠΡΙΝ από κάθε εγγραφή»* (Α3β), το *«η επαναπροβολή ΤΕΛΕΥΤΑΙΑ»* (Ο-35). Ένα αντίγραφο
 * της route για την κάτοψη θα τα κληρονομούσε **σήμερα** και θα τα έχανε στην πρώτη διόρθωση της μίας.
 *
 * 🔑 **Η επαναπροβολή είναι ΜΕΣΑ**, όπως στο `runFileBatch`: πόρτα που περνά από εδώ **δεν μπορεί** να
 * την ξεχάσει. Γι' αυτό ο κορμός είναι δηλωμένος βοηθός επαναπροβολής στο CHECK 3.76
 * (`REFRESH_HELPERS`) — και μια πόρτα **δεν** την καλεί δεύτερη φορά.
 *
 * 🔒 **Η ΚΛΗΣΗ ΤΟΥ ΦΡΟΥΡΟΥ ΚΗΔΕΜΟΝΙΑΣ ΓΡΑΦΕΤΑΙ ΣΤΗΝ ΠΟΡΤΑ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ** *(CHECK 3.100, ADR-281)*: η πύλη
 * διαβάζει το κυριολεκτικό `intent: 'write'` **στο `route.ts`**, όχι σε βοηθό. Γι' αυτό κάθε πόρτα δίνει τον
 * φρουρό της ως **υποχρεωτικό** σκέλος (`judgeProperty`)· ο κορμός αποφασίζει **πότε** τρέχει — πρώτος.
 *
 * ⛔ **Ο κορμός δεν ξέρει τι υλικό δημοσιεύει.** Το *«τι έγγραφο γεννιέται;»* το απαντά ο
 * κατασκευαστής **κάθε** πόρτας (`recordOf`) — ποτέ σημαία εδώ.
 */

import type { NextRequest } from 'next/server';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { propertyIdOfRequest } from '@/app/api/properties/_shared/property-id-of-request';
import type { TenantProperty } from '@/lib/auth/tenant-isolation';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_STATUS, type FileCategory } from '@/config/domain-constants';
import {
  buildFinalizeFileRecordUpdate,
  type BuildPendingFileRecordResult,
  type FileRecordBase,
} from '@/services/file-record';
import type { ModelSourceRevision } from '@/lib/listings/model-source-revisions';
import { uploadPublicFile } from '@/services/storage-admin/public-upload.service';
import { mayChangePublication } from '@/services/file-record/file-classification.service';
import {
  refreshListingAfterMediaChange,
  type ListingMediaRefreshOutcome,
} from '@/services/listings/listing-media-refresh';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

import { findSupersededMaterial, readSourceRevisions } from './material-source-lookup';
import { archiveSuperseded } from './material-supersession';

const logger = createModuleLogger('PropertyMaterialPublication');

/** Ό,τι χρειάζεται ο φρουρός κηδεμονίας — η πόρτα προσθέτει **μόνο** την πρόθεση. */
interface PropertyCustodyQuery {
  readonly ctx: AuthContext;
  readonly propertyId: string;
  readonly path: string;
}

/** Ό,τι ξέρει ο κορμός όταν ρωτά την πόρτα — το ακίνητο είναι **ήδη** κριμένο ως του μισθωτή. */
export interface MaterialDoorEnv {
  readonly adminDb: AdminFirestore;
  readonly ctx: AuthContext;
  readonly propertyId: string;
  /** Το ωμό έγγραφο του ακινήτου, όπως το διάβασε ο φρουρός κηδεμονίας — **μία** ανάγνωση για όλη την αίτηση. */
  readonly property: Readonly<Record<string, unknown>>;
}

/** Ό,τι δίνει ο κορμός στον κατασκευαστή της εγγραφής — και ούτε πεδίο παραπάνω. */
interface MaterialBirth {
  readonly companyId: string;
  readonly propertyId: string;
  readonly createdBy: string;
  /** Διαβασμένα από τον **διακομιστή**, ποτέ από τον πελάτη (ADR-845 Ο-25). */
  readonly sourceRevisions: readonly ModelSourceRevision[];
}

/** Η στιγμή ανάμεσα στην κρίση και στην πρώτη εγγραφή — η τελευταία ευκαιρία για άρνηση χωρίς ίχνος. */
interface MaterialVerdict {
  readonly fileId: string;
  readonly supersedes: readonly string[];
}

/**
 * **Ό,τι διαφέρει από πόρτα σε πόρτα** — και τίποτα από ό,τι είναι κοινό.
 *
 * ⚠️ Κάθε άρνηση της πόρτας είναι `ApiError` με **δικό της** κωδικό: ο άνθρωπος στην άλλη άκρη πρέπει
 * να μάθει *τι* να διορθώσει (ADR-844 §1).
 */
export interface MaterialPublicationDoor<TParsed, TDeclared = undefined> {
  /**
   * 🔒 **Ο φρουρός κηδεμονίας, με την πρόθεση γραμμένη από την πόρτα**: `requirePropertyInTenantScope({ …query,
   * intent: 'write' })`. Ξένο ή ανύπαρκτο ακίνητο ⇒ 404· αποσυρμένο ⇒ 409 — πριν από οτιδήποτε άλλο.
   */
  readonly judgeProperty: (query: PropertyCustodyQuery) => Promise<TenantProperty>;
  /** Ο κάδος του υλικού — στενεύει το ερώτημα των προκατόχων. */
  readonly category: FileCategory;
  readonly codes: { readonly notCapable: string; readonly uploadFailed: string };
  /** Το αίτημα → ό,τι έστειλε ο άνθρωπος, **κριμένο**. Πετά `ApiError` για κάθε άρνηση. */
  readonly read: (formData: FormData, env: MaterialDoorEnv) => Promise<TParsed>;
  readonly fileOf: (parsed: TParsed) => File;
  /** Ποια αρχεία σκηνής παρήγαγαν το υλικό — ο διακομιστής διαβάζει το `revision` τους. */
  readonly sceneFileIdsOf: (parsed: TParsed) => readonly string[];
  /** **Ο ΕΝΑΣ κατασκευαστής της πόρτας.** Πετά `ApiError` αν η εγγραφή δεν επιτρέπεται να γεννηθεί. */
  readonly recordOf: (parsed: TParsed, birth: MaterialBirth) => BuildPendingFileRecordResult;
  /** Ό,τι ταξιδεύει **μέσα στο ίδιο `save()`** με τα bytes. */
  readonly customMetadataOf?: (parsed: TParsed) => Record<string, string>;
  /** Φρουρός **πριν** από κάθε εγγραφή, όταν οι προκάτοχοι είναι γνωστοί. */
  readonly beforeWrite?: (parsed: TParsed, verdict: MaterialVerdict, env: MaterialDoorEnv) => void;
  /**
   * Η δήλωση της πόρτας, **μετά** τη διαδοχή και **πριν** την επαναπροβολή — ώστε η αγγελία να
   * προβληθεί με τη δήλωση ήδη γραμμένη. ⚠️ Δεν επιτρέπεται να ρίξει τη δημοσίευση: επιστρέφει.
   */
  readonly afterSuccession?: (parsed: TParsed, verdict: MaterialVerdict, env: MaterialDoorEnv) => Promise<TDeclared>;
}

interface MaterialPublication<TParsed, TDeclared> {
  readonly propertyId: string;
  readonly fileId: string;
  readonly storagePath: string;
  /** Ποιους διαδέχεται — ταυτοποιητικά· κενό = πρώτη δημοσίευση αυτής της ταυτότητας. */
  readonly supersedes: readonly string[];
  /** Ποιοι από αυτούς αρχειοθετήθηκαν **πράγματι**. */
  readonly archived: readonly string[];
  /** Τι έγινε στην αγγελία — το υλικό ανέβηκε σε **κάθε** τιμή. */
  readonly listing: ListingMediaRefreshOutcome;
  readonly parsed: TParsed;
  readonly sourceRevisions: readonly ModelSourceRevision[];
  readonly bytes: number;
  readonly declared: TDeclared | undefined;
}

/**
 * **Κηδεμονία και δικαίωμα — πριν διαβαστεί το σώμα.**
 *
 * 🔒 Το ανέβασμα **είναι** δημοσίευση *(ADR-845 §7.17 Α3β)*: το αρχείο γεννιέται δημόσιο και
 * αρχειοθετεί τον δημοσιευμένο προκάτοχό του. Ρωτιέται ο **ΕΝΑΣ** τόπος, και **πριν** γραφτεί οτιδήποτε
 * — αλλιώς το νέο υλικό θα γραφόταν και η διαδοχή θα αρνιόταν ⇒ δύο δημόσια αρχεία της ίδιας ταυτότητας.
 */
async function enterDoor(
  request: NextRequest,
  ctx: AuthContext,
  door: Pick<MaterialPublicationDoor<unknown>, 'judgeProperty' | 'codes'>,
): Promise<MaterialDoorEnv> {
  const propertyId = propertyIdOfRequest(request, ctx);
  const property = await door.judgeProperty({ ctx, propertyId, path: request.nextUrl.pathname });

  const subject = { globalRole: ctx.globalRole, permissions: ctx.permissions, companyId: ctx.companyId };
  if (!mayChangePublication(subject)) throw new ApiError(403, door.codes.notCapable);

  return { adminDb: getAdminFirestore(), ctx, propertyId, property: { ...property } };
}

/**
 * **Έγγραφο σε αναμονή → bytes (+ ό,τι ταξιδεύει μαζί τους) → έτοιμο.**
 *
 * ⚠️ **Ο κύκλος ζωής είναι ο ΥΠΑΡΧΩΝ**: ο αναγνώστης της δημοσίευσης φιλτράρει `status === READY`,
 * άρα ένα ημιτελές ανέβασμα είναι **αόρατο** αντί για επικίνδυνο.
 * ⚠️ **Η αποτυχία σημαδεύεται, δεν σιωπά**: ένα `FAILED` έγγραφο λέει *«κάτι ανέβηκε και δεν
 * ολοκληρώθηκε»*, ενώ η διαγραφή του θα άφηνε **μόνο** ορφανά bytes και καμία εξήγηση.
 */
async function writeMaterial(params: {
  fileId: string;
  storagePath: string;
  recordBase: FileRecordBase;
  file: File;
  customMetadata: Record<string, string> | undefined;
  createdBy: string;
  uploadFailed: string;
}): Promise<number> {
  const filesRef = getAdminFirestore().collection(COLLECTIONS.FILES).doc(params.fileId);
  await filesRef.set({ ...params.recordBase, createdAt: FieldValue.serverTimestamp() });

  try {
    const buffer = Buffer.from(await params.file.arrayBuffer());
    const { url: downloadUrl } = await uploadPublicFile({
      storagePath: params.storagePath,
      buffer,
      contentType: params.file.type,
      createdBy: params.createdBy,
      // 🏆 **«ΜΙΑ ΕΓΓΡΑΦΗ»** — ό,τι δηλώνει η πόρτα μπαίνει στο ίδιο `save()` με τα bytes.
      ...(params.customMetadata === undefined ? {} : { customMetadata: params.customMetadata }),
    });

    await filesRef.update({
      ...buildFinalizeFileRecordUpdate({ sizeBytes: buffer.length, downloadUrl, nextStatus: FILE_STATUS.READY }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return buffer.length;
  } catch (error) {
    try {
      await filesRef.update({ status: FILE_STATUS.FAILED, updatedAt: FieldValue.serverTimestamp() });
    } catch { /* το αρχικό σφάλμα είναι το χρήσιμο — μην το σκεπάσεις */ }
    logger.error('Το ανέβασμα υλικού απέτυχε', { fileId: params.fileId, error: getErrorMessage(error) });
    throw new ApiError(500, params.uploadFailed);
  }
}

/**
 * 🏆 **Η ΔΗΜΟΣΙΕΥΣΗ** — ένα σώμα για κάθε πόρτα που γεννά υλικό αγγελίας από το σχέδιο.
 *
 * 🔑 **Οι προκάτοχοι ρωτιούνται ΠΡΙΝ γραφτεί το νέο έγγραφο** *(Ο-27)*: μετά, ο νεοφερμένος θα ήταν
 * μέσα στο αποτέλεσμα και θα έπρεπε να **εξαιρεθεί** — μια γραμμή που, αν ξεχαστεί, κάνει το υλικό να
 * διαδεχθεί τον εαυτό του την ίδια στιγμή που δημοσιεύεται.
 * 🔴 **Η επαναπροβολή είναι ΤΕΛΕΥΤΑΙΑ** *(Ο-35)*, ώστε να δει τον κόσμο όπως έμεινε — νέο `ready`,
 * προκάτοχοι στο αρχείο, δήλωση γραμμένη. Awaited· δεν πετά ποτέ.
 */
export async function publishPropertyMaterial<TParsed, TDeclared = undefined>(
  request: NextRequest,
  ctx: AuthContext,
  door: MaterialPublicationDoor<TParsed, TDeclared>,
): Promise<MaterialPublication<TParsed, TDeclared>> {
  const env = await enterDoor(request, ctx, door);
  const { adminDb, propertyId } = env;

  const parsed = await door.read(await request.formData(), env);
  const sourceRevisions = await readSourceRevisions(adminDb, ctx.companyId, door.sceneFileIdsOf(parsed));
  const { fileId, storagePath, recordBase } = door.recordOf(parsed, {
    companyId: ctx.companyId, propertyId, createdBy: ctx.uid, sourceRevisions,
  });

  const supersedes = await findSupersededMaterial(adminDb, ctx.companyId, propertyId, door.category, recordBase);
  const verdict: MaterialVerdict = { fileId, supersedes };
  door.beforeWrite?.(parsed, verdict, env);

  const bytes = await writeMaterial({
    fileId, storagePath, recordBase, file: door.fileOf(parsed),
    customMetadata: door.customMetadataOf?.(parsed), createdBy: ctx.uid, uploadFailed: door.codes.uploadFailed,
  });
  const archived = await archiveSuperseded(ctx, supersedes, fileId);
  const declared = await door.afterSuccession?.(parsed, verdict, env);
  const listing = await refreshListingAfterMediaChange(adminDb, propertyId, ctx.companyId);

  return { propertyId, fileId, storagePath, supersedes, archived, listing, parsed, sourceRevisions, bytes, declared };
}
