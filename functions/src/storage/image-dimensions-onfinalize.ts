/**
 * =============================================================================
 * STORAGE: ΔΙΑΣΤΑΣΕΙΣ ΕΙΚΟΝΑΣ ΣΤΟ ΑΝΕΒΑΣΜΑ (onFinalize) — ADR-899 §3.7
 * =============================================================================
 *
 * **Ο ΕΝΑΣ γραφέας** του `imageDimensions`. Η εγγραφή γίνεται `ready` από **πολλούς** δρόμους — τον browser
 * (`FileRecordService.finalizeFileRecord`, όπου τα server hooks **δεν** τρέχουν), Admin routes (quote scan, CAD
 * dual-write, συνημμένα AI) — αλλά **όλοι** ανεβάζουν bytes. Ο μόνος παρατηρητής που τους βλέπει όλους είναι ο κάδος.
 * Πρακτική Firebase «Resize Images» / Cloudinary: μέτρηση **στην εισαγωγή**.
 *
 * Ροή: raster τύπος & μονοπάτι εγγραφής αρχείου → κεφαλίδα **καρφωμένης γενιάς** (`probeImageDimensions`) →
 *   (α) custom metadata του αντικειμένου με `ifGenerationMatch` — η μέτρηση **ζει με τη γενιά**· ο server τη διαβάζει
 *       δωρεάν από την κλήση μεταδεδομένων που κάνει ήδη (ADR-899 §3.3). Αλλαγή metadata = νέα *metageneration*, όχι
 *       γενιά ⇒ ETag παραγώγων άθικτο, **κανένα** νέο finalize.
 *   (β) `imageDimensions` στην εγγραφή, σε transaction, **μόνο** αν η εγγραφή δείχνει **αυτό** το αντικείμενο
 *       (`dimensionsRecordVerdict`) **στον ίδιο κάδο**.
 *
 * IDEMPOTENCY: επανάληψη γεγονότος ⇒ το metadata υπάρχει ήδη ⇒ έξοδος πριν από κάθε ανάγνωση· ίδια τιμή στην εγγραφή ⇒
 *   καμία γραφή. Εγγραφή που δεν υπάρχει ακόμη (Admin γραφείς γράφουν μετά το ανέβασμα) ⇒ `no-record`· τη γεμίζει η
 *   συμπλήρωση (`/api/admin/backfill-image-dimensions`).
 * 🔒 Bytes ΕΕ μετριούνται **μόνο** στην ΕΕ: gen2 binding στην περιοχή του κάδου (`regional-storage-triggers`, ADR-895).
 *
 * @module functions/storage/image-dimensions-onfinalize
 * @see ../generated/lib/images/stored-image-dimensions — ο πυρήνας (κοινός με τη συμπλήρωση)
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import sharp from 'sharp';

import { COLLECTIONS } from '../config/firestore-collections';
import { STORAGE_PATH_SEGMENTS } from '../generated/config/domain-constants';
import { isFileCompanionObjectName } from '../generated/lib/files/file-companion-objects';
import { fileStorageBucketNameOf } from '../generated/lib/files/file-storage-placement';
import {
  imageDimensionsFromMetadata,
  imageDimensionsToMetadata,
  isRasterImageContentType,
  type ImageDimensions,
} from '../generated/lib/images/image-dimensions';
import {
  dimensionsRecordVerdict,
  probeImageDimensions,
  type DimensionsRecordVerdict,
} from '../generated/lib/images/stored-image-dimensions';
import { fileStorageBucketNames } from './file-record-bucket';
import { finalizedObjectOf, type FinalizedObject } from './finalized-object';
import { FINALIZE_RUNTIME, gen1Memory } from './finalize-runtime';

/** Η εγγραφή που **ίσως** κατέχει το αντικείμενο — η ιδιοκτησία κρίνεται μετά, από το `storagePath` της. */
export interface FileRecordRef {
  readonly collection: string;
  readonly fileId: string;
}

/**
 * Ρίζα κατόχου ⇒ συλλογή εγγραφών (ADR-866 §5.2 — κάτοπτρο του `FILE_COLLECTION` της εφαρμογής: `company` ⇒ `FILES`,
 * `personal` ⇒ `FILES_PERSONAL`). Ρητά `COLLECTIONS.X`: η προβολή (ADR-874) υπολογίζει τα κλειδιά από **αυτή** τη μορφή.
 */
const RECORD_COLLECTION_OF_ROOT: Readonly<Record<string, string>> = {
  [STORAGE_PATH_SEGMENTS.COMPANIES]: COLLECTIONS.FILES,
  [STORAGE_PATH_SEGMENTS.PEOPLE]: COLLECTIONS.FILES_PERSONAL,
};

/**
 * `{companies|people}/{owner}/…/files/{fileId}.{ext}` ⇒ εγγραφή υποψήφια. Τα μονοπάτια αρχείων είναι **μόνο IDs**
 * (ADR-031), άρα το όνομα ως την πρώτη τελεία είναι η ταυτότητα. Κάθε άλλο σχήμα (avatar, υφές, συνοδευτικά) ⇒ `null` —
 * κανένα κατέβασμα για αντικείμενο που δεν έχει εγγραφή να ενημερώσει.
 * 🔴 Τα συνοδευτικά ζουν **στον ίδιο φάκελο** (`file_x_thumb.webp`): χωρίς το μητρώο, το «ως την πρώτη τελεία» έβγαζε
 * εγγραφή-φάντασμα `file_x_thumb` ⇒ λήψη + `sharp` + metadata + transaction για **κάθε** μικρογραφία (ADR-899 §9 θέμα 6).
 */
export function fileRecordRefOf(objectName: string): FileRecordRef | null {
  if (isFileCompanionObjectName(objectName)) return null;
  const segments = objectName.split('/');
  const collection = RECORD_COLLECTION_OF_ROOT[segments[0]];
  if (collection === undefined || segments.length < 4) return null;
  if (segments[segments.length - 2] !== STORAGE_PATH_SEGMENTS.FILES) return null;
  const fileId = segments[segments.length - 1].split('.')[0];
  return fileId ? { collection, fileId } : null;
}

type StorageFile = ReturnType<ReturnType<ReturnType<typeof admin.storage>['bucket']>['file']>;

const isNotFound = (error: unknown): boolean => (error as { code?: number }).code === 404;
const isPreconditionFailed = (error: unknown): boolean => (error as { code?: number }).code === 412;

async function downloadOrNull(file: StorageFile, range?: { start: number; end: number }): Promise<Uint8Array | null> {
  try {
    const [bytes] = await file.download(range);
    return bytes;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** (β) Η εγγραφή — transaction, κρίση από τον πυρήνα + ίδιος κάδος. */
async function recordOnDocument(
  ref: FileRecordRef,
  object: FinalizedObject & { readonly name: string },
  measured: ImageDimensions,
): Promise<DimensionsRecordVerdict> {
  const db = admin.firestore();
  const docRef = db.collection(ref.collection).doc(ref.fileId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const record = snap.exists ? (snap.data() ?? {}) : null;
    if (record !== null && !recordLivesIn(record, object.bucket)) return 'not-this-object';
    const verdict = dimensionsRecordVerdict(record, object.name, measured);
    if (verdict === 'write') tx.update(docRef, { imageDimensions: measured });
    return verdict;
  });
}

/** Η εγγραφή ζει στον κάδο του γεγονότος; Άγνωστη θέση ⇒ όχι (fail-closed, ποτέ μαντεψιά). */
function recordLivesIn(record: Record<string, unknown>, bucketName: string): boolean {
  try {
    return fileStorageBucketNameOf(record, fileStorageBucketNames()) === bucketName;
  } catch {
    return false;
  }
}

/**
 * **Το μήνυμα λέει την έκβαση** (ADR-899 §9 θέμα 6): ως εδώ φτάνει μόνο ό,τι **μετρήθηκε** και γράφτηκε στο metadata του
 * αντικειμένου· «recorded» λέγεται **μόνο** όταν γράφτηκε και η εγγραφή. Ήταν ένα σταθερό «recorded» και για `no-record`.
 * `Record` πάνω στην ένωση ⇒ νέα έκβαση χωρίς μήνυμα δεν μεταγλωττίζεται. Το πεδίο `verdict` μένει, για φίλτρα/μετρικές.
 */
const RECORD_OUTCOME: Readonly<Record<DimensionsRecordVerdict, string>> = {
  write: 'Image dimensions recorded',
  'already-recorded': 'Image dimensions: measured, record already up to date',
  'no-record': 'Image dimensions: measured, no file record yet',
  'not-this-object': 'Image dimensions: measured, record points to another object',
};

/** Το σώμα — κοινό για gen1 (κανονικός κάδος) και gen2 (ΕΕ). */
export async function recordImageDimensionsOnFinalize(object: FinalizedObject): Promise<void> {
  const { name, generation } = object;
  if (name === null || generation === null || !isRasterImageContentType(object.contentType)) return;
  if (imageDimensionsFromMetadata(object.metadata) !== null) return;
  const ref = fileRecordRefOf(name);
  if (ref === null) return;

  const file = admin.storage().bucket(object.bucket).file(name, { generation });
  const measured = await probeImageDimensions(
    {
      size: object.size,
      readHeader: (byteCount) => downloadOrNull(file, { start: 0, end: byteCount - 1 }),
      readWhole: () => downloadOrNull(file),
    },
    (bytes) => sharp(bytes).metadata(),
  );
  if (measured === null) {
    functions.logger.warn('Image dimensions: not measurable', { name, generation, contentType: object.contentType });
    return;
  }

  try {
    await file.setMetadata({ metadata: imageDimensionsToMetadata(measured) }, { ifGenerationMatch: generation });
  } catch (error) {
    // Η γενιά άλλαξε ή χάθηκε στο μεταξύ ⇒ η μέτρηση περιγράφει bytes που δεν υπάρχουν πια· το νέο γεγονός μετρά τα νέα.
    if (isPreconditionFailed(error) || isNotFound(error)) return;
    throw error;
  }

  const verdict = await recordOnDocument(ref, { ...object, name }, measured);
  functions.logger.info(RECORD_OUTCOME[verdict], { name, verdict, width: measured.width, height: measured.height });
}

/** gen1 — ο κανονικός κάδος. Το gen2 της ΕΕ ζει στο `regional-storage-triggers.ts` (ίδιο σώμα). */
export const onImageDimensionsFinalize = functions
  .runWith({
    timeoutSeconds: FINALIZE_RUNTIME.imageDimensions.timeoutSeconds,
    memory: gen1Memory(FINALIZE_RUNTIME.imageDimensions),
  })
  .storage.object()
  .onFinalize(async (raw) => {
    const object = finalizedObjectOf(raw, fileStorageBucketNames());
    if (object) await recordImageDimensionsOnFinalize(object);
  });
