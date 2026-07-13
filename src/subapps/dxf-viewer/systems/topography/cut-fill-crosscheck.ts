/**
 * ADR-650 M6 — the second opinion (ADR-650 §7, the CASS «cross-check» practice).
 *
 * A volume report has no ground truth to check itself against: the number is either right or
 * it is confidently wrong, and nobody notices until the trucks are counted. The Chinese survey
 * suites (CASS) answer this by computing the same earthworks with a DIFFERENT method and
 * flagging a disagreement — a differentiator western suites still do not ship by default.
 *
 * The second method here is the classic GRID (mesh) method: lay a regular lattice over the
 * site, read Δz at each cell centre, and sum `cell area × Δz`. It shares NOTHING with the prism
 * method except the two surfaces — no triangles, no daylight split, no S-H clipping. So the two
 * agreeing is real evidence; the two diverging means a bug or a pathological surface, and the
 * user is told rather than sold a number.
 *
 * It is deliberately the CRUDER method: cells straddling the zero line are counted whole, so a
 * few percent of disagreement on a wrinkled site is EXPECTED and not an error. That is why the
 * output is a divergence percentage for a human to judge, never an automatic «correction».
 */

import { pointInPolygon } from '../../bim/geometry/shared/polygon-utils';
import type { TinSurface, TopoBoundary, CutFillResult } from './topo-types';
import { createTinSampler } from './tin-sampler';
import type { ElevationReference } from './cut-fill';

/** Lattice resolution — cells per axis. 100 × 100 = 10⁴ samples: instant, and fine enough. */
const GRID_CELLS_PER_AXIS = 100;

/** Above this the two methods are telling different stories → warn the user (CASS practice). */
export const CUTFILL_DIVERGENCE_WARN_PCT = 5;

export interface CutFillCrossCheck {
  readonly gridCutVolumeMm3: number;
  readonly gridFillVolumeMm3: number;
  /** |prism − grid| / prism × 100, over the TOTAL moved earth (cut + fill). */
  readonly divergencePct: number;
  /** `true` when the two methods disagree beyond {@link CUTFILL_DIVERGENCE_WARN_PCT}. */
  readonly diverges: boolean;
}

/**
 * Re-compute the earthworks with the grid method and compare against the prism result.
 * Returns `null` when there is nothing to check (empty surface, or no earth moved at all).
 */
export function crossCheckCutFill(
  ground: TinSurface,
  reference: ElevationReference,
  boundary: TopoBoundary | null | undefined,
  prism: CutFillResult,
): CutFillCrossCheck | null {
  if (ground.triangles.length === 0) return null;

  const groundSampler = createTinSampler(ground);
  const { bounds, origin } = ground;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (!(width > 0) || !(height > 0)) return null;

  const cellW = width / GRID_CELLS_PER_AXIS;
  const cellH = height / GRID_CELLS_PER_AXIS;
  const cellAreaMm2 = cellW * cellH;
  const ring = boundary && boundary.vertices.length >= 3
    ? boundary.vertices.map((p) => ({ x: p.x, y: p.y, z: 0 }))
    : null;

  let cut = 0;
  let fill = 0;

  for (let row = 0; row < GRID_CELLS_PER_AXIS; row++) {
    const worldY = origin.y + bounds.minY + (row + 0.5) * cellH;
    for (let col = 0; col < GRID_CELLS_PER_AXIS; col++) {
      const worldX = origin.x + bounds.minX + (col + 0.5) * cellW;
      if (ring && !pointInPolygon({ x: worldX, y: worldY }, ring)) continue;

      const groundZ = groundSampler.zAtMm(worldX, worldY);
      if (groundZ === null) continue; // cell centre outside the triangulated area
      const targetZ = reference.zAtMm(worldX, worldY);
      if (targetZ === null) continue; // the reference has no ground here — uncountable, not zero

      const volume = (groundZ - targetZ) * cellAreaMm2;
      if (volume > 0) cut += volume;
      else fill -= volume;
    }
  }

  const prismTotal = prism.cutVolumeMm3 + prism.fillVolumeMm3;
  if (!(prismTotal > 0)) return null;

  const divergencePct = (Math.abs(prismTotal - (cut + fill)) / prismTotal) * 100;
  return {
    gridCutVolumeMm3: cut,
    gridFillVolumeMm3: fill,
    divergencePct,
    diverges: divergencePct > CUTFILL_DIVERGENCE_WARN_PCT,
  };
}
