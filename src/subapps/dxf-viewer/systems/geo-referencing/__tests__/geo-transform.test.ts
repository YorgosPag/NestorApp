/**
 * ADR-650 M10 — geo-referencing SSoT tests (rigid transform, schema boundary,
 * robust center, auto-align). All coordinates canonical mm unless noted.
 */

import {
  IDENTITY_GEO_REFERENCE,
  isIdentityGeoReference,
  localToWorld,
  worldToLocal,
  makeWorldToDisplayProjector,
  fromOnePointPair,
  fromTwoPointPairs,
  pointPairScaleRatio,
  type GeoReference,
} from '../geo-transform';
import {
  geoReferenceFromProject,
  geoReferenceToProjectPatch,
  isProjectGeoReferenced,
} from '../geo-reference-schema';
import { computeRobustCenter } from '../../zoom/utils/robust-bounds';
import { autoAlignByRobustCenters } from '../geo-auto-align';

const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

describe('geo-transform — rigid local↔world', () => {
  it('identity maps a point to itself', () => {
    const p = { x: 41_300, y: 147_600 };
    expect(localToWorld(p, IDENTITY_GEO_REFERENCE)).toEqual(p);
    expect(worldToLocal(p, IDENTITY_GEO_REFERENCE)).toEqual(p);
    expect(isIdentityGeoReference(IDENTITY_GEO_REFERENCE)).toBe(true);
    expect(isIdentityGeoReference(null)).toBe(true);
  });

  it('localToWorld / worldToLocal are exact inverses (translation + rotation)', () => {
    const geo: GeoReference = { originWorld: { x: 384_500_000, y: 4_201_200_000 }, rotationDeg: 37 };
    const p = { x: 12_345, y: -6_789 };
    const w = localToWorld(p, geo);
    const back = worldToLocal(w, geo);
    expect(near(back.x, p.x)).toBe(true);
    expect(near(back.y, p.y)).toBe(true);
  });

  it('makeWorldToDisplayProjector: identity/unset is a flagged no-op (backward-compatible fast path)', () => {
    for (const geo of [null, undefined, IDENTITY_GEO_REFERENCE]) {
      const projector = makeWorldToDisplayProjector(geo);
      expect(projector.isIdentity).toBe(true);
      // A no-op still returns the world coords verbatim if a caller ignores the isIdentity guard.
      expect(projector.project(384_500_000, 4_201_200_000)).toEqual({ x: 384_500_000, y: 4_201_200_000 });
    }
  });

  it('makeWorldToDisplayProjector: matches worldToLocal exactly (ONE formula home — 3D seats like 2D)', () => {
    const geo: GeoReference = { originWorld: { x: 384_500_000, y: 4_201_200_000 }, rotationDeg: 37 };
    const projector = makeWorldToDisplayProjector(geo);
    expect(projector.isIdentity).toBe(false);
    for (const w of [{ x: 384_512_345, y: 4_201_193_211 }, { x: 384_500_000, y: 4_201_200_000 }]) {
      const viaProjector = projector.project(w.x, w.y);
      const viaWorldToLocal = worldToLocal(w, geo);
      expect(near(viaProjector.x, viaWorldToLocal.x, 1e-6)).toBe(true);
      expect(near(viaProjector.y, viaWorldToLocal.y, 1e-6)).toBe(true);
    }
  });

  it('fromOnePointPair produces a pure translation (Εγσα anchor, no rotation)', () => {
    const local = { x: 41_300, y: 147_600 };
    const world = { x: 384_500_000, y: 4_201_200_000 };
    const geo = fromOnePointPair(local, world);
    expect(geo.rotationDeg).toBe(0);
    // The picked local point must land exactly on the picked world point.
    const w = localToWorld(local, geo);
    expect(near(w.x, world.x)).toBe(true);
    expect(near(w.y, world.y)).toBe(true);
    // A different local point shifts by the same offset (rigid translation).
    const w2 = localToWorld({ x: local.x + 1000, y: local.y + 2000 }, geo);
    expect(near(w2.x, world.x + 1000)).toBe(true);
    expect(near(w2.y, world.y + 2000)).toBe(true);
  });

  it('fromTwoPointPairs recovers translation + rotation, no scale', () => {
    // Build a known reference, sample two local points, map them, then recover.
    const truth: GeoReference = { originWorld: { x: 1_000_000, y: 2_000_000 }, rotationDeg: 30 };
    const lA = { x: 0, y: 0 };
    const lB = { x: 10_000, y: 0 };
    const wA = localToWorld(lA, truth);
    const wB = localToWorld(lB, truth);
    const geo = fromTwoPointPairs(lA, lB, wA, wB);
    expect(near(geo.rotationDeg, 30, 1e-6)).toBe(true);
    expect(near(geo.originWorld.x, truth.originWorld.x, 1e-3)).toBe(true);
    expect(near(geo.originWorld.y, truth.originWorld.y, 1e-3)).toBe(true);
    // Both anchors map exactly.
    expect(near(localToWorld(lB, geo).x, wB.x, 1e-3)).toBe(true);
    expect(near(localToWorld(lB, geo).y, wB.y, 1e-3)).toBe(true);
  });

  it('pointPairScaleRatio flags a unit mismatch and is ~1 for a rigid match', () => {
    const lA = { x: 0, y: 0 };
    const lB = { x: 1000, y: 0 };
    // Same length in world → ratio 1 (rigid, correct).
    expect(near(pointPairScaleRatio(lA, lB, { x: 0, y: 0 }, { x: 1000, y: 0 }), 1)).toBe(true);
    // World segment 10× longer → ratio 10 (unit mismatch: cm vs mm).
    expect(near(pointPairScaleRatio(lA, lB, { x: 0, y: 0 }, { x: 10_000, y: 0 }), 10)).toBe(true);
    // Degenerate local segment → 1 (no divide-by-zero).
    expect(pointPairScaleRatio(lA, lA, { x: 0, y: 0 }, { x: 5, y: 0 })).toBe(1);
  });
});

describe('geo-reference-schema — Project metres ↔ runtime mm', () => {
  it('returns null when the project has no planar base point', () => {
    expect(geoReferenceFromProject(undefined)).toBeNull();
    expect(geoReferenceFromProject({ northRotation: 12 })).toBeNull();
    expect(geoReferenceFromProject({ basePoint: { z: 0 } })).toBeNull();
    expect(isProjectGeoReferenced({ basePoint: { z: 0 } })).toBe(false);
  });

  it('converts basePoint metres → originWorld mm (×1000) and reads northRotation', () => {
    const geo = geoReferenceFromProject({
      basePoint: { z: 3, x: 384_500, y: 4_201_200 },
      northRotation: 15,
    });
    expect(geo).not.toBeNull();
    expect(geo!.originWorld).toEqual({ x: 384_500_000, y: 4_201_200_000 });
    expect(geo!.rotationDeg).toBe(15);
    expect(isProjectGeoReferenced({ basePoint: { z: 3, x: 384_500, y: 4_201_200 }, northRotation: 15 })).toBe(true);
  });

  it('round-trips runtime → patch → runtime, preserving the elevation datum z', () => {
    const geo: GeoReference = { originWorld: { x: 384_500_000, y: 4_201_200_000 }, rotationDeg: 15 };
    const patch = geoReferenceToProjectPatch(geo, 3, 'γωνία οικοπέδου ΒΔ');
    expect(patch.basePoint.z).toBe(3);
    expect(near(patch.basePoint.x!, 384_500)).toBe(true);
    expect(near(patch.basePoint.y!, 4_201_200)).toBe(true);
    expect(patch.basePoint.description).toBe('γωνία οικοπέδου ΒΔ');
    expect(patch.northRotation).toBe(15);
    const back = geoReferenceFromProject(patch);
    expect(back!.originWorld.x).toBe(geo.originWorld.x);
    expect(back!.originWorld.y).toBe(geo.originWorld.y);
    expect(back!.rotationDeg).toBe(geo.rotationDeg);
  });
});

describe('computeRobustCenter — Εύρημα #1 (bimodal building + far cluster)', () => {
  it('returns null for an empty set', () => {
    expect(computeRobustCenter([])).toBeNull();
  });

  it('finds the building center, ignoring a 17 km stamp cluster + far outliers', () => {
    const pts: { x: number; y: number }[] = [];
    // 40 building points clustered around (41_000, 147_000) mm (~41 m / 147 m).
    for (let i = 0; i < 40; i++) {
      pts.push({ x: 41_000 + (i % 8) * 3000, y: 147_000 + Math.floor(i / 8) * 4000 });
    }
    // 8 points of a legend/stamp cluster at ~17 km (17_000_000 mm) — a real minority.
    for (let i = 0; i < 8; i++) pts.push({ x: 17_000_000 + i * 1000, y: 17_000_000 + i * 1000 });
    // 2 extreme outliers.
    pts.push({ x: -363_608_127, y: 500_000 });
    pts.push({ x: 18_212_871, y: -9_000_000 });

    const result = computeRobustCenter(pts);
    expect(result).not.toBeNull();
    // Center must sit inside the building cluster (tens of metres), NOT between clusters.
    expect(result!.center.x).toBeGreaterThan(30_000);
    expect(result!.center.x).toBeLessThan(80_000);
    expect(result!.center.y).toBeGreaterThan(140_000);
    expect(result!.center.y).toBeLessThan(170_000);
    // The far cluster + outliers were rejected.
    expect(result!.rejected).toBeGreaterThanOrEqual(10);
  });
});

describe('autoAlignByRobustCenters — quick translation first guess', () => {
  it('maps the building robust center onto the terrain robust center', () => {
    const building = [
      { x: 15_720, y: 137_964 },
      { x: 66_785, y: 157_301 },
      { x: 41_000, y: 147_000 },
    ];
    const terrain = [
      { x: 384_500_000, y: 4_201_200_000 },
      { x: 384_560_000, y: 4_201_260_000 },
      { x: 384_530_000, y: 4_201_230_000 },
    ];
    const res = autoAlignByRobustCenters(building, terrain);
    expect(res).not.toBeNull();
    expect(res!.geo.rotationDeg).toBe(0); // translation only
    // The building center must land on the terrain center under the produced transform.
    const mapped = localToWorld(res!.localCenter, res!.geo);
    expect(near(mapped.x, res!.worldCenter.x, 1e-3)).toBe(true);
    expect(near(mapped.y, res!.worldCenter.y, 1e-3)).toBe(true);
  });

  it('returns null when either side is empty', () => {
    expect(autoAlignByRobustCenters([], [{ x: 1, y: 1 }])).toBeNull();
    expect(autoAlignByRobustCenters([{ x: 1, y: 1 }], [])).toBeNull();
  });
});
