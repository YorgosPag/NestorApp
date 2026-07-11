/**
 * ADR-637 Phase 3 — `StairGeometryService` sketch + rest-landings tests.
 *
 * A straight 6-vertex sketch walkline (stepCount=5) with one mid-run rest landing:
 * the landing level's chord becomes a flat quad in `landings[]`, the remaining
 * chords stay rising treads, and the walkline z-progression is untouched.
 *
 * @see ../stair-geometry-sketch.ts
 * @see ../stair-walkline-run-builder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Point3D,
  Polygon3D,
  StairParams,
  StairRestLanding,
  StairVariantSketch,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;

function makeSketchParams(restLandings?: readonly StairRestLanding[]): StairParams {
  const walklinePath: readonly Point3D[] = [
    { x: 0, y: 0, z: 0 },
    { x: 300, y: 0, z: 0 },
    { x: 600, y: 0, z: 0 },
    { x: 900, y: 0, z: 0 },
    { x: 1200, y: 0, z: 0 },
    { x: 1500, y: 0, z: 0 },
  ];
  const variant: StairVariantSketch = { kind: 'sketch', walklinePath };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise: 600,
    tread: 300,
    nosing: 0,
    nosingSide: 'none',
    width: 800,
    stepCount: 5,
    totalRise: 3000,
    totalRun: 0,
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
    restLandings,
  };
}

function allTreads(g: ReturnType<typeof computeStairGeometry>): readonly Polygon3D[] {
  return [...g.treadsBelowCut, ...g.treadsAboveCut];
}

describe('StairGeometryService — sketch rest landings (ADR-637 Φ3)', () => {
  it('no rest landings → byte-identical single-flight path (5 treads, no landings)', () => {
    const g = computeStairGeometry(makeSketchParams());
    expect(allTreads(g)).toHaveLength(5);
    expect(g.landings ?? []).toHaveLength(0);
    expect(g.restLandingHandles).toBeUndefined();
  });

  it('one auto landing at mid-run → 4 rising treads + 1 flat landing quad', () => {
    const g = computeStairGeometry(makeSketchParams([{ id: 'r1', at: 0.5, length: 'auto' }]));
    expect(allTreads(g)).toHaveLength(4);
    expect(g.landings).toHaveLength(1);
    // Landing sits flat at z = 2·rise = 1200 (level 2 of stepCount=5).
    for (const v of g.landings[0]) expect(Math.abs(v.z - 1200)).toBeLessThan(Z_TOL);
    // Walkline keeps stepCount+1 points and its top elevation (rise invariant).
    expect(g.walkline).toHaveLength(6);
    expect(g.walkline[g.walkline.length - 1].z).toBeCloseTo(3000, 9);
  });

  it('ADR-637 Φ4-C — rest-landing grip handle surfaced (chord midpoint, unit tangent)', () => {
    const g = computeStairGeometry(makeSketchParams([{ id: 'r1', at: 0.5, length: 'auto' }]));
    expect(g.restLandingHandles).toHaveLength(1);
    const h = g.restLandingHandles![0];
    expect(h.id).toBe('r1');
    expect(h.length).toBeCloseTo(800, 6); // 'auto' → width
    // Level-2 chord x=600 stretched to length 800 → end x=1400 → midpoint x=1000.
    expect(h.center.x).toBeCloseTo(1000, 6);
    // Handle sits at the landing quad's flat z (level 2 → 2·rise = 1200).
    expect(h.center.z).toBeCloseTo(1200, 6);
    expect(Math.hypot(h.along.x, h.along.y)).toBeCloseTo(1, 6); // chord unit tangent
  });
});
