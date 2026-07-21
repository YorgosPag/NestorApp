/**
 * ADR-637 — straight run with intermediate rest landings (πλατύσκαλα).
 *
 * Geometry parameterization (canonical mm, +X/+Y math frame):
 *   - stepCount=10, rise=175, tread=280, nosing=25, width=1000
 *   - basePoint=(0,0,0), direction=0° (+X), upDirection='forward'
 *
 * Invariants under a rest landing (matches the L-shape `n1+1+n2` z-model):
 *   - total rise / top elevation unchanged (a landing consumes one rise level);
 *   - tread count = stepCount − landingCount;
 *   - plan footprint grows by each landing's length;
 *   - no landings → geometry byte-identical to the single-flight path.
 *
 * @see ../StairGeometryService.ts
 * @see ../stair-run-landings.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  StairParams,
  StairRestLanding,
  StairVariantStraight,
  Polygon3D,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;

function makeStraightParams(overrides?: {
  stepCount?: number;
  restLandings?: readonly StairRestLanding[];
  width?: number;
}): StairParams {
  const stepCount = overrides?.stepCount ?? 10;
  const rise = 175;
  const tread = 280;
  const variant: StairVariantStraight = { kind: 'straight' };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread,
    nosing: 25,
    nosingSide: 'front',
    width: overrides?.width ?? 1000,
    stepCount,
    totalRise: rise * stepCount,
    totalRun: tread * Math.max(stepCount - 1, 0),
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

describe('StairGeometryService — straight with rest landings', () => {
  it('one landing → 1 landing polygon + (stepCount − 1) treads', () => {
    const g = computeStairGeometry(makeStraightParams({ restLandings: [{ id: 'l1', at: 0.5, length: 'auto' }] }));
    expect(g.landings).toHaveLength(1);
    expect(allTreads(g)).toHaveLength(9);
    expect(g.landings[0]).toHaveLength(4); // convex quad
  });

  it('landing sits flat, one riser above the flight below it', () => {
    const g = computeStairGeometry(makeStraightParams({ restLandings: [{ id: 'l1', at: 0.5, length: 'auto' }] }));
    const landingZ = g.landings[0][0].z;
    // at=0.5, stepCount=10 → level 5 → z = 175·5 = 875
    expect(landingZ).toBeCloseTo(875, 6);
    for (const v of g.landings[0]) expect(Math.abs(v.z - landingZ)).toBeLessThan(Z_TOL);
  });

  it('total rise / top elevation invariant vs. no-landing stair', () => {
    const plain = computeStairGeometry(makeStraightParams());
    const withLanding = computeStairGeometry(makeStraightParams({ restLandings: [{ id: 'l1', at: 0.5, length: 'auto' }] }));
    expect(withLanding.bbox.max.z).toBeCloseTo(plain.bbox.max.z, 6);
  });

  it('plan footprint GROWS by the landing length (footprint extends, treads keep depth)', () => {
    const plain = computeStairGeometry(makeStraightParams());
    const withLanding = computeStairGeometry(makeStraightParams({ restLandings: [{ id: 'l1', at: 0.5, length: 1500 }] }));
    // landing replaces one tread-step (280) with a 1500 stretch → net +≈1220
    expect(withLanding.bbox.max.x).toBeGreaterThan(plain.bbox.max.x + 1000);
  });

  it('two landings → 2 polygons, treads = stepCount − 2', () => {
    const g = computeStairGeometry(
      makeStraightParams({ stepCount: 12, restLandings: [{ id: 'a', at: 0.3, length: 'auto' }, { id: 'b', at: 0.7, length: 'auto' }] }),
    );
    expect(g.landings).toHaveLength(2);
    expect(allTreads(g)).toHaveLength(10);
  });

  it('no landings → identical output to a params object without the field', () => {
    const a = computeStairGeometry(makeStraightParams({ restLandings: [] }));
    const b = computeStairGeometry(makeStraightParams());
    expect(a.landings).toHaveLength(0);
    expect(allTreads(a)).toHaveLength(10);
    expect(a.bbox).toEqual(b.bbox);
  });

  it('all treads stay co-planar at their level elevation', () => {
    const g = computeStairGeometry(makeStraightParams({ restLandings: [{ id: 'l1', at: 0.5, length: 'auto' }] }));
    for (const t of allTreads(g)) {
      const z = t[0].z;
      for (const v of t) expect(Math.abs(v.z - z)).toBeLessThan(Z_TOL);
    }
  });

  it('transition risers bridge the landing (no floating tread around the πλατύσκαλο)', () => {
    // Regression: the per-segment flight generators only emit count−1 INTERNAL
    // risers, so the two level boundaries around a landing had no riser — a tread
    // sat floating a rise above/below the landing with no vertical face.
    const g = computeStairGeometry(makeStraightParams({ restLandings: [{ id: 'l1', at: 0.5, length: 'auto' }] }));
    // stepCount=10: a rest landing REPLACES one tread level (9 treads + 1 landing,
    // levels 0..9) → 9 level transitions → 9 risers (4+3 internal + 2 around the landing).
    expect(g.risers).toHaveLength(9);
    const bridges = (zLo: number, zHi: number): boolean =>
      g.risers.some((r) => {
        const lo = Math.min(r.start.z, r.end.z);
        const hi = Math.max(r.start.z, r.end.z);
        return Math.abs(lo - zLo) < 1e-6 && Math.abs(hi - zHi) < 1e-6;
      });
    // rise=175: flight-below top tread @700 → landing @875 → flight-above first @1050.
    expect(bridges(700, 875)).toBe(true);
    expect(bridges(875, 1050)).toBe(true);
  });
});
