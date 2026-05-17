/**
 * ADR-362 Phase B2 — Angular geometry builder tests.
 *
 * Coverage: `angular-builder.ts` (Angular2L + Angular3P).
 * Verifies:
 *   - 90° / 60° / 135° measurements
 *   - parallel-line / degenerate-arcPoint throw paths
 *   - arc anchors land on the circle of `arcRadius = distance(vertex, arcPoint)`
 *   - arrow tangent direction outward (away from arc interior)
 *   - reflex-arc case (arcPoint outside short sweep)
 *   - textAnchor at arc midpoint, override respected
 */

import type {
  Angular2LDimensionEntity,
  Angular3PDimensionEntity,
  DimStyle,
} from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';
import { ISO_129_TEMPLATE } from '../dim-style-templates';
import {
  buildAngular2LGeometry,
  buildAngular3PGeometry,
} from '../builders/angular-builder';

const FLOAT_TOL = 1e-9;

function styleWith(patch: Partial<DimStyle> = {}): DimStyle {
  return { ...ISO_129_TEMPLATE, ...patch };
}

function angular2L(
  defPoints: readonly Point2D[],
  extra: Partial<Angular2LDimensionEntity> = {},
): Angular2LDimensionEntity {
  return {
    id: 'dim_test',
    type: 'dimension',
    dimensionType: 'angular2L',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
    ...extra,
  } as Angular2LDimensionEntity;
}

function angular3P(
  defPoints: readonly Point2D[],
  extra: Partial<Angular3PDimensionEntity> = {},
): Angular3PDimensionEntity {
  return {
    id: 'dim_test',
    type: 'dimension',
    dimensionType: 'angular3P',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
    ...extra,
  } as Angular3PDimensionEntity;
}

function expectPoint(actual: Point2D, expected: Point2D, tol = FLOAT_TOL): void {
  expect(actual.x).toBeCloseTo(expected.x, -Math.log10(tol));
  expect(actual.y).toBeCloseTo(expected.y, -Math.log10(tol));
}

// ──────────────────────────────────────────────────────────────────────────────
// Angular 2-line
// ──────────────────────────────────────────────────────────────────────────────

describe('buildAngular2LGeometry', () => {
  it('perpendicular lines through origin (90°) → measurement π/2, arcRadius respected', () => {
    const entity = angular2L([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 5, y: 5 },
    ]);
    const g = buildAngular2LGeometry(entity, ISO_129_TEMPLATE);
    expect(g.kind).toBe('angular');
    expect(g.measurementValue).toBeCloseTo(Math.PI / 2, 9);
    expectPoint(g.arcCenter, { x: 0, y: 0 });
    const expectedRadius = Math.sqrt(50);
    expect(g.arcRadius).toBeCloseTo(expectedRadius, 9);
    expect(g.arcStartAngle).toBeCloseTo(0, 9);
    expect(g.arcEndAngle).toBeCloseTo(Math.PI / 2, 9);
    expectPoint(g.arrowAnchor1, { x: expectedRadius, y: 0 });
    expectPoint(g.arrowAnchor2, { x: 0, y: expectedRadius });
    // CCW sweep, arrow1 outward at angle 0 = (0, -1), arrow2 outward at angle π/2 = (-1, 0)
    expectPoint(g.arrowDirection1, { x: 0, y: -1 });
    expectPoint(g.arrowDirection2, { x: -1, y: 0 });
    // textAnchor on arc midpoint at angle π/4
    expectPoint(g.textAnchor, { x: 5, y: 5 });
  });

  it('parallel lines → throws "lines parallel"', () => {
    const entity = angular2L([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 5 },
      { x: 10, y: 5 },
      { x: 5, y: 2.5 },
    ]);
    expect(() => buildAngular2LGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /lines parallel/,
    );
  });

  it('oblique lines (60°) → measurement π/3', () => {
    const cos60 = Math.cos(Math.PI / 3);
    const sin60 = Math.sin(Math.PI / 3);
    const entity = angular2L([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      { x: 10 * cos60, y: 10 * sin60 },
      { x: 5 * Math.cos(Math.PI / 6), y: 5 * Math.sin(Math.PI / 6) },
    ]);
    const g = buildAngular2LGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(Math.PI / 3, 9);
  });

  it('arcPoint coincides with vertex → throws "arcPoint coincides with vertex"', () => {
    const entity = angular2L([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ]);
    expect(() => buildAngular2LGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /arcPoint coincides with vertex/,
    );
  });

  it('suppressExtLine flags drop ext lines', () => {
    const entity = angular2L([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 5, y: 5 },
    ]);
    const g = buildAngular2LGeometry(
      entity,
      styleWith({ suppressExtLine1: true, suppressExtLine2: true }),
    );
    expect(g.extLine1).toBeNull();
    expect(g.extLine2).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Angular 3-point
// ──────────────────────────────────────────────────────────────────────────────

describe('buildAngular3PGeometry', () => {
  it('right angle (90°) — vertex=origin, ray1=X, ray2=Y, arcPoint in Q1', () => {
    const entity = angular3P([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: 5, y: 5 },
    ]);
    const g = buildAngular3PGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(Math.PI / 2, 9);
    expect(g.arcRadius).toBeCloseTo(Math.sqrt(50), 9);
    expect(g.arcStartAngle).toBeCloseTo(0, 9);
    expect(g.arcEndAngle).toBeCloseTo(Math.PI / 2, 9);
  });

  it('obtuse 135° angle — ray2 in Q2', () => {
    const cos135 = Math.cos((3 * Math.PI) / 4);
    const sin135 = Math.sin((3 * Math.PI) / 4);
    const entity = angular3P([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10 * cos135, y: 10 * sin135 },
      { x: 2, y: 5 },
    ]);
    const g = buildAngular3PGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo((3 * Math.PI) / 4, 9);
  });

  it('reflex case — arcPoint outside short arc → measures long arc (3π/2)', () => {
    const entity = angular3P([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: -5, y: -5 },
    ]);
    const g = buildAngular3PGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo((3 * Math.PI) / 2, 9);
    // Signed sweep is CW (negative), so arcEndAngle < arcStartAngle
    expect(g.arcEndAngle).toBeLessThan(g.arcStartAngle);
  });

  it('textMidpoint override bypasses arc midpoint', () => {
    const entity = angular3P(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
        { x: 5, y: 5 },
      ],
      { textMidpoint: { x: 8, y: 8 } },
    );
    const g = buildAngular3PGeometry(entity, ISO_129_TEMPLATE);
    expectPoint(g.textAnchor, { x: 8, y: 8 });
  });

  it('ext line built when ray endpoint inside arc (radius > endpoint dist)', () => {
    const entity = angular3P([
      { x: 0, y: 0 },
      { x: 3, y: 0 }, // ray1 endpoint at distance 3
      { x: 0, y: 3 }, // ray2 endpoint at distance 3
      { x: 5, y: 5 }, // arcRadius = √50 ≈ 7.07 > 3 → ext lines bridge to arc
    ]);
    const g = buildAngular3PGeometry(entity, ISO_129_TEMPLATE);
    expect(g.extLine1).not.toBeNull();
    expect(g.extLine2).not.toBeNull();
  });

  it('ext line null when ray endpoint outside arc (radius < endpoint dist)', () => {
    const entity = angular3P([
      { x: 0, y: 0 },
      { x: 10, y: 0 }, // distance 10
      { x: 0, y: 10 }, // distance 10
      { x: 2, y: 2 }, // arcRadius = 2√2 ≈ 2.83 < 10 → no ext line bridge
    ]);
    const g = buildAngular3PGeometry(entity, ISO_129_TEMPLATE);
    expect(g.extLine1).toBeNull();
    expect(g.extLine2).toBeNull();
  });
});
