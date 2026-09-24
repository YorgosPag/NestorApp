/**
 * @fileoverview **Από το αρχείο του ανθρώπου στο ιδιωτικό πρωτότυπο** — μέτρηση, κανονικοποίηση,
 *   ανέβασμα (ADR-881 §4.6 · §5.1).
 * @related lib/landing/hero-upload-check · services/photo-upload.service · hooks/mandate/useShowcaseMark
 * @module components/admin/landing-heroes/hero-upload-prepare
 *
 * 🔑 **Ο ΙΔΙΟΣ ΑΓΩΓΟΣ με το σήμα βιτρίνας** (`PhotoUploadService.uploadPhoto`): μονοπάτι
 *    `companies/{cid}/entities/company/{cid}/…`, που περνά αυτούσιο τον φρουρό κατοχής του διακομιστή.
 *
 * 🔴 **Ο ΑΓΩΓΟΣ ΔΕΧΕΤΑΙ ≤ 5 MB, ΤΟ AI ΒΓΑΖΕΙ PNG > 5 MB.** Αντί να χαλαρώσει το κοινό όριο (όλοι οι
 *    καταναλωτές του), ο browser ξανακωδικοποιεί **μόνο** όταν χρειάζεται: WebP q95 — ουσιαστικά χωρίς
 *    απώλειες, σε sRGB (ο καμβάς είναι sRGB). Ο καθαρισμός του ραφιού ξανακωδικοποιεί ούτως ή άλλως,
 *    άρα δεν χάνεται τίποτα που θα έφτανε στον επισκέπτη.
 */

import { ENTITY_TYPES, FILE_CATEGORIES, FILE_DOMAINS } from '@/config/domain-constants';
import type { HeroDimensions } from '@/lib/landing/hero-upload-check';
import { LANDING_HERO_UPLOAD_SPEC, type LandingHeroVariant } from '@/lib/landing/landing-hero-vocabulary';
import { PhotoUploadService } from '@/services/photo-upload.service';

/** Διαστάσεις **μετά** τον προσανατολισμό EXIF — όπως θα τις δει ο καθαρισμός. */
export async function readImageDimensions(file: Blob): Promise<HeroDimensions> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * **Το αρχείο που θα ανέβει** — αυτούσιο όταν χωρά, αλλιώς WebP q95 (και JPEG q92 αν ούτε αυτό χωρά).
 * `null` ⇒ δεν χωρά ούτε ξανακωδικοποιημένο (πρακτικά αδύνατο σε 2:1 κάτω από 20 MB).
 */
export async function normaliseForUpload(file: File): Promise<File | null> {
  if (file.size <= LANDING_HERO_UPLOAD_SPEC.uploadMaxBytes) return file;

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();

  for (const [type, quality, ext] of [['image/webp', 0.95, 'webp'], ['image/jpeg', 0.92, 'jpg']] as const) {
    const blob = await canvasToBlob(canvas, type, quality);
    if (blob !== null && blob.size <= LANDING_HERO_UPLOAD_SPEC.uploadMaxBytes) {
      return new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type });
    }
  }
  return null;
}

/** Ανεβάζει το πρωτότυπο στον **ιδιωτικό** κάδο και επιστρέφει το μονοπάτι του. */
export async function uploadHeroOriginal(
  file: File,
  variant: LandingHeroVariant,
  companyId: string,
  createdBy: string,
): Promise<string> {
  const result = await PhotoUploadService.uploadPhoto(file, {
    purpose: `landing-hero-${variant}`,
    enableCompression: false,
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    domain: FILE_DOMAINS.ADMIN,
    category: FILE_CATEGORIES.PHOTOS,
    companyId,
    createdBy,
  });
  return result.storagePath;
}
