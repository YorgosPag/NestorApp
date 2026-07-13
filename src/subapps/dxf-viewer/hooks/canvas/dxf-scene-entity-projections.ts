/**
 * Pure geometry projections shared by the `TO_DXF_HANDLERS` arms (ADR-587 Φ5).
 *
 * Extracted out of `dxf-scene-entity-handlers.ts` when that file crossed the 500-line
 * Google limit (N.7.1 — EXTRACT, never trim). Zero behaviour change: the two helpers
 * moved verbatim, both are pure functions of their arguments with no module state.
 */

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import { rectangleEntityVertices } from '../../rendering/entities/shared/geometry-utils';
import type { DxfBaseFields } from './dxf-scene-entity-converter';

export function rectangleToVertices(e: {
  corner1?: Point2D; corner2?: Point2D;
  x?: number; y?: number; width?: number; height?: number;
  rotation?: number;
}): Point2D[] | null {
  // rotated-rectangle (ADR-620): το committed ορθογώνιο μετατρέπεται σε polyline για τον κύριο καμβά
  // — ΠΡΕΠΕΙ να σέβεται το `rotation` (pivot=corner1), αλλιώς η πληκτρολογημένη γωνία κλίσης χάνεται.
  // Entity-level SSoT (χειρίζεται corner1/corner2 ΚΑΙ x/y/w/h + rotation) — ΟΧΙ 4ο axis-aligned duplicate.
  const hasCorners = !!(e.corner1 && e.corner2);
  const hasXywh = e.x !== undefined && e.y !== undefined && e.width !== undefined && e.height !== undefined;
  if (!hasCorners && !hasXywh) return null; // πραγματικά κενή γεωμετρία → warn + skip (όπως πριν)
  return rectangleEntityVertices(e);
}

/**
 * ADR-510 Φ3b/Φ3c — κοινό polyline projection (SSoT polyline/lwpolyline): base +
 * vertices + closed, με optional per-segment bulge/width parallel arrays
 * (index-aligned) όταν υπάρχουν· absent ⇒ all-straight (back-compat).
 */
export function toPolylineUnion(
  base: DxfBaseFields,
  vertices: Point2D[],
  closed: boolean,
  arrays: { bulges?: number[]; startWidths?: number[]; endWidths?: number[] },
): DxfEntityUnion {
  return {
    ...base, type: 'polyline' as const, vertices, closed,
    ...(arrays.bulges ? { bulges: arrays.bulges } : {}),
    ...(arrays.startWidths ? { startWidths: arrays.startWidths } : {}),
    ...(arrays.endWidths ? { endWidths: arrays.endWidths } : {}),
  } as DxfEntityUnion;
}
