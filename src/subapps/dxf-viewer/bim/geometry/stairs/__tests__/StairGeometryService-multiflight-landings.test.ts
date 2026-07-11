/**
 * ADR-637 Phase 2 — multi-flight run carrying intermediate rest landings.
 *
 * Invariants (mirror the straight-landings suite, extended for turns):
 *   - rest-landing count adds to the turn-landing count in `landings[]`;
 *   - tread count = Σflights − restLandingCount (turn landings counted separately);
 *   - total rise / top elevation unchanged vs. the no-rest-landing multi-flight;
 *   - plan footprint grows by each rest landing's length;
 *   - treads stay co-planar per level;
 *   - no rest landings → byte-identical to the existing `walkMultiFlight` path;
 *   - label numbering interleaves rest + turn landings continuously.
 *
 * @see ../stair-geometry-multiflight.ts
 * @see ../stair-flight-run-builder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairRestLanding,
  StairTurnNode,
  StairVariantMultiFlight,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;
const RISE = 175;
const TREAD = 280;
const WIDTH = 1000;

function makeParams(
  flights: readonly number[],
  turns: readonly StairTurnNode[],
  overrides?: {
    restLandings?: readonly StairRestLanding[];
    treadLabelDisplay?: 'all' | 'nth' | 'none';
  },
): StairParams {
  const stepCount = flights.reduce((s, n) => s + n, 0);
  const variant: StairVariantMultiFlight = { kind: 'multi-flight', flights, turns };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise: RISE,
    tread: TREAD,
    nosing: 25,
    nosingSide: 'front',
    width: WIDTH,
    stepCount,
    totalRise: RISE * (stepCount + turns.length),
    totalRun: TREAD * stepCount,
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant,
    restLandings: overrides?.restLandings,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: overrides?.treadLabelDisplay ?? 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

const turn = (dir: 'left' | 'right', deg = 90): StairTurnNode => ({
  turnDirection: dir,
  turnAngleDeg: deg,
  cornerStyle: 'landing',
  landingDepth: 'auto',
});

const allTreads = (g: ReturnType<typeof computeStairGeometry>): readonly Polygon3D[] => [
  ...g.treadsBelowCut,
  ...g.treadsAboveCut,
];

const topZ = (g: ReturnType<typeof computeStairGeometry>): number => {
  let z = -Infinity;
  for (const t of allTreads(g)) for (const v of t) z = Math.max(z, v.z);
  return z;
};

describe('StairGeometryService — multi-flight with rest landings', () => {
  it('one rest landing in flight 1 → 1 rest + 1 turn landing, treads = Σflights − 1', () => {
    const g = computeStairGeometry(
      makeParams([5, 5], [turn('right')], { restLandings: [{ id: 'r1', at: 0.25, length: 'auto' }] }),
    );
    expect(g.landings).toHaveLength(2); // 1 rest + 1 turn
    expect(allTreads(g)).toHaveLength(9); // 10 − 1 rest landing
  });

  it('total rise / top elevation invariant vs. no-rest multi-flight', () => {
    const plain = computeStairGeometry(makeParams([5, 5], [turn('right')]));
    const withRest = computeStairGeometry(
      makeParams([5, 5], [turn('right')], { restLandings: [{ id: 'r1', at: 0.25, length: 'auto' }] }),
    );
    expect(topZ(withRest)).toBeCloseTo(topZ(plain), 6);
  });

  it('rest landing sits flat at its level z (co-planar quad)', () => {
    const g = computeStairGeometry(
      makeParams([5, 5], [turn('right')], { restLandings: [{ id: 'r1', at: 0.25, length: 'auto' }] }),
    );
    // Flight-1 rest landing routed to local level 2 → z = 175·2 = 350.
    const rest = g.landings.find((poly) => Math.abs(poly[0].z - 350) < Z_TOL);
    expect(rest).toBeDefined();
    if (rest) for (const v of rest) expect(Math.abs(v.z - rest[0].z)).toBeLessThan(Z_TOL);
  });

  it('plan footprint GROWS with a long rest landing', () => {
    const plain = computeStairGeometry(makeParams([5, 5], [turn('right')]));
    const withRest = computeStairGeometry(
      makeParams([5, 5], [turn('right')], { restLandings: [{ id: 'r1', at: 0.25, length: 2000 }] }),
    );
    const dx = withRest.bbox.max.x - withRest.bbox.min.x;
    const dx0 = plain.bbox.max.x - plain.bbox.min.x;
    expect(dx).toBeGreaterThan(dx0 + 1000);
  });

  it('all treads stay co-planar at their level elevation', () => {
    const g = computeStairGeometry(
      makeParams([5, 5], [turn('left')], { restLandings: [{ id: 'r1', at: 0.3, length: 'auto' }] }),
    );
    for (const t of allTreads(g)) {
      const z = t[0].z;
      for (const v of t) expect(Math.abs(v.z - z)).toBeLessThan(Z_TOL);
    }
  });

  it('no rest landings → identical output to the existing path', () => {
    const a = computeStairGeometry(makeParams([5, 5], [turn('right')], { restLandings: [] }));
    const b = computeStairGeometry(makeParams([5, 5], [turn('right')]));
    expect(a.landings).toHaveLength(1);
    expect(allTreads(a)).toHaveLength(10);
    expect(a.bbox).toEqual(b.bbox);
    expect(a.walkline).toEqual(b.walkline);
  });

  it('rest landings across both flights → 2 rest + 1 turn landing, treads = Σflights − 2', () => {
    const g = computeStairGeometry(
      makeParams([5, 5], [turn('right')], {
        restLandings: [{ id: 'a', at: 0.25, length: 'auto' }, { id: 'b', at: 0.75, length: 'auto' }],
      }),
    );
    expect(g.landings).toHaveLength(3); // 2 rest + 1 turn
    expect(allTreads(g)).toHaveLength(8);
  });

  it('label numbering interleaves rest + turn landings continuously', () => {
    const g = computeStairGeometry(
      makeParams([5, 5], [turn('right')], {
        restLandings: [{ id: 'r1', at: 0.25, length: 'auto' }],
        treadLabelDisplay: 'all',
      }),
    );
    if (!g.treadLabels) throw new Error('expected labels');
    // 9 treads + 2 landings (1 rest + 1 turn) = 11 continuous labels.
    expect(g.treadLabels).toHaveLength(11);
    expect(g.treadLabels.map((l) => l.text)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    );
    expect(g.treadLabels.filter((l) => l.kind === 'landing')).toHaveLength(2);
  });
});
