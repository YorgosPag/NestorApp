/**
 * ADR-650 M4 — the «one TIN» guarantee.
 *
 * This is the test that protects the whole milestone's core claim: the contours drawn in plan
 * and the hill rendered in 3D are cut from the SAME triangulation. If `getTopoSurface()` ever
 * stops memoising (or memoises too aggressively), the two consumers silently drift apart —
 * so the identity assertions below are the contract, not an optimisation detail.
 */

import { setTopoPoints, addBreakline, clearTopo } from '../TopoPointStore';
import { getTopoSurface, hasTopoSurface, invalidateTopoSurface } from '../topo-surface';
import type { TopoPoint } from '../topo-types';

const HILL: readonly TopoPoint[] = [
  { x: 0, y: 0, z: 0 },
  { x: 10_000, y: 0, z: 0 },
  { x: 10_000, y: 10_000, z: 5_000 },
  { x: 0, y: 10_000, z: 2_000 },
];

beforeEach(() => {
  clearTopo();
  invalidateTopoSurface();
});

describe('getTopoSurface', () => {
  it('hands every consumer the SAME instance while the survey is unchanged', () => {
    setTopoPoints(HILL);

    const forContours = getTopoSurface();
    const forTerrain3D = getTopoSurface();

    expect(forTerrain3D).toBe(forContours); // ← same object: one TIN, two styles
    expect(forContours.triangles.length).toBeGreaterThan(0);
  });

  it('rebuilds when the points change (Civil 3D «Rebuild Surface»)', () => {
    setTopoPoints(HILL);
    const before = getTopoSurface();

    setTopoPoints([...HILL, { x: 5_000, y: 5_000, z: 9_000 }]);
    const after = getTopoSurface();

    expect(after).not.toBe(before);
    expect(after.positions.length).toBe(before.positions.length + 1);
  });

  it('rebuilds when a breakline is added — a constraint changes the triangulation', () => {
    setTopoPoints(HILL);
    const before = getTopoSurface();

    addBreakline([HILL[0]!, HILL[2]!]);

    expect(getTopoSurface()).not.toBe(before);
  });

  it('yields an empty surface (not null, not NaN) below 3 points', () => {
    setTopoPoints([HILL[0]!, HILL[1]!]);

    const surface = getTopoSurface();
    expect(surface.triangles).toHaveLength(0);
    expect(hasTopoSurface()).toBe(false);
    expect(Number.isFinite(surface.bounds.minZ)).toBe(true);
  });
});
