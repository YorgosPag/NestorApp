'use client';

/**
 * ADR-651 Φάση Ε — **σφραγίδα/υπογραφή μηχανικού** (Απόφαση #6α): thin orchestrator, πλήρες
 * SSoT reuse.
 *
 * Πρακτική μεγάλων (ArchiCAD Project Info / Revit shared params): η σφραγίδα ανεβαίνει **μία
 * φορά** και εμφανίζεται σε **όλα** τα σχέδια — ποτέ αντίγραφο ανά σχέδιο. Άρα ζει εκεί που
 * ζει ήδη η ταυτότητα του μηχανικού: στο `users/{userId}` doc (δίπλα στο `licenseNumber` =
 * Α.Μ. ΤΕΕ), και ταξιδεύει στην πινακίδα μέσα από το **υπάρχον** `buildPlaceholderScope()`.
 *
 * Αλυσίδα (μηδέν νέος uploader, μηδέν νέο collection, μηδέν νέος κανόνας Firestore):
 *   validate+upload → `@/services/upload/image-asset-upload` (SSoT· company-scoped path από
 *   τον `buildEngineerStampPath`) → `setDoc(users/{uid}, {stampImageUrl}, {merge:true})`
 *   (self-update, ήδη επιτρεπτό από τους `firestore.rules`) → `applyStampImageUrl()` ώστε η
 *   επόμενη πινακίδα να τη δείξει **αμέσως**, χωρίς να περιμένει νέο fetch scope.
 *
 * Idempotent (N.7.2): το path είναι keyed by `userId` ⇒ νέο ανέβασμα = **αντικατάσταση**,
 * ποτέ δεύτερο αντίγραφο. Κανένα νέο Firestore doc ⇒ καμία ανάγκη enterprise id (N.6).
 *
 * @see @/services/upload/image-asset-upload — ο κοινός uploader
 * @see @/services/upload/utils/storage-path-bim — buildEngineerStampPath (path SSoT)
 * @see ../templates/resolver/placeholder-scope-client — in-session ενημέρωση scope
 */

import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  deleteImageAssetByUrl,
  ImageAssetUploadError,
  uploadImageAsset,
  validateImageAssetFile,
} from '@/services/upload/image-asset-upload';
import { buildEngineerStampPath } from '@/services/upload/utils/storage-path';
import { applyStampImageUrl } from '../templates/resolver/placeholder-scope-client';

/** Όριο πελάτη (2MB) — ίδιο με το hard cap των `storage.rules`. Μια σφραγίδα είναι μικρή. */
export const ENGINEER_STAMP_MAX_BYTES = 2 * 1024 * 1024;

export interface EngineerStampUploadInput {
  readonly file: File;
  readonly companyId: string;
  readonly userId: string;
}

/** Τα i18n suffix κλειδιά κάτω από `titleBlockStamp.errors.*` (N.11 — καμία σταθερή string). */
export type EngineerStampErrorCode =
  | 'format'
  | 'size'
  | 'failed'
  | 'removeFailed'
  | 'notReady';

export class EngineerStampError extends Error {
  readonly code: EngineerStampErrorCode;
  constructor(code: EngineerStampErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'EngineerStampError';
  }
}

/** Τα codes του κοινού uploader → i18n κλειδιά της σφραγίδας. */
function asStampError(err: unknown, fallback: EngineerStampErrorCode): EngineerStampError {
  if (err instanceof ImageAssetUploadError) {
    const code: EngineerStampErrorCode =
      err.code === 'format' || err.code === 'size' ? err.code : 'failed';
    return new EngineerStampError(code, err.message);
  }
  return new EngineerStampError(fallback, err instanceof Error ? err.message : String(err));
}

/** Γράφει (ή σβήνει) το `stampImageUrl` στο ΔΙΚΟ του user doc — merge, ποτέ overwrite. */
async function persistStampUrl(userId: string, url: string | null): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.USERS, userId), { stampImageUrl: url }, { merge: true });
}

/**
 * Ανεβάζει τη σφραγίδα και την κάνει ενεργή. Επιστρέφει το download URL. Πετά
 * {@link EngineerStampError} με code που είναι **i18n κλειδί** (καμία σταθερή συμβολοσειρά).
 */
export async function uploadEngineerStamp(input: EngineerStampUploadInput): Promise<string> {
  const { file, companyId, userId } = input;
  if (!companyId || !userId) throw new EngineerStampError('notReady');

  const ext = (() => {
    try {
      return validateImageAssetFile(file, ENGINEER_STAMP_MAX_BYTES);
    } catch (err) {
      throw asStampError(err, 'failed');
    }
  })();

  try {
    const storagePath = buildEngineerStampPath({ companyId, userId, ext });
    const downloadUrl = await uploadImageAsset({ file, storagePath, ext });
    await persistStampUrl(userId, downloadUrl);
    applyStampImageUrl(downloadUrl);
    return downloadUrl;
  } catch (err) {
    throw asStampError(err, 'failed');
  }
}

/**
 * Αφαιρεί τη σφραγίδα: πρώτα το doc (η πηγή αλήθειας για την ύπαρξη), μετά best-effort το
 * Storage object — ένα ορφανό blob δεν πρέπει ΠΟΤΕ να μπλοκάρει το UX (ίδιο μοτίβο με το
 * `deleteMaterialThumbnailByUrl`).
 */
export async function removeEngineerStamp(userId: string, currentUrl: string): Promise<void> {
  if (!userId) throw new EngineerStampError('notReady');
  try {
    await persistStampUrl(userId, null);
  } catch (err) {
    throw asStampError(err, 'removeFailed');
  }
  applyStampImageUrl(null);
  await deleteImageAssetByUrl(currentUrl).catch(() => {});
}
