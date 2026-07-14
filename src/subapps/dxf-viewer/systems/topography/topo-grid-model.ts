/**
 * ADR-656 M11 — ΕΓΣΑ87 coordinate-grid PURE MODEL (the ONE SSoT, two consumers).
 *
 * Given a world-space rectangle (canonical mm) and a round step, this returns WHICH round
 * Easting/Northing lines fall inside, their intersections (crosses), and the perimeter label
 * anchors. Both consumers derive their rectangle differently but share this math:
 *   - screen  : rect = `screenToWorld(viewport corners)` → draw crosses via `worldToScreen`,
 *               labels pinned to the viewport margin (reflow on pan/zoom).
 *   - export  : rect = points/scene bbox (padded to the step) → crosses/labels as entities.
 *
 * Round lines land on multiples of the step measured from the world origin — ADR-462 makes the
 * world origin the ΕΓΣΑ87 origin, so a line at world X = 500 000 mm IS Easting 500 m. Pure and
 * unit-testable: no store, no canvas, no side effects.
 */

import type { Point2D } from '../../rendering/types/Types';
import { SURVEY_STEP_LADDER_MM, TOPO_GRID_TARGET_SPACING_PX } from './topo-grid-config';

/** A world-space rectangle in canonical mm (min/max on each axis). */
export interface WorldRectMm {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Which edge a perimeter label sits on (drives its alignment/offset in each consumer). */
export type GridAxis = 'E' | 'N';

/** A perimeter coordinate label: the round coordinate (mm), its axis, and a world anchor. */
export interface PerimeterLabel {
  readonly coordinateMm: number;
  readonly axis: GridAxis;
  readonly worldPos: Point2D;
}

/** The computed grid for one rectangle + step. */
export interface TopoGridModel {
  readonly stepMm: number;
  /** Round Easting (world X) values, ascending, within the rectangle. */
  readonly eastings: readonly number[];
  /** Round Northing (world Y) values, ascending, within the rectangle. */
  readonly northings: readonly number[];
  /** Every line intersection, world mm. */
  readonly crosses: readonly Point2D[];
  /** One label per line: Eastings anchored on the bottom edge, Northings on the left edge. */
  readonly perimeterLabels: readonly PerimeterLabel[];
}

/** Defensive cap on lines per axis — the adaptive step keeps screen counts far below this. */
const MAX_LINES_PER_AXIS = 400;

/**
 * Pick the smallest ladder step whose on-screen spacing (`stepMm * scale`, px) is at least the
 * target — the RulerRenderer 1-2-5 adaptive-interval rule, restricted to the survey ladder.
 * `scale` is the view transform's px-per-mm; the largest step is the fallback when zoomed far out.
 */
export function pickSurveyGridStepMm(
  scale: number,
  targetSpacingPx: number = TOPO_GRID_TARGET_SPACING_PX,
): number {
  const ladder = SURVEY_STEP_LADDER_MM;
  for (const step of ladder) {
    if (step * scale >= targetSpacingPx) return step;
  }
  return ladder[ladder.length - 1];
}

/** Round values that are multiples of `stepMm` within `[min, max]`, ascending (capped). */
function roundLinesInRange(min: number, max: number, stepMm: number): number[] {
  if (!(stepMm > 0) || !Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  const first = Math.ceil(min / stepMm) * stepMm;
  const out: number[] = [];
  for (let v = first; v <= max && out.length < MAX_LINES_PER_AXIS; v += stepMm) {
    out.push(v);
  }
  return out;
}

/**
 * Build the coordinate grid for a rectangle + step: the round Easting/Northing lines inside it,
 * their crossings, and one perimeter label per line (Eastings on the bottom edge, Northings on
 * the left edge — the export edges; the screen consumer re-pins them to the viewport margin).
 */
export function buildTopoGrid(rect: WorldRectMm, stepMm: number): TopoGridModel {
  const eastings = roundLinesInRange(rect.minX, rect.maxX, stepMm);
  const northings = roundLinesInRange(rect.minY, rect.maxY, stepMm);

  const crosses: Point2D[] = [];
  for (const x of eastings) {
    for (const y of northings) crosses.push({ x, y });
  }

  const perimeterLabels: PerimeterLabel[] = [
    ...eastings.map((x): PerimeterLabel => ({ coordinateMm: x, axis: 'E', worldPos: { x, y: rect.minY } })),
    ...northings.map((y): PerimeterLabel => ({ coordinateMm: y, axis: 'N', worldPos: { x: rect.minX, y } })),
  ];

  return { stepMm, eastings, northings, crosses, perimeterLabels };
}
