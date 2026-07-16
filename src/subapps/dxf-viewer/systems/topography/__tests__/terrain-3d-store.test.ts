/**
 * ADR-650 M10d — Terrain3DStore transparency state: per-style surface opacity + contour opacity.
 * Pins the clamp, the per-style memory (Civil 3D «Surface Style transparency») and the no-op guard.
 */

import {
  getTerrain3DState,
  getTerrainSurfaceOpacity,
  setTerrainSurfaceOpacity,
  setTerrainContourOpacity,
  setTerrainAutoClipAtActiveLevel,
  subscribeTerrain3D,
} from '../terrain-3d-store';

describe('Terrain3DStore — transparency (M10d)', () => {
  beforeEach(() => {
    // Reset to fully opaque so each test starts from a known baseline (module-level singleton).
    setTerrainSurfaceOpacity('shaded', 1);
    setTerrainSurfaceOpacity('hypsometric', 1);
    setTerrainSurfaceOpacity('cutfill', 1);
    setTerrainContourOpacity(1);
  });

  it('remembers surface opacity independently per style', () => {
    setTerrainSurfaceOpacity('shaded', 0.4);
    setTerrainSurfaceOpacity('hypsometric', 0.7);
    expect(getTerrainSurfaceOpacity('shaded')).toBeCloseTo(0.4);
    expect(getTerrainSurfaceOpacity('hypsometric')).toBeCloseTo(0.7);
    expect(getTerrainSurfaceOpacity('cutfill')).toBe(1); // untouched
  });

  it('keeps the contour opacity separate from the surface opacity', () => {
    setTerrainSurfaceOpacity('shaded', 0.2);
    setTerrainContourOpacity(0.9);
    expect(getTerrain3DState().contourOpacity).toBeCloseTo(0.9);
    expect(getTerrainSurfaceOpacity('shaded')).toBeCloseTo(0.2);
  });

  it('clamps out-of-range and non-finite inputs into 0..1', () => {
    setTerrainSurfaceOpacity('shaded', 1.5);
    expect(getTerrainSurfaceOpacity('shaded')).toBe(1);
    setTerrainSurfaceOpacity('shaded', -0.3);
    expect(getTerrainSurfaceOpacity('shaded')).toBe(0);
    setTerrainContourOpacity(Number.NaN);
    expect(getTerrain3DState().contourOpacity).toBe(1);
  });

  it('is a no-op (same reference) when the value is unchanged', () => {
    setTerrainSurfaceOpacity('shaded', 0.5);
    const before = getTerrain3DState();
    setTerrainSurfaceOpacity('shaded', 0.5);
    expect(getTerrain3DState()).toBe(before); // identity-guarded → no re-render churn
  });
});

describe('Terrain3DStore — auto-clip at active level (ADR-665)', () => {
  afterEach(() => { setTerrainAutoClipAtActiveLevel(true); }); // restore the default

  it('defaults to ON — the relief must never bury the building once shown', () => {
    // Safe as a default precisely because `visible` defaults to false: the default RENDERED scene
    // is unchanged, but the moment the user opts into the hill it is already cut sensibly.
    expect(getTerrain3DState().autoClipAtActiveLevel).toBe(true);
    expect(getTerrain3DState().visible).toBe(false);
  });

  it('toggles and notifies exactly once', () => {
    const listener = jest.fn();
    const unsub = subscribeTerrain3D(listener);
    setTerrainAutoClipAtActiveLevel(false);
    expect(getTerrain3DState().autoClipAtActiveLevel).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('setting the same value is a no-op and does NOT notify', () => {
    // Load-bearing, not cosmetic: every notify drives a scene rebuild + a clip re-apply.
    setTerrainAutoClipAtActiveLevel(false);
    const before = getTerrain3DState();
    const listener = jest.fn();
    const unsub = subscribeTerrain3D(listener);
    setTerrainAutoClipAtActiveLevel(false);
    expect(getTerrain3DState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });

  it('is independent of the opacity/style state', () => {
    setTerrainAutoClipAtActiveLevel(false);
    setTerrainSurfaceOpacity('shaded', 0.3);
    expect(getTerrain3DState().autoClipAtActiveLevel).toBe(false);
    expect(getTerrainSurfaceOpacity('shaded')).toBeCloseTo(0.3);
  });
});
