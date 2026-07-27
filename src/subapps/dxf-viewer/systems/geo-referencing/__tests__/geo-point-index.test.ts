/**
 * ADR-650 §M10e — the VERIFIER anchors (`scoreGeoReference`).
 *
 * Two things are pinned here:
 *
 *  1. **identity-restore** — the analytic path. A drawing normalized to (0,0) whose
 *     `sourceOrigin` was kept must re-seat onto its own survey points EXACTLY, with no
 *     search and no tolerance games. This is literally Giorgio's file (93 points that are
 *     already bit-identical on disk, stranded ~4.500 km apart only by the lost offset).
 *
 *  2. **the one-to-one rule** — the anti-false-positive core. A scorer that lets many
 *     drawing points claim the same survey point can be fooled into reporting a beautiful
 *     match for a meaningless transform. That is the failure mode that would put a WRONG
 *     geo-reference in front of the engineer wearing a green badge, so it gets its own test.
 */

import { buildWorldPointIndex, scoreGeoReference } from '../geo-point-index';
import { fromOnePointPair, type GeoReference } from '../geo-transform';
import type { PointPair } from '../geo-similarity-solve';
import type { Point2D } from '../../../rendering/types/Types';

/** The real ΕΓΣΑ'87 offset measured on `47_ergasia.dxf`, canonical mm. */
const SOURCE_ORIGIN: Point2D = { x: 407_700_000, y: 4_502_400_000 };

/** 93 deterministic, well-spread survey points in the drawing's LOCAL frame. */
function makeLocalSurvey(count = 93): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < count; i++) {
    points.push({ x: (i * 7919) % 61_000, y: (i * 104_729) % 47_000 });
  }
  return points;
}

/** The same points as the surveyor's CSV holds them: absolute ΕΓΣΑ. */
function toWorld(locals: readonly Point2D[], origin: Point2D): Point2D[] {
  return locals.map((p) => ({ x: p.x + origin.x, y: p.y + origin.y }));
}

const TOLERANCE_MM = 50;

describe('scoreGeoReference — identity-restore (ADR-650 §M10e Σκέλος Α)', () => {
  test('a kept sourceOrigin re-seats all 93 points with a sub-millimetre residual', () => {
    const locals = makeLocalSurvey();
    const index = buildWorldPointIndex(toWorld(locals, SOURCE_ORIGIN), TOLERANCE_MM);

    // The whole of Σκέλος Α, in one line: the restore IS `fromOnePointPair` of the offset.
    const geo = fromOnePointPair({ x: 0, y: 0 }, SOURCE_ORIGIN);
    const score = scoreGeoReference(locals, index, geo);

    expect(score.inliers).toBe(93);
    expect(score.total).toBe(93);
    expect(score.inlierRatio).toBe(1);
    expect(score.rmsMm).toBeLessThan(1);
  });

  test('the restore is exact, not merely inside tolerance', () => {
    const locals = makeLocalSurvey();
    const index = buildWorldPointIndex(toWorld(locals, SOURCE_ORIGIN), TOLERANCE_MM);
    const geo = fromOnePointPair({ x: 0, y: 0 }, SOURCE_ORIGIN);

    // Re-score at a tolerance far tighter than any real survey noise. An approximate
    // restore would collapse here; the analytic one does not care.
    const strict = buildWorldPointIndex(index.points, 0.001);
    expect(scoreGeoReference(locals, strict, geo).inliers).toBe(93);
  });

  test('WITHOUT the offset (the pre-M10e behaviour) nothing matches at all', () => {
    const locals = makeLocalSurvey();
    const index = buildWorldPointIndex(toWorld(locals, SOURCE_ORIGIN), TOLERANCE_MM);

    // Identity == what the app did before: drawing at (0,0), survey at ~4.5e9 mm.
    const identity: GeoReference = { originWorld: { x: 0, y: 0 }, rotationDeg: 0 };
    expect(scoreGeoReference(locals, index, identity).inliers).toBe(0);
  });
});

describe('scoreGeoReference — the one-to-one rule stops inflated scores', () => {
  test('ten drawing points crowding ONE survey point score 1, not 10', () => {
    // A single survey point; ten drawing points all within tolerance of it after transform.
    const worldPoints: Point2D[] = [{ x: 1_000_000, y: 1_000_000 }];
    const index = buildWorldPointIndex(worldPoints, TOLERANCE_MM);

    const locals: Point2D[] = [];
    for (let i = 0; i < 10; i++) locals.push({ x: i * 2, y: -i * 2 }); // all within 30 mm of (0,0)

    const geo: GeoReference = { originWorld: { x: 1_000_000, y: 1_000_000 }, rotationDeg: 0 };
    const score = scoreGeoReference(locals, index, geo);

    // A naive counter would report 10/10 — a perfect match for a meaningless transform.
    expect(score.inliers).toBe(1);
    expect(score.total).toBe(10);
    expect(score.inlierRatio).toBeCloseTo(0.1, 10);
  });

  test('each survey point is consumed once, so a duplicated drawing point cannot double-count', () => {
    const worldPoints: Point2D[] = [{ x: 0, y: 0 }, { x: 10_000, y: 0 }];
    const index = buildWorldPointIndex(worldPoints, TOLERANCE_MM);

    // The same local point twice + one genuine partner.
    const locals: Point2D[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10_000, y: 0 }];
    const geo: GeoReference = { originWorld: { x: 0, y: 0 }, rotationDeg: 0 };

    expect(scoreGeoReference(locals, index, geo).inliers).toBe(2);
  });
});

describe('scoreGeoReference — rejects what it should reject', () => {
  test('a wrong rotation scores essentially nothing', () => {
    const locals = makeLocalSurvey();
    const index = buildWorldPointIndex(toWorld(locals, SOURCE_ORIGIN), TOLERANCE_MM);

    const wrong: GeoReference = { originWorld: SOURCE_ORIGIN, rotationDeg: 17 };
    const score = scoreGeoReference(locals, index, wrong);

    // Only points near the rotation centre can survive a 17° error; nowhere near a pass.
    expect(score.inlierRatio).toBeLessThan(0.1);
  });

  test('empty inputs are answered, not thrown at', () => {
    const index = buildWorldPointIndex([], TOLERANCE_MM);
    const geo: GeoReference = { originWorld: { x: 0, y: 0 }, rotationDeg: 0 };

    expect(scoreGeoReference([], index, geo)).toEqual({ inliers: 0, total: 0, rmsMm: 0, inlierRatio: 0 });
    expect(scoreGeoReference([{ x: 1, y: 1 }], index, geo).inliers).toBe(0);
  });
});

describe('scoreGeoReference — the collector feeds the refine step', () => {
  test('collected pairs are the actual inliers and are usable by solveRigid2D', () => {
    const locals = makeLocalSurvey(20);
    const index = buildWorldPointIndex(toWorld(locals, SOURCE_ORIGIN), TOLERANCE_MM);
    const geo = fromOnePointPair({ x: 0, y: 0 }, SOURCE_ORIGIN);

    const collected: PointPair[] = [];
    const score = scoreGeoReference(locals, index, geo, (pair) => collected.push(pair));

    expect(collected).toHaveLength(score.inliers);
    for (const { local, world } of collected) {
      expect(world.x).toBeCloseTo(local.x + SOURCE_ORIGIN.x, 6);
      expect(world.y).toBeCloseTo(local.y + SOURCE_ORIGIN.y, 6);
    }
  });
});
