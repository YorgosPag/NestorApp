/**
 * ADR-448 Phase 1 — Active Storey Context pure-builder unit tests.
 *
 * Locks the storey-aware datum SSoT: datum-relative FFL, storey height/finish
 * fallbacks, next-floor (ceiling) pick, lowest-occupied gating (foundation
 * excluded), and basement detection. Reuses the floor-stack-elevation datum math.
 */

import {
  buildActiveStoreyContext,
  DEFAULT_STOREY_HEIGHT_MM,
  type StoreyFloorRef,
} from '../active-storey-context';

// Maisonette (no ground floor): 1ος @3m, 2ος @6m — datum resolves to the lowest (3m).
const MAISONETTE: StoreyFloorRef[] = [
  { id: 'f1', number: 1, elevation: 3, height: 3, kind: 'standard' },
  { id: 'f2', number: 2, elevation: 6, height: 3, kind: 'standard' },
];

// Full stack with ground (datum) + basement + foundation below.
const FULL_STACK: StoreyFloorRef[] = [
  { id: 'fnd', number: -2, elevation: -4, height: 1, kind: 'foundation' },
  { id: 'bsm', number: -1, elevation: -3, height: 3, kind: 'basement' },
  { id: 'grd', number: 0, elevation: 0, height: 3, kind: 'ground' },
  { id: 'upr', number: 1, elevation: 3, height: 3, kind: 'standard' },
];

describe('buildActiveStoreyContext — degenerate', () => {
  it('returns null when no active floor id', () => {
    expect(buildActiveStoreyContext(MAISONETTE, null)).toBeNull();
  });
  it('returns null when active floor id not in list', () => {
    expect(buildActiveStoreyContext(MAISONETTE, 'ghost')).toBeNull();
  });
});

describe('buildActiveStoreyContext — datum-relative elevation (reuse floor-stack-elevation)', () => {
  it('lowest floor of a maisonette resolves to datum 0', () => {
    const ctx = buildActiveStoreyContext(MAISONETTE, 'f1');
    expect(ctx?.floorElevationMm).toBe(0);
  });
  it('upper floor is datum-relative (3m above the lowest)', () => {
    const ctx = buildActiveStoreyContext(MAISONETTE, 'f2');
    expect(ctx?.floorElevationMm).toBe(3000);
  });
  it('ground floor is the datum when present (basement below 0)', () => {
    expect(buildActiveStoreyContext(FULL_STACK, 'grd')?.floorElevationMm).toBe(0);
    expect(buildActiveStoreyContext(FULL_STACK, 'bsm')?.floorElevationMm).toBe(-3000);
  });
});

describe('buildActiveStoreyContext — storey height', () => {
  it('uses floor.height × 1000', () => {
    expect(buildActiveStoreyContext(MAISONETTE, 'f1')?.storeyHeightMm).toBe(3000);
  });
  it('falls back to DEFAULT_STOREY_HEIGHT_MM when height absent', () => {
    const floors: StoreyFloorRef[] = [{ id: 'x', number: 0, elevation: 0 }];
    expect(buildActiveStoreyContext(floors, 'x')?.storeyHeightMm).toBe(DEFAULT_STOREY_HEIGHT_MM);
  });
});

describe('buildActiveStoreyContext — next floor (storey ceiling)', () => {
  it('picks the closest floor above as the ceiling', () => {
    expect(buildActiveStoreyContext(MAISONETTE, 'f1')?.nextFloorElevationMm).toBe(3000);
  });
  it('top floor ceiling = FFL + storey height (no next floor)', () => {
    expect(buildActiveStoreyContext(MAISONETTE, 'f2')?.nextFloorElevationMm).toBe(6000);
  });
});

describe('buildActiveStoreyContext — lowest occupied storey (foundation excluded)', () => {
  it('basement is the lowest occupied (foundation does not count)', () => {
    expect(buildActiveStoreyContext(FULL_STACK, 'bsm')?.isLowestOccupiedStorey).toBe(true);
  });
  it('ground is NOT lowest when a basement exists', () => {
    expect(buildActiveStoreyContext(FULL_STACK, 'grd')?.isLowestOccupiedStorey).toBe(false);
  });
  it('a foundation floor is never the lowest occupied storey', () => {
    expect(buildActiveStoreyContext(FULL_STACK, 'fnd')?.isLowestOccupiedStorey).toBe(false);
  });
  it('the single lowest floor of a maisonette is the lowest occupied', () => {
    expect(buildActiveStoreyContext(MAISONETTE, 'f1')?.isLowestOccupiedStorey).toBe(true);
    expect(buildActiveStoreyContext(MAISONETTE, 'f2')?.isLowestOccupiedStorey).toBe(false);
  });
});

describe('buildActiveStoreyContext — basement detection + finish thickness', () => {
  it('flags buildingHasBasement when any floor is below grade', () => {
    expect(buildActiveStoreyContext(FULL_STACK, 'grd')?.buildingHasBasement).toBe(true);
    expect(buildActiveStoreyContext(MAISONETTE, 'f1')?.buildingHasBasement).toBe(false);
  });
  it('uses floor.finishThickness, falling back to the default', () => {
    const floors: StoreyFloorRef[] = [
      { id: 'a', number: 0, elevation: 0, finishThickness: 120 },
      { id: 'b', number: 1, elevation: 3 },
    ];
    expect(buildActiveStoreyContext(floors, 'a')?.finishThicknessMm).toBe(120);
    expect(buildActiveStoreyContext(floors, 'b')?.finishThicknessMm).toBe(80);
  });
});
