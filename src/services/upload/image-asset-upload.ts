'use client';

/**
 * SSoT — ανέβασμα **εικόνας-asset** στο Firebase Storage από τον browser.
 *
 * Το μοτίβο «validate (τύπος + μέγεθος) → `uploadBytes` σε company-scoped path →
 * `getDownloadURL`» ζούσε αυτούσιο σε κάθε νέο καταναλωτή (BIM material thumbnail
 * ADR-413, HDRI ADR-366, hatch image ADR-643). Με τη σφραγίδα μηχανικού (ADR-651
 * Φάση Ε) θα γινόταν **τέταρτο δίδυμο** — γι' αυτό ο πυρήνας ζει εδώ, μία φορά, και
 * οι εξειδικευμένες υπηρεσίες κρατούν μόνο ό,τι τις κάνει διαφορετικές (ποιο path,
 * ποιο doc ενημερώνεται, ποιο όριο μεγέθους).
 *
 * Το **path** το χτίζει πάντα ο καλών από το `utils/storage-path*` (ποτέ user-supplied
 * string) ⇒ tenant isolation, όπως το επιβάλλουν και οι `storage.rules`.
 *
 * @see ./utils/storage-path-bim.ts — οι company-scoped builders (path SSoT)
 * @see @/subapps/dxf-viewer/bim/services/bim-material-thumbnail-upload.service — καταναλωτής
 * @see @/subapps/dxf-viewer/text-engine/title-block/engineer-stamp.service — καταναλωτής
 */

import { ref as makeStorageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/** Οι μορφές εικόνας που δέχεται ο browser uploader (και οι `storage.rules`). */
export type ImageAssetExt = 'png' | 'jpg' | 'jpeg' | 'webp';

export type ImageAssetUploadErrorCode = 'format' | 'size' | 'upload-failed';

export class ImageAssetUploadError extends Error {
  readonly code: ImageAssetUploadErrorCode;
  constructor(code: ImageAssetUploadErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'ImageAssetUploadError';
  }
}

/** Η κατάληξη του αρχείου, ή `null` όταν δεν είναι υποστηριζόμενη εικόνα. */
export function detectImageAssetExt(file: File): ImageAssetExt | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg')) return 'jpg';
  if (lower.endsWith('.jpeg')) return 'jpeg';
  if (lower.endsWith('.webp')) return 'webp';
  return null;
}

/** Το MIME που δηλώνεται στο Storage (οι `storage.rules` ελέγχουν `image/.*`). */
export function imageAssetContentType(ext: ImageAssetExt): string {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
  }
}

/**
 * Ελέγχει μορφή + μέγεθος **πριν** από οποιοδήποτε I/O (fail fast, ώστε ο καλών να μη
 * δημιουργήσει ποτέ orphan doc). Πετά {@link ImageAssetUploadError}· επιστρέφει την κατάληξη.
 */
export function validateImageAssetFile(file: File, maxBytes: number): ImageAssetExt {
  const ext = detectImageAssetExt(file);
  if (!ext) throw new ImageAssetUploadError('format');
  if (file.size > maxBytes) throw new ImageAssetUploadError('size');
  return ext;
}

export interface ImageAssetUploadInput {
  readonly file: File;
  /** Χτισμένο από τους path builders — **ποτέ** από είσοδο χρήστη. */
  readonly storagePath: string;
  readonly ext: ImageAssetExt;
}

/**
 * Ανεβάζει το αρχείο στο δοσμένο path και επιστρέφει το download URL. Idempotent ως προς
 * το path: ίδιο path ⇒ αντικατάσταση, ποτέ δεύτερο αντίγραφο (N.7.2 — το path είναι η
 * ταυτότητα του asset).
 */
export async function uploadImageAsset(input: ImageAssetUploadInput): Promise<string> {
  const fileRef = makeStorageRef(storage, input.storagePath);
  try {
    await uploadBytes(fileRef, input.file, { contentType: imageAssetContentType(input.ext) });
    return await getDownloadURL(fileRef);
  } catch (err) {
    throw new ImageAssetUploadError(
      'upload-failed',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Σβήνει το Storage object πίσω από ένα **download URL** (το modular `ref(storage, url)`
 * δέχεται `https://` URL του ίδιου bucket ⇒ κανένα μάντεμα κατάληξης). No-op σε κενό URL.
 */
export async function deleteImageAssetByUrl(url: string): Promise<void> {
  if (!url) return;
  await deleteObject(makeStorageRef(storage, url));
}
