/**
 * ADR-650 M5α — elevation busts (surface-node outliers).
 *
 * The classic survey blunder: a keyed-in Z typo (312 for 31.2). Detected the robust way
 * Civil 3D/TBC do — compare each TIN node's Z with the MEDIAN Z of its triangle neighbours
 * (median, not mean, so one bad neighbour cannot drag the expectation), then flag the nodes
 * whose residual clears a MAD-based fence (`median + k·MAD` of all residuals). MAD + median
 * are outlier-resistant: a handful of real busts do not inflate the threshold the way a
 * standard deviation would, so busts stay visible instead of hiding in their own variance.
 *
 * Never edits anything — returns findings for the engineer to certify (§9).
 */

import type { TinSurface } from '../topo-types';
import type { TopoQaFlag } from './topo-qa-types';
import { TOPO_QA_CONFIG } from './topo-qa-config';
import { buildVertexAdjacency } from './topo-qa-topology';
import { nodeWorld, mmToMetreString } from './topo-qa-format';
import { median } from '../../../utils/statistics';

interface NodeResidual {
  readonly index: number;
  readonly residual: number;
  readonly expected: number;
}

/** Residual (|Z − median neighbour Z|) for every node that has at least one neighbour. */
function computeResiduals(surface: TinSurface): NodeResidual[] {
  const adjacency = buildVertexAdjacency(surface);
  const residuals: NodeResidual[] = [];
  for (let index = 0; index < surface.elevations.length; index++) {
    const neighbours = adjacency[index]!;
    if (neighbours.size === 0) continue;
    const expected = median([...neighbours].map((n) => surface.elevations[n]!));
    residuals.push({ index, residual: Math.abs(surface.elevations[index]! - expected), expected });
  }
  return residuals;
}

/** MAD-based fence, floored at the noise threshold so tiny survey scatter never flags. */
function bustThresholdMm(residuals: readonly NodeResidual[]): number {
  const values = residuals.map((r) => r.residual);
  const med = median(values);
  const mad = median(values.map((v) => Math.abs(v - med)));
  const fence = med + TOPO_QA_CONFIG.ELEVATION_BUST_MAD_MULTIPLIER * mad;
  return Math.max(TOPO_QA_CONFIG.ELEVATION_BUST_MIN_RESIDUAL_MM, fence);
}

/** All node elevation busts, most-severe first (the orchestrator applies the per-kind cap). */
export function checkElevationBusts(surface: TinSurface): TopoQaFlag[] {
  if (surface.triangles.length === 0) return [];
  const residuals = computeResiduals(surface);
  const threshold = bustThresholdMm(residuals);

  const flags: TopoQaFlag[] = residuals
    .filter((r) => r.residual > threshold)
    .sort((a, b) => b.residual - a.residual)
    .map((r) => ({
      id: `elevation-bust:${r.index}`,
      kind: 'elevation-bust' as const,
      severity: r.residual >= TOPO_QA_CONFIG.ELEVATION_BUST_HIGH_RESIDUAL_MM ? ('high' as const) : ('medium' as const),
      at: nodeWorld(surface, r.index),
      messageKey: 'topography.qa.flag.elevationBust',
      messageParams: {
        elevation: mmToMetreString(surface.elevations[r.index]!),
        expected: mmToMetreString(r.expected),
        deviation: mmToMetreString(r.residual),
      },
    }));
  return flags;
}
