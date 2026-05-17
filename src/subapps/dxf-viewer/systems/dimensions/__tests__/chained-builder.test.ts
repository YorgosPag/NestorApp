/**
 * ADR-362 Phase B3 — Baseline + Continued (chained) builder tests.
 *
 * Coverage targets: ≥80% on `chained-builder.ts`. Tests verify:
 *   - baseline single chain off a linear root → dim line offset by DIMDLI
 *   - baseline triple chain → offset by DIMDLI × 3
 *   - continued off linear root → same dim line, chains from parent extOrigin2
 *   - continued chained from continued → same dim line, advances by chain
 *   - continued off baseline parent → inherits baseline's offset
 *   - axis inherited from rotated linear root (rotation=90)
 *   - aligned root (3-4-5) propagates non-axis-aligned direction
 *   - parent missing in lookup → throws
 *   - parent of unsupported type (radius) → throws
 *   - root dim line passing through baseline origin → throws
 *   - lookup missing entirely → throws
 */

import type {
  AlignedDimensionEntity,
  BaselineDimensionEntity,
  ContinuedDimensionEntity,
  DimensionEntity,
  DimStyle,
  LinearDimensionEntity,
  RadiusDimensionEntity,
} from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';
import { ISO_129_TEMPLATE } from '../dim-style-templates';
import {
  buildBaselineGeometry,
  buildContinuedGeometry,
} from '../builders/chained-builder';
import type { DimensionLookup } from '../dim-geometry-builder';

const FLOAT_TOLERANCE = 1e-9;
const DIMDLI = ISO_129_TEMPLATE.dimdli;

function makeLookup(entities: DimensionEntity[]): DimensionLookup {
  const map = new Map<string, DimensionEntity>(entities.map((e) => [e.id, e]));
  return (id) => map.get(id);
}

function linearRoot(
  id: string,
  defPoints: readonly Point2D[],
  rotation: number,
): LinearDimensionEntity {
  return {
    id,
    type: 'dimension',
    dimensionType: 'linear',
    styleId: ISO_129_TEMPLATE.id,
    layerId: 'layer_test',
    defPoints,
    rotation,
  } as LinearDimensionEntity;
}

function alignedRoot(
  id: string,
  defPoints: readonly Point2D[],
): AlignedDimensionEntity {
  return {
    id,
    type: 'dimension',
    dimensionType: 'aligned',
    styleId: ISO_129_TEMPLATE.id,
    layerId: 'layer_test',
    defPoints,
  } as AlignedDimensionEntity;
}

function baselineDim(
  id: string,
  newExtOrigin: Point2D,
  parentDimensionId: string,
): BaselineDimensionEntity {
  return {
    id,
    type: 'dimension',
    dimensionType: 'baseline',
    styleId: ISO_129_TEMPLATE.id,
    layerId: 'layer_test',
    defPoints: [newExtOrigin],
    parentDimensionId,
  } as BaselineDimensionEntity;
}

function continuedDim(
  id: string,
  newExtOrigin: Point2D,
  parentDimensionId: string,
): ContinuedDimensionEntity {
  return {
    id,
    type: 'dimension',
    dimensionType: 'continued',
    styleId: ISO_129_TEMPLATE.id,
    layerId: 'layer_test',
    defPoints: [newExtOrigin],
    parentDimensionId,
  } as ContinuedDimensionEntity;
}

function expectPoint(actual: Point2D, expected: Point2D, tol = FLOAT_TOLERANCE): void {
  expect(actual.x).toBeCloseTo(expected.x, -Math.log10(tol));
  expect(actual.y).toBeCloseTo(expected.y, -Math.log10(tol));
}

// ──────────────────────────────────────────────────────────────────────────────
// Baseline
// ──────────────────────────────────────────────────────────────────────────────

describe('buildBaselineGeometry', () => {
  it('single chain off linear root — dim line offset by DIMDLI, measurement off baseline origin', () => {
    const root = linearRoot('root', [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 20 },
    ], 0);
    const baseline = baselineDim('b1', { x: 100, y: 0 }, 'root');
    const g = buildBaselineGeometry(baseline, ISO_129_TEMPLATE, makeLookup([root, baseline]));
    expect(g.measurementValue).toBeCloseTo(100, 9);
    expectPoint(g.dimLine.start, { x: 0, y: 20 + DIMDLI });
    expectPoint(g.dimLine.end, { x: 100, y: 20 + DIMDLI });
  });

  it('triple chain (baseline of baseline of baseline) — offset by DIMDLI × 3', () => {
    const root = linearRoot('root', [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 20 },
    ], 0);
    const b1 = baselineDim('b1', { x: 75, y: 0 }, 'root');
    const b2 = baselineDim('b2', { x: 150, y: 0 }, 'b1');
    const b3 = baselineDim('b3', { x: 200, y: 0 }, 'b2');
    const g = buildBaselineGeometry(b3, ISO_129_TEMPLATE, makeLookup([root, b1, b2, b3]));
    expect(g.measurementValue).toBeCloseTo(200, 9);
    expectPoint(g.dimLine.start, { x: 0, y: 20 + DIMDLI * 3 });
    expectPoint(g.dimLine.end, { x: 200, y: 20 + DIMDLI * 3 });
  });

  it('axis inherited from rotated linear root (rotation=90, vertical)', () => {
    const root = linearRoot('root', [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 20, y: 25 },
    ], 90);
    const baseline = baselineDim('b1', { x: 0, y: 100 }, 'root');
    const g = buildBaselineGeometry(baseline, ISO_129_TEMPLATE, makeLookup([root, baseline]));
    expect(g.measurementValue).toBeCloseTo(100, 9);
    expectPoint(g.dimLine.start, { x: 20 + DIMDLI, y: 0 });
    expectPoint(g.dimLine.end, { x: 20 + DIMDLI, y: 100 });
  });

  it('aligned root (3-4-5 segment) — axis propagated, measurement along same direction', () => {
    const root = alignedRoot('root', [
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      { x: -8, y: 6 }, // perpOutward = (-0.8, 0.6), offset = +10 (raw signedOff +10)
    ]);
    const baseline = baselineDim('b1', { x: 60, y: 80 }, 'root');
    const g = buildBaselineGeometry(baseline, ISO_129_TEMPLATE, makeLookup([root, baseline]));
    expect(g.measurementValue).toBeCloseTo(100, 9);
    // dim line at offset (10 + DIMDLI) along (-0.8, 0.6) from baselineOrigin (0,0)
    const off = 10 + DIMDLI;
    expectPoint(g.dimLine.start, { x: -0.8 * off, y: 0.6 * off });
    expectPoint(g.dimLine.end, { x: 60 - 0.8 * off, y: 80 + 0.6 * off });
  });

  it('throws when parent id is not present in lookup', () => {
    const baseline = baselineDim('b1', { x: 100, y: 0 }, 'missing_root');
    expect(() =>
      buildBaselineGeometry(baseline, ISO_129_TEMPLATE, makeLookup([baseline])),
    ).toThrow(/Parent dim 'missing_root' not found/);
  });

  it('throws when parent is an unsupported dim type (radius)', () => {
    const radiusParent: RadiusDimensionEntity = {
      id: 'r1',
      type: 'dimension',
      dimensionType: 'radius',
      styleId: ISO_129_TEMPLATE.id,
      layerId: 'layer_test',
      defPoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
    } as RadiusDimensionEntity;
    const baseline = baselineDim('b1', { x: 100, y: 0 }, 'r1');
    expect(() =>
      buildBaselineGeometry(baseline, ISO_129_TEMPLATE, makeLookup([radiusParent, baseline])),
    ).toThrow(/cannot anchor a baseline\/continued chain/);
  });

  it('throws when root dim line passes through baseline origin (zero offset)', () => {
    const root = linearRoot('root', [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 0 }, // dimLineRef collinear with ext origins → signedOffset = 0
    ], 0);
    const baseline = baselineDim('b1', { x: 100, y: 0 }, 'root');
    expect(() =>
      buildBaselineGeometry(baseline, ISO_129_TEMPLATE, makeLookup([root, baseline])),
    ).toThrow(/Root dim line passes through baseline origin/);
  });

  it('throws when lookup callback is not provided', () => {
    const baseline = baselineDim('b1', { x: 100, y: 0 }, 'root');
    expect(() =>
      buildBaselineGeometry(baseline, ISO_129_TEMPLATE, undefined),
    ).toThrow(/Baseline dim requires a DimensionLookup/);
  });

  it('throws when aligned root has coincident ext origins', () => {
    const root = alignedRoot('root', [
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 50, y: 50 },
    ]);
    const baseline = baselineDim('b1', { x: 100, y: 0 }, 'root');
    expect(() =>
      buildBaselineGeometry(baseline, ISO_129_TEMPLATE, makeLookup([root, baseline])),
    ).toThrow(/Root aligned dim has coincident ext origins/);
  });

  it('uses the chained entity DIMDLI when style overrides spacing', () => {
    const root = linearRoot('root', [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 20 },
    ], 0);
    const baseline = baselineDim('b1', { x: 100, y: 0 }, 'root');
    const customStyle: DimStyle = { ...ISO_129_TEMPLATE, dimdli: 10 };
    const g = buildBaselineGeometry(baseline, customStyle, makeLookup([root, baseline]));
    expectPoint(g.dimLine.start, { x: 0, y: 30 });
    expectPoint(g.dimLine.end, { x: 100, y: 30 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Continued
// ──────────────────────────────────────────────────────────────────────────────

describe('buildContinuedGeometry', () => {
  it('single chain off linear root — same dim line as parent, chains from parent extOrigin2', () => {
    const root = linearRoot('root', [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 20 },
    ], 0);
    const cont = continuedDim('c1', { x: 100, y: 0 }, 'root');
    const g = buildContinuedGeometry(cont, ISO_129_TEMPLATE, makeLookup([root, cont]));
    expect(g.measurementValue).toBeCloseTo(50, 9);
    expectPoint(g.dimLine.start, { x: 50, y: 20 });
    expectPoint(g.dimLine.end, { x: 100, y: 20 });
  });

  it('chained from continued — accumulates ext origin advance, same dim line', () => {
    const root = linearRoot('root', [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 20 },
    ], 0);
    const c1 = continuedDim('c1', { x: 100, y: 0 }, 'root');
    const c2 = continuedDim('c2', { x: 150, y: 0 }, 'c1');
    const g = buildContinuedGeometry(c2, ISO_129_TEMPLATE, makeLookup([root, c1, c2]));
    expect(g.measurementValue).toBeCloseTo(50, 9);
    expectPoint(g.dimLine.start, { x: 100, y: 20 });
    expectPoint(g.dimLine.end, { x: 150, y: 20 });
  });

  it('continued off baseline parent — inherits baseline dim line offset', () => {
    const root = linearRoot('root', [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 25, y: 20 },
    ], 0);
    const b1 = baselineDim('b1', { x: 75, y: 0 }, 'root');
    const cont = continuedDim('c1', { x: 100, y: 0 }, 'b1');
    const g = buildContinuedGeometry(cont, ISO_129_TEMPLATE, makeLookup([root, b1, cont]));
    expect(g.measurementValue).toBeCloseTo(25, 9);
    expectPoint(g.dimLine.start, { x: 75, y: 20 + DIMDLI });
    expectPoint(g.dimLine.end, { x: 100, y: 20 + DIMDLI });
  });

  it('throws when parent id is not present in lookup', () => {
    const cont = continuedDim('c1', { x: 100, y: 0 }, 'missing_root');
    expect(() =>
      buildContinuedGeometry(cont, ISO_129_TEMPLATE, makeLookup([cont])),
    ).toThrow(/Parent dim 'missing_root' not found/);
  });

  it('throws when lookup callback is not provided', () => {
    const cont = continuedDim('c1', { x: 100, y: 0 }, 'root');
    expect(() =>
      buildContinuedGeometry(cont, ISO_129_TEMPLATE, undefined),
    ).toThrow(/Continued dim requires a DimensionLookup/);
  });

  it('throws when parent is an unsupported dim type (radius)', () => {
    const radiusParent: RadiusDimensionEntity = {
      id: 'r1',
      type: 'dimension',
      dimensionType: 'radius',
      styleId: ISO_129_TEMPLATE.id,
      layerId: 'layer_test',
      defPoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
    } as RadiusDimensionEntity;
    const cont = continuedDim('c1', { x: 100, y: 0 }, 'r1');
    expect(() =>
      buildContinuedGeometry(cont, ISO_129_TEMPLATE, makeLookup([radiusParent, cont])),
    ).toThrow(/cannot anchor a baseline\/continued chain/);
  });
});
