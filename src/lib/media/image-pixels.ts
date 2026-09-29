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

/** Τα pixel μιας εικόνας όπως τα δίνει το `getImageData` (RGBA, γραμμή-προς-γραμμή). */
export interface ImagePixels {
  readonly rgba: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
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

/** **Κατέβασε και διάβασε** τα pixel μιας εικόνας ίδιας προέλευσης. Πετά με ονομασμένο μήνυμα σε κάθε αποτυχία. */
export async function fetchImagePixels(url: string, signal?: AbortSignal): Promise<ImagePixels> {
  const response = await fetch(url, { credentials: 'same-origin', signal });
  if (!response.ok) throw new Error(`image-pixels-http-${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const { width, height } = bitmap;
    const context = context2d(width, height);
    context.drawImage(bitmap, 0, 0);
    return { rgba: context.getImageData(0, 0, width, height).data, width, height };
  } finally {
    bitmap.close();
  }
}
