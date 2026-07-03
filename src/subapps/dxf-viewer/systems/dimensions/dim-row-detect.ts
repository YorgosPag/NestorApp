/**
 * ADR-362 — Dimension ROW detector (SSoT for "same row" grouping).
 *
 * A "row" = the set of linear/aligned dimensions that share ONE dim line:
 * their axes are parallel AND their dim lines are collinear (lie on the same
 * infinite line). This is the chain of stacked dims the user sees as a single
 * horizontal/vertical band of measurements.
 *
 * Used by:
 *   · «Επιλογή σειράς» (double-click / ribbon button) — select the whole row.
 *   · Row group-move — offset every dim of the row together.
 *   · DIMSPACE — the natural target set when re-spacing a band.
 *
 * Geometry only (no styleId/layerId coupling) via the shared `dim-line-info`
 * frame SSoT. Orientation-agnostic: works for horizontal, vertical and rotated
 * bands alike.
 */

import type { DimensionEntity } from '../../types/dimension';
import { extractDimLineInfo, type DimLineInfo } from './dim-line-info';

/** Tuning for "same row" equivalence. */
export interface DimRowTolerance {
  /**
   * Min |dot(dirA, dirB)| for the two dim-line directions to count as parallel.
   * Default cos(1°) ≈ 0.99985 (near-exact; imported chains share the axis).
   */
  readonly parallelDot: number;
  /**
   * Max perpendicular distance (world mm) from a candidate's dim-line reference
   * to the target's dim line for them to count as collinear. Small by design so
   * two DISTINCT stacked rows (offset by ~DIMDLI×scale) are NOT merged. Default 1.
   */
  readonly collinearMm: number;
}

export const DEFAULT_DIM_ROW_TOLERANCE: DimRowTolerance = {
  parallelDot: 0.99985,
  collinearMm: 1,
};

/** Perpendicular distance from point `p` to the line through `q` with unit dir `dir`. */
function perpDistanceToLine(
  p: { x: number; y: number },
  q: { x: number; y: number },
  dir: { x: number; y: number },
): number {
  const vx = p.x - q.x;
  const vy = p.y - q.y;
  // 2D cross product magnitude = perpendicular component (dir is unit length).
  return Math.abs(vx * dir.y - vy * dir.x);
}

/** True when `candidate`'s dim line is parallel + collinear with `target`'s. */
export function isSameDimRow(
  targetInfo: DimLineInfo,
  candidate: DimensionEntity,
  tol: DimRowTolerance = DEFAULT_DIM_ROW_TOLERANCE,
): boolean {
  const info = extractDimLineInfo(candidate);
  if (!info) return false;
  const dot = targetInfo.dimDir.x * info.dimDir.x + targetInfo.dimDir.y * info.dimDir.y;
  if (Math.abs(dot) < tol.parallelDot) return false;
  // Collinear = candidate's dim-line reference sits on the target's dim line.
  const dist = perpDistanceToLine(info.dimLineRef, targetInfo.dimLineRef, targetInfo.dimDir);
  return dist <= tol.collinearMm;
}

/**
 * Collect every dimension in `allDims` that belongs to the same row as `target`
 * (including `target` itself). Returns `[target]` when `target` is not a
 * linear/aligned dim (radial/angular/etc. have no "row"). Order follows
 * `allDims` for determinism.
 */
export function collectDimensionRow(
  target: DimensionEntity,
  allDims: readonly DimensionEntity[],
  tol: DimRowTolerance = DEFAULT_DIM_ROW_TOLERANCE,
): DimensionEntity[] {
  const targetInfo = extractDimLineInfo(target);
  if (!targetInfo) return [target];

  const row: DimensionEntity[] = [];
  let includedTarget = false;
  for (const d of allDims) {
    if (d.id === target.id) {
      row.push(d);
      includedTarget = true;
      continue;
    }
    if (isSameDimRow(targetInfo, d, tol)) row.push(d);
  }
  // Guard: target may not be present in `allDims` (defensive) — ensure it is in.
  if (!includedTarget) row.unshift(target);
  return row;
}
