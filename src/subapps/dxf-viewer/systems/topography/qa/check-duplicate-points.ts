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

import type { TopoPoint, TopoPoint3D } from '../topo-types';
import type { TopoQaFlag, TopoQaSeverity } from './topo-qa-types';
import { TOPO_QA_CONFIG } from './topo-qa-config';
import { mmToMetreString } from './topo-qa-format';
import { hasElevation } from '../topo-point-elevation';
import { PointHashGrid } from '../../../core/spatial/PointHashGrid';

const { DUPLICATE_XY_TOLERANCE_MM, DUPLICATE_Z_INCOMPATIBLE_MM, DUPLICATE_Z_HIGH_MM } = TOPO_QA_CONFIG;

/** The flag for one confirmed coincident-XY / incompatible-Z pair (`a` at `i` is the kept shot). */
function duplicateFlag(
  a: TopoPoint3D, i: number, j: number, dz: number,
): TopoQaFlag & { readonly dz: number } {
  const severity: TopoQaSeverity = dz >= DUPLICATE_Z_HIGH_MM ? 'high' : 'medium';
  return {
    id: `duplicate-point:${i}:${j}`,
    kind: 'duplicate-point',
    severity,
    at: { x: a.x, y: a.y },
    // The FIRST shot's Z — the one the TIN dedup kept, so the 3D marker lands on the
    // surface the engineer is actually looking at (the partner's Z is in the message).
    atZMm: a.z,
    messageKey: 'topography.qa.flag.duplicatePoint',
    messageParams: { a: i + 1, b: j + 1, deviation: mmToMetreString(dz) },
    dz,
  };
}

/**
 * All coincident-XY pairs whose Z disagrees beyond tolerance, most-severe first.
 *
 * ⚠️ ADR-720 — a pair is only a contradiction when **both** shots carry an elevation. The whole
 * premise of this check is that the TIN dedup keeps the first shot's Ζ and the second's *silently
 * vanishes*; a point without a Ζ contributes no TIN vertex at all, so it loses nothing and
 * contradicts nothing. Flagging «(2D corner, spot height) at the same X,Y» would be a false
 * positive on the single most ordinary arrangement in a real survey — a boundary corner and the
 * ground shot taken at it — and a QA engine that cries wolf there stops being read.
 */
export function checkDuplicatePoints(points: readonly TopoPoint[]): TopoQaFlag[] {
  // ADR-650 §M10e boy-scout: the tolerance-keyed cell index + 3×3 neighbour walk used to be
  // hand-rolled here (one of FIVE such grids in the subapp). Same algorithm, one owner.
  // ⚠️ The grid is built over ALL points so the `j` indices it yields stay indices into the
  // caller's array — the flag ids and messages name the surveyor's own point numbers (#i / #j).
  const grid = new PointHashGrid(points, DUPLICATE_XY_TOLERANCE_MM);
  const flags: Array<TopoQaFlag & { readonly dz: number }> = [];

  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    if (!hasElevation(a)) continue;
    grid.forEachWithin(a.x, a.y, DUPLICATE_XY_TOLERANCE_MM, (j) => {
      if (j <= i) return; // each unordered pair once (and never a point against itself)
      const b = points[j]!;
      if (!hasElevation(b)) return;
      const dz = Math.abs(a.z - b.z);
      if (dz <= DUPLICATE_Z_INCOMPATIBLE_MM) return;
      flags.push(duplicateFlag(a, i, j, dz));
    });
  }

  return flags.sort((a, b) => b.dz - a.dz).map(({ dz: _dz, ...flag }) => flag);
}
