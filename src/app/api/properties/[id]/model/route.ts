/**
 * @fileoverview **POST /api/properties/[id]/model** — η πόρτα του 3D μοντέλου στον ιδιωτικό κάδο.
 * @related ADR-845 §6.2 · §7.5 (Φ4.2β/Βήμα Γ) · ADR-841 §7 Α12.7 · ADR-709 (κανονική διαδρομή)
 * @module app/api/properties/[id]/model/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΑ BYTES ΚΑΙ Η ΔΗΛΩΣΗ ΓΡΑΦΟΝΤΑΙ ΣΕ **ΜΙΑ** ΕΓΓΡΑΦΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η δήλωση του πελάτη *(σήμανση · υπογράφων · λογιστική γεωμετρίας)* ταξιδεύει ως **custom
 * metadata του ίδιου αντικειμένου**, όχι ως δεύτερο έγγραφο και όχι ως δεύτερη κλήση. Ο
 * {@link uploadPublicFile} το γράφει **μέσα** στο ίδιο `file.save()`.
 *
 * 🔑 **Δύο κλήσεις θα άνοιγαν παράθυρο όπου τα bytes υπάρχουν ΧΩΡΙΣ δήλωση** — και ο ψήστης
 * απορρίπτει ονομαστικά (`'missing-declaration'`) ό,τι δεν έχει. Το αποτέλεσμα θα ήταν αρχείο
 * που **υπάρχει** και **δεν δημοσιεύεται ποτέ**, χωρίς κανείς να μπορεί να πει γιατί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΚΡΙΝΕΙ ΑΥΤΗ Η ΠΟΡΤΑ — ΚΑΙ ΤΙ **ΔΕΝ** ΚΡΙΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ✅ **Κηδεμονία και σχήμα**: ανήκει το ακίνητο στον μισθωτή; είναι αυτό GLB; χωρά; είναι
 *    **δήλωση**; υπάρχει **υπογράφων**;
 * ⛔ **ΟΧΙ περιεχόμενο.** Η κλειστή λογιστική *(«συμφωνεί η δήλωση με τα bytes;»)* έχει **έναν**
 *    κριτή: τον ψήστη *(`public-shelf-model-bake`)*, που μετράει τα bytes **που πρόκειται να
 *    δημοσιεύσει**. Ένας δεύτερος κριτής εδώ θα απαντούσε την ίδια ερώτηση για bytes **άλλης
 *    στιγμής** και θα μπορούσε να διαφωνήσει με τον πρώτο για λόγο που **κανείς δεν θα μπορούσε
 *    να ονομάσει** — δηλαδή ακριβώς το σχήμα «δύο μηχανές, μία ερώτηση» του ADR-749. Και θα
 *    πλήρωνε πλήρη ανάλυση glTF **ανά ανέβασμα**, για απάντηση που ξαναδίνεται στη δημοσίευση.
 *
 * ⚠️ **Ο κύκλος ζωής είναι ο ΥΠΑΡΧΩΝ**: `PENDING` έγγραφο → bytes → `READY`. Ο αναγνώστης της
 * δημοσίευσης φιλτράρει `status === READY`, άρα ένα ημιτελές ανέβασμα είναι **αόρατο** αντί για
 * επικίνδυνο. ⛔ Καμία νέα σειρά εγγραφών — ίδια με το `floorplan-backgrounds`.
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { extractNestedIdFromUrl } from '@/lib/api/route-helpers';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_STATUS } from '@/config/domain-constants';
import { FILE_TYPE_CONFIG } from '@/config/file-upload-config';
import {
  buildFinalizeFileRecordUpdate,
  type FileRecordBase,
} from '@/services/file-record';
import { buildPublishedModelFileRecord } from '@/lib/listings/model-file-record';
import { uploadPublicFile } from '@/services/storage-admin/public-upload.service';
import {
  MODEL_DECLARATION_METADATA_KEY,
  decodeModelDeclaration,
  encodeModelDeclaration,
} from '@/lib/listings/model-declaration-metadata';
import {
  hasSignatory,
  type ModelPublicationDeclaration,
} from '@/lib/listings/listing-model-declaration';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertyModelRoute');

export const dynamic = 'force-dynamic';

/**
 * 🔑 **Το λεξιλόγιο ρωτιέται, δεν αντιγράφεται.** MIME, επέκταση και ταβάνι μεγέθους ζουν στο
 * `FILE_TYPE_CONFIG.model` — ό,τι επιτρέπεται να **ανέβει** είναι ακριβώς ό,τι μπορεί να
 * **φύγει** *(`DELIVERABLE_MODEL_TYPES` στο `agency-media-publication`)*, από την ίδια πηγή.
 */
const MODEL_UPLOAD = FILE_TYPE_CONFIG.model;

interface PropertyModelResponse {
  readonly fileId: string;
  readonly storagePath: string;
}

/**
 * **Τι έστειλε ο άνθρωπος** — bytes + δήλωση, ή ονομασμένη άρνηση.
 *
 * ⚠️ **Κάθε άρνηση έχει δικό της μήνυμα**, ποτέ ένα κοινό «μη έγκυρο αίτημα»: ο άνθρωπος στην
 * άλλη άκρη πρέπει να μάθει *τι* να διορθώσει. Είναι η ίδια διόρθωση που έκανε το ADR-844 §1.
 */
async function readModelUpload(
  request: NextRequest,
): Promise<{ file: File; declaration: ModelPublicationDeclaration }> {
  const formData = await request.formData();

  const file = formData.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'MODEL_FILE_REQUIRED');
  if (!MODEL_UPLOAD.mimeTypes.includes(file.type)) throw new ApiError(415, 'MODEL_TYPE_UNSUPPORTED');
  if (file.size === 0) throw new ApiError(400, 'MODEL_FILE_EMPTY');
  if (file.size > MODEL_UPLOAD.maxSize) throw new ApiError(413, 'MODEL_FILE_TOO_LARGE');

  const raw = formData.get('declaration');
  const declaration = decodeModelDeclaration(typeof raw === 'string' ? raw : null);
  if (declaration === null) throw new ApiError(400, 'MODEL_DECLARATION_INVALID');

  // 🔑 **Ο ΙΔΙΟΣ φρουρός με τον ψήστη, νωρίτερα** — όχι δεύτερη διατύπωση. Το *«τι μετράει ως
  //    υπογραφή»* ζει σε ένα σημείο (`hasSignatory`, άγκυρα Α-4)· εδώ ρωτιέται όσο ο άνθρωπος
  //    είναι **παρών** και μπορεί να διορθώσει, αντί να μάθει τη σιωπή του τη μέρα της
  //    δημοσίευσης. Ο ψήστης τον ξαναρωτά — ζώνη **και** τιράντες (N.7.2 #4).
  if (!hasSignatory(declaration.signatory)) throw new ApiError(400, 'MODEL_SIGNATORY_REQUIRED');

  return { file, declaration };
}

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ApiSuccessResponse<PropertyModelResponse>>> {
  if (!ctx.companyId) throw new ApiError(403, 'Missing company context');

  const propertyId = extractNestedIdFromUrl(request.url, 'properties');
  if (!propertyId) throw new ApiError(400, 'Property ID is required');

  await requirePropertyInTenantScope({ ctx, propertyId, path: request.nextUrl.pathname });

  const { file, declaration } = await readModelUpload(request);

  // 🔴 **ΤΟ ΣΧΗΜΑ ΤΟΥ ΕΓΓΡΑΦΟΥ ΔΕΝ ΑΠΟΦΑΣΙΖΕΤΑΙ ΕΔΩ** *(ADR-845 §9 Ο-13)*. Η πόρτα κρίνει
  //    κηδεμονία και σχήμα· το *«τι έγγραφο γεννιέται — και είναι εξουσιοδοτημένο να φύγει;»*
  //    το απαντά **ένα** σώμα, το οποίο εκτελεί αυτούσιο και η άγκυρα της ραφής. Όσο η
  //    απάντηση ζούσε **μόνο** εδώ, καμία δοκιμή δεν μπορούσε να τη ρωτήσει — και δεν τη ρώτησε.
  const { fileId, storagePath, recordBase } = buildPublishedModelFileRecord({
    companyId: ctx.companyId,
    propertyId,
    contentType: file.type,
    originalFilename: file.name,
    createdBy: ctx.uid,
  });

  await writeModel({ fileId, storagePath, recordBase, file, declaration, createdBy: ctx.uid });

  logger.info('Μοντέλο ακινήτου ανέβηκε', {
    fileId, propertyId, companyId: ctx.companyId, bytes: file.size, state: declaration.state,
  });

  return apiSuccess<PropertyModelResponse>({ fileId, storagePath });
}

/**
 * **Έγγραφο σε αναμονή → bytes + δήλωση → έτοιμο.**
 *
 * ⚠️ **Η αποτυχία σημαδεύεται, δεν σιωπά**: ένα `FAILED` έγγραφο λέει *«κάτι ανέβηκε και δεν
 * ολοκληρώθηκε»*, ενώ η διαγραφή του θα άφηνε **μόνο** ορφανά bytes και καμία εξήγηση.
 */
async function writeModel(params: {
  fileId: string;
  storagePath: string;
  recordBase: FileRecordBase;
  file: File;
  declaration: ModelPublicationDeclaration;
  createdBy: string;
}): Promise<void> {
  const filesRef = getAdminFirestore().collection(COLLECTIONS.FILES).doc(params.fileId);
  await filesRef.set({ ...params.recordBase, createdAt: FieldValue.serverTimestamp() });

  try {
    const buffer = Buffer.from(await params.file.arrayBuffer());
    const { url: downloadUrl } = await uploadPublicFile({
      storagePath: params.storagePath,
      buffer,
      contentType: params.file.type,
      createdBy: params.createdBy,
      // 🏆 **ΕΔΩ ΕΙΝΑΙ Η «ΜΙΑ ΕΓΓΡΑΦΗ»** — η δήλωση μπαίνει στο ίδιο `save()` με τα bytes.
      //    ⚠️ **`encodeModelDeclaration`, ΠΟΤΕ η ωμή συμβολοσειρά του πελάτη**: αποθηκεύεται
      //    ό,τι **πέρασε** από τον `decodeModelDeclaration`, στην **κανονική** μορφή του ενός
      //    γραφέα — και μαζί ξαναελέγχεται το ταβάνι των 4 KiB των custom metadata. Η ωμή
      //    συμβολοσειρά θα μπορούσε να κουβαλά πεδία που κανείς δεν επικύρωσε.
      customMetadata: { [MODEL_DECLARATION_METADATA_KEY]: encodeModelDeclaration(params.declaration) },
    });

    await filesRef.update({
      ...buildFinalizeFileRecordUpdate({
        sizeBytes: buffer.length,
        downloadUrl,
        nextStatus: FILE_STATUS.READY,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    try {
      await filesRef.update({ status: FILE_STATUS.FAILED, updatedAt: FieldValue.serverTimestamp() });
    } catch { /* το αρχικό σφάλμα είναι το χρήσιμο — μην το σκεπάσεις */ }
    logger.error('Το ανέβασμα μοντέλου απέτυχε', {
      fileId: params.fileId, error: getErrorMessage(error),
    });
    throw new ApiError(500, 'MODEL_UPLOAD_FAILED');
  }
}

export const POST = withHeavyRateLimit(
  withAuth<ApiSuccessResponse<PropertyModelResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handlePost(request, ctx),
    { permissions: 'properties:properties:update' },
  ),
);
