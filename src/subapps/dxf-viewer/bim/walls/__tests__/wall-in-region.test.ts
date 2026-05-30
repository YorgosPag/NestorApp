/**
 * ADR-363 Phase 1K — «Τοίχος σε περιοχή (4 γραμμές)» geometry SSoT tests.
 *
 * Covers: rectangle detection from independent segments (axis-aligned / rotated /
 * reversed endpoints / near-tolerance gaps / open chains / parallelograms /
 * extra noise lines), enclosing-rectangle pick (inside / outside / nested), and
 * the filling-wall build (centered axis, length = long side, thickness = short).
 */

import type { WallEntity } from '../../types/wall-types';
import type { Entity, LineEntity } from '../../../types/entities';
import {
  extractLineSegments,
  findRectanglesFromSegments,
  findEnclosingRectangle,
  buildWallFillingRect,
  type RegionLineSeg,
} from '../wall-in-region';

const SU = 'mm' as const;
const LEVEL = '0';
const TOL = 5;

/** 4 segments of an axis-aligned rectangle (corners CCW), edge order shuffled +
 *  some endpoints reversed to prove orientation-independence. */
function rectSegments(w: number, h: number): RegionLineSeg[] {
  return [
    { start: { x: 0, y: 0 }, end: { x: w, y: 0 } }, // bottom
    { start: { x: w, y: h }, end: { x: w, y: 0 } }, // right (reversed)
    { start: { x: 0, y: h }, end: { x: w, y: h } }, // top
    { start: { x: 0, y: 0 }, end: { x: 0, y: h } }, // left
  ];
}

describe('wall-in-region — findRectanglesFromSegments', () => {
  it('detects one rectangle from 4 independent segments (any order / reversed)', () => {
    const rects = findRectanglesFromSegments(rectSegments(5000, 3000), TOL);
    expect(rects).toHaveLength(1);
    expect(rects[0].longSide).toBeCloseTo(5000, 3);
    expect(rects[0].shortSide).toBeCloseTo(3000, 3);
    expect(rects[0].area).toBeCloseTo(15_000_000, 0);
  });

  it('detects a rotated (45°) rectangle', () => {
    // Square rotated 45°, corners on the axes.
    const segs: RegionLineSeg[] = [
      { start: { x: 1000, y: 0 }, end: { x: 0, y: 1000 } },
      { start: { x: 0, y: 1000 }, end: { x: 1000, y: 2000 } },
      { start: { x: 1000, y: 2000 }, end: { x: 2000, y: 1000 } },
      { start: { x: 2000, y: 1000 }, end: { x: 1000, y: 0 } },
    ];
    const rects = findRectanglesFromSegments(segs, TOL);
    expect(rects).toHaveLength(1);
    expect(rects[0].longSide).toBeCloseTo(rects[0].shortSide, 3); // square
  });

  it('merges near-tolerance endpoint gaps into the same corner', () => {
    const segs = rectSegments(4000, 4000);
    // Nudge one shared endpoint by < TOL — must still close.
    segs[0] = { start: { x: -2, y: 1 }, end: { x: 4000, y: 0 } };
    const rects = findRectanglesFromSegments(segs, TOL);
    expect(rects).toHaveLength(1);
  });

  it('returns [] for an open chain (only 3 sides)', () => {
    expect(findRectanglesFromSegments(rectSegments(5000, 3000).slice(0, 3), TOL)).toHaveLength(0);
  });

  it('returns [] for a closed parallelogram (no right angles)', () => {
    const segs: RegionLineSeg[] = [
      { start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } },
      { start: { x: 5000, y: 0 }, end: { x: 6000, y: 3000 } },
      { start: { x: 6000, y: 3000 }, end: { x: 1000, y: 3000 } },
      { start: { x: 1000, y: 3000 }, end: { x: 0, y: 0 } },
    ];
    expect(findRectanglesFromSegments(segs, TOL)).toHaveLength(0);
  });

  it('finds the rectangle even with extra noise lines present', () => {
    const segs = [
      ...rectSegments(5000, 3000),
      { start: { x: 10000, y: 10000 }, end: { x: 12000, y: 11000 } }, // unrelated
      { start: { x: 2500, y: 1500 }, end: { x: 8000, y: 1500 } }, // dangling
    ];
    const rects = findRectanglesFromSegments(segs, TOL);
    expect(rects).toHaveLength(1);
    expect(rects[0].area).toBeCloseTo(15_000_000, 0);
  });
});

describe('wall-in-region — findEnclosingRectangle', () => {
  it('returns the rectangle when the point is inside', () => {
    const rect = findEnclosingRectangle(rectSegments(5000, 3000), { x: 2500, y: 1500 }, TOL);
    expect(rect).not.toBeNull();
    expect(rect?.area).toBeCloseTo(15_000_000, 0);
  });

  it('returns null when the point is outside every rectangle', () => {
    const rect = findEnclosingRectangle(rectSegments(5000, 3000), { x: -1000, y: -1000 }, TOL);
    expect(rect).toBeNull();
  });

  it('picks the smallest (innermost) rectangle when nested', () => {
    const outer = rectSegments(10000, 10000);
    const inner: RegionLineSeg[] = [
      { start: { x: 2000, y: 2000 }, end: { x: 6000, y: 2000 } },
      { start: { x: 6000, y: 2000 }, end: { x: 6000, y: 6000 } },
      { start: { x: 6000, y: 6000 }, end: { x: 2000, y: 6000 } },
      { start: { x: 2000, y: 6000 }, end: { x: 2000, y: 2000 } },
    ];
    const rect = findEnclosingRectangle([...outer, ...inner], { x: 4000, y: 4000 }, TOL);
    expect(rect).not.toBeNull();
    expect(rect?.area).toBeCloseTo(16_000_000, 0); // inner 4000×4000, not outer 100M
  });
});

describe('wall-in-region — buildWallFillingRect', () => {
  it('builds one wall: centered axis, length = long side, thickness = short side', () => {
    // Thin wall-footprint rectangle (5000 long × 250 thick) — short side within
    // MAX_WALL_THICKNESS_MM (2000), the canonical use case.
    const [rect] = findRectanglesFromSegments(rectSegments(5000, 250), TOL);
    const entity = buildWallFillingRect(rect, {}, SU, LEVEL);
    expect(entity).not.toBeNull();
    const e = entity as WallEntity;
    expect(e.type).toBe('wall');
    expect(e.kind).toBe('straight');
    // Thickness = short side (250 mm). Axis length = long side (5000).
    expect(e.params.thickness).toBeCloseTo(250, 3);
    const axisLen = Math.hypot(
      e.params.end.x - e.params.start.x,
      e.params.end.y - e.params.start.y,
    );
    expect(axisLen).toBeCloseTo(5000, 3);
    // Centered between the long edges (y=0 and y=250) → axis at y=125.
    expect(e.params.start.y).toBeCloseTo(125, 3);
    expect(e.params.end.y).toBeCloseTo(125, 3);
  });

  it('handles a square (length === thickness)', () => {
    const [rect] = findRectanglesFromSegments(rectSegments(1500, 1500), TOL);
    const entity = buildWallFillingRect(rect, {}, SU, LEVEL);
    expect(entity).not.toBeNull();
    const e = entity as WallEntity;
    expect(e.params.thickness).toBeCloseTo(1500, 3);
    const axisLen = Math.hypot(
      e.params.end.x - e.params.start.x,
      e.params.end.y - e.params.start.y,
    );
    expect(axisLen).toBeCloseTo(1500, 3);
  });

  it('returns null when the short side exceeds MAX_WALL_THICKNESS_MM (validator)', () => {
    // A 5000×3000 room outline → 3 m thick "wall" is unphysical → validator reject.
    const [rect] = findRectanglesFromSegments(rectSegments(5000, 3000), TOL);
    expect(buildWallFillingRect(rect, {}, SU, LEVEL)).toBeNull();
  });
});

// ─── Box-select (Mode C) pipeline — filter scene by selected ids → rects ──────
// Mirrors the EventBus path in useWallTool: a marquee collects line-entity ids,
// the tool filters the live scene to those ids, extracts segments, and detects
// EVERY enclosed rectangle (one filling wall built per rectangle downstream).

/** Build a LINE Entity (minimal valid shape for extractLineSegments). */
function lineEntity(id: string, sx: number, sy: number, ex: number, ey: number): LineEntity {
  return { id, type: 'line', layerId: 'lyr_test', start: { x: sx, y: sy }, end: { x: ex, y: ey } };
}

/** 4 LINE entities closing one axis-aligned rectangle. */
function rectLineEntities(prefix: string, w: number, h: number): LineEntity[] {
  return [
    lineEntity(`${prefix}-b`, 0, 0, w, 0),
    lineEntity(`${prefix}-r`, w, 0, w, h),
    lineEntity(`${prefix}-t`, w, h, 0, h),
    lineEntity(`${prefix}-l`, 0, h, 0, 0),
  ];
}

describe('wall-in-region — box-select (Mode C) filter-by-ids → rectangles', () => {
  it('detects the rectangle from the selected line ids only', () => {
    const scene: Entity[] = [
      ...rectLineEntities('rect', 5000, 250),
      lineEntity('noise', 10000, 10000, 12000, 11000), // not selected
    ];
    const selected = new Set(['rect-b', 'rect-r', 'rect-t', 'rect-l']);
    const segs = extractLineSegments(scene.filter((e) => selected.has(e.id)));
    const rects = findRectanglesFromSegments(segs, TOL);
    expect(rects).toHaveLength(1);
    const entity = buildWallFillingRect(rects[0], {}, SU, LEVEL);
    expect((entity as WallEntity).params.thickness).toBeCloseTo(250, 3);
  });

  it('finds multiple rectangles when the marquee covers two rooms', () => {
    const roomA = rectLineEntities('a', 4000, 250);
    const roomB = [
      lineEntity('b-b', 0, 5000, 4000, 5000),
      lineEntity('b-r', 4000, 5000, 4000, 5250),
      lineEntity('b-t', 4000, 5250, 0, 5250),
      lineEntity('b-l', 0, 5250, 0, 5000),
    ];
    const scene: Entity[] = [...roomA, ...roomB];
    const segs = extractLineSegments(scene); // marquee selected everything
    const rects = findRectanglesFromSegments(segs, TOL);
    expect(rects).toHaveLength(2);
  });

  it('detects no rectangle when only 3 of the 4 sides are selected', () => {
    const scene: Entity[] = rectLineEntities('rect', 5000, 250);
    const selected = new Set(['rect-b', 'rect-r', 'rect-t']); // missing left
    const segs = extractLineSegments(scene.filter((e) => selected.has(e.id)));
    expect(findRectanglesFromSegments(segs, TOL)).toHaveLength(0);
  });
});
