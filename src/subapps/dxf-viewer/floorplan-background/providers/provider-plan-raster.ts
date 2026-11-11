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
