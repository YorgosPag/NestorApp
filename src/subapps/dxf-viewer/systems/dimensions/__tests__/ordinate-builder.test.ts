/**
 * ADR-362 Phase B3 — Ordinate geometry builder tests.
 *
 * Coverage targets: ≥80% on `ordinate-builder.ts`. Tests verify:
 *   - axis='x' / axis='y' measurement math (absolute distance along chosen axis)
 *   - negative coordinates → positive measurement
 *   - default leader direction (+Y for x-axis, +X for y-axis) + length (dimasz*8)
 *   - textMidpoint override → leader follows override
 *   - single-arrow convention (`arrowDirection2 = {0,0}`)
 *   - no extension lines (`extLine1/2 === null`)
 *   - degenerate (feature == datum on measured axis) → throws
 *   - DIMTIH=true → text rotation 0
 */

import type { DimStyle, OrdinateDimensionEntity } from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';
import { ISO_129_TEMPLATE } from '../dim-style-templates';
import { buildOrdinateGeometry } from '../builders/ordinate-builder';

const FLOAT_TOLERANCE = 1e-9;

function styleWith(patch: Partial<DimStyle> = {}): DimStyle {
  return { ...ISO_129_TEMPLATE, ...patch };
}

function ordinateEntity(
  feature: Point2D,
  axis: 'x' | 'y',
  datum: Point2D,
  extra: Partial<OrdinateDimensionEntity> = {},
): OrdinateDimensionEntity {
  return {
    id: 'dim_test',
    type: 'dimension',
    dimensionType: 'ordinate',
    styleId: ISO_129_TEMPLATE.id,
    defPoints: [feature],
    axis,
    datum,
    layerId: 'layer_test',
    ...extra,
  } as OrdinateDimensionEntity;
}

function expectPoint(actual: Point2D, expected: Point2D, tol = FLOAT_TOLERANCE): void {
  expect(actual.x).toBeCloseTo(expected.x, -Math.log10(tol));
  expect(actual.y).toBeCloseTo(expected.y, -Math.log10(tol));
}

describe('buildOrdinateGeometry', () => {
  it('axis=x — measurement is |feature.x - datum.x|, leader vertical +Y by default', () => {
    const entity = ordinateEntity({ x: 50, y: 30 }, 'x', { x: 0, y: 0 });
    const g = buildOrdinateGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(50, 9);
    expect(g.kind).toBe('linear');
    expectPoint(g.dimLine.start, { x: 50, y: 30 });
    expectPoint(g.dimLine.end, { x: 50, y: 30 + ISO_129_TEMPLATE.dimasz * 8 });
    expectPoint(g.arrowDirection1, { x: 0, y: 1 });
  });

  it('axis=y — measurement is |feature.y - datum.y|, leader horizontal +X by default', () => {
    const entity = ordinateEntity({ x: 50, y: 30 }, 'y', { x: 0, y: 0 });
    const g = buildOrdinateGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(30, 9);
    expectPoint(g.dimLine.start, { x: 50, y: 30 });
    expectPoint(g.dimLine.end, { x: 50 + ISO_129_TEMPLATE.dimasz * 8, y: 30 });
    expectPoint(g.arrowDirection1, { x: 1, y: 0 });
  });

  it('negative coordinate (datum offset) → absolute measurement', () => {
    const entity = ordinateEntity({ x: -75, y: 0 }, 'x', { x: 25, y: 0 });
    const g = buildOrdinateGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(100, 9);
  });

  it('textMidpoint override — leader endpoint follows override, arrow direction unit toward it', () => {
    const entity = ordinateEntity({ x: 40, y: 0 }, 'x', { x: 0, y: 0 }, {
      textMidpoint: { x: 40, y: 100 },
    });
    const g = buildOrdinateGeometry(entity, ISO_129_TEMPLATE);
    expectPoint(g.dimLine.end, { x: 40, y: 100 });
    expectPoint(g.arrowDirection1, { x: 0, y: 1 });
    expectPoint(g.textAnchor, { x: 40, y: 100 });
  });

  it('single-arrow convention — arrowAnchor2 == arrowAnchor1, arrowDirection2 zero', () => {
    const entity = ordinateEntity({ x: 50, y: 0 }, 'x', { x: 0, y: 0 });
    const g = buildOrdinateGeometry(entity, ISO_129_TEMPLATE);
    expectPoint(g.arrowAnchor2, g.arrowAnchor1);
    expectPoint(g.arrowDirection2, { x: 0, y: 0 });
  });

  it('no extension lines (extLine1 + extLine2 are null)', () => {
    const entity = ordinateEntity({ x: 50, y: 0 }, 'x', { x: 0, y: 0 });
    const g = buildOrdinateGeometry(entity, ISO_129_TEMPLATE);
    expect(g.extLine1).toBeNull();
    expect(g.extLine2).toBeNull();
  });

  it('degenerate axis=x (feature.x == datum.x) → throws', () => {
    const entity = ordinateEntity({ x: 50, y: 30 }, 'x', { x: 50, y: 0 });
    expect(() => buildOrdinateGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /Degenerate ordinate dim/,
    );
  });

  it('degenerate axis=y (feature.y == datum.y) → throws', () => {
    const entity = ordinateEntity({ x: 50, y: 30 }, 'y', { x: 0, y: 30 });
    expect(() => buildOrdinateGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /Degenerate ordinate dim/,
    );
  });

  it('DIMTIH=true (text horizontal) → textRotation 0 regardless of leader direction', () => {
    const entity = ordinateEntity({ x: 50, y: 30 }, 'y', { x: 0, y: 0 });
    const g = buildOrdinateGeometry(entity, styleWith({ dimtih: true }));
    expect(g.textRotation).toBeCloseTo(0, 9);
  });

  it('default leader length uses dimasz × 8 from style', () => {
    const entity = ordinateEntity({ x: 10, y: 0 }, 'x', { x: 0, y: 0 });
    const g = buildOrdinateGeometry(entity, styleWith({ dimasz: 5 }));
    expectPoint(g.dimLine.end, { x: 10, y: 40 }); // 5 * 8 = 40
  });
});
