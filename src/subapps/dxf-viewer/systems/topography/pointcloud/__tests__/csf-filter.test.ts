/**
 * ADR-650 M8α — CSF (cloth simulation filter) + ground-classification dispatcher.
 *
 * Analytic scenes only: a plane we KNOW the answer for, plus objects we KNOW are not ground. If
 * the cloth ever stops draping, these fail — no golden files, no tolerance fudging.
 */

import { csfClassify } from '../csf-cloth';
import { classifyGround } from '../classify-ground';
import { ASPRS_CLASS } from '../asprs-las-spec';
import { CSF_DEFAULTS } from '../pointcloud-defaults';
import type { CsfOptions, PointCloudData } from '../pointcloud-types';
import { groundGrid, makeCloud, type FixturePoint } from './pointcloud-fixtures';

const EXTENT = 10_000; // 10 m square site
const SPACING = 500; // 0.5 m survey spacing
const ORIGIN = { x: 500_000, y: 4_200_000 }; // ΕΓΣΑ'87-sized origin — proves LOCAL handling

const OPTS: CsfOptions = {
  ...CSF_DEFAULTS,
  clothResolutionMm: 1_000,
  classThresholdMm: 300,
  rigidness: 3,
};

/** z = 1000 + 0.1·x → a 10 % slope, 1 m to 2 m across the site. */
const slope = (x: number): number => 1_000 + 0.1 * x;

/** Points 5 m above the ground at three spots — «trees». Deliberately off the survey grid. */
const trees = (elevation: (x: number, y: number) => number): FixturePoint[] =>
  [
    { x: 2_250, y: 2_250 },
    { x: 5_250, y: 5_250 },
    { x: 8_250, y: 3_250 },
  ].map((p) => ({ x: p.x, y: p.y, z: elevation(p.x, p.y) + 5_000 }));

function slopedSceneWithTrees(): { cloud: PointCloudData; groundCount: number } {
  const ground = groundGrid(EXTENT, SPACING, (x) => slope(x));
  const cloud = makeCloud([...ground, ...trees((x) => slope(x))], ORIGIN);
  return { cloud, groundCount: ground.length };
}

describe('csfClassify — sloped bare earth + trees', () => {
  it('keeps every ground point and rejects every tree point', () => {
    const { cloud, groundCount } = slopedSceneWithTrees();

    const indices = Array.from(csfClassify(cloud, OPTS));

    expect(indices).toEqual([...Array(groundCount).keys()]); // exactly the ground, in order
  });

  it('is deterministic — two runs agree byte for byte', () => {
    const { cloud } = slopedSceneWithTrees();

    const first = csfClassify(cloud, OPTS);
    const second = csfClassify(cloud, OPTS);

    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it('reports monotonic progress and finishes at 1', () => {
    const { cloud } = slopedSceneWithTrees();
    const seen: number[] = [];

    csfClassify(cloud, OPTS, (ratio) => seen.push(ratio));

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(1);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('throws the i18n key when the cloth would need too many particles', () => {
    const { cloud } = slopedSceneWithTrees();

    expect(() => csfClassify(cloud, { ...OPTS, clothResolutionMm: 1 })).toThrow(
      'topography.pointcloud.error.clothTooFine',
    );
  });

  it('returns an empty selection for an empty cloud', () => {
    expect(csfClassify(makeCloud([]), OPTS)).toHaveLength(0);
  });
});

describe('csfClassify — retaining wall (2 m step)', () => {
  /** Flat lower terrace, flat upper terrace, hard break at x = 5 m. */
  const step = (x: number): number => (x < 5_000 ? 1_000 : 3_000);

  function stepScene(): { cloud: PointCloudData; groundCount: number } {
    const ground = groundGrid(EXTENT, SPACING, (x) => step(x));
    const cloud = makeCloud([...ground, ...trees((x) => step(x))], ORIGIN);
    return { cloud, groundCount: ground.length };
  }

  it('rejects every tree and loses earth ONLY in the cell that straddles the break', () => {
    const { cloud, groundCount } = stepScene();
    const ground = groundGrid(EXTENT, SPACING, (x) => step(x));

    const kept = new Set(csfClassify(cloud, OPTS));

    expect([...kept].filter((i) => i >= groundCount)).toEqual([]); // no tree
    expect(kept.size / groundCount).toBeGreaterThan(0.75);
    // Every missed point is within one cloth cell (1 m) of the wall — the cloth hangs off the
    // cliff edge, which is CSF's known and accepted behaviour. Nothing else is lost.
    const missedX = ground.filter((_, i) => !kept.has(i)).map((p) => p.x);
    expect(Math.min(...missedX)).toBeGreaterThanOrEqual(4_000);
    expect(Math.max(...missedX)).toBeLessThanOrEqual(6_000);
  });

  it('a loose cloth (rigidness 1) follows the break better than a rigid one (3)', () => {
    const { cloud } = stepScene();

    const loose = csfClassify(cloud, { ...OPTS, rigidness: 1 });
    const rigid = csfClassify(cloud, { ...OPTS, rigidness: 3 });

    expect(loose.length).toBeGreaterThan(rigid.length);
  });
});

describe('csfClassify — slope smoothing', () => {
  it('rescues points on a slope so steep the cloth would otherwise bridge it', () => {
    const steep = groundGrid(EXTENT, SPACING, (x) => 1_000 + 2.5 * x); // 250 % grade
    const cloud = makeCloud(steep, ORIGIN);

    const on = csfClassify(cloud, { ...OPTS, slopeSmoothing: true });
    const off = csfClassify(cloud, { ...OPTS, slopeSmoothing: false });

    expect(on.length).toBeGreaterThan(off.length);
    expect(on.length).toBeLessThanOrEqual(steep.length); // never invents ground
  });
});

describe('classifyGround — source classification vs CSF', () => {
  /**
   * The trees here are (absurdly) tagged GROUND. If the dispatcher honours the source, they come
   * back; if it secretly re-runs the cloth, they cannot. That is the whole assertion.
   */
  function classifiedScene(): { cloud: PointCloudData; groundCount: number } {
    const ground = groundGrid(EXTENT, SPACING, (x) => slope(x)).map((p) => ({
      ...p,
      cls: ASPRS_CLASS.GROUND,
    }));
    const tagged = trees((x) => slope(x)).map((p) => ({ ...p, cls: ASPRS_CLASS.GROUND }));
    return { cloud: makeCloud([...ground, ...tagged], ORIGIN, true), groundCount: ground.length };
  }

  it('honours an ASPRS class-2 source instead of re-deriving it', () => {
    const { cloud, groundCount } = classifiedScene();

    const result = classifyGround(cloud, OPTS, false);

    expect(result.method).toBe('source-classification');
    expect(result.groundCount).toBe(groundCount + 3); // the mislabelled trees came back → no CSF
    expect(result.nonGroundCount).toBe(0);
  });

  it('runs the cloth anyway when the engineer forces it', () => {
    const { cloud, groundCount } = classifiedScene();

    const result = classifyGround(cloud, OPTS, true);

    expect(result.method).toBe('csf');
    expect(result.groundCount).toBe(groundCount);
    expect(result.nonGroundCount).toBe(3);
  });

  it('runs the cloth on an unclassified cloud', () => {
    const { cloud, groundCount } = slopedSceneWithTrees();

    const result = classifyGround(cloud, OPTS, false);

    expect(result.method).toBe('csf');
    expect(result.groundCount).toBe(groundCount);
  });

  it('runs the cloth when the source carries a class array but nobody is ground', () => {
    const ground = groundGrid(EXTENT, SPACING, (x) => slope(x)).map((p) => ({
      ...p,
      cls: ASPRS_CLASS.UNCLASSIFIED,
    }));
    const cloud = makeCloud(ground, ORIGIN, true);

    expect(classifyGround(cloud, OPTS, false).method).toBe('csf');
  });
});
