/**
 * 🏢 DXF INSERT → plan placement — the ONE reading of 10/20/30 · 41/42/43 · 50 · 44/45 (ADR-635 Φ C.30).
 *
 * Every consumer places a block as `position + Rot(rotation) · Scale(sx,sy) · (p − base)`: the exploded members, the
 * kept `BlockEntity`, and the R12 hatch reconstruction. They used to each read the record, so all three ignored the
 * 210 at once. An INSERT is an OCS entity: its point, its angle and the axes its scale runs along all belong to the
 * plane of N, so the file's numbers describe `OCS→WCS ∘ T(i) ∘ Rot(θ) ∘ Scale`. This module re-expresses that map in
 * the plan terms the scene speaks — the formula above stays the only placement formula in the viewer.
 *
 * How: the block's own Y axis, after Rot(θ) and OCS→WCS, gives the plan rotation; the block's X axis then gives a
 * SIGNED X scale along it. For N = (0,0,−1) that is exactly `position (−ix, iy) · rotation −θ · sx → −sx` — a block
 * mirrored in X, the same shape as an INSERT with a negative 41, which every downstream path already handles.
 * A tilted N foreshortens: the plan scale is the true projected length, and the shear a tilted rotated block would
 * need has no place in `Rot · Scale`, so it is dropped. A plane containing Z has no Y axis to read — X is used.
 */

import type { Point2D } from '../rendering/types/Types';
import {
  dxfOcsToWcs,
  dxfRealOr,
  isDefaultDxfExtrusion,
  readDxfExtrusion,
  type DxfVec3,
} from '@/lib/dxf/dxf-ocs';

export interface DxfInsertPlacement {
  /** Plan position (WCS). */
  readonly position: Point2D;
  /** WCS Z of the insertion point. */
  readonly z: number;
  /** Plan X/Y scale along the rotated axes (negative = mirrored), and the Z scale along world Z. */
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  /** Plan rotation, degrees. */
  readonly rotation: number;
  /** MINSERT spacing along the rotated X / Y axes, in the same terms as `sx` / `sy`. */
  readonly columnSpacing: number;
  readonly rowSpacing: number;
}

const DEGENERATE_LENGTH = 1e-12;

/** A unit direction of the block, Rot(θ) applied, as a plan vector. */
function planAxis(angleRad: number, extrusion: DxfVec3): Point2D {
  const world = dxfOcsToWcs({ x: Math.cos(angleRad), y: Math.sin(angleRad), z: 0 }, extrusion);
  return { x: world.x, y: world.y };
}

/** Plan rotation (radians) + the X / Y foreshortening of the block axes — the decomposition in the header. */
function planFrame(thetaRad: number, extrusion: DxfVec3): { rotation: number; lengthX: number; lengthY: number } {
  const xAxis = planAxis(thetaRad, extrusion);
  const yAxis = planAxis(thetaRad + Math.PI / 2, extrusion);
  const lengthY = Math.hypot(yAxis.x, yAxis.y);
  if (lengthY < DEGENERATE_LENGTH) {
    return { rotation: Math.atan2(xAxis.y, xAxis.x), lengthX: Math.hypot(xAxis.x, xAxis.y), lengthY: 0 };
  }
  const rotation = Math.atan2(yAxis.y, yAxis.x) - Math.PI / 2;
  return { rotation, lengthX: xAxis.x * Math.cos(rotation) + xAxis.y * Math.sin(rotation), lengthY };
}

/** The INSERT record → its placement in the plan. Default extrusion: the numbers exactly as written. */
export function readInsertPlacement(data: Readonly<Record<string, string>>): DxfInsertPlacement {
  const x = dxfRealOr(data['10'], 0);
  const y = dxfRealOr(data['20'], 0);
  const z = dxfRealOr(data['30'], 0);
  const sx = dxfRealOr(data['41'], 1);
  const sy = dxfRealOr(data['42'], 1);
  const sz = dxfRealOr(data['43'], 1);
  const rotation = dxfRealOr(data['50'], 0);
  const columnSpacing = dxfRealOr(data['44'], 0);
  const rowSpacing = dxfRealOr(data['45'], 0);

  const extrusion = readDxfExtrusion(data);
  if (isDefaultDxfExtrusion(extrusion)) {
    return { position: { x, y }, z, sx, sy, sz, rotation, columnSpacing, rowSpacing };
  }

  const world = dxfOcsToWcs({ x, y, z }, extrusion);
  const frame = planFrame((rotation * Math.PI) / 180, extrusion);
  return {
    position: { x: world.x, y: world.y },
    z: world.z,
    sx: sx * frame.lengthX,
    sy: sy * frame.lengthY,
    sz: sz * extrusion.z,
    rotation: (frame.rotation * 180) / Math.PI,
    columnSpacing: columnSpacing * frame.lengthX,
    rowSpacing: rowSpacing * frame.lengthY,
  };
}
