/**
 * ADR-637 Phase 2b — L-shape flights carrying intermediate rest landings.
 *
 * Flight 1 is a centreline run (`buildRectilinearRun`); the turn landing is
 * anchored at flight 1's real plan end; flight 2 is an edge-origin run
 * (`buildEdgeOriginRun`). A rest landing consumes one level WITHIN its flight
 * span, so the z-model is invariant (turn landing at level `n1`, flight 2 from
 * level `n1+1`); only the plan footprint grows.
 *
 * Baseline (turnRight, [5,5], rise=175): flight 1 treads levels 0..4; turn
 * landing at level 5 (z=875); flight 2 treads levels 6..10 (top z=1750).
 *
 * Invariants:
 *   - landings[] = rest landings + the single turn landing;
 *   - tread count = (n1+n2) − restLandingCount;
 *   - turn-landing z and top-tread z unchanged vs. the no-rest L-shape;
 *   - footprint grows; treads co-planar per level;
 *   - one grip handle per rest landing;
 *   - no rest landings → identical to the existing two-flight path.
 *
 * @see ../stair-geometry-lshape.ts
 * @see ../stair-flight-run-builder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairRestLanding,
  StairVariantLShape,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;
const RISE = 175;

function makeParams(restLandings?: readonly StairRestLanding[], landingLen?: number): StairParams {
  const flightSplit = [5, 5] as const;
  const stepCount = flightSplit[0] + flightSplit[1];
  const variant: StairVariantLShape = {
    kind: 'l-shape',
    cornerStyle: 'landing',
    turnDirection: 'right',
    landingDepth: 'auto',
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
    totalRise: RISE * stepCount,
    totalRun: 280 * (stepCount - 1),
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant,
    restLandings:
      restLandings && landingLen !== undefined
        ? restLandings.map((r) => ({ ...r, length: landingLen }))
        : restLandings,
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
const landingAtZ = (g: Geo, z: number): Polygon3D | undefined =>
  g.landings.find((p) => Math.abs(p[0].z - z) < 1e-6);

describe('StairGeometryService — L-shape with rest landings', () => {
  it('one rest landing in flight 1 → 2 landings (rest + turn), 9 treads', () => {
    const g = computeStairGeometry(makeParams([{ id: 'a', at: 0.25, length: 'auto' }]));
    expect(g.landings).toHaveLength(2);
    expect(allTreads(g)).toHaveLength(9);
  });

  it('one rest landing in flight 2 → 2 landings, 9 treads', () => {
    const g = computeStairGeometry(makeParams([{ id: 'a', at: 0.75, length: 'auto' }]));
    expect(g.landings).toHaveLength(2);
    expect(allTreads(g)).toHaveLength(9);
  });

  it('turn landing z (level 5 = 875) invariant with a flight-1 rest landing', () => {
    const g = computeStairGeometry(makeParams([{ id: 'a', at: 0.25, length: 'auto' }]));
    expect(landingAtZ(g, RISE * 5)).toBeDefined(); // turn landing unmoved
  });

  it('rest landing sits flat one riser above the flight below it', () => {
    const g = computeStairGeometry(makeParams([{ id: 'a', at: 0.25, length: 'auto' }]));
    // flight-1 rest landing lands on interior level 2 → z = 175·2 = 350.
    const rest = landingAtZ(g, RISE * 2);
    expect(rest).toBeDefined();
    for (const v of rest!) expect(Math.abs(v.z - RISE * 2)).toBeLessThan(Z_TOL);
  });

  it('top-tread elevation invariant vs. no-rest L-shape', () => {
    const plain = computeStairGeometry(makeParams());
    const withRest = computeStairGeometry(makeParams([{ id: 'a', at: 0.25, length: 'auto' }]));
    expect(topZ(withRest)).toBeCloseTo(topZ(plain), 6);
    expect(topZ(plain)).toBeCloseTo(RISE * 10, 6);
  });

  it('plan footprint GROWS with a long flight-1 rest landing', () => {
    const plain = computeStairGeometry(makeParams());
    const withRest = computeStairGeometry(makeParams([{ id: 'a', at: 0.25, length: 'auto' }], 2500));
    const spanX = (g: Geo): number => g.bbox.max.x - g.bbox.min.x;
    expect(spanX(withRest)).toBeGreaterThan(spanX(plain));
  });

  it('emits one grip handle per rest landing', () => {
    const g = computeStairGeometry(
      makeParams([
        { id: 'a', at: 0.2, length: 'auto' },
        { id: 'b', at: 0.8, length: 'auto' },
      ]),
    );
    expect(g.restLandingHandles).toBeDefined();
    expect(g.restLandingHandles).toHaveLength(2);
    expect(g.restLandingHandles!.map((h) => h.id).sort()).toEqual(['a', 'b']);
  });

  it('all treads stay co-planar at their level elevation', () => {
    const g = computeStairGeometry(makeParams([{ id: 'a', at: 0.75, length: 'auto' }]));
    for (const t of allTreads(g)) {
      const z = t[0].z;
      for (const v of t) expect(Math.abs(v.z - z)).toBeLessThan(Z_TOL);
    }
  });

  it('no rest landings → byte-identical to the existing two-flight path', () => {
    const a = computeStairGeometry(makeParams([]));
    const b = computeStairGeometry(makeParams());
    expect(a.landings).toHaveLength(1); // only the turn landing
    expect(allTreads(a)).toHaveLength(10);
    expect(a.restLandingHandles).toBeUndefined();
    expect(a.bbox).toEqual(b.bbox);
    expect(a.walkline).toEqual(b.walkline);
  });
});
