/**
 * @fileoverview **Which unit is this survey in? — a suggestion with its evidence, never a silent guess** (ADR-920 §13.3).
 * @related ./topo-import-types (`TopoUnit`, the scale table) · @/lib/geo/greek-grid (EPSG:2100 area of use)
 *
 * Revit asks the unit every time; ArchiCAD asks too. Both are right that a unit must be CONFIRMED by the human —
 * neither tells the human what the file itself suggests. We do, and we say WHY, so the confirmation is informed:
 *
 *   1. **Greek grid** — read as metres (or millimetres), ≥ 90 % of the points fall inside the EPSG:2100 area of
 *      use. Absolute position is the strongest evidence a coordinate can carry: a plot in Greece cannot be anywhere else.
 *   2. **Extent** — local coordinates: a plot spans metres to a few kilometres. The diagonal says which unit makes
 *      that true; the band where both would be plausible returns `null` — the human decides.
 *
 * Points arrive in the FILE's units (unscaled). Planimetric points count: position, not elevation, is the evidence.
 */

import { isWithinGreekGridAreaOfUse } from '@/lib/geo/greek-grid';

import type { TopoPoint } from '../terrain-types';
import type { TopoUnit } from './topo-import-types';

export type SurveyUnitEvidence = 'greek-grid' | 'extent';

export interface SurveyUnitSuggestion {
  readonly unit: TopoUnit;
  readonly evidence: SurveyUnitEvidence;
}

/** Share of points that must sit inside the Greek grid — a stray origin point or two must not veto the file. */
const GREEK_GRID_MIN_SHARE = 0.9;

/** A plot's diagonal in METRES: from a garden plot to a large estate. Outside the band, nothing is suggested. */
const PLOT_DIAGONAL_M = { min: 2, max: 3_000 } as const;

/** File units → metres, for the units a survey table can declare. */
const METRES_PER_UNIT: Readonly<Record<TopoUnit, number>> = { m: 1, mm: 0.001, ft: 0.3048 };

function shareInGreekGrid(points: readonly TopoPoint[], metresPerUnit: number): number {
  const inside = points.filter((p) => isWithinGreekGridAreaOfUse(p.x * metresPerUnit, p.y * metresPerUnit)).length;
  return inside / points.length;
}

function diagonalOf(points: readonly TopoPoint[]): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

/** The units whose reading makes the plot's diagonal plausible. */
function unitsByExtent(points: readonly TopoPoint[]): TopoUnit[] {
  const diagonal = diagonalOf(points);
  return (['m', 'mm'] as const).filter((unit) => {
    const metres = diagonal * METRES_PER_UNIT[unit];
    return metres >= PLOT_DIAGONAL_M.min && metres <= PLOT_DIAGONAL_M.max;
  });
}

/**
 * Suggest the unit of a survey given in FILE units, or `null` when the file does not make it clear.
 * Feet are never suggested: a Greek survey is not in feet, and a foreign one is declared by its own header (DXF).
 */
export function suggestSurveyUnit(points: readonly TopoPoint[]): SurveyUnitSuggestion | null {
  if (points.length < 2) return null;

  for (const unit of ['m', 'mm'] as const) {
    if (shareInGreekGrid(points, METRES_PER_UNIT[unit]) >= GREEK_GRID_MIN_SHARE) return { unit, evidence: 'greek-grid' };
  }
  const plausible = unitsByExtent(points);
  return plausible.length === 1 ? { unit: plausible[0], evidence: 'extent' } : null;
}
