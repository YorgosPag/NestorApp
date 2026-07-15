/**
 * ADR-650 M10d — Terrain3DStore transparency state: per-style surface opacity + contour opacity.
 * Pins the clamp, the per-style memory (Civil 3D «Surface Style transparency») and the no-op guard.
 */

import {
  getTerrain3DState,
  getTerrainSurfaceOpacity,
  setTerrainSurfaceOpacity,
  setTerrainContourOpacity,
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
