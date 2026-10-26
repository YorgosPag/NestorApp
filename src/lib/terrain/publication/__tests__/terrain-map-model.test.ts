/**
 * ADR-920 Β4.8 — the 2D terrain map model.
 *
 * Fixtures are REAL snapshots (`buildListingTerrainSnapshot`) of a 20 m × 20 m plot at ΕΓΣΑ'87 magnitudes, so every
 * expectation is derivable by hand from the plane that built it:
 *   - `PLANE`: rises 10 % to the east from 120 m ⇒ one slope class (5–15 %), contours every 0.1 m running north–south,
 *     the index contour of level z at x = 10·(z − 120) − 10 m in the snapshot frame.
 *   - `STEP_PLOT`: flat for x ≤ 15 m (5 m grid), then 20 % (1 m grid) ⇒ 75 % / 25 % of the AREA, but 24 / 40 triangles.
 */

import type { TopoPoint } from '@/lib/terrain/terrain-types';
import { buildListingTerrainSnapshot } from '../listing-terrain-snapshot';
import type { ListingTerrainContour, ListingTerrainSnapshot } from '../listing-terrain-types';
import { contourLabelsOf, labelLengthM } from '../terrain-map-contours';
import { scaleBarParts } from '../terrain-map-furniture';
import { LEGIBLE_SCREEN_TEXT_MIN_PX } from '@/lib/media/legible-screen-text';
import { terrainMapModelOf, terrainMapWidthClassOf } from '../terrain-map-model';
import { meshTriangles, sparseAreaPathData } from '../terrain-map-regions';

const E0 = 400_000_000;
const N0 = 4_200_000_000;

function snapshotOf(points: TopoPoint[]): ListingTerrainSnapshot {
  const result = buildListingTerrainSnapshot({ points, boundaryWorldMm: null, envelope: null });
  if (!result.ok) throw new Error(`expected a snapshot, got ${result.reason}`);
  return result.snapshot;
}

function gridOf(xsM: readonly number[], ysM: readonly number[], zMmAt: (xM: number) => number): TopoPoint[] {
  return xsM.flatMap((x) => ysM.map((y) => ({ x: E0 + x * 1000, y: N0 + y * 1000, z: zMmAt(x) })));
}

const every = (from: number, to: number, step: number): number[] =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

const PLANE = snapshotOf(gridOf(every(0, 20, 2), every(0, 20, 2), (x) => 120_000 + 100 * x));
const STEP_PLOT = snapshotOf(
  gridOf([...every(0, 15, 5), ...every(16, 20, 1)], every(0, 20, 5), (x) => (x <= 15 ? 120_000 : 120_000 + 200 * (x - 15))),
);

/** Every `x y` pair of a path data string. */
function pathPoints(pathData: string): { x: number; y: number }[] {
  const numbers = (pathData.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  return Array.from({ length: numbers.length / 2 }, (_, i) => ({ x: numbers[2 * i], y: numbers[2 * i + 1] }));
}

describe('terrainMapModelOf — frame', () => {
  it('SVG y points DOWN: the snapshot is north-up, so north (+y) becomes −y', () => {
    const model = terrainMapModelOf(PLANE, [{ x: -10, y: -10, kind: 'conflicting' }]);
    expect(model.marks).toEqual([{ x: -10, y: 10, kind: 'conflicting' }]);
  });

  it('the view box is the surface plus a margin of 10 % of its longer side', () => {
    expect(terrainMapModelOf(PLANE).viewBox).toEqual({ minX: -12, minY: -12, width: 24, height: 24, margin: 2 });
  });

  it('the extent is ONE ring around the surface — no interior edge leaks into it', () => {
    const points = pathPoints(terrainMapModelOf(PLANE).extentPathData);
    expect((terrainMapModelOf(PLANE).extentPathData.match(/M/g) ?? []).length).toBe(1);
    for (const p of points) expect(Math.abs(p.x) === 10 || Math.abs(p.y) === 10).toBe(true);
  });

  it('no boundary on a points-only source (Β4): the map says «survey extent», never «plot boundary»', () => {
    expect(terrainMapModelOf(PLANE).boundaryPathData).toBeNull();
  });

  it('is deterministic: the same snapshot gives the same model', () => {
    expect(JSON.stringify(terrainMapModelOf(PLANE))).toBe(JSON.stringify(terrainMapModelOf(PLANE)));
  });
});

describe('terrainMapModelOf — slope classes', () => {
  it('lists the full scale, empty classes included, with their ranges', () => {
    const regions = terrainMapModelOf(PLANE).slopeRegions;
    expect(regions.map((r) => [r.fromPct, r.toPct])).toEqual([[0, 5], [5, 15], [15, 25], [25, null]]);
    expect(regions.map((r) => r.areaShare)).toEqual([0, 1, 0, 0]);
    expect(regions.map((r) => r.pathData.length > 0)).toEqual([false, true, false, false]);
  });

  it('the share is of AREA, not of triangles (75 % flat over 24 triangles, 25 % steep over 40)', () => {
    const regions = terrainMapModelOf(STEP_PLOT).slopeRegions;
    expect(regions[0].areaShare).toBeCloseTo(0.75, 9);
    expect(regions[2].areaShare).toBeCloseTo(0.25, 9);
    expect(regions.reduce((sum, r) => sum + r.areaShare, 0)).toBeCloseTo(1, 9);
  });

  it('each class region stays on its own side of the break (x = 15 m ⇒ 5 m in the frame)', () => {
    const [flat, , steep] = terrainMapModelOf(STEP_PLOT).slopeRegions;
    expect(Math.max(...pathPoints(flat.pathData).map((p) => p.x))).toBe(5);
    expect(Math.min(...pathPoints(steep.pathData).map((p) => p.x))).toBe(5);
  });
});

describe('sparse area — interpolation, not survey', () => {
  it('a regular survey has none', () => {
    expect(terrainMapModelOf(PLANE).sparsePathData).toBeNull();
  });

  it('a lone far point spans unmeasured ground; the factor decides', () => {
    const far = snapshotOf([...gridOf(every(0, 20, 2), every(0, 20, 2), () => 120_000), { x: E0 + 60_000, y: N0 + 10_000, z: 120_000 }]);
    const triangles = meshTriangles(far.mesh);
    expect(sparseAreaPathData(far.mesh, triangles)).not.toBeNull();
    expect(sparseAreaPathData(far.mesh, triangles, 1e9)).toBeNull();
  });
});

describe('contours and their labels', () => {
  const model = terrainMapModelOf(PLANE);

  it('minor and index contours are one path each', () => {
    expect(model.minorContoursPathData.length).toBeGreaterThan(0);
    expect(model.majorContoursPathData.length).toBeGreaterThan(0);
    expect(model.contourIntervalM).toBe(0.1);
    // Index spacing = interval × majorEvery (the legend and caption name it).
    expect(model.majorContourIntervalM).toBe(0.5);
    expect(PLANE.contourMajorEvery).toBe(5);
  });

  it('index labels sit ON their line: level z at x = 10·(z − 120) − 10', () => {
    for (const level of [120.5, 121, 121.5]) {
      const label = model.contourLabels.find((l) => l.levelM === level);
      expect(label).toBeDefined();
      expect(label?.x).toBeCloseTo(10 * (level - 120) - 10, 1);
    }
  });

  const line = (levelM: number, points: number[]): ListingTerrainContour => ({ levelM, major: true, closed: false, points });

  it('a label always reads upright, whatever way the line was walked', () => {
    const [label] = contourLabelsOf([line(124, [10, 0, -10, 0])], 1);
    expect(label.angleDeg).toBe(0);
    const [diagonal] = contourLabelsOf([line(124, [10, -10, -10, 10])], 1);
    expect(diagonal.angleDeg).toBe(45);
  });

  it('a label takes the STRAIGHTEST stretch: past the zigzag, on the straight leg', () => {
    const [label] = contourLabelsOf([line(124, [0, 0, 1, 1, 2, 0, 3, 1, 4, 0, 14, 0])], 1);
    expect(label.x).toBeGreaterThan(4);
    expect(label.y).toBe(0);
  });

  it('no label on a line shorter than the label, and none over another label', () => {
    expect(contourLabelsOf([line(124, [0, 0, labelLengthM(124, 1) * 0.9, 0])], 1)).toEqual([]);
    const crowded = contourLabelsOf([line(124, [0, 0, 20, 0]), line(125, [0, 0.5, 20, 0.5])], 1);
    expect(crowded.map((l) => l.levelM)).toEqual([124]);
  });
});

describe('furniture — north arrow and 1-2-5 scale bar', () => {
  const model = terrainMapModelOf(PLANE);

  it('the bar spans the 1-2-5 length nearest a quarter of the width (24 m ⇒ 6 ⇒ 5 m)', () => {
    expect(model.scaleBar.lengthM).toBe(5);
    expect(model.scaleBar.parts).toBe(5);
  });

  it('every part is a 1-2-5 number too', () => {
    expect([0.2, 1, 2, 5, 10, 20, 50, 2000].map(scaleBarParts)).toEqual([4, 5, 4, 5, 5, 4, 5, 4]);
  });

  it('arrow and bar live in the margin, never over the ground', () => {
    const { viewBox, northArrow, scaleBar } = model;
    for (const p of pathPoints(northArrow.pathData)) expect(p.y).toBeLessThan(viewBox.minY + viewBox.margin);
    expect(northArrow.letter.y).toBeGreaterThan(viewBox.minY);
    expect(scaleBar.y).toBeGreaterThan(viewBox.minY + viewBox.height - viewBox.margin);
  });
});

describe('on a screen — labels in screen pixels (§13.8 decision 4, Β4.8 5γ)', () => {
  it('the width is floored to its class · not measured ⇒ null · below the first class ⇒ the first', () => {
    expect([0, Number.NaN, 300, 320, 479, 480, 700, 959, 2000].map(terrainMapWidthClassOf))
      .toEqual([null, null, 320, 320, 320, 480, 640, 640, 960]);
  });

  it('never below the legible floor on screen — and the labels are placed for the height actually drawn', () => {
    const paper = terrainMapModelOf(PLANE);
    const narrow = terrainMapModelOf(PLANE, [], { widthPx: 320 });
    const pxPerM = 320 / narrow.viewBox.width;
    expect(paper.labelHeightM * pxPerM).toBeLessThan(LEGIBLE_SCREEN_TEXT_MIN_PX);
    expect(narrow.labelHeightM * pxPerM).toBeGreaterThanOrEqual(LEGIBLE_SCREEN_TEXT_MIN_PX - 0.01);
    expect(narrow.contourLabels).toEqual(contourLabelsOf(PLANE.contours, narrow.labelHeightM));
  });

  it('wide enough ⇒ the drawing’s own proportion, exactly as on paper', () => {
    expect(terrainMapModelOf(PLANE, [], { widthPx: 960 })).toEqual(terrainMapModelOf(PLANE));
  });
});
