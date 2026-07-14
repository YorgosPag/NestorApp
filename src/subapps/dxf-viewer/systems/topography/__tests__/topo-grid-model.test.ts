/**
 * ADR-656 M11 — topo-grid-model pure math tests.
 */

import {
  buildTopoGrid,
  pickSurveyGridStepMm,
  type WorldRectMm,
} from '../topo-grid-model';
import { SURVEY_STEP_LADDER_MM, TOPO_GRID_TARGET_SPACING_PX } from '../topo-grid-config';

describe('pickSurveyGridStepMm (1-2-5 survey ladder)', () => {
  it('picks the smallest step whose on-screen spacing meets the target', () => {
    // Scale where 50 m spans ~150 px (clears the target) while 20 m spans only ~60 px (below it),
    // so 50 m is the smallest qualifying step. (Avoids the FP-fragile exact-boundary scale.)
    const scale = 150 / 50_000;
    expect(pickSurveyGridStepMm(scale)).toBe(50_000);
  });

  it('grows the step as the view zooms out (smaller scale)', () => {
    const zoomedIn = pickSurveyGridStepMm(TOPO_GRID_TARGET_SPACING_PX / 10_000);
    const zoomedOut = pickSurveyGridStepMm(TOPO_GRID_TARGET_SPACING_PX / 500_000);
    expect(zoomedOut).toBeGreaterThan(zoomedIn);
  });

  it('falls back to the largest ladder step when zoomed extremely far out', () => {
    expect(pickSurveyGridStepMm(1e-12)).toBe(SURVEY_STEP_LADDER_MM[SURVEY_STEP_LADDER_MM.length - 1]);
  });
});

describe('buildTopoGrid (round lines within a rectangle)', () => {
  // A 240 m × 130 m plot starting at a non-round corner, step 50 m.
  const rect: WorldRectMm = { minX: 130_000, minY: 40_000, maxX: 370_000, maxY: 170_000 };
  const STEP = 50_000;

  it('includes only round multiples of the step inside the rectangle', () => {
    const grid = buildTopoGrid(rect, STEP);
    expect(grid.eastings).toEqual([150_000, 200_000, 250_000, 300_000, 350_000]);
    expect(grid.northings).toEqual([50_000, 100_000, 150_000]);
  });

  it('produces one cross per Easting×Northing intersection', () => {
    const grid = buildTopoGrid(rect, STEP);
    expect(grid.crosses).toHaveLength(grid.eastings.length * grid.northings.length);
    expect(grid.crosses).toContainEqual({ x: 200_000, y: 100_000 });
  });

  it('anchors one perimeter label per line — Eastings on the bottom edge, Northings on the left', () => {
    const grid = buildTopoGrid(rect, STEP);
    expect(grid.perimeterLabels).toHaveLength(grid.eastings.length + grid.northings.length);
    const e = grid.perimeterLabels.find((l) => l.axis === 'E' && l.coordinateMm === 250_000);
    expect(e?.worldPos).toEqual({ x: 250_000, y: rect.minY });
    const n = grid.perimeterLabels.find((l) => l.axis === 'N' && l.coordinateMm === 100_000);
    expect(n?.worldPos).toEqual({ x: rect.minX, y: 100_000 });
  });

  it('returns empty arrays for a degenerate/inverted rectangle', () => {
    const grid = buildTopoGrid({ minX: 10, minY: 10, maxX: 5, maxY: 5 }, STEP);
    expect(grid.eastings).toEqual([]);
    expect(grid.northings).toEqual([]);
    expect(grid.crosses).toEqual([]);
    expect(grid.perimeterLabels).toEqual([]);
  });
});
