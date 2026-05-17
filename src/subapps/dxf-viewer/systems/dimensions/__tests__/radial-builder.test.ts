/**
 * ADR-362 Phase B2 — Radial family geometry builder tests.
 *
 * Coverage: radius / diameter / arcLength / joggedRadius builders.
 * Verifies measurement formulas, leaderPath shapes, arrow conventions
 * (single-arrow zero vector for radius+jogged), degenerate throws.
 */

import type {
  ArcLengthDimensionEntity,
  DiameterDimensionEntity,
  JoggedRadiusDimensionEntity,
  RadiusDimensionEntity,
} from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';
import { ISO_129_TEMPLATE } from '../dim-style-templates';
import {
  buildArcLengthGeometry,
  buildDiameterGeometry,
  buildJoggedRadiusGeometry,
  buildRadiusGeometry,
} from '../builders/radial-builder';

const FLOAT_TOL = 1e-9;

function radiusEntity(
  defPoints: readonly Point2D[],
  extra: Partial<RadiusDimensionEntity> = {},
): RadiusDimensionEntity {
  return {
    id: 'dim_test',
    type: 'dimension',
    dimensionType: 'radius',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
    ...extra,
  } as RadiusDimensionEntity;
}

function diameterEntity(
  defPoints: readonly Point2D[],
  extra: Partial<DiameterDimensionEntity> = {},
): DiameterDimensionEntity {
  return {
    id: 'dim_test',
    type: 'dimension',
    dimensionType: 'diameter',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
    ...extra,
  } as DiameterDimensionEntity;
}

function arcLengthEntity(
  defPoints: readonly Point2D[],
): ArcLengthDimensionEntity {
  return {
    id: 'dim_test',
    type: 'dimension',
    dimensionType: 'arcLength',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
  } as ArcLengthDimensionEntity;
}

function joggedEntity(
  defPoints: readonly Point2D[],
): JoggedRadiusDimensionEntity {
  return {
    id: 'dim_test',
    type: 'dimension',
    dimensionType: 'joggedRadius',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
  } as JoggedRadiusDimensionEntity;
}

function expectPoint(actual: Point2D, expected: Point2D, tol = FLOAT_TOL): void {
  expect(actual.x).toBeCloseTo(expected.x, -Math.log10(tol));
  expect(actual.y).toBeCloseTo(expected.y, -Math.log10(tol));
}

// ──────────────────────────────────────────────────────────────────────────────
// Radius
// ──────────────────────────────────────────────────────────────────────────────

describe('buildRadiusGeometry', () => {
  it('center=origin, arcPoint=(50,0) → measurement=50, leader outward +X, single arrow', () => {
    const entity = radiusEntity([{ x: 0, y: 0 }, { x: 50, y: 0 }]);
    const g = buildRadiusGeometry(entity, ISO_129_TEMPLATE);
    expect(g.kind).toBe('radial');
    expect(g.isDiameter).toBe(false);
    expect(g.measurementValue).toBeCloseTo(50, 9);
    expect(g.leaderPath).toHaveLength(2);
    expectPoint(g.leaderPath[0], { x: 50, y: 0 });
    // Leader extends by style.dimasz * 3 default
    const defaultLeader = ISO_129_TEMPLATE.dimasz * 3;
    expectPoint(g.leaderPath[1], { x: 50 + defaultLeader, y: 0 });
    expectPoint(g.arrowAnchor1, { x: 50, y: 0 });
    expectPoint(g.arrowDirection1, { x: 1, y: 0 });
    // Single-arrow: arrow2 anchor = arrow1, direction = zero vector
    expectPoint(g.arrowAnchor2, { x: 50, y: 0 });
    expectPoint(g.arrowDirection2, { x: 0, y: 0 });
  });

  it('leaderLength override respected', () => {
    const entity = radiusEntity([{ x: 0, y: 0 }, { x: 50, y: 0 }], {
      leaderLength: 30,
    });
    const g = buildRadiusGeometry(entity, ISO_129_TEMPLATE);
    expectPoint(g.leaderPath[1], { x: 80, y: 0 });
  });

  it('degenerate (arcPoint == center) → throws', () => {
    const entity = radiusEntity([{ x: 5, y: 5 }, { x: 5, y: 5 }]);
    expect(() => buildRadiusGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /arcPoint coincides with center/,
    );
  });

  it('textMidpoint override bypasses leader midpoint', () => {
    const entity = radiusEntity([{ x: 0, y: 0 }, { x: 50, y: 0 }], {
      textMidpoint: { x: 70, y: 10 },
    });
    const g = buildRadiusGeometry(entity, ISO_129_TEMPLATE);
    expectPoint(g.textAnchor, { x: 70, y: 10 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Diameter
// ──────────────────────────────────────────────────────────────────────────────

describe('buildDiameterGeometry', () => {
  it('horizontal diameter (-50,0)→(50,0) → measurement=100, 2 arrows outward, isDiameter=true', () => {
    const entity = diameterEntity([{ x: -50, y: 0 }, { x: 50, y: 0 }]);
    const g = buildDiameterGeometry(entity, ISO_129_TEMPLATE);
    expect(g.isDiameter).toBe(true);
    expect(g.measurementValue).toBeCloseTo(100, 9);
    expect(g.leaderPath).toHaveLength(2);
    expectPoint(g.leaderPath[0], { x: -50, y: 0 });
    expectPoint(g.leaderPath[1], { x: 50, y: 0 });
    expectPoint(g.arrowAnchor1, { x: -50, y: 0 });
    expectPoint(g.arrowAnchor2, { x: 50, y: 0 });
    expectPoint(g.arrowDirection1, { x: -1, y: 0 });
    expectPoint(g.arrowDirection2, { x: 1, y: 0 });
    expectPoint(g.textAnchor, { x: 0, y: 0 });
  });

  it('degenerate (sides coincide) → throws', () => {
    const entity = diameterEntity([{ x: 5, y: 5 }, { x: 5, y: 5 }]);
    expect(() => buildDiameterGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /sides coincide/,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Arc length
// ──────────────────────────────────────────────────────────────────────────────

describe('buildArcLengthGeometry', () => {
  it('quarter circle (radius 100, sweep π/2) → measurement=50π, leaderPath has 9 vertices', () => {
    const entity = arcLengthEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ]);
    const g = buildArcLengthGeometry(entity, ISO_129_TEMPLATE);
    expect(g.kind).toBe('radial');
    expect(g.isDiameter).toBe(false);
    expect(g.measurementValue).toBeCloseTo(50 * Math.PI, 6);
    expect(g.leaderPath).toHaveLength(9); // 8 segments + 1
    expectPoint(g.leaderPath[0], { x: 100, y: 0 });
    expectPoint(g.leaderPath[8], { x: 0, y: 100 });
    expectPoint(g.arrowAnchor1, { x: 100, y: 0 });
    expectPoint(g.arrowAnchor2, { x: 0, y: 100 });
    // Tangent outward at start (angle=0, CCW sweep) = (0, -1)
    expectPoint(g.arrowDirection1, { x: 0, y: -1 });
    // Tangent outward at end (angle=π/2, CCW sweep) = (-1, 0)
    expectPoint(g.arrowDirection2, { x: -1, y: 0 });
  });

  it('hemicircle (sweep π) → measurement=100π', () => {
    const entity = arcLengthEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: -100, y: 1e-12 }, // tiny y offset to disambiguate sweep direction (CCW)
    ]);
    const g = buildArcLengthGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(100 * Math.PI, 4);
  });

  it('degenerate (arcStart radius ≠ arcEnd radius) → throws', () => {
    const entity = arcLengthEntity([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 20 }, // radius 20 ≠ 10
    ]);
    expect(() => buildArcLengthGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /radii differ/,
    );
  });

  it('degenerate (zero radius) → throws', () => {
    const entity = arcLengthEntity([
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ]);
    expect(() => buildArcLengthGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /zero radius/,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Jogged radius
// ──────────────────────────────────────────────────────────────────────────────

describe('buildJoggedRadiusGeometry', () => {
  it('4-vertex leaderPath: arcPoint → jogVertex → jogPoint → tail extension', () => {
    const entity = joggedEntity([
      { x: 0, y: 0 }, // center
      { x: 50, y: 0 }, // arcPoint
      { x: 80, y: 20 }, // jogPoint
      { x: 65, y: 10 }, // jogVertex
    ]);
    const g = buildJoggedRadiusGeometry(entity, ISO_129_TEMPLATE);
    expect(g.isDiameter).toBe(false);
    expect(g.measurementValue).toBeCloseTo(50, 9);
    expect(g.leaderPath).toHaveLength(4);
    expectPoint(g.leaderPath[0], { x: 50, y: 0 }); // arcPoint
    expectPoint(g.leaderPath[1], { x: 65, y: 10 }); // jogVertex
    expectPoint(g.leaderPath[2], { x: 80, y: 20 }); // jogPoint
    // tail = jogPoint + unit(jogVertex→jogPoint) * dist(jogVertex,jogPoint)
    // unit = (15,10)/√325, length=√325 → tail = (80+15, 20+10) = (95, 30)
    expectPoint(g.leaderPath[3], { x: 95, y: 30 });
    expectPoint(g.arrowAnchor1, { x: 50, y: 0 });
    expectPoint(g.arrowDirection1, { x: 1, y: 0 });
    // Single arrow on side 2
    expectPoint(g.arrowDirection2, { x: 0, y: 0 });
  });

  it('degenerate (arcPoint == center) → throws', () => {
    const entity = joggedEntity([
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 10, y: 10 },
      { x: 7, y: 7 },
    ]);
    expect(() => buildJoggedRadiusGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /arcPoint coincides with center/,
    );
  });
});
