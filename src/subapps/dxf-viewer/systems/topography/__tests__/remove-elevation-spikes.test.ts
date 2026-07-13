/**
 * ADR-650 M5β — spike-removal SSoT tests (deterministic, no LLM).
 *
 * Same analytic input as the M5α elevation-bust test — a flat grid with one keyed-in Z spike —
 * so the KNOWN answer is «exactly one spike». Verifies preview counts without mutating, remove
 * deletes exactly that raw point, and a clean survey is left untouched.
 */

import type { TopoPoint } from '../topo-types';
import { setTopoPoints, getTopoPoints, clearTopo } from '../TopoPointStore';
import { invalidateTopoSurface } from '../topo-surface';
import { previewElevationSpikes, removeElevationSpikes } from '../remove-elevation-spikes';

/** n×n grid at spacing `step` mm, all at elevation `z` mm. */
function flatGrid(n: number, step: number, z: number): TopoPoint[] {
  const pts: TopoPoint[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pts.push({ x: i * step, y: j * step, z });
  return pts;
}

/** A 3×3 flat grid whose centre node is an +8 m keyed-in spike (index 4 = (500,500)). */
function gridWithCentreSpike(): TopoPoint[] {
  const points = flatGrid(3, 500, 1000);
  points[4] = { x: 500, y: 500, z: 9000 };
  return points;
}

beforeEach(() => {
  clearTopo();
  invalidateTopoSurface();
});

describe('previewElevationSpikes', () => {
  it('counts the spike without mutating the survey', () => {
    setTopoPoints(gridWithCentreSpike());
    expect(previewElevationSpikes()).toBe(1);
    expect(previewElevationSpikes()).toBe(1); // idempotent — still there
    expect(getTopoPoints().length).toBe(9);
  });

  it('returns 0 on a clean flat survey', () => {
    setTopoPoints(flatGrid(3, 500, 1000));
    expect(previewElevationSpikes()).toBe(0);
  });
});

describe('removeElevationSpikes', () => {
  it('removes exactly the elevation-bust spike point', () => {
    setTopoPoints(gridWithCentreSpike());

    const removed = removeElevationSpikes();

    expect(removed).toBe(1);
    const kept = getTopoPoints();
    expect(kept.length).toBe(8);
    expect(kept.some((p) => p.z === 9000)).toBe(false);
  });

  it('removes nothing from a clean survey and does not write', () => {
    setTopoPoints(flatGrid(3, 500, 1000));
    expect(removeElevationSpikes()).toBe(0);
    expect(getTopoPoints().length).toBe(9);
  });

  it('is safe to re-run after a removal (the rebuilt surface is clean)', () => {
    setTopoPoints(gridWithCentreSpike());
    expect(removeElevationSpikes()).toBe(1);
    expect(removeElevationSpikes()).toBe(0);
  });
});
