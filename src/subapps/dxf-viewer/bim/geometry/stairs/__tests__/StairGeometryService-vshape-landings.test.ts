/**
 * ADR-637 Phase 2 — V-shape arms carrying intermediate rest landings.
 *
 * Both arms diverge from the shared apex; each is one `buildRectilinearRun` with
 * its partitioned landings. The apex is a geometric junction, NOT a landing.
 *
 * Invariants:
 *   - rest-landing count = landings in `landings[]` (no junction landing);
 *   - tread count = Σarms − restLandingCount;
 *   - each arm's top elevation unchanged vs. the no-rest V-shape;
 *   - footprint grows;
 *   - treads co-planar per level;
 *   - no rest landings → identical to the existing bare-flight path.
 *
 * @see ../stair-geometry-vshape.ts
 * @see ../stair-flight-run-builder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairRestLanding,
  StairVariantVShape,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;
const RISE = 175;

function makeParams(overrides?: {
  armSplit?: readonly [number, number];
  armAngleDeg?: number;
  restLandings?: readonly StairRestLanding[];
}): StairParams {
  const armSplit = overrides?.armSplit ?? ([5, 5] as const);
  const stepCount = armSplit[0] + armSplit[1];
  const variant: StairVariantVShape = {
    kind: 'v-shape',
    armAngleDeg: overrides?.armAngleDeg ?? 90,
    armSplit,
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
    totalRun: 280 * Math.max(stepCount - 1, 0),
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
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

const allTreads = (g: ReturnType<typeof computeStairGeometry>): readonly Polygon3D[] => [
  ...g.treadsBelowCut,
  ...g.treadsAboveCut,
];

const topZ = (g: ReturnType<typeof computeStairGeometry>): number => {
  let z = -Infinity;
  for (const t of allTreads(g)) for (const v of t) z = Math.max(z, v.z);
  return z;
};

describe('StairGeometryService — V-shape with rest landings', () => {
  it('one rest landing per arm → 2 landings (no junction landing), treads = 8', () => {
    const g = computeStairGeometry(
      makeParams({ restLandings: [{ id: 'a', at: 0.25, length: 'auto' }, { id: 'b', at: 0.75, length: 'auto' }] }),
    );
    expect(g.landings).toHaveLength(2);
    expect(allTreads(g)).toHaveLength(8);
  });

  it('single rest landing in one arm → 1 landing, treads = 9', () => {
    const g = computeStairGeometry(makeParams({ restLandings: [{ id: 'a', at: 0.25, length: 'auto' }] }));
    expect(g.landings).toHaveLength(1);
    expect(allTreads(g)).toHaveLength(9);
  });

  it('each arm top elevation invariant vs. no-rest V-shape', () => {
    const plain = computeStairGeometry(makeParams());
    const withRest = computeStairGeometry(
      makeParams({ restLandings: [{ id: 'a', at: 0.25, length: 'auto' }, { id: 'b', at: 0.75, length: 'auto' }] }),
    );
    expect(topZ(withRest)).toBeCloseTo(topZ(plain), 6);
  });

  it('rest landings sit flat at their level z', () => {
    const g = computeStairGeometry(
      makeParams({ restLandings: [{ id: 'a', at: 0.25, length: 'auto' }, { id: 'b', at: 0.75, length: 'auto' }] }),
    );
    // Both arms start at apex z=0; a local-level-2 rest landing sits at z = 175·2 = 350.
    for (const poly of g.landings) {
      expect(poly[0].z).toBeCloseTo(350, 6);
      for (const v of poly) expect(Math.abs(v.z - poly[0].z)).toBeLessThan(Z_TOL);
    }
  });

  it('plan footprint GROWS with a long rest landing', () => {
    const plain = computeStairGeometry(makeParams());
    const withRest = computeStairGeometry(makeParams({ restLandings: [{ id: 'a', at: 0.25, length: 2000 }] }));
    expect(withRest.bbox.max.x - withRest.bbox.min.x).toBeGreaterThan(
      plain.bbox.max.x - plain.bbox.min.x,
    );
  });

  it('all treads stay co-planar at their level elevation', () => {
    const g = computeStairGeometry(makeParams({ restLandings: [{ id: 'a', at: 0.25, length: 'auto' }] }));
    for (const t of allTreads(g)) {
      const z = t[0].z;
      for (const v of t) expect(Math.abs(v.z - z)).toBeLessThan(Z_TOL);
    }
  });

  it('no rest landings → identical to the existing path', () => {
    const a = computeStairGeometry(makeParams({ restLandings: [] }));
    const b = computeStairGeometry(makeParams());
    expect(a.landings).toHaveLength(0);
    expect(allTreads(a)).toHaveLength(10);
    expect(a.bbox).toEqual(b.bbox);
    expect(a.walkline).toEqual(b.walkline);
  });
});
