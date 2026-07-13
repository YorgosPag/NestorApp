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

const cache = new Map<string, StampImage>();
const pending = new Map<string, Promise<StampImage | null>>();

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

/**
 * Προ-φορτώνει τη σφραγίδα (idempotent· in-flight dedupe). Αποτυχία ⇒ `null` + warning, ώστε
 * η πινακίδα να μπαίνει ούτως ή άλλως με κενό κελί σφραγίδας.
 */
export async function loadStampImage(url: string | undefined): Promise<StampImage | null> {
  if (!url) return null;
  const hit = cache.get(url);
  if (hit) return hit;
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const promise = decodeStamp(url)
    .then((image) => {
      cache.set(url, image);
      pending.delete(url);
      return image;
    })
    .catch((error: unknown) => {
      pending.delete(url);
      logger.warn('Stamp image unavailable — printing an empty stamp cell', {
        error: getErrorMessage(error),
      });
      return null;
    });

  pending.set(url, promise);
  return promise;
}

/** Event-time read (κλικ / ghost / PDF). `null` όσο δεν έχει φορτώσει ή αν απέτυχε. */
export function getStampImage(url: string | undefined): StampImage | null {
  return url ? (cache.get(url) ?? null) : null;
}

/** Test seam — καθαρίζει το singleton μεταξύ των specs. */
export function __resetStampImageCacheForTests(): void {
  cache.clear();
  pending.clear();
}
