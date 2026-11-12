/**
 * ADR-929 Φ5 — **τα pixel του υποβάθρου**, όπως τα έχει ήδη αποκωδικοποιημένα ο provider (§6.2 #6: **μία**
 * αποκωδικοποίηση για εικόνα, TIFF και PDF). Κανένα δεύτερο fetch, κανένα δεύτερο decode.
 *
 * 🔑 **Νέο buffer σε κάθε κλήση.** Ο `createPlanAligner().align` μεταφέρει τον buffer στον Worker (zero-copy) και τον
 *   αποσπά· η αποστολή της ανάγνωσης χρειάζεται δεύτερο, ακέραιο αντίγραφο (`renderReadingViewRaster`).
 * 📏 Χώρος `raster-px` των `naturalBounds`: ίδιο πλάτος/ύψος με ό,τι ζωγραφίζει το `render`, άρα ίδιο σύστημα με το
 *   `rasterPixelToScene` (Δ3). Για PDF αυτό είναι η απόδοση ×2 του `PdfRenderer`, όχι οι μονάδες της σελίδας.
 *
 * @module subapps/dxf-viewer/floorplan-background/providers/provider-plan-raster
 */

import type { PlanRaster, RecognitionRaster } from '@/lib/geometry/raster/plan-raster';
import type { RasterRectPx } from '../../types/coordinate-space';
import type { NaturalBounds } from './types';

/** Οι πηγές που κρατούν οι providers: `OffscreenCanvas` (εικόνα, TIFF) ή `HTMLImageElement` (απόδοση PDF). */
export type DecodedRasterSource = OffscreenCanvas | HTMLImageElement;

/**
 * Τα RGBA της αποκωδικοποιημένης πηγής σε φυσικό μέγεθος, ή `null` όταν δεν υπάρχει πηγή / μηδενικό μέγεθος.
 * Το `willReadFrequently` λέει στον browser να κρατήσει τον καμβά στη CPU: η ανάγνωση είναι ο σκοπός του.
 */
export function readPlanRaster(source: DecodedRasterSource | null, bounds: NaturalBounds): PlanRaster | null {
  const width = Math.round(bounds.width);
  const height = Math.round(bounds.height);
  if (source === null || width <= 0 || height <= 0) return null;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { rgba: data, width, height };
}

/** ADR-929 §6.16 βήμα 4 — τα pixel των `naturalBounds` ως εικόνα αναγνώρισης (ίδια ανάλυση ⇒ `naturalPerRasterPx = 1`). */
export function naturalRecognitionRaster(raster: PlanRaster | null): RecognitionRaster | null {
  return raster === null ? null : { raster, naturalPerRasterPx: 1 };
}

/** Τα εγγενή pixel της πηγής (μπορεί να διαφέρουν από τα `naturalBounds`, π.χ. απόδοση PDF). */
function sourceSize(source: DecodedRasterSource): { readonly width: number; readonly height: number } {
  return source instanceof OffscreenCanvas
    ? { width: source.width, height: source.height }
    : { width: source.naturalWidth, height: source.naturalHeight };
}

/**
 * ADR-929 Δ21 (δ) βήμα 1 — **μικρογραφία μιας περιοχής** της εικόνας (PNG), για να φαίνεται η τιμή δίπλα στο τεκμήριό της.
 *
 * 🔑 Κόβει **μόνο** την περιοχή, απευθείας από την ήδη αποκωδικοποιημένη πηγή (`drawImage` με ορθογώνιο πηγής): καμία
 *   πλήρης αντιγραφή pixel όπως στο `readPlanRaster` (μια σάρωση 7696 × 7200 θα ήταν ~220 MB για κάθε μικρογραφία).
 * 🔑 `rect` σε px των `naturalBounds` (ο ίδιος χώρος με το `rasterPixelToScene`, Δ3)· μετατρέπεται στα εγγενή px της πηγής.
 * 🔑 Ποτέ μεγέθυνση: η μεγαλύτερη πλευρά ≤ `maxEdgePx`· τη μεγέθυνση στην οθόνη την κάνει ο browser.
 * `null` = χωρίς πηγή, ή περιοχή εκτός εικόνας.
 */
export async function cropPlanRegion(
  source: DecodedRasterSource | null,
  bounds: NaturalBounds,
  rect: RasterRectPx,
  maxEdgePx: number,
): Promise<Blob | null> {
  if (source === null || bounds.width <= 0 || bounds.height <= 0) return null;
  const size = sourceSize(source);
  const kx = size.width / bounds.width;
  const ky = size.height / bounds.height;
  const sx = Math.max(0, Math.floor(rect.minX * kx));
  const sy = Math.max(0, Math.floor(rect.minY * ky));
  const sw = Math.min(size.width, Math.ceil(rect.maxX * kx)) - sx;
  const sh = Math.min(size.height, Math.ceil(rect.maxY * ky)) - sy;
  if (sw <= 0 || sh <= 0) return null;
  const k = Math.min(1, maxEdgePx / Math.max(sw, sh));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k)));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: 'image/png' });
}
