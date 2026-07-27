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
import { PointHashGrid } from '../../../core/spatial/PointHashGrid';

const { DUPLICATE_XY_TOLERANCE_MM, DUPLICATE_Z_INCOMPATIBLE_MM, DUPLICATE_Z_HIGH_MM } = TOPO_QA_CONFIG;

/** The flag for one confirmed coincident-XY / incompatible-Z pair (`i` is the kept shot). */
function duplicateFlag(points: readonly TopoPoint[], i: number, j: number, dz: number): TopoQaFlag & { readonly dz: number } {
  const severity: TopoQaSeverity = dz >= DUPLICATE_Z_HIGH_MM ? 'high' : 'medium';
  return {
    id: `duplicate-point:${i}:${j}`,
    kind: 'duplicate-point',
    severity,
    at: { x: points[i]!.x, y: points[i]!.y },
    // The FIRST shot's Z — the one the TIN dedup kept, so the 3D marker lands on the
    // surface the engineer is actually looking at (the partner's Z is in the message).
    atZMm: points[i]!.z,
    messageKey: 'topography.qa.flag.duplicatePoint',
    messageParams: { a: i + 1, b: j + 1, deviation: mmToMetreString(dz) },
    dz,
  };
}

/** All coincident-XY pairs whose Z disagrees beyond tolerance, most-severe first. */
export function checkDuplicatePoints(points: readonly TopoPoint[]): TopoQaFlag[] {
  // ADR-650 §M10e boy-scout: the tolerance-keyed cell index + 3×3 neighbour walk used to be
  // hand-rolled here (one of FIVE such grids in the subapp). Same algorithm, one owner.
  const grid = new PointHashGrid(points, DUPLICATE_XY_TOLERANCE_MM);
  const flags: Array<TopoQaFlag & { readonly dz: number }> = [];

  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    grid.forEachWithin(a.x, a.y, DUPLICATE_XY_TOLERANCE_MM, (j) => {
      if (j <= i) return; // each unordered pair once (and never a point against itself)
      const dz = Math.abs(a.z - points[j]!.z);
      if (dz <= DUPLICATE_Z_INCOMPATIBLE_MM) return;
      flags.push(duplicateFlag(points, i, j, dz));
    });
  }

  return flags.sort((a, b) => b.dz - a.dz).map(({ dz: _dz, ...flag }) => flag);
}
