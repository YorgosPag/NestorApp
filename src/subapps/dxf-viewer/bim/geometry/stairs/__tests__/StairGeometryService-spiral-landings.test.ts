/**
 * ADR-637 Phase 3 (radial) — `StairGeometryService` spiral + rest-landings.
 * Spiral is the apex (`innerRadius = 0`) radial run: a landing becomes a flat
 * triangular sector (pie slice) in `landings[]` at constant z; the fan sweep grows.
 *
 * @see ../stair-geometry-spiral.ts
 * @see ../stair-radial-run-builder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairRestLanding,
  StairVariantSpiral,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;

function makeSpiralParams(restLandings?: readonly StairRestLanding[]): StairParams {
  const stepCount = 10;
  const rise = 190;
  const variant: StairVariantSpiral = {
    kind: 'spiral', centerPoint: { x: 0, y: 0, z: 0 },
    innerRadius: 0, sweepAngle: 360, turnDirection: 'ccw',
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 }, direction: 0, rise, tread: 250, nosing: 0,
    nosingSide: 'none', width: 1000, stepCount, totalRise: rise * stepCount, totalRun: 0,
    pitch: 30, structureType: 'monolithic', riserType: 'closed', antiskidNosing: false,
    adaContrastStrip: false, variant, walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 }, upDirection: 'forward',
    treadNumberStart: 1, treadLabelDisplay: 'none', treadLabelRestartPerFlight: false,
    codeProfile: 'none', restLandings,
  };
}

function allTreads(g: ReturnType<typeof computeStairGeometry>): readonly Polygon3D[] {
  return [...g.treadsBelowCut, ...g.treadsAboveCut];
}

describe('StairGeometryService — spiral rest landings (ADR-637 Φ3 radial)', () => {
  it('no rest landings → 10 triangular treads, no landings', () => {
    const g = computeStairGeometry(makeSpiralParams());
    expect(allTreads(g)).toHaveLength(10);
    expect(g.landings ?? []).toHaveLength(0);
  });

  it('one landing at mid-run → 9 triangular treads + 1 flat triangular sector', () => {
    const g = computeStairGeometry(makeSpiralParams([{ id: 'r1', at: 0.5, length: 'auto' }]));
    expect(allTreads(g)).toHaveLength(9);
    expect(g.landings).toHaveLength(1);
    expect(g.landings![0]).toHaveLength(3); // apex sector = triangle
    const z0 = g.landings![0][0].z;
    for (const v of g.landings![0]) expect(Math.abs(v.z - z0)).toBeLessThan(Z_TOL);
    expect(g.walkline[g.walkline.length - 1].z).toBeCloseTo(190 * 10, 9);
  });

  it('grips deferred → no restLandingHandles surfaced', () => {
    const g = computeStairGeometry(makeSpiralParams([{ id: 'r1', at: 0.5, length: 'auto' }]));
    expect(g.restLandingHandles).toBeUndefined();
  });
});
