/**
 * ADR-637 Phase 3 (radial) — unit tests for `buildRadialRunWithLandings`.
 * A helical run (annular) + a spiral run (apex) with one mid-run rest landing,
 * asserting the angle-space model: the landing sweeps a wider angle at constant z,
 * the total sweep grows, treads re-flow, z-progression stays invariant.
 *
 * @see ../stair-radial-run-builder.ts
 */

import { buildRadialRunWithLandings } from '../stair-radial-run-builder';
import type { RadialStairConfig } from '../stair-geometry-runs';
import type { StairParams, StairRestLanding, StairVariantHelical } from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;

function helicalParams(restLandings: readonly StairRestLanding[]): StairParams {
  const variant: StairVariantHelical = {
    kind: 'helical', centerPoint: { x: 0, y: 0, z: 0 },
    innerRadius: 400, outerRadius: 1400, sweepAngle: 180, turnDirection: 'ccw',
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 }, direction: 0, rise: 175, tread: 250, nosing: 0,
    nosingSide: 'none', width: 1000, stepCount: 8, totalRise: 175 * 8, totalRun: 0, pitch: 30,
    structureType: 'monolithic', riserType: 'closed', antiskidNosing: false, adaContrastStrip: false,
    variant, walklineOffset: 300, handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward', treadNumberStart: 1, treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false, codeProfile: 'none', restLandings,
  };
}
const HELICAL_CFG: RadialStairConfig = {
  center: { x: 0, y: 0, z: 0 }, innerRadius: 400, outerRadius: 1400,
  sweepAngleDeg: 180, turnDirection: 'ccw', apex: false,
};

describe('buildRadialRunWithLandings', () => {
  it('one auto landing at mid-run → level 4, flat sector, sweep grows, z invariant', () => {
    const g = buildRadialRunWithLandings(helicalParams([{ id: 'l1', at: 0.5, length: 'auto' }]), HELICAL_CFG);
    const treads = [...g.treadsBelowCut, ...g.treadsAboveCut];

    // 8 levels, 1 landing at level 4 → 7 rising treads + 1 landing sector + 7 risers.
    expect(treads).toHaveLength(7);
    expect(g.landings).toHaveLength(1);
    expect(g.risers).toHaveLength(7);

    // Landing sits flat at z = 4·rise = 700 (all annular-quad corners share z).
    for (const v of g.landings![0]) expect(Math.abs(v.z - 700)).toBeLessThan(Z_TOL);

    // z-model invariant: top of the run at rise·stepCount = 1400.
    const w = g.walkline;
    expect(w[w.length - 1].z).toBeCloseTo(1400, 9);
    expect(w).toHaveLength(9); // stepCount+1 boundaries

    // Total sweep grew: last walkline angle > the plain 180° end (angle from +X).
    // Plain: 8·(180/8)=180° → walkline ends at angle 180° (−X axis, y≈0, x<0).
    // With a 1000mm landing at R=900 (≈63.7° extra) the run sweeps past 180°.
    const endAngle = Math.atan2(w[w.length - 1].y, w[w.length - 1].x); // (−π, π]
    expect(endAngle).toBeLessThan(0); // swept beyond 180° into the third quadrant
  });

  it('spiral (apex) landing → triangular sector fan, still one landing + z invariant', () => {
    const spiralCfg: RadialStairConfig = {
      center: { x: 0, y: 0, z: 0 }, innerRadius: 0, outerRadius: 1000,
      sweepAngleDeg: 270, turnDirection: 'ccw', apex: true,
    };
    const params = { ...helicalParams([{ id: 'l1', at: 0.5, length: 'auto' }]), width: 1000, stepCount: 10, totalRise: 175 * 10 };
    const g = buildRadialRunWithLandings(params, spiralCfg);
    expect(g.landings).toHaveLength(1);
    // Apex sector is a triangle (3 vertices), flat at its level z.
    expect(g.landings![0]).toHaveLength(3);
    const z0 = g.landings![0][0].z;
    for (const v of g.landings![0]) expect(Math.abs(v.z - z0)).toBeLessThan(Z_TOL);
    expect([...g.treadsBelowCut, ...g.treadsAboveCut]).toHaveLength(9); // 10 − 1 landing
  });
});
