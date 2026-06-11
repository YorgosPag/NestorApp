/**
 * ADR-363 Slice F — Column footprint dimensions (mm) SSoT.
 *
 * THE single source of "how big is a column cross-section in plan" along its
 * local +X / +Y axes. Owns the three dim extractors that render (`transformFootprint`),
 * grips (`column-grip-utils`) and anchor-snap (`column-anchors`) all consume, so the
 * three NEVER disagree about a column's footprint (Revit = one geometry truth:
 * render == handles == insertion/anchor).
 *
 * Lives in a neutral module — NOT in `column-anchors` nor `column-grip-utils` —
 * because both of those need it and importing across them creates a circular
 * dependency (`column-grip-utils` already imports `polygonBboxMm`). A neutral owner
 * is the clean SSoT break.
 *
 * Pure: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see bim/columns/column-anchors.ts (anchor-snap consumer)
 * @see bim/columns/column-grip-utils.ts (grip-handle consumer)
 * @see bim/geometry/column-geometry.ts (render consumer — transformFootprint)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Slice F
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnParams } from '../types/column-types';
import {
  DEFAULT_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  MIN_POLYGON_SIDES,
} from '../types/column-types';

/**
 * Compute axis-aligned bbox dimensions ενός regular N-gon σε mm coords.
 * Mirror του `buildPolygonLocal` (column-geometry.ts) + `computeLocalBboxCanvas`
 * pattern, αλλά εκφρασμένο σε mm (όχι canvas units) ώστε να συμφωνεί με τα
 * mm-scoped anchor positions + grip handles.
 *
 * Vertex 0 points up (math +Y) per AutoCAD/Revit polygon default. Sides clamped
 * to [MIN_POLYGON_SIDES, MAX_POLYGON_SIDES] (3..12). Degenerate diameter ≤ 0
 * collapses bbox σε {0, 0} χωρίς exception.
 */
export function polygonBboxMm(
  diameter: number,
  sides?: number,
): { dimX: number; dimY: number } {
  const r = Math.max(0, diameter / 2);
  if (r === 0) return { dimX: 0, dimY: 0 };
  const rawSides = sides ?? DEFAULT_POLYGON_SIDES;
  const n = Math.max(MIN_POLYGON_SIDES, Math.min(MAX_POLYGON_SIDES, Math.round(rawSides)));
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const startAngle = Math.PI / 2;
  const step = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * step;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { dimX: maxX - minX, dimY: maxY - minY };
}

/**
 * Bounding-box dimensions (mm) of a polygon-backed cross-section (U-shape /
 * composite, ADR-363 Phase 2b). The polygon is bbox-centred by invariant (the
 * «από-περίγραμμα» generator + `resizePolyVertex` re-centre it), so the centre
 * is 0 and only the spans matter for the anchor shift.
 */
export function polygonBackedBboxMm(
  poly: readonly Point2D[],
): { dimX: number; dimY: number } {
  let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { dimX: maxX - minX, dimY: maxY - minY };
}

/**
 * Footprint extents (mm) along local +X / +Y per column kind — THE SSoT consumed by
 * render + grips + anchor-snap. rectangular/shear-wall/variants = `width × depth`;
 * polygon (Phase 8C) = actual N-gon bbox (`depth` meaningless, bbox depends on
 * sides); polygon-backed U-shape / composite (Phase 2b) = actual polygon bbox
 * (mirror της `transformFootprint`). Circular is handled by callers (anchor 0 /
 * rotationally symmetric).
 */
export function columnFootprintDims(params: ColumnParams): { dimX: number; dimY: number } {
  const uPoly = params.kind === 'U-shape' ? params.ushape?.polygon : undefined;
  const cPoly = params.kind === 'composite' ? params.composite?.polygon : undefined;
  if (params.kind === 'polygon') return polygonBboxMm(params.width, params.polygon?.sides);
  if (uPoly && uPoly.length >= 3) return polygonBackedBboxMm(uPoly);
  if (cPoly && cPoly.length >= 3) return polygonBackedBboxMm(cPoly);
  return { dimX: params.width, dimY: params.depth };
}
