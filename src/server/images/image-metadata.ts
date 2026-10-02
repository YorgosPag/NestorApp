import 'server-only';

/**
 * @fileoverview 📐 **Ο ΑΝΑΓΝΩΣΤΗΣ ΜΕΤΑΔΕΔΟΜΕΝΩΝ ΕΙΚΟΝΑΣ ΤΟΥ SERVER** — το `sharp` δεμένο στον πυρήνα
 *   `lib/images/stored-image-dimensions` (ADR-899 §3.7).
 * @module server/images/image-metadata
 * @related lib/images/image-dimensions (τι σημαίνει «διαστάσεις θεατή») · functions/storage/image-dimensions-onfinalize
 *          (ο ίδιος πυρήνας με το δικό του `sharp`)
 *
 * 🔑 **Μόνο κεφαλίδα**: το `metadata()` του sharp διαβάζει μέγεθος/προσανατολισμό **χωρίς** αποκωδικοποίηση pixel —
 *   φθηνό ακόμη και για σφαίρα 40 MB.
 */

import sharp from 'sharp';

import type { ImageDimensions } from '@/lib/images/image-dimensions';
import { imageDimensionsIn, type ImageMetadataReader } from '@/lib/images/stored-image-dimensions';

/** `sharp().metadata()` στο σχήμα του πυρήνα. */
export const readImageMetadata: ImageMetadataReader = (bytes) => sharp(bytes).metadata();

/** **Bytes ⇒ διαστάσεις θεατή** (μετά τον προσανατολισμό EXIF) — `null` όταν δεν διαβάζονται. Ποτέ δεν πετά. */
export function readImageDimensions(bytes: Uint8Array): Promise<ImageDimensions | null> {
  return imageDimensionsIn(bytes, readImageMetadata);
}
