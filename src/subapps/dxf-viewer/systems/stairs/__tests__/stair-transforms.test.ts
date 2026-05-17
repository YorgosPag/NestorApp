/**
 * ADR-358 Phase 5c — Stair transforms (G17) tests.
 *
 * Tolerance 1e-6 (matches Phase 2a/2b/3a convention).
 *
 * @see ../stair-transforms.ts
 */

import {
  copyStairParams,
  mirrorStairParams,
  rotateStairParams,
} from '../stair-transforms';
import type {
  StairParams,
  StairVariantElliptical,
  StairVariantGamma,
  StairVariantHelical,
  StairVariantLShape,
  StairVariantSketch,
  StairVariantSpiral,
  StairVariantStraight,
  StairVariantTriangularFan,
  StairVariantTriangularOutline,
  StairVariantWinder,
} from '../../../types/stair';

const TOL = 1e-6;

function baseParams(variant: StairParams['variant'], overrides?: {
  direction?: number;
  basePoint?: StairParams['basePoint'];
}): StairParams {
  return {
    basePoint: overrides?.basePoint ?? { x: 100, y: 200, z: 5 },
    direction: overrides?.direction ?? 30,
    rise: 175,
    tread: 280,
    nosing: 25,
    nosingSide: 'front',
    width: 1000,
    stepCount: 10,
    totalRise: 1750,
    totalRun: 2520,
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

const STRAIGHT: StairVariantStraight = { kind: 'straight' };

describe('mirrorStairParams', () => {
  test('mirror across X axis flips y of basePoint and reflects direction', () => {
    const p = baseParams(STRAIGHT, { basePoint: { x: 10, y: 20, z: 7 }, direction: 30 });
    const m = mirrorStairParams(p, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(m.basePoint.x).toBeCloseTo(10, 6);
    expect(m.basePoint.y).toBeCloseTo(-20, 6);
    expect(m.basePoint.z).toBeCloseTo(7, 6);
    // direction 30° mirrored across +X axis (angle 0°) → -30° → 330°
    expect(m.direction).toBeCloseTo(330, 6);
  });

  test('mirror across Y axis flips x of basePoint, direction → 180-d', () => {
    const p = baseParams(STRAIGHT, { basePoint: { x: 10, y: 20, z: 0 }, direction: 30 });
    const m = mirrorStairParams(p, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(m.basePoint.x).toBeCloseTo(-10, 6);
    expect(m.basePoint.y).toBeCloseTo(20, 6);
    // direction 30° mirrored across +Y axis (angle 90°) → 2*90 - 30 = 150°
    expect(m.direction).toBeCloseTo(150, 6);
  });

  test('mirror across arbitrary axis y=x reflects (a,b) to (b,a)', () => {
    const p = baseParams(STRAIGHT, { basePoint: { x: 3, y: 7, z: 1 }, direction: 45 });
    const m = mirrorStairParams(p, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(m.basePoint.x).toBeCloseTo(7, 6);
    expect(m.basePoint.y).toBeCloseTo(3, 6);
    expect(m.basePoint.z).toBeCloseTo(1, 6);
    // axis 45° → mirror(45°) = 2*45 - 45 = 45° (axis invariant)
    expect(m.direction).toBeCloseTo(45, 6);
  });

  test('mirror l-shape flips turnDirection right↔left', () => {
    const variant: StairVariantLShape = {
      kind: 'l-shape',
      cornerStyle: 'landing',
      turnDirection: 'right',
      landingDepth: 'auto',
      flightSplit: [0.5, 0.5],
    };
    const m = mirrorStairParams(baseParams(variant), { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(m.variant.kind).toBe('l-shape');
    expect((m.variant as StairVariantLShape).turnDirection).toBe('left');
  });

  test('mirror gamma flips each entry of turnSequence', () => {
    const variant: StairVariantGamma = {
      kind: 'gamma',
      turnSequence: ['right', 'left'],
      landings: ['auto', 'auto'],
      flightSplit: [0.33, 0.34, 0.33],
    };
    const m = mirrorStairParams(baseParams(variant), { x: 0, y: 0 }, { x: 1, y: 0 });
    expect((m.variant as StairVariantGamma).turnSequence).toEqual(['left', 'right']);
  });

  test('mirror spiral flips turnDirection cw↔ccw and reflects centerPoint', () => {
    const variant: StairVariantSpiral = {
      kind: 'spiral',
      centerPoint: { x: 5, y: 10, z: 2 },
      innerRadius: 0,
      sweepAngle: 270,
      turnDirection: 'cw',
    };
    const m = mirrorStairParams(baseParams(variant), { x: 0, y: 0 }, { x: 1, y: 0 });
    const v = m.variant as StairVariantSpiral;
    expect(v.turnDirection).toBe('ccw');
    expect(v.centerPoint.x).toBeCloseTo(5, 6);
    expect(v.centerPoint.y).toBeCloseTo(-10, 6);
    expect(v.centerPoint.z).toBeCloseTo(2, 6);
  });

  test('mirror helical flips turnDirection and preserves radii', () => {
    const variant: StairVariantHelical = {
      kind: 'helical',
      centerPoint: { x: 0, y: 0, z: 0 },
      innerRadius: 500,
      outerRadius: 1500,
      sweepAngle: 360,
      turnDirection: 'ccw',
    };
    const m = mirrorStairParams(baseParams(variant), { x: 0, y: 0 }, { x: 1, y: 0 });
    const v = m.variant as StairVariantHelical;
    expect(v.turnDirection).toBe('cw');
    expect(v.innerRadius).toBe(500);
    expect(v.outerRadius).toBe(1500);
  });

  test('mirror elliptical flips turnDirection, reflects centerPoint and rotation', () => {
    const variant: StairVariantElliptical = {
      kind: 'elliptical',
      centerPoint: { x: 10, y: 20, z: 0 },
      semiMajor: 1000,
      semiMinor: 500,
      sweepAngle: 180,
      turnDirection: 'cw',
      rotation: 30,
    };
    const m = mirrorStairParams(baseParams(variant), { x: 0, y: 0 }, { x: 1, y: 0 });
    const v = m.variant as StairVariantElliptical;
    expect(v.turnDirection).toBe('ccw');
    expect(v.centerPoint.y).toBeCloseTo(-20, 6);
    // mirror(30° across +X axis at 0°) = -30° → 330°
    expect(v.rotation).toBeCloseTo(330, 6);
  });

  test('mirror winder negates turnAngle sign', () => {
    const variant: StairVariantWinder = {
      kind: 'winder',
      turnAngle: 90,
      winderCount: 3,
      winderMethod: 'equal-going',
    };
    const m = mirrorStairParams(baseParams(variant), { x: 0, y: 0 }, { x: 1, y: 0 });
    expect((m.variant as StairVariantWinder).turnAngle).toBe(-90);
  });

  test('mirror triangular-outline rotates each vertex and flips orientation', () => {
    const variant: StairVariantTriangularOutline = {
      kind: 'triangular-outline',
      triangleVertices: [
        { x: 0, y: 0, z: 0 },
        { x: 100, y: 0, z: 0 },
        { x: 50, y: 100, z: 0 },
      ],
      entrySide: 0,
      orientation: 'cw',
    };
    const m = mirrorStairParams(baseParams(variant), { x: 0, y: 0 }, { x: 1, y: 0 });
    const v = m.variant as StairVariantTriangularOutline;
    expect(v.orientation).toBe('ccw');
    expect(v.triangleVertices[2].y).toBeCloseTo(-100, 6);
  });

  test('mirror sketch reflects every walkline vertex (z preserved)', () => {
    const variant: StairVariantSketch = {
      kind: 'sketch',
      walklinePath: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 5, z: 1 },
        { x: 20, y: 10, z: 2 },
      ],
    };
    const m = mirrorStairParams(baseParams(variant), { x: 0, y: 0 }, { x: 1, y: 0 });
    const v = m.variant as StairVariantSketch;
    expect(v.walklinePath[1].x).toBeCloseTo(10, 6);
    expect(v.walklinePath[1].y).toBeCloseTo(-5, 6);
    expect(v.walklinePath[1].z).toBeCloseTo(1, 6);
  });

  test('mirror twice ≡ identity (within 1e-6)', () => {
    const variant: StairVariantSpiral = {
      kind: 'spiral',
      centerPoint: { x: 5, y: 10, z: 2 },
      innerRadius: 0,
      sweepAngle: 270,
      turnDirection: 'cw',
    };
    const p = baseParams(variant, { basePoint: { x: 3, y: 7, z: 1 }, direction: 47 });
    const axisStart = { x: 1, y: 2 };
    const axisEnd = { x: 5, y: 3 };
    const m2 = mirrorStairParams(mirrorStairParams(p, axisStart, axisEnd), axisStart, axisEnd);
    expect(m2.basePoint.x).toBeCloseTo(p.basePoint.x, 6);
    expect(m2.basePoint.y).toBeCloseTo(p.basePoint.y, 6);
    expect(m2.direction).toBeCloseTo(p.direction, 6);
    expect((m2.variant as StairVariantSpiral).turnDirection).toBe('cw');
    const v0 = p.variant as StairVariantSpiral;
    const v2 = m2.variant as StairVariantSpiral;
    expect(v2.centerPoint.x).toBeCloseTo(v0.centerPoint.x, 6);
    expect(v2.centerPoint.y).toBeCloseTo(v0.centerPoint.y, 6);
  });
});

describe('rotateStairParams', () => {
  test('rotate basePoint around origin by 90°', () => {
    const p = baseParams(STRAIGHT, { basePoint: { x: 10, y: 0, z: 3 }, direction: 0 });
    const r = rotateStairParams(p, { x: 0, y: 0 }, 90);
    expect(r.basePoint.x).toBeCloseTo(0, 6);
    expect(r.basePoint.y).toBeCloseTo(10, 6);
    expect(r.basePoint.z).toBeCloseTo(3, 6);
    expect(r.direction).toBeCloseTo(90, 6);
  });

  test('rotate basePoint around pivot by 180°', () => {
    const p = baseParams(STRAIGHT, { basePoint: { x: 10, y: 0, z: 0 }, direction: 45 });
    const r = rotateStairParams(p, { x: 5, y: 0 }, 180);
    expect(r.basePoint.x).toBeCloseTo(0, 6);
    expect(r.basePoint.y).toBeCloseTo(0, 6);
    expect(r.direction).toBeCloseTo(225, 6);
  });

  test('rotate by -45° subtracts from direction', () => {
    const p = baseParams(STRAIGHT, { basePoint: { x: 0, y: 0, z: 0 }, direction: 90 });
    const r = rotateStairParams(p, { x: 0, y: 0 }, -45);
    expect(r.direction).toBeCloseTo(45, 6);
  });

  test('rotate spiral rotates centerPoint, preserves turnDirection', () => {
    const variant: StairVariantSpiral = {
      kind: 'spiral',
      centerPoint: { x: 10, y: 0, z: 5 },
      innerRadius: 0,
      sweepAngle: 270,
      turnDirection: 'cw',
    };
    const r = rotateStairParams(baseParams(variant), { x: 0, y: 0 }, 90);
    const v = r.variant as StairVariantSpiral;
    expect(v.centerPoint.x).toBeCloseTo(0, 6);
    expect(v.centerPoint.y).toBeCloseTo(10, 6);
    expect(v.centerPoint.z).toBeCloseTo(5, 6);
    expect(v.turnDirection).toBe('cw');
  });

  test('rotate elliptical adds angleDeg to rotation', () => {
    const variant: StairVariantElliptical = {
      kind: 'elliptical',
      centerPoint: { x: 0, y: 0, z: 0 },
      semiMajor: 1000,
      semiMinor: 500,
      sweepAngle: 180,
      turnDirection: 'cw',
      rotation: 30,
    };
    const r = rotateStairParams(baseParams(variant), { x: 0, y: 0 }, 60);
    expect((r.variant as StairVariantElliptical).rotation).toBeCloseTo(90, 6);
  });

  test('rotate triangular-outline rotates every vertex', () => {
    const variant: StairVariantTriangularOutline = {
      kind: 'triangular-outline',
      triangleVertices: [
        { x: 10, y: 0, z: 0 },
        { x: 0, y: 10, z: 0 },
        { x: -10, y: 0, z: 0 },
      ],
      entrySide: 0,
      orientation: 'cw',
    };
    const r = rotateStairParams(baseParams(variant), { x: 0, y: 0 }, 90);
    const v = r.variant as StairVariantTriangularOutline;
    expect(v.triangleVertices[0].x).toBeCloseTo(0, 6);
    expect(v.triangleVertices[0].y).toBeCloseTo(10, 6);
    expect(v.triangleVertices[1].x).toBeCloseTo(-10, 6);
    expect(v.triangleVertices[1].y).toBeCloseTo(0, 6);
  });

  test('rotate triangular-fan rotates apexPoint', () => {
    const variant: StairVariantTriangularFan = {
      kind: 'triangular-fan',
      apexPoint: { x: 10, y: 0, z: 1 },
      openingAngle: 90,
      stepCountPerArc: 5,
      turnDirection: 'cw',
    };
    const r = rotateStairParams(baseParams(variant), { x: 0, y: 0 }, 90);
    const v = r.variant as StairVariantTriangularFan;
    expect(v.apexPoint.x).toBeCloseTo(0, 6);
    expect(v.apexPoint.y).toBeCloseTo(10, 6);
    expect(v.turnDirection).toBe('cw');
  });

  test('rotate sketch rotates every walkline vertex (z preserved)', () => {
    const variant: StairVariantSketch = {
      kind: 'sketch',
      walklinePath: [
        { x: 10, y: 0, z: 0 },
        { x: 20, y: 0, z: 1 },
        { x: 30, y: 0, z: 2 },
      ],
    };
    const r = rotateStairParams(baseParams(variant), { x: 0, y: 0 }, 90);
    const v = r.variant as StairVariantSketch;
    expect(v.walklinePath[1].x).toBeCloseTo(0, 6);
    expect(v.walklinePath[1].y).toBeCloseTo(20, 6);
    expect(v.walklinePath[1].z).toBeCloseTo(1, 6);
  });

  test('rotate by 0° is identity (within tolerance)', () => {
    const p = baseParams(STRAIGHT, { basePoint: { x: 3, y: 7, z: 1 }, direction: 47 });
    const r = rotateStairParams(p, { x: 5, y: 5 }, 0);
    expect(r.basePoint.x).toBeCloseTo(3, 6);
    expect(r.basePoint.y).toBeCloseTo(7, 6);
    expect(r.direction).toBeCloseTo(47, 6);
  });
});

describe('copyStairParams', () => {
  test('copy translates basePoint, preserves direction', () => {
    const p = baseParams(STRAIGHT, { basePoint: { x: 10, y: 20, z: 5 }, direction: 30 });
    const c = copyStairParams(p, { x: 100, y: -50 });
    expect(c.basePoint.x).toBeCloseTo(110, 6);
    expect(c.basePoint.y).toBeCloseTo(-30, 6);
    expect(c.basePoint.z).toBeCloseTo(5, 6);
    expect(c.direction).toBeCloseTo(30, 6);
  });

  test('copy spiral translates both basePoint and centerPoint', () => {
    const variant: StairVariantSpiral = {
      kind: 'spiral',
      centerPoint: { x: 5, y: 10, z: 2 },
      innerRadius: 0,
      sweepAngle: 270,
      turnDirection: 'cw',
    };
    const c = copyStairParams(baseParams(variant), { x: 100, y: 100 });
    const v = c.variant as StairVariantSpiral;
    expect(v.centerPoint.x).toBeCloseTo(105, 6);
    expect(v.centerPoint.y).toBeCloseTo(110, 6);
    expect(v.centerPoint.z).toBeCloseTo(2, 6);
    expect(v.turnDirection).toBe('cw');
  });

  test('copy gamma preserves turnSequence (no flip)', () => {
    const variant: StairVariantGamma = {
      kind: 'gamma',
      turnSequence: ['right', 'left'],
      landings: ['auto', 'auto'],
      flightSplit: [0.33, 0.34, 0.33],
    };
    const c = copyStairParams(baseParams(variant), { x: 50, y: 50 });
    expect((c.variant as StairVariantGamma).turnSequence).toEqual(['right', 'left']);
  });

  test('copy triangular-outline translates every vertex', () => {
    const variant: StairVariantTriangularOutline = {
      kind: 'triangular-outline',
      triangleVertices: [
        { x: 0, y: 0, z: 0 },
        { x: 100, y: 0, z: 0 },
        { x: 50, y: 100, z: 0 },
      ],
      entrySide: 0,
      orientation: 'cw',
    };
    const c = copyStairParams(baseParams(variant), { x: 10, y: 20 });
    const v = c.variant as StairVariantTriangularOutline;
    expect(v.triangleVertices[0].x).toBeCloseTo(10, 6);
    expect(v.triangleVertices[0].y).toBeCloseTo(20, 6);
    expect(v.triangleVertices[2].x).toBeCloseTo(60, 6);
    expect(v.triangleVertices[2].y).toBeCloseTo(120, 6);
  });

  test('copy by {0,0} is identity (within tolerance)', () => {
    const p = baseParams(STRAIGHT, { basePoint: { x: 3, y: 7, z: 1 } });
    const c = copyStairParams(p, { x: 0, y: 0 });
    expect(c.basePoint.x).toBeCloseTo(3, 6);
    expect(c.basePoint.y).toBeCloseTo(7, 6);
    expect(c.basePoint.z).toBeCloseTo(1, 6);
  });

  // Unused tolerance ref to silence lint if any (kept as documentation):
  test('tolerance constant is exported in spirit', () => {
    expect(TOL).toBe(1e-6);
  });
});
