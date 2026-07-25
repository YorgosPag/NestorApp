'use client';

/**
 * ADR-366 Φ9/C.2 — `StagedFile[]` → `CommentAttachment[]` (wiring 2026-07-26).
 *
 * Ο **τέταρτος καταναλωτής** του `image-asset-upload` SSoT (ADR-651 Φ.Ε), όχι τέταρτο δίδυμο:
 * το «validate → uploadBytes σε company-scoped path → getDownloadURL» δεν ξαναγράφεται εδώ.
 * Δικό μας είναι μόνο ό,τι μας κάνει διαφορετικούς: **δύο** objects ανά συνημμένο (πλήρες +
 * μικρογραφία) και η μετατροπή του client-side thumbnail από data URL σε `File`.
 *
 * ## Σειρά: upload ΠΡΙΝ το `createComment` (ADR-366, απόφαση 2026-07-26)
 *
 * Ο καλών δεσμεύει το `commentId` (`generateBimCommentId()`), ανεβάζει, και κάνει **ένα**
 * `createComment` με τα έτοιμα attachments. Η εναλλακτική (create → upload → update) κάνει
 * δύο writes και αφήνει παράθυρο όπου το σχόλιο φαίνεται χωρίς τα συνημμένα που ο χρήστης
 * μόλις είδε staged. Η ασυμμετρία των αποτυχιών είναι που αποφασίζει:
 *
 *   - εδώ, αποτυχία μετά το upload κοστίζει **bytes** — και τα μαζεύει ο GC του ADR-694
 *     (mark-only + ημερήσιος sweeper, ωρίμανση 7 ημερών)·
 *   - εκεί, αποτυχία μετά το create κοστίζει **ακεραιότητα**: σχόλιο που μόνιμα και σιωπηλά
 *     ισχυρίζεται ότι δεν έχει συνημμένα.
 *
 * Γι' αυτό η επικύρωση ΟΛΩΝ των αρχείων προηγείται ΚΑΘΕ ανεβάσματος (fail fast): μισοανεβασμένο
 * σύνολο δεν παράγεται ποτέ από πρόβλημα που ήταν γνωστό εξ αρχής.
 *
 * @see @/services/upload/image-asset-upload — ο πυρήνας (SSoT)
 * @see @/services/upload/utils/storage-path-bim — `buildBimCommentAttachmentPath` (path SSoT)
 */

import { dataUrlToBlob } from '@/lib/data-url-utils';
import {
  ImageAssetUploadError,
  uploadImageAsset,
  validateImageAssetFile,
  type ImageAssetExt,
} from '@/services/upload/image-asset-upload';
import { buildBimCommentAttachmentPath } from '@/services/upload/utils/storage-path-bim';
import type { StagedFile } from './CommentAttachmentUploader';
import type { CommentAttachment } from './bim-comment-types';

/** Ίδιο όριο με τον uploader (`CommentAttachmentUploader.MAX_SIZE_BYTES`). */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Το `generateThumbnail()` του uploader παράγει πάντα JPEG (`toDataURL('image/jpeg')`). */
const THUMBNAIL_EXT: ImageAssetExt = 'jpg';

/**
 * Μόνο PNG/JPG — ίδιο σύνολο με το `ALLOWED_TYPES` του uploader **και** με το
 * `contentType.matches('image/(png|jpe?g)')` των `storage.rules` (ADR-366 C.2.Q6).
 * Το κοινό SSoT δέχεται και `webp`· αν το αφήναμε να περάσει, ο client θα νόμιζε ότι
 * ανεβάζει και θα έτρωγε `permission-denied` από κανόνα που δεν ελέγχει ο ίδιος.
 */
const ALLOWED_EXTS: ReadonlySet<ImageAssetExt> = new Set<ImageAssetExt>(['png', 'jpg', 'jpeg']);

export interface UploadCommentAttachmentsInput {
  readonly companyId: string;
  /** Προ-δεσμευμένο από τον καλούντα — το path το χρειάζεται ΠΡΙΝ γραφτεί το σχόλιο. */
  readonly commentId: string;
  readonly staged: readonly StagedFile[];
}

/** Ένα staged αρχείο μαζί με την κατάληξη που πέρασε την επικύρωση. */
interface ValidatedFile {
  readonly staged: StagedFile;
  readonly ext: ImageAssetExt;
}

/**
 * Επικυρώνει **όλα** τα αρχεία πριν αγγίξει το δίκτυο. Πετά `ImageAssetUploadError`
 * (`format` / `size`) — ο καλών το μεταφράζει σε μήνυμα χρήστη.
 */
function validateAll(staged: readonly StagedFile[]): readonly ValidatedFile[] {
  return staged.map((s) => {
    const ext = validateImageAssetFile(s.file, MAX_ATTACHMENT_BYTES);
    if (!ALLOWED_EXTS.has(ext)) throw new ImageAssetUploadError('format');
    return { staged: s, ext };
  });
}

/**
 * Το thumbnail ζει ως data URL στη μνήμη (ο uploader το φτιάχνει με `canvas.toDataURL`).
 * Το SSoT δέχεται `File`, και βγάζει την κατάληξη από το **όνομα** — γι' αυτό το όνομα
 * χτίζεται ρητά με `.jpg`, ποτέ από το όνομα του πρωτότυπου.
 */
function toThumbnailFile(staged: StagedFile): File {
  const blob = dataUrlToBlob(staged.thumbnailDataUrl);
  return new File([blob], `${staged.id}-thumb.${THUMBNAIL_EXT}`, { type: blob.type });
}

/** Ανεβάζει το ζεύγος (πλήρες + μικρογραφία) ενός συνημμένου και επιστρέφει την εγγραφή του. */
async function uploadOne(
  input: UploadCommentAttachmentsInput,
  validated: ValidatedFile,
): Promise<CommentAttachment> {
  const { staged, ext } = validated;
  const base = {
    companyId: input.companyId,
    commentId: input.commentId,
    attachmentId: staged.id,
  } as const;

  const url = await uploadImageAsset({
    file: staged.file,
    storagePath: buildBimCommentAttachmentPath({ ...base, ext, variant: 'full' }),
    ext,
  });
  const thumbnailUrl = await uploadImageAsset({
    file: toThumbnailFile(staged),
    storagePath: buildBimCommentAttachmentPath({
      ...base,
      ext: THUMBNAIL_EXT,
      variant: 'thumb',
    }),
    ext: THUMBNAIL_EXT,
  });

  return {
    id: staged.id,
    url,
    thumbnailUrl,
    name: staged.file.name,
    sizeBytes: staged.file.size,
  };
}

/**
 * Ανεβάζει τα staged αρχεία και επιστρέφει τις εγγραφές που θα ταξιδέψουν στο
 * `createComment`. Σειριακά, όχι `Promise.all`: πέντε ταυτόχρονα ζεύγη ανεβάσματος από
 * browser δεν κερδίζουν χρόνο σε αργή σύνδεση, ενώ κάνουν την πρώτη αποτυχία να αφήνει
 * απρόβλεπτο αριθμό μισοανεβασμένων objects.
 */
export async function uploadCommentAttachments(
  input: UploadCommentAttachmentsInput,
): Promise<readonly CommentAttachment[]> {
  if (input.staged.length === 0) return [];

  const validated = validateAll(input.staged);
  const uploaded: CommentAttachment[] = [];
  for (const item of validated) {
    uploaded.push(await uploadOne(input, item));
  }
  return uploaded;
}
