/**
 * ADR-637 Phase 3 (radial) — `StairGeometryService` helical + rest-landings.
 * One mid-run landing becomes a flat annular sector in `landings[]`; the sweep
 * grows, the treads re-flow, the run keeps its top elevation and step count.
 *
 * @see ../stair-geometry-helical.ts
 * @see ../stair-radial-run-builder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairRestLanding,
  StairVariantHelical,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;

function makeHelicalParams(restLandings?: readonly StairRestLanding[]): StairParams {
  const stepCount = 12;
  const rise = 175;
  const variant: StairVariantHelical = {
    kind: 'helical', centerPoint: { x: 0, y: 0, z: 0 },
    innerRadius: 400, outerRadius: 1400, sweepAngle: 270, turnDirection: 'ccw',
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

describe('StairGeometryService — helical rest landings (ADR-637 Φ3 radial)', () => {
  it('no rest landings → 12 treads, no landings (byte-identical path)', () => {
    const g = computeStairGeometry(makeHelicalParams());
    expect(allTreads(g)).toHaveLength(12);
    expect(g.landings ?? []).toHaveLength(0);
  });

  it('one landing at mid-run → 11 annular treads + 1 flat sector, top elevation kept', () => {
    const g = computeStairGeometry(makeHelicalParams([{ id: 'r1', at: 0.5, length: 'auto' }]));
    expect(allTreads(g)).toHaveLength(11);
    expect(g.landings).toHaveLength(1);
    const z0 = g.landings![0][0].z;
    for (const v of g.landings![0]) expect(Math.abs(v.z - z0)).toBeLessThan(Z_TOL);
    expect(g.walkline[g.walkline.length - 1].z).toBeCloseTo(175 * 12, 9);
  });

  it('grips deferred → no restLandingHandles surfaced', () => {
    const g = computeStairGeometry(makeHelicalParams([{ id: 'r1', at: 0.5, length: 'auto' }]));
    expect(g.restLandingHandles).toBeUndefined();
  });
});
