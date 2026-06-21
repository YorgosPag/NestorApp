/**
 * ADR-507 — Hatch parametric grip handlers.
 *
 * Pure functions (zero React / DOM / Firestore / canvas deps). Mirror of
 * `bim/floor-finishes/floor-finish-grips.ts`, but the hatch is a FLAT primitive
 * (`boundaryPaths: Point2D[][]`, NO params/geometry):
 *
 *   - `hatch-vertex-${pathIdx}-${vertexIdx}` → translate boundary vertex
 *     (path 0 = outer ring, rest = island rings). XY only.
 *
 * Edge-midpoint insertion = DEFER (separate slice). Rectilinear constraint:
 * when `input.rectilinear` is true the delta is quantized to the dominant world
 * axis (Ortho / Shift-constrained), same as floor-finish.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { HatchGripKind } from '../../hooks/grip-types';

const VERTEX_PREFIX = 'hatch-vertex-';

export interface HatchGripDragInput {
  readonly originalBoundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>;
  readonly delta: Point2D;
  readonly rectilinear?: boolean;
}

/** Decode `hatch-vertex-${pathIdx}-${vertexIdx}` → `[pathIdx, vertexIdx]` or `null`. */
export function decodeHatchVertexGripKind(gripKind: HatchGripKind): [number, number] | null {
  if (!gripKind.startsWith(VERTEX_PREFIX)) return null;
  const rest = gripKind.slice(VERTEX_PREFIX.length).split('-');
  if (rest.length !== 2) return null;
  const pathIdx = parseInt(rest[0], 10);
  const vertexIdx = parseInt(rest[1], 10);
  if (!Number.isFinite(pathIdx) || !Number.isFinite(vertexIdx) || pathIdx < 0 || vertexIdx < 0) return null;
  return [pathIdx, vertexIdx];
}

/**
 * Pure transform: hatch grip kind + drag input → new `boundaryPaths`. Returns the
 * ORIGINAL array reference unchanged on out-of-range index or zero delta (no-op
 * signal the caller short-circuits on). Never mutates the input.
 */
export function applyHatchGripDrag(
  gripKind: HatchGripKind,
  input: Readonly<HatchGripDragInput>,
): Point2D[][] {
  const original = input.originalBoundaryPaths;
  const decoded = decodeHatchVertexGripKind(gripKind);
  if (!decoded) return original as Point2D[][];
  const [pathIdx, vertexIdx] = decoded;
  if (pathIdx >= original.length) return original as Point2D[][];
  const path = original[pathIdx];
  if (vertexIdx >= path.length) return original as Point2D[][];

  const delta = input.rectilinear ? quantizeToDominantAxis(input.delta) : input.delta;
  if (delta.x === 0 && delta.y === 0) return original as Point2D[][];

  // Clone only the affected ring; share the untouched rings by reference.
  return original.map((ring, p) =>
    p === pathIdx
      ? ring.map((v, i) => (i === vertexIdx ? { x: v.x + delta.x, y: v.y + delta.y } : { x: v.x, y: v.y }))
      : ring.map((v) => ({ x: v.x, y: v.y })),
  );
}

function quantizeToDominantAxis(delta: Point2D): Point2D {
  return Math.abs(delta.x) >= Math.abs(delta.y)
    ? { x: delta.x, y: 0 }
    : { x: 0, y: delta.y };
}
