/**
 * ADR-363 Phase 2b — Polygon-backed column per-vertex grip handlers
 * (U-shape «από περίγραμμα» + composite).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Provides the
 * per-vertex editing path for polygon-backed cross-sections, mirror του
 * `bim/slabs/slab-grips.ts` outline-vertex pattern. The base width/depth grips
 * are NO-OPs for polygon-backed kinds (`buildUshapeLocal`/`buildCompositeLocal`
 * ignore width/depth when a polygon is present), so each polygon vertex gets its
 * own grip instead (the vertex index travels encoded in the `column-poly-vertex-
 * ${n}` grip-kind string — see `hooks/grip-types.ts`).
 *
 * SSoT:
 *   - Geometry math via `computeColumnGeometry()` (called by
 *     `UpdateColumnParamsCommand` at commit time — this module returns ONLY new
 *     `ColumnParams`).
 *   - World ↔ local frame primitives από `column-grip-utils.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 2b
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnParams } from '../types/column-types';
import {
  localToWorld,
  polygonBackedBboxMm,
  projectDeltaToLocal,
  rotate,
} from './column-grip-utils';
import { mmScaleFor } from '../../utils/scene-units';
import type { ColumnGripDragInput } from './column-grips';

/**
 * Το ακριβές polygon (LOCAL mm, bbox-centered, CCW) ενός polygon-backed τοιχίου,
 * ή `undefined` αν το kind δεν είναι polygon-backed / λείπει το polygon.
 */
export function columnPolygon(params: ColumnParams): readonly Point2D[] | undefined {
  if (params.kind === 'U-shape') return params.ushape?.polygon;
  if (params.kind === 'composite') return params.composite?.polygon;
  return undefined;
}

/**
 * World position της κορυφής `index` ενός polygon-backed τοιχίου. `localToWorld`
 * εφαρμόζει centroid + rotation + scale (ADR-397), ίδιο SSoT με τη γεωμετρία.
 */
export function polyVertexHandlePosition(params: ColumnParams, index: number): Point2D {
  const poly = columnPolygon(params);
  if (!poly || index < 0 || index >= poly.length) return localToWorld({ x: 0, y: 0 }, params);
  return localToWorld(poly[index], params);
}

/**
 * Μετακίνηση μίας κορυφής polygon-backed διατομής (ADR-363 Phase 2b). Σέρνει
 * ΜΟΝΟ τη συγκεκριμένη κορυφή (οι υπόλοιπες μένουν οπτικά στη θέση τους).
 *
 * Pipeline (διατηρεί το invariant «polygon bbox-centered»):
 *   1. patch κορυφή `index` κατά το local mm delta (`projectDeltaToLocal ÷ s`).
 *   2. re-center το polygon στο νέο bbox-center.
 *   3. compensate `position` κατά `rotate(center·s)` ώστε οι μη-συρόμενες
 *      κορυφές να μη «πηδήξουν» (WYSIWYG, ισχύει για κάθε anchor).
 *   4. refresh `width`/`depth` = νέες διαστάσεις bbox (panel truthfulness).
 *
 * Geometry δεν υπολογίζεται εδώ — ο `UpdateColumnParamsCommand` τρέχει το
 * `computeColumnGeometry()`. Non-polygon-backed / out-of-range index: no-op.
 */
export function resizePolyVertex(
  input: Readonly<ColumnGripDragInput>,
  index: number,
): ColumnParams {
  const { originalParams, delta } = input;
  const poly = columnPolygon(originalParams);
  if (!poly || index < 0 || index >= poly.length) return originalParams;
  const s = mmScaleFor(originalParams);
  const { dxLocal, dyLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const moved: Point2D[] = poly.map((p, i) =>
    i === index ? { x: p.x + dxLocal / s, y: p.y + dyLocal / s } : { x: p.x, y: p.y },
  );
  // Re-center to bbox centre + compensate position so untouched vertices stay put.
  let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
  for (const p of moved) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const centered: Point2D[] = moved.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  const { dimX, dimY } = polygonBackedBboxMm(centered);
  const worldShift = rotate({ x: cx * s, y: cy * s }, originalParams.rotation);
  const next: ColumnParams = {
    ...originalParams,
    position: {
      x: originalParams.position.x + worldShift.x,
      y: originalParams.position.y + worldShift.y,
      z: originalParams.position.z ?? 0,
    },
    width: dimX,
    depth: dimY,
  };
  return originalParams.kind === 'composite'
    ? { ...next, composite: { polygon: centered } }
    : { ...next, ushape: { ...originalParams.ushape, polygon: centered } };
}
