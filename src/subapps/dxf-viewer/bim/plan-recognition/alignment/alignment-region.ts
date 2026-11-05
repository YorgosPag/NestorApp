/**
 * Η γέφυρα ευθυγραμμισμένα px → αρχικά px για **περιοχές** (ADR-929 Δ3). Ένα σημείο και ένα ορθογώνιο περνούν από την
 * **ίδια** ομογραφία — κανένας δεύτερος τύπος.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/alignment-region
 */

import { applyHomography, type Homography, type PlanePoint, type Quad } from '@/lib/geometry/homography';
import type { RasterRectPx } from '../../../types/coordinate-space';
import type { AlignedRectPx, PlanRegion } from './plan-alignment-types';

/** Σημείο της ευθυγραμμισμένης εικόνας → αρχικά px. */
export function alignedPointToOriginal(point: PlanePoint, alignedToOriginal: Homography): PlanePoint {
  return applyHomography(alignedToOriginal, point.x, point.y);
}

/** Ορθογώνιο της ευθυγραμμισμένης εικόνας ⇒ περιοχή και στους δύο χώρους. */
export function planRegion(aligned: AlignedRectPx, alignedToOriginal: Homography): PlanRegion {
  const corners: Quad = [
    alignedPointToOriginal({ x: aligned.minX, y: aligned.minY }, alignedToOriginal),
    alignedPointToOriginal({ x: aligned.maxX, y: aligned.minY }, alignedToOriginal),
    alignedPointToOriginal({ x: aligned.maxX, y: aligned.maxY }, alignedToOriginal),
    alignedPointToOriginal({ x: aligned.minX, y: aligned.maxY }, alignedToOriginal),
  ];
  return { aligned, originalQuad: corners, originalBounds: rasterBoundsOf(corners) };
}

/** Το περιβάλλον ορθογώνιο σημείων των αρχικών px (πλαίσιο πηγής για «άλμα στο σημείο», Δ9). */
export function rasterBoundsOf(points: readonly PlanePoint[]): RasterRectPx {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * Η **αντίστροφη** κατεύθυνση: ορθογώνιο των αρχικών px ⇒ περιβάλλον ορθογώνιο στα ευθυγραμμισμένα (ADR-929 Φ4: τα πλαίσια
 * κειμένου της ανάγνωσης ζουν στα αρχικά px, η σύντηξη μετρά στα ευθυγραμμισμένα). Ίδια ομογραφία, ποτέ δεύτερος τύπος.
 */
export function originalRectToAligned(rect: RasterRectPx, originalToAligned: Homography): AlignedRectPx {
  const corners = [
    applyHomography(originalToAligned, rect.minX, rect.minY),
    applyHomography(originalToAligned, rect.maxX, rect.minY),
    applyHomography(originalToAligned, rect.maxX, rect.maxY),
    applyHomography(originalToAligned, rect.minX, rect.maxY),
  ];
  const b = rasterBoundsOf(corners);
  return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
}
