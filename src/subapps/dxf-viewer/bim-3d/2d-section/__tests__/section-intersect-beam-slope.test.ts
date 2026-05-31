/**
 * ADR-401 Phase E/(β) — 2D τομή κεκλιμένης δοκού.
 *
 * Ελέγχει ότι το `toBeamPlan`/`beamSection`:
 *   - flat δοκός → χωρίς `slopeYAt`, back-compat yMin/yMax
 *   - tilted → `slopeYAt` αποτιμά την παρειά κατά μήκος του άξονα
 *   - `beamSection` αποτιμά στο μέσο της εγκάρσιας τομής (single-point rect)
 */

import { toBeamPlan, beamSection } from '../section-intersect';
import { computeBeamGeometry } from '../../../bim/geometry/beam-geometry';
import type { BeamEntity, BeamParams } from '../../../bim/types/beam-types';

const MM_TO_M = 0.001;
const TOL = 6;

function makeBeam(over: Partial<BeamParams> = {}): BeamEntity {
  const params: BeamParams = {
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 1000, y: 0, z: 0 },
    width: 250,
    depth: 400,
    topElevation: 3000,
    sceneUnits: 'mm',
    ...over,
  } as BeamParams;
  return {
    id: 'b',
    type: 'beam',
    kind: params.kind,
    ifcType: 'IfcBeam',
    layerId: '0',
    params,
    geometry: computeBeamGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as BeamEntity;
}

describe('toBeamPlan — flat back-compat', () => {
  it('οριζόντια δοκός → χωρίς slopeYAt, top/bottom σταθερά', () => {
    const plan = toBeamPlan(makeBeam());
    expect(plan.slopeYAt).toBeUndefined();
    expect(plan.topY).toBeCloseTo(3.0, TOL);
    expect(plan.bottomY).toBeCloseTo(3.0 - 0.4, TOL);
  });
});

describe('toBeamPlan — tilted slopeYAt', () => {
  const plan = toBeamPlan(makeBeam({ topElevationEnd: 3500 })); // Δ = 500mm

  it('slopeYAt παρόν', () => {
    expect(plan.slopeYAt).toBeDefined();
  });
  it('start → nominal top (3.0)', () => {
    const { topY, bottomY } = plan.slopeYAt!({ x: 0, y: 0 });
    expect(topY).toBeCloseTo(3.0, TOL);
    expect(bottomY).toBeCloseTo(3.0 - 0.4, TOL);
  });
  it('end → top 3.5 (Δ=500mm)', () => {
    const { topY } = plan.slopeYAt!({ x: 1000, y: 0 });
    expect(topY).toBeCloseTo(3.5, TOL);
  });
  it('mid → top 3.25', () => {
    const { topY, bottomY } = plan.slopeYAt!({ x: 500, y: 0 });
    expect(topY).toBeCloseTo(3.25, TOL);
    expect(bottomY).toBeCloseTo(3.25 - 0.4, TOL);
  });
});

describe('beamSection — αποτίμηση στο μέσο της τομής', () => {
  it('flat → yMin/yMax === bottomY/topY', () => {
    const plan = toBeamPlan(makeBeam());
    const rect = beamSection(plan, 'x', 500)!; // κάθετη τομή στο x=500
    expect(rect).not.toBeNull();
    expect(rect.yMax).toBeCloseTo(3.0, TOL);
    expect(rect.yMin).toBeCloseTo(2.6, TOL);
  });

  it('tilted → η τομή στο x=500 δίνει top 3.25 / bottom 2.85', () => {
    const plan = toBeamPlan(makeBeam({ topElevationEnd: 3500 }));
    const rect = beamSection(plan, 'x', 500)!;
    expect(rect).not.toBeNull();
    expect(rect.yMax).toBeCloseTo(3.25, TOL);
    expect(rect.yMin).toBeCloseTo(2.85, TOL);
    // σταθερό βάθος 0.4
    expect(rect.yMax - rect.yMin).toBeCloseTo(0.4, TOL);
  });

  it('tilted → τομή κοντά στο start (x≈0) δίνει ~nominal top', () => {
    const plan = toBeamPlan(makeBeam({ topElevationEnd: 3500 }));
    const rect = beamSection(plan, 'x', 1)!; // σχεδόν στο start (offset ~0.5mm)
    expect(rect).not.toBeNull();
    expect(rect.yMax).toBeCloseTo(3.0, 2);
  });

  it('τομή εκτός δοκού → null', () => {
    const plan = toBeamPlan(makeBeam({ topElevationEnd: 3500 }));
    expect(beamSection(plan, 'x', 5000)).toBeNull();
  });
});
