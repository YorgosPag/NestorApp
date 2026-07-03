/**
 * ADR-362 Round 35 — Dimension ROW partition SSoT.
 *
 * Groups ALL linear/aligned dimensions of a scene into rows (a "row" = the set of
 * dims that share ONE dim line: parallel axes + collinear dim lines — see
 * `dim-row-detect`). Feeds the «Λαβές Μετακίνησης Σειρών» handle overlay
 * (one handle per row) so the user can drag a whole stacked band perpendicular to
 * its axis without first selecting it.
 *
 * Greedy single-pass partition over the SAME `isSameDimRow` equivalence the
 * «Επιλογή σειράς» / DIMSPACE features use — no parallel grouping logic. The
 * representative frame of each bucket is the first dim placed in it (rows are
 * collinear within tolerance, so any member's frame describes the shared line).
 *
 * Pure — zero React / DOM / canvas deps. Trivially testable.
 */

import type { DimensionEntity } from '../../types/dimension';
import { extractDimLineInfo, type DimLineInfo } from './dim-line-info';
import { isSameDimRow, DEFAULT_DIM_ROW_TOLERANCE, type DimRowTolerance } from './dim-row-detect';

/** One partitioned row of collinear parallel dimensions. */
export interface DimRow {
  /** Stable key (sorted member ids) — safe as a React list key across re-partitions. */
  readonly id: string;
  /** The dimensions that make up this row (input order preserved). */
  readonly dims: readonly DimensionEntity[];
  /** Shared dim-line frame (axis dir + normal + a reference point on the line). */
  readonly info: DimLineInfo;
}

/**
 * Partition every linear/aligned dimension in `allDims` into rows. Radial /
 * angular / ordinate dims (no `DimLineInfo`) are skipped — they have no "row".
 */
export function partitionDimensionRows(
  allDims: readonly DimensionEntity[],
  tol: DimRowTolerance = DEFAULT_DIM_ROW_TOLERANCE,
): DimRow[] {
  const buckets: { info: DimLineInfo; dims: DimensionEntity[] }[] = [];

  for (const dim of allDims) {
    const info = extractDimLineInfo(dim);
    if (!info) continue;
    const bucket = buckets.find((b) => isSameDimRow(b.info, dim, tol));
    if (bucket) bucket.dims.push(dim);
    else buckets.push({ info, dims: [dim] });
  }

  return buckets.map((b) => ({
    id: b.dims.map((d) => d.id).slice().sort().join('|'),
    dims: b.dims,
    info: b.info,
  }));
}
