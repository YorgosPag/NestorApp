/**
 * ADR-362 Phase B1 — Linear + Aligned geometry builder tests.
 *
 * Coverage targets: ≥80% on `linear-aligned-builder.ts` + orchestrator dispatch
 * in `dim-geometry-builder.ts`. Tests verify:
 *   - axis-aligned & rotated linear projection math
 *   - aligned dim direction & measurement
 *   - negative/reversed direction handling
 *   - textMidpoint override
 *   - suppressExtLine1/2 → null
 *   - DIMEXO=0 ext line starts at origin
 *   - obliqueAngle ext-line tilt preserves measurement
 *   - unimplemented variants throw via the orchestrator
 */

import type {
  AlignedDimensionEntity,
  DimStyle,
  LinearDimensionEntity,
  OrdinateDimensionEntity,
} from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';
import { ISO_129_TEMPLATE } from '../dim-style-templates';
import { buildDimensionGeometry } from '../dim-geometry-builder';
import {
  buildAlignedGeometry,
  buildLinearGeometry,
} from '../builders/linear-aligned-builder';

// ──────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ──────────────────────────────────────────────────────────────────────────────

const FLOAT_TOLERANCE = 1e-9;

function styleWith(patch: Partial<DimStyle> = {}): DimStyle {
  return { ...ISO_129_TEMPLATE, ...patch };
}

function linearEntity(
  defPoints: readonly Point2D[],
  rotation: number,
  extra: Partial<LinearDimensionEntity> = {},
): LinearDimensionEntity {
  return {
    id: 'dim_test',
    type: 'dimension',
    dimensionType: 'linear',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    rotation,
    layerId: 'layer_test',
    ...extra,
  } as LinearDimensionEntity;
}

function alignedEntity(
  defPoints: readonly Point2D[],
  extra: Partial<AlignedDimensionEntity> = {},
): AlignedDimensionEntity {
  return {
    id: 'dim_test',
    type: 'dimension',
    dimensionType: 'aligned',
    styleId: ISO_129_TEMPLATE.id,
    defPoints,
    layerId: 'layer_test',
    ...extra,
  } as AlignedDimensionEntity;
}

function expectPoint(actual: Point2D, expected: Point2D, tol = FLOAT_TOLERANCE): void {
  expect(actual.x).toBeCloseTo(expected.x, -Math.log10(tol));
  expect(actual.y).toBeCloseTo(expected.y, -Math.log10(tol));
}

// ──────────────────────────────────────────────────────────────────────────────
// Linear
// ──────────────────────────────────────────────────────────────────────────────

describe('buildLinearGeometry', () => {
  it('horizontal linear (rotation=0) — measurement, dim line y=50, vertical ext lines', () => {
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
    ], 0);
    const g = buildLinearGeometry(entity, ISO_129_TEMPLATE);

    expect(g.measurementValue).toBeCloseTo(100, 9);
    expectPoint(g.dimLine.start, { x: 0, y: 50 });
    expectPoint(g.dimLine.end, { x: 100, y: 50 });
    // ext line 1 starts at extOrigin1 + (0,1)*dimexo and ends at foot1 + (0,1)*dimexe
    expectPoint(g.extLine1!.start, { x: 0, y: ISO_129_TEMPLATE.dimexo });
    expectPoint(g.extLine1!.end, { x: 0, y: 50 + ISO_129_TEMPLATE.dimexe });
    // arrow1 tip on foot1, pointing outward (toward -X relative to foot2→foot1 axis)
    expectPoint(g.arrowAnchor1, { x: 0, y: 50 });
    expectPoint(g.arrowDirection1, { x: -1, y: 0 });
    expectPoint(g.arrowAnchor2, { x: 100, y: 50 });
    expectPoint(g.arrowDirection2, { x: 1, y: 0 });
    // text anchor defaults to midpoint, horizontal rotation 0 (ISO 129 dimtih=false but |0|<π/2)
    expectPoint(g.textAnchor, { x: 50, y: 50 });
    expect(g.textRotation).toBeCloseTo(0, 9);
  });

  it('vertical linear (rotation=90) — measurement, dim line x=50, horizontal ext lines', () => {
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 50, y: 50 },
    ], 90);
    const g = buildLinearGeometry(entity, ISO_129_TEMPLATE);

    expect(g.measurementValue).toBeCloseTo(100, 9);
    expectPoint(g.dimLine.start, { x: 50, y: 0 });
    expectPoint(g.dimLine.end, { x: 50, y: 100 });
    // ext line from (0,0) to foot1=(50,0) — horizontal +X
    expectPoint(g.extLine1!.start, { x: ISO_129_TEMPLATE.dimexo, y: 0 });
    expectPoint(g.extLine1!.end, { x: 50 + ISO_129_TEMPLATE.dimexe, y: 0 });
    // dim line vertical pointing up: foot2-foot1 = (0,100), angle = π/2 → flipped to -π/2
    // (DIMTIH=false on ISO 129, |π/2| > π/2 is false, so stays π/2... edge: > is strict)
    expect(g.textRotation).toBeCloseTo(Math.PI / 2, 9);
  });

  it('ADR-562 — entity.textRotation (deg) overrides the auto text angle', () => {
    // Horizontal dim would auto-resolve textRotation=0; a 45° override wins (→ π/4 rad).
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
    ], 0, { textRotation: 45 });
    const g = buildLinearGeometry(entity, ISO_129_TEMPLATE);
    expect(g.textRotation).toBeCloseTo(Math.PI / 4, 9);
  });

  it('rotated linear (rotation=30) — measurement projected onto rotated axis', () => {
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
    ], 30);
    const g = buildLinearGeometry(entity, ISO_129_TEMPLATE);
    // projection of (100,0) onto (cos30, sin30) = 100 * cos30 = 50√3 ≈ 86.6025
    expect(g.measurementValue).toBeCloseTo(100 * Math.cos(Math.PI / 6), 6);
  });

  it('negative direction (extOrigin2 left of extOrigin1) → positive measurement, arrows reversed', () => {
    const entity = linearEntity([
      { x: 100, y: 0 },
      { x: 0, y: 0 },
      { x: 50, y: 50 },
    ], 0);
    const g = buildLinearGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(100, 9);
    expectPoint(g.arrowAnchor1, { x: 100, y: 50 });
    expectPoint(g.arrowAnchor2, { x: 0, y: 50 });
    // arrow1 at foot1=(100,50) points outward away from foot2=(0,50) → +X
    expectPoint(g.arrowDirection1, { x: 1, y: 0 });
    expectPoint(g.arrowDirection2, { x: -1, y: 0 });
  });

  it('textMidpoint override bypasses the computed midpoint', () => {
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
    ], 0, { textMidpoint: { x: 75, y: 60 } });
    const g = buildLinearGeometry(entity, ISO_129_TEMPLATE);
    expectPoint(g.textAnchor, { x: 75, y: 60 });
  });

  it('suppressExtLine1=true → extLine1 null, extLine2 still present', () => {
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
    ], 0);
    const g = buildLinearGeometry(entity, styleWith({ suppressExtLine1: true }));
    expect(g.extLine1).toBeNull();
    expect(g.extLine2).not.toBeNull();
  });

  it('suppressExtLine2=true → extLine2 null, extLine1 still present', () => {
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
    ], 0);
    const g = buildLinearGeometry(entity, styleWith({ suppressExtLine2: true }));
    expect(g.extLine1).not.toBeNull();
    expect(g.extLine2).toBeNull();
  });

  it('DIMEXO=0 → ext line starts at the exact ext origin', () => {
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
    ], 0);
    const g = buildLinearGeometry(entity, styleWith({ dimexo: 0 }));
    expectPoint(g.extLine1!.start, { x: 0, y: 0 });
  });

  it('obliqueAngle=45 → ext lines tilted but measurement preserved', () => {
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 50 },
    ], 0, { obliqueAngle: 45 });
    const g = buildLinearGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(100, 9);
    // foot1 = (-50, 50), foot2 = (50, 50) — both shifted left by 50 due to 45° tilt
    expectPoint(g.dimLine.start, { x: -50, y: 50 });
    expectPoint(g.dimLine.end, { x: 50, y: 50 });
  });

  it('degenerate linear (ext direction parallel to dim line axis) → throws', () => {
    // rotation 0 + obliqueAngle 90: ext_dir = perpendicular(0,1) rotated 90° = (-1,0),
    // parallel to dim-line axis (1,0) → no intersection.
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
    ], 0, { obliqueAngle: 90 });
    expect(() => buildLinearGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /Degenerate linear dim/,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Aligned
// ──────────────────────────────────────────────────────────────────────────────

describe('buildAlignedGeometry', () => {
  it('aligned non-orthogonal (3-4-5 triangle) → measurement=100, dim line parallel to segment', () => {
    const entity = alignedEntity([
      { x: 0, y: 0 },
      { x: 60, y: 80 },
      { x: 60, y: -40 },
    ]);
    const g = buildAlignedGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(100, 9);
    // axis = (0.6, 0.8), perp = (-0.8, 0.6)
    // signedOffset = (60,-40)·(-0.8, 0.6) = -48 + -24 = -72
    // foot1 = (0,0) + (-0.8,0.6)*-72 = (57.6, -43.2)
    expectPoint(g.dimLine.start, { x: 57.6, y: -43.2 });
    expectPoint(g.dimLine.end, { x: 117.6, y: 36.8 });
  });

  it('aligned horizontal segment behaves like horizontal linear', () => {
    const entity = alignedEntity([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 50 },
    ]);
    const g = buildAlignedGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(100, 9);
    expectPoint(g.dimLine.start, { x: 0, y: 50 });
    expectPoint(g.dimLine.end, { x: 100, y: 50 });
  });

  it('aligned with coincident ext origins → throws', () => {
    const entity = alignedEntity([
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 50, y: 50 },
    ]);
    expect(() => buildAlignedGeometry(entity, ISO_129_TEMPLATE)).toThrow(
      /Degenerate aligned dim/,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Orchestrator dispatch
// ──────────────────────────────────────────────────────────────────────────────

describe('buildDimensionGeometry — orchestrator', () => {
  it('dispatches to linear builder', () => {
    const entity = linearEntity([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 20 },
    ], 0);
    const g = buildDimensionGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(50, 9);
  });

  it('dispatches to aligned builder', () => {
    const entity = alignedEntity([
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      { x: 50, y: 0 },
    ]);
    const g = buildDimensionGeometry(entity, ISO_129_TEMPLATE);
    expect(g.measurementValue).toBeCloseTo(50, 9);
  });

  it('dispatches to angular2L builder (Phase B2)', () => {
    const entity = {
      id: 'dim_test',
      type: 'dimension',
      dimensionType: 'angular2L',
      styleId: ISO_129_TEMPLATE.id,
      defPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 5, y: 5 },
      ],
      layerId: 'layer_test',
    } as unknown as Parameters<typeof buildDimensionGeometry>[0];
    const g = buildDimensionGeometry(entity, ISO_129_TEMPLATE);
    expect(g.kind).toBe('angular');
    expect(g.measurementValue).toBeCloseTo(Math.PI / 2, 6);
  });

  it('dispatches to radius builder (Phase B2)', () => {
    const entity = {
      id: 'dim_test',
      type: 'dimension',
      dimensionType: 'radius',
      styleId: ISO_129_TEMPLATE.id,
      defPoints: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
      layerId: 'layer_test',
    } as unknown as Parameters<typeof buildDimensionGeometry>[0];
    const g = buildDimensionGeometry(entity, ISO_129_TEMPLATE);
    expect(g.kind).toBe('radial');
    expect(g.measurementValue).toBeCloseTo(50, 9);
  });

  it('dispatches to angular3P builder (Phase B2)', () => {
    const entity = {
      id: 'dim_test',
      type: 'dimension',
      dimensionType: 'angular3P',
      styleId: ISO_129_TEMPLATE.id,
      defPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
        { x: 5, y: 5 },
      ],
      layerId: 'layer_test',
    } as unknown as Parameters<typeof buildDimensionGeometry>[0];
    const g = buildDimensionGeometry(entity, ISO_129_TEMPLATE);
    expect(g.kind).toBe('angular');
  });

  it('dispatches to diameter builder (Phase B2)', () => {
    const entity = {
      id: 'dim_test',
      type: 'dimension',
      dimensionType: 'diameter',
      styleId: ISO_129_TEMPLATE.id,
      defPoints: [{ x: -10, y: 0 }, { x: 10, y: 0 }],
      layerId: 'layer_test',
    } as unknown as Parameters<typeof buildDimensionGeometry>[0];
    const g = buildDimensionGeometry(entity, ISO_129_TEMPLATE);
    expect(g.kind).toBe('radial');
    expect(g.measurementValue).toBeCloseTo(20, 9);
  });

  it('dispatches to arcLength builder (Phase B2)', () => {
    const entity = {
      id: 'dim_test',
      type: 'dimension',
      dimensionType: 'arcLength',
      styleId: ISO_129_TEMPLATE.id,
      defPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ],
      layerId: 'layer_test',
    } as unknown as Parameters<typeof buildDimensionGeometry>[0];
    const g = buildDimensionGeometry(entity, ISO_129_TEMPLATE);
    expect(g.kind).toBe('radial');
    expect(g.measurementValue).toBeCloseTo(5 * Math.PI, 6);
  });

  it('dispatches to joggedRadius builder (Phase B2)', () => {
    const entity = {
      id: 'dim_test',
      type: 'dimension',
      dimensionType: 'joggedRadius',
      styleId: ISO_129_TEMPLATE.id,
      defPoints: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 80, y: 20 },
        { x: 65, y: 10 },
      ],
      layerId: 'layer_test',
    } as unknown as Parameters<typeof buildDimensionGeometry>[0];
    const g = buildDimensionGeometry(entity, ISO_129_TEMPLATE);
    expect(g.kind).toBe('radial');
    expect(g.measurementValue).toBeCloseTo(50, 9);
  });

  it('dispatches to ordinate builder (Phase B3)', () => {
    const entity: OrdinateDimensionEntity = {
      id: 'dim_test',
      type: 'dimension',
      dimensionType: 'ordinate',
      styleId: ISO_129_TEMPLATE.id,
      defPoints: [{ x: 25, y: 25 }],
      datum: { x: 0, y: 0 },
      axis: 'x',
      layerId: 'layer_test',
    } as OrdinateDimensionEntity;
    const g = buildDimensionGeometry(entity, ISO_129_TEMPLATE);
    expect(g.kind).toBe('linear');
    expect(g.measurementValue).toBeCloseTo(25, 9);
  });
});
