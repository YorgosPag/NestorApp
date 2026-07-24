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

describe('computeRailingGeometry — Baluster Per Tread (ADR-407 Φ7c, tread-seated)', () => {
  // 4 tread anchors seated on the 45° SLOPED_PATH (x == z), one per tread.
  const TREAD_ANCHORS: RailingPath = [
    { x: 200, y: 0, z: 200 },
    { x: 400, y: 0, z: 400 },
    { x: 600, y: 0, z: 600 },
    { x: 800, y: 0, z: 800 },
  ];

  it('places ONE baluster per tread anchor, base seated on the tread-top z', () => {
    const g = computeRailingGeometry(hostedParams({ perTreadAnchors: TREAD_ANCHORS, type: PER_TREAD_TYPE }));
    expect(g.balusters).toHaveLength(4); // one per tread (no landing on this straight flight)
    expect(g.balusters.map((b) => b.basePoint.x)).toEqual([200, 400, 600, 800]);
    expect(g.balusters[0].basePoint.z).toBeCloseTo(200); // base = tread top (stepped)
    expect(g.balusters[3].basePoint.z).toBeCloseTo(800);
  });

  it('STEPPED base: a baluster whose tread top is BELOW the walkline grows to reach the rail', () => {
    // Tread top z=300 at x=600, but the smooth walkline z there is 600 → the baluster must span
    // from 300 up to the rail underside (600 + 975), i.e. height 1275, not the flat 975.
    const g = computeRailingGeometry(hostedParams({ perTreadAnchors: [{ x: 600, y: 0, z: 300 }], type: PER_TREAD_TYPE }));
    expect(g.balusters).toHaveLength(1);
    expect(g.balusters[0].basePoint.z).toBeCloseTo(300); // sits on the (low) tread
    expect(g.balusters[0].basePoint.z + g.balusters[0].heightMm).toBeCloseTo(600 + 975); // top meets rail
  });

  it('REGRESSION (float guard): every baluster top sits at the top-rail underside', () => {
    const g = computeRailingGeometry(hostedParams({ perTreadAnchors: TREAD_ANCHORS, type: PER_TREAD_TYPE }));
    const railRadius = PER_TREAD_TYPE.topRail.profile.heightMm / 2;
    for (const b of g.balusters) {
      const walklineZ = b.basePoint.x; // 45° path: walkline z == x
      const balusterTop = (b.basePoint.z ?? 0) + b.heightMm;
      expect(balusterTop).toBeCloseTo(walklineZ + DEFAULT_RAILING_TOTAL_HEIGHT_MM - railRadius, 3);
    }
  });

  it('fills a FLAT landing segment with ball-rule spacing balusters', () => {
    // Flight up, then a 500-long flat landing at z=1000 (spacing 100 → interior balusters).
    const withLanding: RailingPath = [
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 1000 },
      { x: 1500, y: 0, z: 1000 },
    ];
    const g = computeRailingGeometry(hostedParams({
      resolvedPath: withLanding,
      perTreadAnchors: [{ x: 500, y: 0, z: 500 }],
      type: PER_TREAD_TYPE,
    }));
    // 1 flight baluster + landing infill (500 / 100 = 5 gaps → 4 interior) sitting flat at z=1000.
    const landing = g.balusters.filter((b) => Math.abs((b.basePoint.z ?? 0) - 1000) < 1e-6);
    expect(landing.length).toBeGreaterThanOrEqual(3);
    for (const b of landing) expect(b.heightMm).toBeCloseTo(975); // flat rail directly above
  });

  it('falls back to along-path spacing when no anchors are present', () => {
    const g = computeRailingGeometry(hostedParams({ type: PER_TREAD_TYPE }));
    expect(g.balusters.length).toBeGreaterThan(2);
  });
});
