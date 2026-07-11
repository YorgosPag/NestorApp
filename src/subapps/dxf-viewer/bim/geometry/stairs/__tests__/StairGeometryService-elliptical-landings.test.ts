/**
 * ADR-637 Phase 3 — `StairGeometryService` elliptical + rest-landings tests.
 *
 * A 270° elliptical run (stepCount=12) with one mid-run rest landing: the landing
 * level's arc-chord becomes a flat quad in `landings[]`, the other chords stay
 * rising wedge treads, and the sampled walkline keeps its z-progression + top
 * elevation (a rest landing consumes one level, footprint grows — ADR-637 §2).
 *
 * @see ../stair-geometry-elliptical.ts
 * @see ../stair-walkline-run-builder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairRestLanding,
  StairVariantElliptical,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;

function makeEllipticalParams(restLandings?: readonly StairRestLanding[]): StairParams {
  const stepCount = 12;
  const totalRise = 2100;
  const variant: StairVariantElliptical = {
    kind: 'elliptical',
    centerPoint: { x: 0, y: 0, z: 0 },
    semiMajor: 1500,
    semiMinor: 1000,
    sweepAngle: 270,
    turnDirection: 'ccw',
    rotation: 0,
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise: totalRise / stepCount,
    tread: 250,
    nosing: 0,
    nosingSide: 'none',
    width: 800,
    stepCount,
    totalRise,
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

describe('StairGeometryService — elliptical rest landings (ADR-637 Φ3)', () => {
  it('no rest landings → 12 treads, no landings (byte-identical path)', () => {
    const g = computeStairGeometry(makeEllipticalParams());
    expect(allTreads(g)).toHaveLength(12);
    expect(g.landings ?? []).toHaveLength(0);
  });

  it('one landing at mid-run → 11 rising wedges + 1 flat landing quad', () => {
    const g = computeStairGeometry(makeEllipticalParams([{ id: 'r1', at: 0.5, length: 'auto' }]));
    expect(allTreads(g)).toHaveLength(11);
    expect(g.landings).toHaveLength(1);
    // Landing quad is planar (all four corners share z).
    const z0 = g.landings[0][0].z;
    for (const v of g.landings[0]) expect(Math.abs(v.z - z0)).toBeLessThan(Z_TOL);
    // Walkline keeps stepCount+1 points and its top elevation.
    expect(g.walkline).toHaveLength(13);
    expect(g.walkline[g.walkline.length - 1].z).toBeCloseTo(2100, 9);
  });

  it('grips deferred → no restLandingHandles surfaced for elliptical', () => {
    const g = computeStairGeometry(makeEllipticalParams([{ id: 'r1', at: 0.5, length: 'auto' }]));
    expect(g.restLandingHandles).toBeUndefined();
  });
});
