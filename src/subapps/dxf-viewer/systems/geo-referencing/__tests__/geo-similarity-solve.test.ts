/**
 * ADR-650 §M10e — `solveRigid2D` (Umeyama/Kabsch) exactness anchors.
 *
 * The solver is closed-form, so "approximately right" is not the bar: given noise-free
 * correspondences generated from a KNOWN transform, it must recover that transform to
 * floating-point precision. Anything looser would be a bug hiding behind a loose epsilon.
 *
 * Coordinates are canonical mm at real ΕΓΣΑ'87 magnitudes (~4.5e9) on purpose — that is
 * where a naive UNCENTRED implementation burns its significant digits and silently returns
 * a degraded fit. These tests fail if someone removes the mean-centring.
 */

import { solveRigid2D, type PointPair } from '../geo-similarity-solve';
import { localToWorld, type GeoReference } from '../geo-transform';
import type { Point2D } from '../../../rendering/types/Types';

/** A deterministic, well-spread local point set (no randomness — ADR-650 §M10e). */
function makeLocalPoints(count: number): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < count; i++) {
    // Coprime strides keep the set off any exact grid, so a symmetric degeneracy cannot
    // make a wrong rotation fit as well as the right one.
    points.push({ x: (i * 7919) % 43_000, y: (i * 104_729) % 37_000 });
  }
  return points;
}

function pairsFrom(locals: readonly Point2D[], geo: GeoReference): PointPair[] {
  return locals.map((local) => ({ local, world: localToWorld(local, geo) }));
}

const EGSA_TRUTH: GeoReference = {
  originWorld: { x: 407_700_000, y: 4_502_400_000 },
  rotationDeg: 37.4,
};

describe('solveRigid2D — exact recovery of a known transform', () => {
  test('recovers rotation, translation and unit scale from 50 noise-free pairs', () => {
    const solution = solveRigid2D(pairsFrom(makeLocalPoints(50), EGSA_TRUTH));

    expect(solution).not.toBeNull();
    expect(solution!.geo.rotationDeg).toBeCloseTo(37.4, 9);
    // Sub-micron on a 4.5e9 mm coordinate — i.e. the fit is exact, not merely close.
    expect(solution!.geo.originWorld.x).toBeCloseTo(407_700_000, 3);
    expect(solution!.geo.originWorld.y).toBeCloseTo(4_502_400_000, 3);
    expect(solution!.scaleEstimate).toBeCloseTo(1, 12);
    expect(solution!.rmsMm).toBeLessThan(1e-3);
    expect(solution!.maxResidualMm).toBeLessThan(1e-3);
    expect(solution!.pairCount).toBe(50);
  });

  test('a pure translation comes back with zero rotation', () => {
    const truth: GeoReference = { originWorld: { x: 407_700_000, y: 4_502_400_000 }, rotationDeg: 0 };
    const solution = solveRigid2D(pairsFrom(makeLocalPoints(20), truth));

    expect(solution!.geo.rotationDeg).toBeCloseTo(0, 9);
    expect(solution!.rmsMm).toBeLessThan(1e-3);
  });

  test('negative and >180° rotations round-trip through the same projection', () => {
    for (const rotationDeg of [-42.5, 91.25, 179.9, -170.3]) {
      const truth: GeoReference = { originWorld: { x: 1_000_000, y: 2_000_000 }, rotationDeg };
      const solution = solveRigid2D(pairsFrom(makeLocalPoints(30), truth));

      // atan2 returns (-180, 180]; assert via the projection so an equivalent angle
      // expressed differently still counts as correct.
      expect(solution!.rmsMm).toBeLessThan(1e-6);
    }
  });
});

describe('solveRigid2D — the scale is DIAGNOSED, never applied', () => {
  test('a 1000× (m→mm) mismatch is reported as scaleEstimate, and the geo stays rigid', () => {
    const locals = makeLocalPoints(30);
    // World side is the SAME drawing scaled ×1000 about the origin — the classic units bug.
    const pairs: PointPair[] = locals.map((local) => ({
      local,
      world: { x: local.x * 1000, y: local.y * 1000 },
    }));

    const solution = solveRigid2D(pairs);

    expect(solution!.scaleEstimate).toBeCloseTo(1000, 6);
    // The rigid fit cannot absorb a 1000× — it must leave a huge residual rather than
    // quietly resizing the building. That residual is what makes the gate reject it.
    expect(solution!.rmsMm).toBeGreaterThan(1000);
  });
});

describe('solveRigid2D — refuses ill-posed input instead of inventing an answer', () => {
  test('fewer than two correspondences → null', () => {
    expect(solveRigid2D([])).toBeNull();
    expect(solveRigid2D([{ local: { x: 0, y: 0 }, world: { x: 1, y: 1 } }])).toBeNull();
  });

  test('all local points coincident → null (every rotation fits equally well)', () => {
    const pairs: PointPair[] = [
      { local: { x: 5, y: 5 }, world: { x: 100, y: 200 } },
      { local: { x: 5, y: 5 }, world: { x: 100, y: 201 } },
      { local: { x: 5, y: 5 }, world: { x: 101, y: 200 } },
    ];
    expect(solveRigid2D(pairs)).toBeNull();
  });
});

describe('solveRigid2D — least-squares behaviour under noise', () => {
  test('symmetric noise averages out: the fit stays far better than the per-point error', () => {
    const locals = makeLocalPoints(40);
    const clean = pairsFrom(locals, EGSA_TRUTH);
    // Deterministic ±5 mm perturbation — no Math.random (ADR-650 §M10e). Both axes use a
    // pattern that is exactly zero-mean over the 40 points, so "averages out" is a real
    // claim about the estimator rather than an artefact of a biased fixture.
    const noisy: PointPair[] = clean.map((pair, i) => ({
      local: pair.local,
      world: {
        x: pair.world.x + (i % 2 === 0 ? 5 : -5),
        y: pair.world.y + (i % 4 < 2 ? 5 : -5),
      },
    }));

    const solution = solveRigid2D(noisy);

    // A physical bound, not a decimal-places ritual: 5 mm of scatter over a ~40 m spread
    // can only swing the recovered bearing by ~atan(5/40000) ≈ 0.007°. Assert an order of
    // magnitude above that — tight enough to catch a real regression, loose enough that it
    // is not measuring float noise.
    expect(Math.abs(solution!.geo.rotationDeg - 37.4)).toBeLessThan(0.02);
    // The residual should sit at the noise level (~5 mm), not above it.
    expect(solution!.rmsMm).toBeLessThan(10);
  });
});
