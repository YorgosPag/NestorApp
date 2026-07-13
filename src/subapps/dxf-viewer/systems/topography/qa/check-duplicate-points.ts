/**
 * ADR-650 M5α — coincident survey points with incompatible elevations.
 *
 * Two shots at (almost) the same X,Y that disagree in Z are a contradiction the TIN cannot
 * honour — cdt2d keeps only the FIRST (the dedup grid in tin-builder), so the second point's
 * Z silently vanishes from the surface. Civil 3D flags these as «duplicate points»; here we
 * surface the pair and its ΔZ so the engineer decides which shot is right.
 *
 * Uses the RAW survey points (not the TIN) so the flag can name the two offending point
 * NUMBERS (#i / #j) the surveyor recognises. A uniform grid keyed at the coincidence
 * tolerance keeps it O(n) instead of O(n²) on a real survey.
 */

import type { TopoPoint } from '../topo-types';
import type { TopoQaFlag, TopoQaSeverity } from './topo-qa-types';
import { TOPO_QA_CONFIG } from './topo-qa-config';
import { mmToMetreString } from './topo-qa-format';

const { DUPLICATE_XY_TOLERANCE_MM, DUPLICATE_Z_INCOMPATIBLE_MM, DUPLICATE_Z_HIGH_MM } = TOPO_QA_CONFIG;

/** Grid cell (tolerance-sized) → indices of the points falling in it. */
function buildCellIndex(points: readonly TopoPoint[]): Map<string, number[]> {
  const cells = new Map<string, number[]>();
  points.forEach((p, i) => {
    const key = `${Math.floor(p.x / DUPLICATE_XY_TOLERANCE_MM)}:${Math.floor(p.y / DUPLICATE_XY_TOLERANCE_MM)}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(i);
    else cells.set(key, [i]);
  });
  return cells;
}

/** Candidate partners of point `i`: everything in its cell + the 8 neighbours, with j > i. */
function neighbourIndices(cells: Map<string, number[]>, points: readonly TopoPoint[], i: number): number[] {
  const cx = Math.floor(points[i]!.x / DUPLICATE_XY_TOLERANCE_MM);
  const cy = Math.floor(points[i]!.y / DUPLICATE_XY_TOLERANCE_MM);
  const out: number[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const j of cells.get(`${cx + dx}:${cy + dy}`) ?? []) if (j > i) out.push(j);
    }
  }
  return out;
}

function coincides(a: TopoPoint, b: TopoPoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= DUPLICATE_XY_TOLERANCE_MM;
}

/** All coincident-XY pairs whose Z disagrees beyond tolerance, most-severe first. */
export function checkDuplicatePoints(points: readonly TopoPoint[]): TopoQaFlag[] {
  const cells = buildCellIndex(points);
  const flags: Array<TopoQaFlag & { readonly dz: number }> = [];
  for (let i = 0; i < points.length; i++) {
    for (const j of neighbourIndices(cells, points, i)) {
      const dz = Math.abs(points[i]!.z - points[j]!.z);
      if (dz <= DUPLICATE_Z_INCOMPATIBLE_MM || !coincides(points[i]!, points[j]!)) continue;
      const severity: TopoQaSeverity = dz >= DUPLICATE_Z_HIGH_MM ? 'high' : 'medium';
      flags.push({
        id: `duplicate-point:${i}:${j}`,
        kind: 'duplicate-point',
        severity,
        at: { x: points[i]!.x, y: points[i]!.y },
        messageKey: 'topography.qa.flag.duplicatePoint',
        messageParams: { a: i + 1, b: j + 1, deviation: mmToMetreString(dz) },
        dz,
      });
    }
  }
  return flags.sort((a, b) => b.dz - a.dz).map(({ dz: _dz, ...flag }) => flag);
}
