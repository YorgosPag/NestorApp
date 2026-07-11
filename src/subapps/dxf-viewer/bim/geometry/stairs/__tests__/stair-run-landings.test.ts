/**
 * ADR-637 — `planStairRunSegments` kind-independent rest-landing planner tests.
 *
 * @see ../stair-run-landings.ts
 */

import {
  planStairRunSegments,
  partitionRestLandingsByFlight,
  hasRestLandings,
  resolveRestLandingLength,
  resolveRestLandingDepth,
  type StairRunSegment,
} from '../stair-run-landings';
import type { StairRestLanding } from '../../../types/stair-types';

const L = (id: string, at: number, length: StairRestLanding['length'] = 'auto', depth?: StairRestLanding['depth']): StairRestLanding => ({
  id,
  at,
  length,
  ...(depth === undefined ? {} : { depth }),
});

const treadTotal = (segs: readonly StairRunSegment[]): number =>
  segs.filter((s) => s.kind === 'flight').reduce((n, s) => n + (s.kind === 'flight' ? s.treadCount : 0), 0);
const landingLevels = (segs: readonly StairRunSegment[]): number[] =>
  segs.filter((s) => s.kind === 'landing').map((s) => (s.kind === 'landing' ? s.level : -1));

describe('planStairRunSegments', () => {
  it('no landings → single flight of stepCount', () => {
    const segs = planStairRunSegments(10, undefined);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ kind: 'flight', startLevel: 0, treadCount: 10 });
  });

  it('empty landings array → single flight', () => {
    expect(planStairRunSegments(10, [])).toEqual([{ kind: 'flight', startLevel: 0, treadCount: 10 }]);
  });

  it('stepCount < 3 → no room for a rest landing (single flight)', () => {
    expect(planStairRunSegments(2, [L('a', 0.5)])).toEqual([{ kind: 'flight', startLevel: 0, treadCount: 2 }]);
    expect(hasRestLandings(2, [L('a', 0.5)])).toBe(false);
  });

  it('one landing at=0.5, stepCount=10 → level 5, treads = stepCount − 1', () => {
    const segs = planStairRunSegments(10, [L('a', 0.5)]);
    expect(landingLevels(segs)).toEqual([5]);
    expect(treadTotal(segs)).toBe(9);
    // total levels (treads + landings) conserved = stepCount
    expect(treadTotal(segs) + landingLevels(segs).length).toBe(10);
    expect(segs).toEqual([
      { kind: 'flight', startLevel: 0, treadCount: 5 },
      { kind: 'landing', level: 5, landing: L('a', 0.5) },
      { kind: 'flight', startLevel: 6, treadCount: 4 },
    ]);
  });

  it('landing at extremes clamps into [1, stepCount−2]', () => {
    expect(landingLevels(planStairRunSegments(10, [L('a', 0)]))).toEqual([1]);
    expect(landingLevels(planStairRunSegments(10, [L('a', 1)]))).toEqual([8]);
  });

  it('two landings → both materialize on distinct levels, level-ordered', () => {
    const segs = planStairRunSegments(12, [L('a', 0.3), L('b', 0.7)]);
    const levels = landingLevels(segs);
    expect(levels).toHaveLength(2);
    expect(levels[0]).toBeLessThan(levels[1]);
    expect(treadTotal(segs) + levels.length).toBe(12);
    // flanks are always treads
    expect(segs[0].kind).toBe('flight');
    expect(segs[segs.length - 1].kind).toBe('flight');
  });

  it('colliding landings (same at) nudge to the nearest free level — none dropped', () => {
    const segs = planStairRunSegments(10, [L('a', 0.5), L('b', 0.5)]);
    const levels = landingLevels(segs);
    expect(levels).toHaveLength(2);
    expect(new Set(levels).size).toBe(2); // distinct
    expect(treadTotal(segs) + levels.length).toBe(10);
  });

  it('drags: moving `at` moves the landing level and re-flows treads', () => {
    const near = planStairRunSegments(10, [L('a', 0.2)]); // level ~2
    const far = planStairRunSegments(10, [L('a', 0.8)]); // level ~7
    expect(landingLevels(near)[0]).toBeLessThan(landingLevels(far)[0]);
    // first flight grows as the landing slides up the run
    const firstFlight = (segs: StairRunSegment[]) =>
      segs[0].kind === 'flight' ? segs[0].treadCount : 0;
    expect(firstFlight(near)).toBeLessThan(firstFlight(far));
  });

  it('more landings than free levels → extras silently dropped (never crash)', () => {
    // stepCount=4 → only levels 1,2 free → 3rd landing can't place.
    const segs = planStairRunSegments(4, [L('a', 0.3), L('b', 0.6), L('c', 0.5)]);
    expect(landingLevels(segs)).toHaveLength(2);
    expect(treadTotal(segs) + 2).toBe(4);
  });
});

describe('partitionRestLandingsByFlight', () => {
  it('no landings → empty array per flight', () => {
    expect(partitionRestLandingsByFlight([5, 5], undefined)).toEqual([[], []]);
    expect(partitionRestLandingsByFlight([5, 5], [])).toEqual([[], []]);
  });

  it('routes a landing to the flight whose tread range contains its global level', () => {
    // total=10; at=0.3 → globalIdx round(2.7)=3 → flight 0 (levels 0..4).
    const per = partitionRestLandingsByFlight([5, 5], [L('a', 0.3)]);
    expect(per[0]).toHaveLength(1);
    expect(per[1]).toHaveLength(0);
    // local level 3 within a 5-level flight → local at = 3/4 = 0.75.
    expect(per[0][0].at).toBeCloseTo(0.75, 9);
    expect(per[0][0].id).toBe('a'); // identity preserved
  });

  it('routes a late landing to the second flight with re-expressed local at', () => {
    // at=0.7 → globalIdx round(6.3)=6 → flight 1 (levels 5..9), local level 1 → 1/4.
    const per = partitionRestLandingsByFlight([5, 5], [L('b', 0.7)]);
    expect(per[0]).toHaveLength(0);
    expect(per[1]).toHaveLength(1);
    expect(per[1][0].at).toBeCloseTo(0.25, 9);
  });

  it('splits two landings across the two flights', () => {
    const per = partitionRestLandingsByFlight([5, 5], [L('a', 0.3), L('b', 0.7)]);
    expect(per.map((f) => f.length)).toEqual([1, 1]);
  });

  it('clamps a boundary at=0 inward to the first flight (never dropped)', () => {
    const per = partitionRestLandingsByFlight([5, 5], [L('a', 0)]);
    expect(per[0]).toHaveLength(1);
    expect(per[1]).toHaveLength(0);
  });

  it('clamps a boundary at=1 inward to the last flight (never dropped)', () => {
    const per = partitionRestLandingsByFlight([5, 5], [L('a', 1)]);
    expect(per[0]).toHaveLength(0);
    expect(per[1]).toHaveLength(1);
  });

  it('asymmetric flights: routes by cumulative tread range', () => {
    // flights [3,7], total=10; at=0.5 → globalIdx round(4.5)=5 → flight 1 (levels 3..9).
    const per = partitionRestLandingsByFlight([3, 7], [L('a', 0.5)]);
    expect(per[0]).toHaveLength(0);
    expect(per[1]).toHaveLength(1);
    // local level 5-3=2 within a 7-level flight → 2/6.
    expect(per[1][0].at).toBeCloseTo(2 / 6, 9);
  });

  it('total < 3 → nothing placeable, arrays stay empty', () => {
    expect(partitionRestLandingsByFlight([1, 1], [L('a', 0.5)])).toEqual([[], []]);
  });
});

describe('resolveRestLandingLength / resolveRestLandingDepth', () => {
  it("'auto' → width", () => {
    expect(resolveRestLandingLength('auto', 1000)).toBe(1000);
    expect(resolveRestLandingDepth('auto', 1000)).toBe(1000);
    expect(resolveRestLandingDepth(undefined, 1000)).toBe(1000);
  });
  it('positive explicit value passes through', () => {
    expect(resolveRestLandingLength(1500, 1000)).toBe(1500);
    expect(resolveRestLandingDepth(800, 1000)).toBe(800);
  });
  it('invalid (≤0 / NaN) falls back to width', () => {
    expect(resolveRestLandingLength(0, 1000)).toBe(1000);
    expect(resolveRestLandingLength(Number.NaN, 1000)).toBe(1000);
    expect(resolveRestLandingDepth(-5, 1000)).toBe(1000);
  });
});
