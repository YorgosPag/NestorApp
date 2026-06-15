/**
 * floor-stack-elevation — datum resolution + datum-relative stacking (ADR-399
 * Phase B · ADR-369 §9). Verifies the Revit-grade rule that the building rests
 * on its ground-floor datum (or lowest storey when none) at world 0.
 */

import {
  resolveBuildingDatumElevationM,
  resolveFloorDatumRelativeElevationMm,
  type FloorElevationRef,
} from '../floor-stack-elevation';

describe('resolveBuildingDatumElevationM', () => {
  it('uses the ground floor (number 0) elevation when present', () => {
    const floors: FloorElevationRef[] = [
      { number: 0, elevation: 0 },
      { number: 1, elevation: 3 },
      { number: 2, elevation: 6 },
    ];
    expect(resolveBuildingDatumElevationM(floors)).toBe(0);
  });

  it('prefers the ground floor even when a basement sits lower', () => {
    const floors: FloorElevationRef[] = [
      { number: -1, elevation: -3 },
      { number: 0, elevation: 0 },
      { number: 1, elevation: 3 },
    ];
    // Datum = ground (0), NOT the basement min (−3) → basement stays below grade.
    expect(resolveBuildingDatumElevationM(floors)).toBe(0);
  });

  it('falls back to the lowest elevation when no ground floor exists', () => {
    // The user's real case: lowest defined floor is «1ος» (number 1) at 3 m.
    const floors: FloorElevationRef[] = [
      { number: 1, elevation: 3 },
      { number: 2, elevation: 6 },
    ];
    expect(resolveBuildingDatumElevationM(floors)).toBe(3);
  });

  it('treats a ground floor with missing elevation as not-a-datum (falls back to min)', () => {
    const floors: FloorElevationRef[] = [
      { number: 0 }, // elevation absent
      { number: 1, elevation: 3 },
    ];
    expect(resolveBuildingDatumElevationM(floors)).toBe(0);
  });

  it('returns 0 for an empty building', () => {
    expect(resolveBuildingDatumElevationM([])).toBe(0);
  });

  // ADR-461 — special levels (foundation/roof/stair-penthouse) must never be the datum.
  it('ignores a foundation special level when falling back to the lowest counted storey', () => {
    const floors: FloorElevationRef[] = [
      { number: -1, elevation: -1, kind: 'foundation' }, // lowest elevation, but NOT a datum
      { number: 1, elevation: 3 },
      { number: 2, elevation: 6 },
    ];
    // Without the kind-guard the foundation (−1) would lift the model by foundationDepth.
    expect(resolveBuildingDatumElevationM(floors)).toBe(3);
  });

  it('still prefers the ground floor even with a foundation present', () => {
    const floors: FloorElevationRef[] = [
      { number: -1, elevation: -1, kind: 'foundation' },
      { number: 0, elevation: 0, kind: 'ground' },
      { number: 1, elevation: 3, kind: 'standard' },
    ];
    expect(resolveBuildingDatumElevationM(floors)).toBe(0);
  });

  it('degenerate building of only special levels falls back to their min (never NaN)', () => {
    const floors: FloorElevationRef[] = [
      { number: -1, elevation: -1, kind: 'foundation' },
      { number: 99, elevation: 9, kind: 'stair-penthouse' },
    ];
    expect(resolveBuildingDatumElevationM(floors)).toBe(-1);
  });
});

describe('resolveFloorDatumRelativeElevationMm', () => {
  it('places the datum storey at 0 mm', () => {
    expect(resolveFloorDatumRelativeElevationMm(3, 3)).toBe(0);
  });

  it('stacks an upper floor by its difference from the datum (× 1000)', () => {
    // «2ος» at 6 m above a «1ος» datum of 3 m → +3000 mm.
    expect(resolveFloorDatumRelativeElevationMm(6, 3)).toBe(3000);
  });

  it('keeps a basement below the ground datum', () => {
    expect(resolveFloorDatumRelativeElevationMm(-3, 0)).toBe(-3000);
  });

  it('coerces a missing/non-finite elevation to the datum (0 mm)', () => {
    expect(resolveFloorDatumRelativeElevationMm(undefined, 3)).toBe(-3000);
    expect(resolveFloorDatumRelativeElevationMm(null, 0)).toBe(0);
    expect(resolveFloorDatumRelativeElevationMm(NaN, 0)).toBe(0);
  });
});
