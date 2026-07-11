/**
 * ADR-637 Phase 3 (radial) / Phase 4-C — `StairGeometryService` triangular-fan
 * (βεντάλια) + rest-landings. A triangular-fan is an apex-mode radial run
 * (`innerRadius = 0`, center = `apexPoint`) — geometrically identical to a spiral —
 * so a landing becomes a flat triangular sector (pie slice) at constant z and the
 * fan sweep grows. A rest landing consumes one level, keeping `stepCount` invariant,
 * so the fan's single-arc `stepCount === stepCountPerArc` assertion still holds.
 *
 * @see ../stair-geometry-triangular-fan.ts
 * @see ../stair-radial-run-builder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairRestLanding,
  StairVariantTriangularFan,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;

function makeFanParams(restLandings?: readonly StairRestLanding[]): StairParams {
  const stepCount = 10;
  const rise = 190;
  const variant: StairVariantTriangularFan = {
    kind: 'triangular-fan',
    apexPoint: { x: 0, y: 0, z: 0 },
    openingAngle: 180,
    stepCountPerArc: stepCount,
    turnDirection: 'ccw',
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

describe('StairGeometryService — triangular-fan rest landings (ADR-637 Φ3/Φ4-C)', () => {
  it('no rest landings → 10 triangular treads, no landings (byte-identical path)', () => {
    const g = computeStairGeometry(makeFanParams());
    expect(allTreads(g)).toHaveLength(10);
    expect(g.landings ?? []).toHaveLength(0);
    expect(g.restLandingHandles).toBeUndefined();
  });

  it('one landing at mid-run → 9 triangular treads + 1 flat triangular sector', () => {
    const g = computeStairGeometry(makeFanParams([{ id: 'r1', at: 0.5, length: 'auto' }]));
    expect(allTreads(g)).toHaveLength(9);
    expect(g.landings).toHaveLength(1);
    expect(g.landings![0]).toHaveLength(3); // apex sector = triangle
    const z0 = g.landings![0][0].z;
    for (const v of g.landings![0]) expect(Math.abs(v.z - z0)).toBeLessThan(Z_TOL);
    // stepCount invariant → total rise preserved (assertStepCountMatchesArc holds).
    expect(g.walkline[g.walkline.length - 1].z).toBeCloseTo(190 * 10, 9);
  });

  it('ADR-637 Φ4-C — rest-landing grip handle surfaced (id-tagged, unit tangent)', () => {
    const g = computeStairGeometry(makeFanParams([{ id: 'r1', at: 0.5, length: 'auto' }]));
    expect(g.restLandingHandles).toHaveLength(1);
    const h = g.restLandingHandles![0];
    expect(h.id).toBe('r1');
    expect(h.length).toBeCloseTo(1000, 6); // 'auto' → width
    // Handle sits on the walkline circle: radius = (0 + width)/2 = 500 in apex mode.
    expect(Math.hypot(h.center.x, h.center.y)).toBeCloseTo(500, 6);
    expect(Math.hypot(h.along.x, h.along.y)).toBeCloseTo(1, 6);
  });
});
