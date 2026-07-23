/**
 * ADR-407 Φ7 — hosted (stair) railing engine: sloped members + «Baluster Per Tread» +
 * self-hydrating baked snapshot.
 */

import { computeRailingGeometry } from '../railing-geometry';
import type { RailingParams, RailingPath, RailingType } from '../../types/railing-types';
import { DEFAULT_RAILING_TYPE, DEFAULT_RAILING_TOTAL_HEIGHT_MM } from '../../types/railing-types';

/** A metal guardrail Type with «Baluster Per Tread» enabled. */
const PER_TREAD_TYPE: RailingType = {
  ...DEFAULT_RAILING_TYPE,
  balusterPlacement: { ...DEFAULT_RAILING_TYPE.balusterPlacement, perTread: { count: 1 } },
};

/** A rail that rises 1000mm over 1000 canvas-units (45° flight). */
const SLOPED_PATH: RailingPath = [
  { x: 0, y: 0, z: 0 },
  { x: 1000, y: 0, z: 1000 },
];

function hostedParams(overrides: {
  resolvedPath?: RailingPath;
  treadCount?: number;
  perTreadAnchors?: RailingPath;
  type?: RailingType;
} = {}): RailingParams {
  return {
    type: overrides.type ?? DEFAULT_RAILING_TYPE,
    pathSource: {
      kind: 'hosted',
      hostId: 'stair-1',
      hostType: 'stair',
      side: 'outer',
      resolvedPath: overrides.resolvedPath ?? SLOPED_PATH,
      ...(overrides.treadCount !== undefined ? { treadCount: overrides.treadCount } : {}),
      ...(overrides.perTreadAnchors ? { perTreadAnchors: overrides.perTreadAnchors } : {}),
    },
    totalHeightMm: DEFAULT_RAILING_TOTAL_HEIGHT_MM,
    baseElevationMm: 0,
    sceneUnits: 'mm',
  };
}

describe('computeRailingGeometry — hosted stair path (baked snapshot, no live host)', () => {
  it('resolves the path from the baked snapshot so a persisted hosted railing self-hydrates', () => {
    const g = computeRailingGeometry(hostedParams());
    expect(g.resolvedPath).toHaveLength(2);
    expect(g.resolvedPath[1].x).toBeCloseTo(1000);
  });

  it('places posts on the sloped path (base z follows the vertex z, not a flat datum)', () => {
    const g = computeRailingGeometry(hostedParams());
    expect(g.posts).toHaveLength(2);
    expect(g.posts[0].basePoint.z).toBeCloseTo(0);
    expect(g.posts[1].basePoint.z).toBeCloseTo(1000); // top of the flight
  });

  it('builds a sloped top rail (each vertex lifted heightMm above its own z)', () => {
    const g = computeRailingGeometry(hostedParams());
    const top = g.rails.find((r) => r.role === 'top-rail');
    expect(top).toBeDefined();
    expect(top!.path[0].z).toBeCloseTo(1000); // 0 + 1000
    expect(top!.path[1].z).toBeCloseTo(2000); // 1000 + 1000
  });

  it('spans the bbox z over the sloped run + guardrail height', () => {
    const g = computeRailingGeometry(hostedParams());
    expect(g.bbox.min.z).toBeCloseTo(0);
    expect(g.bbox.max.z).toBeCloseTo(2000); // maxZ 1000 + totalHeight 1000
  });
});

describe('computeRailingGeometry — Baluster Per Tread (ADR-407 Φ7b, derive-from-path SSoT)', () => {
  it('places treadCount × perTread.count balusters, positions + z derived from resolvedPath', () => {
    const g = computeRailingGeometry(hostedParams({ treadCount: 4, type: PER_TREAD_TYPE }));
    expect(g.balusters).toHaveLength(4); // 4 treads × 1
    // Even samples of the 45° SLOPED_PATH (len √2·1000) at (i+0.5)/4 → x == z (rides the slope).
    for (const b of g.balusters) {
      expect(b.basePoint.z).toBeCloseTo(b.basePoint.x, 6); // 45° flight: z === x on the path
    }
    // Monotonic ascent, none flat at the datum (the pre-Φ7b stale-anchor float bug).
    const zs = g.balusters.map((b) => b.basePoint.z ?? 0);
    expect(zs[0]).toBeGreaterThan(0);
    expect(zs[3]).toBeGreaterThan(zs[0]);
  });

  it('LEGACY self-heal: a pre-Φ7b doc with only perTreadAnchors uses their COUNT but re-derives z', () => {
    // Stale baked anchors sitting FLAT at the datum (the exact old-code float bug).
    const STALE_FLAT: RailingPath = [
      { x: 250, y: 0, z: 0 },
      { x: 750, y: 0, z: 0 },
    ];
    const g = computeRailingGeometry(hostedParams({ perTreadAnchors: STALE_FLAT, type: PER_TREAD_TYPE }));
    expect(g.balusters).toHaveLength(2); // count from anchors.length
    // z is re-derived from resolvedPath (the 45° slope) — NOT the stale flat 0.
    expect(g.balusters[0].basePoint.z).toBeGreaterThan(0);
    expect(g.balusters[1].basePoint.z).toBeGreaterThan(g.balusters[0].basePoint.z ?? 0);
  });

  it('falls back to along-path spacing when neither treadCount nor anchors are present', () => {
    const g = computeRailingGeometry(hostedParams({ type: PER_TREAD_TYPE }));
    // No count signal → the 100mm ball-rule spacing over the sloped path length (~1414 units).
    expect(g.balusters.length).toBeGreaterThan(2);
  });

  it('REGRESSION (float guard): every baluster top sits at the top-rail underside on the sloped path', () => {
    const g = computeRailingGeometry(hostedParams({ treadCount: 6, type: PER_TREAD_TYPE }));
    const topRail = g.rails.find((r) => r.role === 'top-rail')!;
    const railRadius = PER_TREAD_TYPE.topRail.profile.heightMm / 2;
    // The rail path is resolvedPath lifted by topRail.heightMm; balusters sample the SAME path,
    // so at each baluster the rail-underside z (railCentre − radius) equals the baluster top.
    for (const b of g.balusters) {
      const t = (b.basePoint.x ?? 0) / 1000; // 45° path param from x
      const railCentreZ = topRail.path[0].z! + (topRail.path[1].z! - topRail.path[0].z!) * t;
      const balusterTop = (b.basePoint.z ?? 0) + b.heightMm;
      expect(balusterTop).toBeCloseTo(railCentreZ - railRadius, 3); // touching (≤1mm)
    }
  });
});
