/**
 * ADR-637 Phase 2b — Γ (gamma) flights carrying intermediate rest landings.
 *
 * Flight 1 centreline run; flights 2 & 3 edge-origin runs; each of the two turn
 * landings is anchored at the preceding run's real plan end. A rest landing
 * consumes one level within its flight span, so the two-turn z-model is invariant
 * (landing 1 at level n1, landing 2 at level n1+n2+1); only the footprint grows.
 *
 * Baseline ([3,4,3], rise=175): landing 1 z=525 (level 3), landing 2 z=1400
 * (level 8), top tread z=1925 (level 11 = (stepCount+1)·rise).
 *
 * @see ../stair-geometry-gamma.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairRestLanding,
  StairTurnDirectionLR,
  StairVariantGamma,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;
const RISE = 175;

function makeParams(
  restLandings?: readonly StairRestLanding[],
  turnSequence: readonly [StairTurnDirectionLR, StairTurnDirectionLR] = ['right', 'right'],
): StairParams {
  const flightSplit = [3, 4, 3] as const;
  const stepCount = flightSplit[0] + flightSplit[1] + flightSplit[2];
  const variant: StairVariantGamma = {
    kind: 'gamma',
    turnSequence,
    landings: ['auto', 'auto'],
    flightSplit,
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise: RISE,
    tread: 280,
    nosing: 25,
    nosingSide: 'front',
    width: 1000,
    stepCount,
    totalRise: RISE * (stepCount + 1),
    totalRun: 280 * stepCount,
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant,
    restLandings,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

type Geo = ReturnType<typeof computeStairGeometry>;
const allTreads = (g: Geo): readonly Polygon3D[] => [...g.treadsBelowCut, ...g.treadsAboveCut];
const topZ = (g: Geo): number => {
  let z = -Infinity;
  for (const t of allTreads(g)) for (const v of t) z = Math.max(z, v.z);
  return z;
};
const hasLandingAtZ = (g: Geo, z: number): boolean =>
  g.landings.some((p) => Math.abs(p[0].z - z) < 1e-6);

describe('StairGeometryService — Γ (gamma) with rest landings', () => {
  it('one rest landing in flight 1 → 3 landings (rest + 2 turns), 9 treads', () => {
    const g = computeStairGeometry(makeParams([{ id: 'a', at: 0.1, length: 'auto' }]));
    expect(g.landings).toHaveLength(3);
    expect(allTreads(g)).toHaveLength(9);
  });

  it('one rest landing in the middle flight → 3 landings, 9 treads', () => {
    const g = computeStairGeometry(makeParams([{ id: 'a', at: 0.5, length: 'auto' }]));
    expect(g.landings).toHaveLength(3);
    expect(allTreads(g)).toHaveLength(9);
  });

  it('both turn landings (z=525, z=1400) invariant with a rest landing', () => {
    const g = computeStairGeometry(makeParams([{ id: 'a', at: 0.1, length: 'auto' }]));
    expect(hasLandingAtZ(g, RISE * 3)).toBe(true);
    expect(hasLandingAtZ(g, RISE * 8)).toBe(true);
  });

  it('top-tread elevation invariant vs. no-rest Γ', () => {
    const plain = computeStairGeometry(makeParams());
    const withRest = computeStairGeometry(makeParams([{ id: 'a', at: 0.5, length: 'auto' }]));
    expect(topZ(withRest)).toBeCloseTo(topZ(plain), 6);
    expect(topZ(plain)).toBeCloseTo(RISE * 11, 6);
  });

  it('one rest landing per flight → 5 landings (3 rest + 2 turns), 7 treads', () => {
    const g = computeStairGeometry(
      makeParams([
        { id: 'a', at: 0.1, length: 'auto' },
        { id: 'b', at: 0.5, length: 'auto' },
        { id: 'c', at: 0.9, length: 'auto' },
      ]),
    );
    expect(g.landings).toHaveLength(5);
    expect(allTreads(g)).toHaveLength(7);
    expect(g.restLandingHandles).toHaveLength(3);
  });

  it('all treads stay co-planar (also for a re-aligning right/left sequence)', () => {
    const g = computeStairGeometry(makeParams([{ id: 'a', at: 0.5, length: 'auto' }], ['right', 'left']));
    for (const t of allTreads(g)) {
      const z = t[0].z;
      for (const v of t) expect(Math.abs(v.z - z)).toBeLessThan(Z_TOL);
    }
  });

  it('no rest landings → byte-identical to the existing three-flight path', () => {
    const a = computeStairGeometry(makeParams([]));
    const b = computeStairGeometry(makeParams());
    expect(a.landings).toHaveLength(2); // two turn landings only
    expect(allTreads(a)).toHaveLength(10);
    expect(a.restLandingHandles).toBeUndefined();
    expect(a.bbox).toEqual(b.bbox);
    expect(a.walkline).toEqual(b.walkline);
  });
});
