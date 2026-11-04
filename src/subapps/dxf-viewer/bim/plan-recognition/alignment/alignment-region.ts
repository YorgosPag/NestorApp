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
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const originalBounds: RasterRectPx = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  return { aligned, originalQuad: corners, originalBounds };
}
