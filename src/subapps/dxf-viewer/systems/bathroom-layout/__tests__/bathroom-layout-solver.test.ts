/**
 * Bathroom Auto-Layout solver tests · ADR-638 (Στάδιο 1).
 *
 * Exercises the pure, headless rule-based planner: wall segmentation, clearance
 * spec reuse, candidate generation (inside-room, no collision, door keep-clear),
 * ranking order and determinism. All millimetres.
 */

import type { Point2D } from '../../../rendering/types/Types';
import {
  solveBathroomLayout,
  segmentRoomWalls,
  buildFixtureRects,
  resolveFixtureSpec,
  type LayoutFixtureKind,
} from '../index';
import { SANITARY_SPEC } from '../../../bim/sanitary/sanitary-symbol-spec';
import { allCornersInside, lift, rectOverlapMm2 } from '../layout-geometry';

/** CCW rectangle room (mm) at origin. */
function rectRoom(widthMm: number, depthMm: number): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: widthMm, y: 0 },
    { x: widthMm, y: depthMm },
    { x: 0, y: depthMm },
  ];
}

describe('resolveFixtureSpec — dims reused from catalogs (no drift)', () => {
  it('reuses SANITARY_SPEC footprint dims verbatim', () => {
    const wc = resolveFixtureSpec('wc');
    expect(wc.widthMm).toBe(SANITARY_SPEC.wc.widthMm);
    expect(wc.depthMm).toBe(SANITARY_SPEC.wc.depthMm);
    expect(wc.frontClearanceMm).toBeGreaterThan(0);
  });

  it('provides a vanity spec even without a catalog entry', () => {
    const v = resolveFixtureSpec('vanity');
    expect(v.widthMm).toBeGreaterThan(0);
    expect(v.depthMm).toBeGreaterThan(0);
  });
});

describe('segmentRoomWalls', () => {
  it('yields one oriented wall per rectangle edge with inward normals pointing inside', () => {
    const walls = segmentRoomWalls(rectRoom(2000, 2200));
    expect(walls).toHaveLength(4);
    const roomLifted = lift(rectRoom(2000, 2200));
    for (const w of walls) {
      const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
      const probe = [{ x: mid.x + w.inward.x * 10, y: mid.y + w.inward.y * 10, z: 0 }];
      expect(allCornersInside([{ x: probe[0].x, y: probe[0].y }], roomLifted)).toBe(true);
    }
  });

  it('normalises CW input to CCW (inward normals still point inside)', () => {
    const cw = [...rectRoom(2000, 2200)].reverse();
    const walls = segmentRoomWalls(cw);
    const roomLifted = lift(cw);
    for (const w of walls) {
      const mid = { x: (w.a.x + w.b.x) / 2 + w.inward.x * 10, y: (w.a.y + w.b.y) / 2 + w.inward.y * 10 };
      expect(allCornersInside([mid], roomLifted)).toBe(true);
    }
  });
});

describe('buildFixtureRects', () => {
  it('produces a footprint fully inside the room hugging the wall', () => {
    const walls = segmentRoomWalls(rectRoom(2000, 2200));
    const bottom = walls[0];
    const rects = buildFixtureRects(bottom, 1000, 600, 460, 550);
    expect(allCornersInside(rects.footprint, lift(rectRoom(2000, 2200)))).toBe(true);
    expect(rects.footprint).toHaveLength(4);
    expect(rects.useZone).toHaveLength(4);
  });
});

describe('solveBathroomLayout — core solver', () => {
  const room = rectRoom(2400, 2400);
  const basics: LayoutFixtureKind[] = ['wc', 'washbasin', 'shower', 'bathtub'];

  it('returns at least one solution and never exceeds maxSolutions', () => {
    const sols = solveBathroomLayout({ polygonMm: room, fixtures: basics }, { maxSolutions: 3 });
    expect(sols.length).toBeGreaterThanOrEqual(1);
    expect(sols.length).toBeLessThanOrEqual(3);
  });

  it('places every fixture inside the room with no footprint collisions (best solution)', () => {
    const [best] = solveBathroomLayout({ polygonMm: room, fixtures: basics });
    expect(best).toBeDefined();
    const roomLifted = lift(room);
    for (const p of best.placements) {
      expect(allCornersInside(p.footprint, roomLifted)).toBe(true);
    }
    for (let i = 0; i < best.placements.length; i++) {
      for (let j = i + 1; j < best.placements.length; j++) {
        const overlap = rectOverlapMm2(best.placements[i].footprint, best.placements[j].footprint);
        const area = best.placements[i].widthMm * best.placements[i].depthMm;
        expect(overlap).toBeLessThanOrEqual(0.02 * area + 1);
      }
    }
  });

  it('keeps fixtures clear of the door keep-clear zone', () => {
    const doorKeepClear: Point2D[] = [
      { x: 0, y: 0 },
      { x: 900, y: 0 },
      { x: 900, y: 800 },
      { x: 0, y: 800 },
    ];
    const [best] = solveBathroomLayout({ polygonMm: room, fixtures: basics, doorKeepClearMm: doorKeepClear });
    expect(best).toBeDefined();
    for (const p of best.placements) {
      const overlap = rectOverlapMm2(p.footprint, doorKeepClear);
      const area = p.widthMm * p.depthMm;
      expect(overlap).toBeLessThanOrEqual(0.02 * area + 1);
    }
  });

  it('ranks solutions best-first (descending score)', () => {
    const sols = solveBathroomLayout({ polygonMm: room, fixtures: basics }, { maxSolutions: 5 });
    for (let i = 1; i < sols.length; i++) {
      expect(sols[i - 1].score).toBeGreaterThanOrEqual(sols[i].score);
      expect(sols[i - 1].score).toBeGreaterThanOrEqual(0);
      expect(sols[i - 1].score).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic — identical input yields identical solution ids', () => {
    const input = { polygonMm: room, fixtures: basics };
    const a = solveBathroomLayout(input, { maxSolutions: 5 }).map((s) => s.id);
    const b = solveBathroomLayout(input, { maxSolutions: 5 }).map((s) => s.id);
    expect(a).toEqual(b);
  });

  it('handles the full 7-fixture set in a larger bathroom', () => {
    const big = rectRoom(3200, 2600);
    const all: LayoutFixtureKind[] = ['wc', 'washbasin', 'shower', 'bathtub', 'bidet', 'washing-machine', 'vanity'];
    const [best] = solveBathroomLayout({ polygonMm: big, fixtures: all }, { maxSolutions: 3 });
    expect(best).toBeDefined();
    expect(best.placements.length).toBeGreaterThan(0);
    expect(best.scoreBreakdown.completeness).toBeGreaterThan(0);
  });

  it('returns [] for a degenerate room (< 3 walls) or empty fixtures', () => {
    expect(solveBathroomLayout({ polygonMm: [{ x: 0, y: 0 }, { x: 100, y: 0 }], fixtures: ['wc'] })).toEqual([]);
    expect(solveBathroomLayout({ polygonMm: rectRoom(2000, 2000), fixtures: [] })).toEqual([]);
  });

  it('reports unplaced fixtures via a warning when the room is too small', () => {
    const tiny = rectRoom(900, 900);
    const sols = solveBathroomLayout({ polygonMm: tiny, fixtures: ['bathtub', 'shower', 'wc', 'washbasin'] });
    const withWarn = sols.find((s) => s.warnings.some((w) => w.startsWith('unplaced:')));
    expect(withWarn).toBeDefined();
  });
});
