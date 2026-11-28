/**
 * @fileoverview **ΕΙΚΟΝΑ ΑΠΟ URL ⇒ PIXEL RGBA** — λήψη, αποκωδικοποίηση και ανάγνωση pixel, **και μέσα σε Web Worker** (ADR-884
 * Φ2στ-γ Γ3γ-2α · §4.14). Χωρίς `document` όπου υπάρχει `OffscreenCanvas`.
 * @related `lib/spatial-tour/space-detect/space-detect-host.ts` (ο πρώτος καλών — η κάτοψη της ανίχνευσης χώρων)
 * @module lib/media/image-pixels
 *
 * 🔒 **Μόνο ίδια προέλευση**: ένα `getImageData` σε εικόνα άλλης προέλευσης χωρίς CORS «μολύνει» τον καμβά και πετά. Η κάτοψη
 *   σερβίρεται από τη δική μας διαδρομή μέσων — γι' αυτό η ανίχνευση ζητά το **παράγωγο**, ποτέ ξένο URL.
 * 🔑 **Εκτός κύριου νήματος**: `fetch` + `createImageBitmap` + `OffscreenCanvas` τρέχουν όλα σε Worker — η αποκωδικοποίηση μιας
 *   κάτοψης 2048 px δεν παγώνει ποτέ την οθόνη. Ο κύριος νήμας (δίχτυ) χρησιμοποιεί τον ίδιο δρόμο, ή `<canvas>` αν λείπει.
 */

import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';

/**
 * Τα pixel μιας εικόνας όπως τα δίνει το `getImageData`: **το ίδιο** `PlanRaster` (ADR-929 §6.1 #5), στενεμένο στον
 * `Uint8ClampedArray` που πράγματι επιστρέφει ο browser. Δεύτερος ανεξάρτητος τύπος για το ίδιο buffer δεν υπάρχει.
 */
export interface ImagePixels extends PlanRaster {
  readonly rgba: Uint8ClampedArray;
}

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function context2d(width: number, height: number): Context2D {
  if (typeof OffscreenCanvas !== 'undefined') {
    const context = new OffscreenCanvas(width, height).getContext('2d');
    if (context !== null) return context;
  }
  if (typeof document === 'undefined') throw new Error('image-pixels-no-canvas');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('image-pixels-no-canvas');
  return context;
}

/**
 * Οι επιλογές για εικόνα που κουβαλά **δεδομένα**, όχι χρώμα (π.χ. πλακίδιο υψομέτρου Terrarium): καμία μετατροπή
 * χρωματικού χώρου, κανένας πολλαπλασιασμός με το άλφα (ADR-920 §14.12 Β4).
 */
export const RAW_IMAGE_BITMAP_OPTIONS: ImageBitmapOptions = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };

/** **Κατέβασε και διάβασε** τα pixel μιας εικόνας ίδιας προέλευσης. Πετά με ονομασμένο μήνυμα σε κάθε αποτυχία. */
export async function fetchImagePixels(url: string, signal?: AbortSignal): Promise<ImagePixels> {
  const response = await fetch(url, { credentials: 'same-origin', signal });
  if (!response.ok) throw new Error(`image-pixels-http-${response.status}`);
  return decodeImagePixels(await response.blob());
}

/**
 * **Αποκωδικοποίησε και διάβασε** τα pixel μιας εικόνας που είναι ήδη στη μνήμη. `options` = οι επιλογές του
 * `createImageBitmap`· για εικόνα-δεδομένα πέρασε {@link RAW_IMAGE_BITMAP_OPTIONS}.
 */
export async function decodeImagePixels(blob: Blob, options?: ImageBitmapOptions): Promise<ImagePixels> {
  const bitmap = await (options === undefined ? createImageBitmap(blob) : createImageBitmap(blob, options));
  try {
    const { width, height } = bitmap;
    const context = context2d(width, height);
    context.drawImage(bitmap, 0, 0);
    return { rgba: context.getImageData(0, 0, width, height).data, width, height };
  } finally {
    bitmap.close();
  }
}

/** Πλευρά του δείγματος ελέγχου — όσο της MapLibre (`isOffscreenCanvasDistorted`) και του maplibre-contour. */
const FIDELITY_PROBE_SIDE_PX = 5;

let faithful: boolean | null = null;

function probeCanvasFidelity(): boolean {
  const side = FIDELITY_PROBE_SIDE_PX;
  const written = new Uint8ClampedArray(side * side * 4);
  for (let i = 0; i < written.length; i++) written[i] = i % 4 === 3 ? 255 : (i * 37 + 11) % 256;
  const context = context2d(side, side);
  context.putImageData(new ImageData(written, side, side), 0, 0);
  const read = context.getImageData(0, 0, side, side).data;
  return written.every((byte, i) => read[i] === byte);
}

/**
 * **Διαβάζει ο καμβάς τα pixel όπως γράφτηκαν;** Ορισμένοι browsers αλλοιώνουν σκόπιμα το `getImageData` ως προστασία από
 * δακτυλικό αποτύπωμα (Safari με αυξημένη προστασία, Firefox `resistFingerprinting`, Brave). Σε φωτογραφία δεν φαίνεται· σε
 * εικόνα-**δεδομένα** (ύψη γραμμένα σε bytes) είναι λάθος τιμές. Ο έλεγχος γράφει ένα γνωστό δείγμα και το διαβάζει πίσω —
 * το ίδιο κάνουν η MapLibre και το maplibre-contour (ADR-920 §14.12 Β4). Μία φορά ανά νήμα· χωρίς καμβά ⇒ `false`.
 */
export function canvasReadsPixelsFaithfully(): boolean {
  if (faithful === null) {
    try {
      faithful = probeCanvasFidelity();
    } catch {
      faithful = false;
    }
  }
  return faithful;
}
