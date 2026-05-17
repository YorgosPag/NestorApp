/**
 * ADR-358 Phase 3c — `StairGeometryService` V-shape tests.
 *
 * Parameterization (canonical mm, +X/+Y math frame):
 *   - armSplit=[5,5] → stepCount=10; armAngleDeg=90 by default
 *   - rise=175, tread=280, nosing=25, width=1000
 *   - basePoint=(0,0,0), direction=0° (+X), upDirection='forward'
 *
 * z-model: each arm tread j sits at z = j·rise (no landing, both arms share
 * the apex step at z = 0 starting at basePoint).
 *
 * Tolerance: 1e-6 for xy, 1e-9 for z.
 *
 * @see ../StairGeometryService.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairVariantVShape,
} from '../../../types/stair';

const COORD_TOL = 1e-6;
const Z_TOL = 1e-9;

function makeVShapeParams(overrides?: {
  armSplit?: readonly [number, number];
  armAngleDeg?: number;
  rise?: number;
  tread?: number;
  width?: number;
  nosing?: number;
  direction?: number;
}): StairParams {
  const armSplit = overrides?.armSplit ?? ([5, 5] as const);
  const stepCount = armSplit[0] + armSplit[1];
  const rise = overrides?.rise ?? 175;
  const tread = overrides?.tread ?? 280;
  const variant: StairVariantVShape = {
    kind: 'v-shape',
    armAngleDeg: overrides?.armAngleDeg ?? 90,
    armSplit,
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: overrides?.direction ?? 0,
    rise,
    tread,
    nosing: overrides?.nosing ?? 25,
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
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

function centroidXY(poly: Polygon3D): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / poly.length, y: sy / poly.length };
}

describe('StairGeometryService — V-shape', () => {
  it('Test 1: stepCount=10, armSplit=[5,5] → 10 treads, 0 landings', () => {
    const g = computeStairGeometry(makeVShapeParams());
    const total = g.treadsBelowCut.length + g.treadsAboveCut.length;
    expect(total).toBe(10);
    expect(g.landings).toHaveLength(0);
  });

  it('Test 2: 90° arm angle at direction=0° → arm1 along +X, arm2 along +Y', () => {
    const g = computeStairGeometry(makeVShapeParams());
    const allTreads: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    // Arm 1 tread 1 centroid should advance along +X from arm 1 tread 0.
    const arm1t0 = centroidXY(allTreads[0]);
    const arm1t1 = centroidXY(allTreads[1]);
    expect(arm1t1.x - arm1t0.x).toBeCloseTo(280, 6);
    expect(Math.abs(arm1t1.y - arm1t0.y)).toBeLessThan(COORD_TOL);
    // Arm 2 first tread (index 5) → advance along +Y from origin.
    const arm2t0 = centroidXY(allTreads[5]);
    const arm2t1 = centroidXY(allTreads[6]);
    expect(arm2t1.y - arm2t0.y).toBeCloseTo(280, 6);
    expect(Math.abs(arm2t1.x - arm2t0.x)).toBeLessThan(COORD_TOL);
  });

  it('Test 3: each arm has treads at z = j·rise (apex at z=0 shared)', () => {
    const g = computeStairGeometry(makeVShapeParams());
    const allTreads: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    for (let j = 0; j < 5; j++) {
      expect(allTreads[j][0].z).toBeCloseTo(175 * j, 9);
      expect(allTreads[5 + j][0].z).toBeCloseTo(175 * j, 9);
    }
  });

  it('Test 4: walkline has 3 vertices: tip1 → apex → tip2', () => {
    const g = computeStairGeometry(makeVShapeParams());
    expect(g.walkline).toHaveLength(3);
    // Apex (vertex 1) at basePoint.
    expect(g.walkline[1].x).toBeCloseTo(0, 6);
    expect(g.walkline[1].y).toBeCloseTo(0, 6);
    expect(g.walkline[1].z).toBeCloseTo(0, 9);
    // Tip 1 at (tread·n1, 0, rise·n1) = (1400, 0, 875).
    expect(g.walkline[0].x).toBeCloseTo(1400, 6);
    expect(g.walkline[0].y).toBeCloseTo(0, 6);
    expect(g.walkline[0].z).toBeCloseTo(875, 9);
    // Tip 2 at (0, tread·n2, rise·n2) = (0, 1400, 875).
    expect(g.walkline[2].x).toBeCloseTo(0, 6);
    expect(g.walkline[2].y).toBeCloseTo(1400, 6);
    expect(g.walkline[2].z).toBeCloseTo(875, 9);
  });

  it('Test 5: asymmetric armSplit=[3,7] → 10 treads, walkline tips match each arm length', () => {
    const g = computeStairGeometry(makeVShapeParams({ armSplit: [3, 7] }));
    const total = g.treadsBelowCut.length + g.treadsAboveCut.length;
    expect(total).toBe(10);
    // Arm 1 tip at (3·280, 0, 3·175) = (840, 0, 525).
    expect(g.walkline[0].x).toBeCloseTo(840, 6);
    expect(g.walkline[0].z).toBeCloseTo(525, 9);
    // Arm 2 tip at (0, 7·280, 7·175) = (0, 1960, 1225).
    expect(g.walkline[2].y).toBeCloseTo(1960, 6);
    expect(g.walkline[2].z).toBeCloseTo(1225, 9);
  });

  it('Test 6: 60° arm angle → arm2 direction is (cos60°, sin60°)', () => {
    const g = computeStairGeometry(makeVShapeParams({ armAngleDeg: 60 }));
    const allTreads: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const arm2t0 = centroidXY(allTreads[5]);
    const arm2t1 = centroidXY(allTreads[6]);
    const dx = arm2t1.x - arm2t0.x;
    const dy = arm2t1.y - arm2t0.y;
    expect(dx).toBeCloseTo(280 * Math.cos((60 * Math.PI) / 180), 6);
    expect(dy).toBeCloseTo(280 * Math.sin((60 * Math.PI) / 180), 6);
  });

  it('Test 7: risers per arm = (n_i − 1); total = (n1−1)+(n2−1)', () => {
    const g = computeStairGeometry(makeVShapeParams({ armSplit: [4, 6] }));
    expect(g.risers).toHaveLength((4 - 1) + (6 - 1));
  });

  it('Test 8: armAngleDeg=10° throws (below MIN_ARM_ANGLE_DEG=15°)', () => {
    expect(() => computeStairGeometry(makeVShapeParams({ armAngleDeg: 10 }))).toThrow(
      /v-shape armAngleDeg/,
    );
  });

  it('Test 9: armAngleDeg=175° throws (above MAX_ARM_ANGLE_DEG=170°)', () => {
    expect(() => computeStairGeometry(makeVShapeParams({ armAngleDeg: 175 }))).toThrow(
      /v-shape armAngleDeg/,
    );
  });

  it('Test 10: armSplit=[0,5] throws (arm must have ≥1 tread)', () => {
    expect(() => computeStairGeometry(makeVShapeParams({ armSplit: [0, 5] }))).toThrow(
      /armSplit/,
    );
  });

  it('Test 11: stringers are 3-vertex polylines (V-shaped offset of walkline)', () => {
    const g = computeStairGeometry(makeVShapeParams());
    expect(g.stringers.outer).toHaveLength(3);
    expect(g.stringers.inner).toHaveLength(3);
  });

  it('Test 12: arrowSymbol points from apex toward arm 1 tip', () => {
    const g = computeStairGeometry(makeVShapeParams());
    expect(g.arrowSymbol.start.x).toBeCloseTo(0, 6);
    expect(g.arrowSymbol.start.y).toBeCloseTo(0, 6);
    expect(g.arrowSymbol.end.x).toBeCloseTo(g.walkline[0].x, 6);
    expect(g.arrowSymbol.end.y).toBeCloseTo(g.walkline[0].y, 6);
    expect(g.arrowSymbol.label).toBe('UP');
  });

  it('Test 13: bbox spans both arms in xy and 0..maxRise in z', () => {
    const g = computeStairGeometry(makeVShapeParams({ armSplit: [5, 5] }));
    // Arm 1 extends to (n·tread + tread+nosing) ≈ 1705 in x with half-width offset.
    // Arm 2 extends similarly in y. z: 0..rise·(n-1)=700.
    expect(g.bbox.min.z).toBeCloseTo(0, Z_TOL);
    expect(g.bbox.max.z).toBeCloseTo(175 * 4, Z_TOL);
    expect(g.bbox.max.x).toBeGreaterThan(1000);
    expect(g.bbox.max.y).toBeGreaterThan(1000);
  });
});
