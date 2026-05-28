/**
 * ADR-363 — `wall-dimension-edit` (height/thickness meters I/O) tests.
 */

import {
  getWallHeightMeters,
  setWallHeightMeters,
  getWallThicknessMeters,
  setWallThicknessMeters,
} from '../wall-dimension-edit';
import { MIN_WALL_THICKNESS_MM, MAX_WALL_THICKNESS_MM } from '../../types/wall-types';
import type { WallParams } from '../../types/wall-types';

const TOL = 1e-9;

function makeParams(overrides?: Partial<WallParams>): WallParams {
  return {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    ...overrides,
  };
}

describe('height — meters I/O (mm SSoT, no scale)', () => {
  it('reads 3000 mm as 3.0 m', () => {
    expect(getWallHeightMeters(makeParams())).toBeCloseTo(3.0, TOL);
  });

  it('writes 2.7 m → 2700 mm', () => {
    expect(setWallHeightMeters(makeParams(), 2.7)).toEqual({ height: 2700 });
  });

  it('skips no-op (unchanged value) → null', () => {
    expect(setWallHeightMeters(makeParams({ height: 2700 }), 2.7)).toBeNull();
  });

  it('non-finite → null', () => {
    expect(setWallHeightMeters(makeParams(), Number.NaN)).toBeNull();
  });
});

describe('thickness — meters I/O with clamp + dna drop', () => {
  it('reads 250 mm as 0.25 m', () => {
    expect(getWallThicknessMeters(makeParams())).toBeCloseTo(0.25, TOL);
  });

  it('writes 0.2 m → 200 mm and drops dna', () => {
    expect(setWallThicknessMeters(makeParams(), 0.2)).toEqual({ thickness: 200, dna: undefined });
  });

  it('clamps below MIN_WALL_THICKNESS_MM', () => {
    const patch = setWallThicknessMeters(makeParams(), 0.001); // 1 mm
    expect(patch).toEqual({ thickness: MIN_WALL_THICKNESS_MM, dna: undefined });
  });

  it('clamps above MAX_WALL_THICKNESS_MM', () => {
    const patch = setWallThicknessMeters(makeParams(), 5); // 5000 mm
    expect(patch).toEqual({ thickness: MAX_WALL_THICKNESS_MM, dna: undefined });
  });

  it('non-finite → null', () => {
    expect(setWallThicknessMeters(makeParams(), Number.NaN)).toBeNull();
  });
});
