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
 *
 * 🔑 **Η ΣΕΙΡΑ ΤΩΝ ΒΗΜΑΤΩΝ ΖΕΙ ΣΤΟΝ ΚΟΙΝΟ ΚΟΡΜΟ** *(ADR-909 Β1, `_shared/publish-property-material`)*:
 * κηδεμονία · δικαίωμα · εγγραφή · bytes · διαδοχή · επαναπροβολή. Εδώ μένει **μόνο** ό,τι είναι του
 * μοντέλου — τι δέχεται, τι έγγραφο γεννά, τι ταξιδεύει δίπλα στα bytes.
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import { FILE_TYPE_CONFIG } from '@/config/file-upload-config';
import { buildPublishedModelFileRecord } from '@/lib/listings/model-file-record';
import { readSceneFileIds } from '../_shared/material-source-lookup';
import {
  publishPropertyMaterial,
  type MaterialPublicationDoor,
} from '../_shared/publish-property-material';
import type { ListingMediaRefreshOutcome } from '@/services/listings/listing-media-refresh';
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
  /**
   * 🏆 **ΠΟΙΟΥΣ ΔΙΑΔΕΧΕΤΑΙ ΑΥΤΗ Η ΔΗΜΟΣΙΕΥΣΗ** — ταυτοποιητικά (ADR-845 Ο-27).
   *
   * 🔴 **ΑΛΛΑΞΕ ΣΤΟ ADR-862 Φ0 Β10: Ο ΔΙΑΚΟΜΙΣΤΗΣ ΚΡΙΝΕΙ ΚΑΙ ΠΡΑΤΤΕΙ.** Μέχρι τότε η μία πόρτα
   * της απόσυρσης ήταν **client SDK** και η αρχειοθέτηση γινόταν σε δεύτερο βήμα στον πελάτη.
   * Πλέον η πόρτα **είναι** ο server γραφέας (`transitionContainer({ act: 'supersede' })`), άρα
   * καλείται **εδώ** — όχι δίδυμο: ο **ΕΝΑΣ** γραφέας, από τον δεύτερο καλούντα. Δες {@link archived}.
   *
   * ⚠️ **Η ΑΓΓΕΛΙΑ ΕΙΝΑΙ ΗΔΗ ΣΩΣΤΗ ΧΩΡΙΣ ΑΥΤΟ.** Το `currentPerIdentity` κρατά **παράγωγα**
   * το νεότερο ανά ταυτότητα, άρα το κοινό δεν βλέπει ποτέ διπλότυπο — ούτε αν ο πελάτης
   * πεθάνει σε αυτό ακριβώς το σημείο. Αυτό εδώ γράφει την **ιστορία** *(ISO 19650 §10.2: το
   * superseded είναι **μη χρησιμοποιήσιμο, όχι ανύπαρκτο**, και ο διάδοχος **ευρέσιμος**)*.
   *
   * 🔑 **Κενός πίνακας = δεν διαδέχεται κανέναν** — πρώτη δημοσίευση αυτής της ταυτότητας.
   * **Ποτέ** «δεν ξέρω».
   */
  readonly supersedes: readonly string[];
  /**
   * 🗄️ **Ποιοι από τους `supersedes` ΑΡΧΕΙΟΘΕΤΗΘΗΚΑΝ ΠΡΑΓΜΑΤΙ** (ADR-862 Φ0 Β10).
   *
   * 🔑 Ο πελάτης εκπέμπει `FILE_SUPERSEDED` **μόνο** γι' αυτούς — ποτέ για ό,τι απλώς
   * ταυτοποιήθηκε. Μια άρνηση του γραφέα (π.χ. `not-capable`) **δεν** ακυρώνει τη δημοσίευση:
   * η αγγελία είναι ήδη σωστή· χάνεται μόνο η τακτοποίηση της ιστορίας, και καταγράφεται.
   */
  readonly archived: readonly string[];
  /**
   * 🌍 **ΤΙ ΕΓΙΝΕ ΣΤΗΝ ΑΓΓΕΛΙΑ** (ADR-845 Ο-35) — το μοντέλο ανέβηκε **σε κάθε** τιμή· αυτό λέει
   * αν το **είδε ο κόσμος**: `published` ναι · `withdrawn` το ακίνητο δεν είναι στην αγορά ·
   * `failed` εκκρεμεί ως την επανασύνθεση · `absent` δεν βρέθηκε ακίνητο να προβληθεί.
   */
  readonly listing: ListingMediaRefreshOutcome;
}

/**
 * **Τι έστειλε ο άνθρωπος** — bytes + δήλωση, ή ονομασμένη άρνηση.
 *
 * ⚠️ **Κάθε άρνηση έχει δικό της μήνυμα**, ποτέ ένα κοινό «μη έγκυρο αίτημα»: ο άνθρωπος στην
 * άλλη άκρη πρέπει να μάθει *τι* να διορθώσει. Είναι η ίδια διόρθωση που έκανε το ADR-844 §1.
 */
interface ModelUpload {
  readonly file: File;
  readonly declaration: ModelPublicationDeclaration;
  readonly sceneFileIds: readonly string[];
}

async function readModelUpload(formData: FormData): Promise<ModelUpload> {
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

  // ⚠️ **ΚΑΜΙΑ ΑΡΝΗΣΗ ΓΙΑ ΤΟΝ ΚΑΤΑΛΟΓΟ ΣΧΕΔΙΩΝ** *(ADR-845 Ο-25)*, σε αντίθεση με τα τέσσερα
  //    από πάνω: ένα σώμα που δεν τον φέρει σημαίνει *«δεν κατέγραψα προέλευση»* ⇒ η
  //    παλαιότητα μένει `unknown`, που είναι **τίμιο**. Η καταγραφή δεν επιτρέπεται να
  //    ακυρώσει τη δημοσίευση — ίδιος κανόνας με την ιστορία της διαδοχής *(Ο-27)*.
  return { file, declaration, sceneFileIds: readSceneFileIds(formData.get('sceneFileIds')) };
}

/**
 * 🏆 **Ό,ΤΙ ΕΙΝΑΙ ΤΟΥ ΜΟΝΤΕΛΟΥ** — ο κορμός κάνει όλα τα υπόλοιπα *(ADR-909 Β1)*.
 *
 * 🔴 **ΤΟ ΣΧΗΜΑ ΤΟΥ ΕΓΓΡΑΦΟΥ ΔΕΝ ΑΠΟΦΑΣΙΖΕΤΑΙ ΕΔΩ** *(ADR-845 §9 Ο-13)*: το *«τι έγγραφο γεννιέται —
 * και είναι εξουσιοδοτημένο να φύγει;»* το απαντά **ένα** σώμα (`buildPublishedModelFileRecord`), το
 * οποίο εκτελεί αυτούσιο και η άγκυρα της ραφής.
 * 🔑 **Ο ΠΕΛΑΤΗΣ ΕΙΠΕ *ΠΟΙΑ*, Ο ΚΟΡΜΟΣ ΔΙΑΒΑΖΕΙ *ΣΕ ΠΟΙΟ REVISION*** *(Ο-25)*: ένα revision από τον
 * πελάτη θα ήταν ισχυρισμός του καλούντος, και θα μπορούσε να είναι μπαγιάτικο τη στιγμή που γράφεται.
 */
const MODEL_DOOR: MaterialPublicationDoor<ModelUpload> = {
  // 🔒 Η πρόθεση εγγραφής γράφεται **εδώ** (CHECK 3.100)· το **πότε** τρέχει το αποφασίζει ο κορμός — πρώτο.
  judgeProperty: (query) => requirePropertyInTenantScope({ ...query, intent: 'write' }),
  category: FILE_CATEGORIES.MODELS,
  codes: { notCapable: 'MODEL_PUBLICATION_NOT_CAPABLE', uploadFailed: 'MODEL_UPLOAD_FAILED' },
  read: readModelUpload,
  fileOf: (upload) => upload.file,
  sceneFileIdsOf: (upload) => upload.sceneFileIds,
  recordOf: (upload, birth) =>
    buildPublishedModelFileRecord({
      ...birth,
      contentType: upload.file.type,
      originalFilename: upload.file.name,
      declaration: upload.declaration,
    }),
  // 🏆 **ΕΔΩ ΕΙΝΑΙ Η «ΜΙΑ ΕΓΓΡΑΦΗ»** — η δήλωση μπαίνει στο ίδιο `save()` με τα bytes.
  //    ⚠️ **`encodeModelDeclaration`, ΠΟΤΕ η ωμή συμβολοσειρά του πελάτη**: αποθηκεύεται ό,τι **πέρασε**
  //    από τον `decodeModelDeclaration`, στην **κανονική** μορφή του ενός γραφέα — και μαζί ξαναελέγχεται
  //    το ταβάνι των 4 KiB των custom metadata. Η ωμή θα μπορούσε να κουβαλά πεδία που κανείς δεν επικύρωσε.
  customMetadataOf: (upload) => ({
    [MODEL_DECLARATION_METADATA_KEY]: encodeModelDeclaration(upload.declaration),
  }),
};

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ApiSuccessResponse<PropertyModelResponse>>> {
  const published = await publishPropertyMaterial(request, ctx, MODEL_DOOR);
  const { propertyId, fileId, storagePath, supersedes, archived, listing } = published;
  const { declaration } = published.parsed;

  logger.info('Μοντέλο ακινήτου ανέβηκε', {
    fileId, propertyId, companyId: ctx.companyId, bytes: published.bytes,
    state: declaration.state, scope: declaration.scope, supersedes: supersedes.length,
    archived: archived.length, sources: published.sourceRevisions.length, listing,
  });

  return apiSuccess<PropertyModelResponse>({ fileId, storagePath, supersedes, archived, listing });
}

export const POST = withHeavyRateLimit(
  withAuth<ApiSuccessResponse<PropertyModelResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handlePost(request, ctx),
    { permissions: 'properties:properties:update' },
  ),
);
