'use client';

/**
 * ADR-651 Φάση Ε — client cache της **εικόνας σφραγίδας** (module singleton, zero React).
 *
 * Η πινακίδα χτίζεται σε **καθαρές συναρτήσεις** (ghost === commit === PDF): κανένα `await`
 * στο μονοπάτι σχεδίασης. Άρα η εικόνα φορτώνεται **μία φορά, εκ των προτέρων** (όταν
 * οπλίζεται το εργαλείο ή ανοίγει ο διάλογος εκτύπωσης) και το layout τη διαβάζει
 * **σύγχρονα** με getter — ακριβώς το μοτίβο του `placeholder-scope-client` (§5.1).
 *
 * Δύο πράγματα δίνει το cache, γιατί δύο διαφορετικά backends τα θέλουν:
 *  - **`url`** (https download URL) → μπαίνει ως `ImageEntity.url` στο in-scene block: το
 *    σχέδιο κρατά **αναφορά**, ποτέ pixels (ίδια σύμβαση με το `HatchImageFill.assetId`).
 *  - **`dataUrl`** (base64) + **pixel διαστάσεις** → τα απαιτεί ο jsPDF (`addImage`) και ο
 *    contain-fit υπολογισμός· ένα σκέτο https URL δεν αρκεί για το PDF.
 *
 * `crossOrigin='anonymous'`: τα Firebase download URLs σερβίρουν CORS ⇒ ο καμβάς **δεν
 * μολύνεται** (χωρίς αυτό, το `toDataURL` της raster εκτύπωσης θα πετούσε SecurityError).
 *
 * Αποτυχία δικτύου/decode ⇒ `null` (κενό κελί σφραγίδας), **ποτέ** μπλοκαρισμένη εισαγωγή.
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { createKeyedImageCache } from './title-block-image-cache';

const logger = createModuleLogger('TitleBlockStampImage');

/** Η φορτωμένη σφραγίδα, στις δύο μορφές που ζητούν τα backends. */
export interface StampImage {
  /** Το αρχικό https download URL — αυτό μπαίνει στο in-scene `ImageEntity`. */
  readonly url: string;
  /** PNG data URL — το απαιτεί ο jsPDF ζωγράφος (`drawRaster`). */
  readonly dataUrl: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

/** Decode + rasterise σε data URL (ό,τι χρειάζεται ο jsPDF· ο καμβάς δεν μολύνεται). */
async function decodeStamp(url: string): Promise<StampImage> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(img, 0, 0);

  return {
    url,
    dataUrl: canvas.toDataURL('image/png'),
    widthPx: img.naturalWidth,
    heightPx: img.naturalHeight,
  };
}

/** Ο keyed cache της σφραγίδας — keyed by download URL (ο μηχανισμός ζει στο SSoT factory). */
const stampCache = createKeyedImageCache<StampImage>(decodeStamp, (error) =>
  logger.warn('Stamp image unavailable — printing an empty stamp cell', {
    error: getErrorMessage(error),
  }),
);

/**
 * Προ-φορτώνει τη σφραγίδα (idempotent· in-flight dedupe). Αποτυχία ⇒ `null` + warning, ώστε
 * η πινακίδα να μπαίνει ούτως ή άλλως με κενό κελί σφραγίδας.
 */
export function loadStampImage(url: string | undefined): Promise<StampImage | null> {
  return stampCache.load(url);
}

/** Event-time read (κλικ / ghost / PDF). `null` όσο δεν έχει φορτώσει ή αν απέτυχε. */
export function getStampImage(url: string | undefined): StampImage | null {
  return stampCache.get(url);
}

/** Test seam — καθαρίζει το singleton μεταξύ των specs. */
export function __resetStampImageCacheForTests(): void {
  stampCache.reset();
}
