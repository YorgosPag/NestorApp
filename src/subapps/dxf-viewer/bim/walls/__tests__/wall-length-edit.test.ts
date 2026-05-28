/**
 * ADR-363 — `wall-length-edit` pure helper tests.
 *
 * Coverage:
 *   - getWallLengthMeters: mm scene, 3-4-5, meters scene, degenerate
 *   - setWallLengthMeters: moves end along axis, keeps start + bearing,
 *     clamps to MIN_WALL_LENGTH_MM, meters scene scale, degenerate/non-finite
 *   - round-trip get∘set === input
 */

import { getWallLengthMeters, setWallLengthMeters } from '../wall-length-edit';
import { MIN_WALL_LENGTH_MM } from '../../types/wall-types';
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

describe('getWallLengthMeters', () => {
  it('mm scene: 1000 mm axis → 1.0 m', () => {
    expect(getWallLengthMeters(makeParams())).toBeCloseTo(1.0, TOL);
  });

  it('mm scene: 3-4-5 triangle → 5.0 m', () => {
    const p = makeParams({ end: { x: 3000, y: 4000, z: 0 } });
    expect(getWallLengthMeters(p)).toBeCloseTo(5.0, TOL);
  });

  it('meters scene: canvas 3.75 → 3.75 m', () => {
    const p = makeParams({ sceneUnits: 'm', end: { x: 3.75, y: 0, z: 0 } });
    expect(getWallLengthMeters(p)).toBeCloseTo(3.75, TOL);
  });

  it('degenerate axis (start === end) → 0', () => {
    const p = makeParams({ end: { x: 0, y: 0, z: 0 } });
    expect(getWallLengthMeters(p)).toBe(0);
  });
});

describe('setWallLengthMeters', () => {
  it('mm scene: set 2 m moves end to x=2000, keeps start + y', () => {
    const next = setWallLengthMeters(makeParams(), 2);
    expect(next).not.toBeNull();
    expect(next!.start).toEqual({ x: 0, y: 0, z: 0 });
    expect(next!.end.x).toBeCloseTo(2000, TOL);
    expect(next!.end.y).toBeCloseTo(0, TOL);
  });

  it('keeps bearing on a diagonal wall', () => {
    const p = makeParams({ end: { x: 3000, y: 4000, z: 0 } }); // 5 m, dir (0.6, 0.8)
    const next = setWallLengthMeters(p, 10);
    expect(next!.end.x).toBeCloseTo(6000, TOL); // 10 m * 0.6 → 6000 mm
    expect(next!.end.y).toBeCloseTo(8000, TOL);
  });

  it('clamps below MIN_WALL_LENGTH_MM', () => {
    const next = setWallLengthMeters(makeParams(), 0.01); // 10 mm < 100 mm floor
    expect(next!.end.x).toBeCloseTo(MIN_WALL_LENGTH_MM, TOL);
  });

  it('meters scene: set 4 m → canvas end x=4.0', () => {
    const p = makeParams({ sceneUnits: 'm', end: { x: 1, y: 0, z: 0 } });
    const next = setWallLengthMeters(p, 4);
    expect(next!.end.x).toBeCloseTo(4.0, TOL);
  });

  it('degenerate axis → null', () => {
    const p = makeParams({ end: { x: 0, y: 0, z: 0 } });
    expect(setWallLengthMeters(p, 5)).toBeNull();
  });

  it('non-finite input → null', () => {
    expect(setWallLengthMeters(makeParams(), Number.NaN)).toBeNull();
  });
});

describe('round-trip', () => {
  it('get ∘ set === input (above clamp)', () => {
    const next = setWallLengthMeters(makeParams({ end: { x: 1234, y: 567, z: 0 } }), 7.25);
    expect(getWallLengthMeters(next!)).toBeCloseTo(7.25, TOL);
  });

  it('meters scene round-trip', () => {
    const p = makeParams({ sceneUnits: 'm', end: { x: 2, y: 1, z: 0 } });
    const next = setWallLengthMeters(p, 3.5);
    expect(getWallLengthMeters(next!)).toBeCloseTo(3.5, TOL);
  });
});
