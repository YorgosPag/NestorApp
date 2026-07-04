/**
 * ADR-562 Φ9.2 — `getDimGripAlignmentAnchors` + `toDimensionEntity` tests.
 *
 * Locks the alignment-anchor mapping per dimension grip kind used by the grip-drag
 * AutoAlign traces (mouse-handler-move/up + useDimGripGhostPreview):
 *   - endpoint grips align to their partner origin
 *   - dim-line offset / text align to both measured origins
 *   - `dim-extra` is per dimensionType (aligned→origins, radius/diameter/ordinate→point,
 *     linear rotation handle / angular → null = alignment skipped)
 *   - `toDimensionEntity` normalises both the raw entity and the DxfDimension wrapper.
 */

import { getDimGripAlignmentAnchors, toDimensionEntity } from '../useDimensionGrips';
import type {
  DimensionEntity,
  AlignedDimensionEntity,
  LinearDimensionEntity,
  OrdinateDimensionEntity,
  RadiusDimensionEntity,
} from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';

function aligned(defPoints: Point2D[]): AlignedDimensionEntity {
  return { id: 'd', type: 'dimension', dimensionType: 'aligned', styleId: 's', layerId: 'L', defPoints } as unknown as AlignedDimensionEntity;
}
function linear(defPoints: Point2D[]): LinearDimensionEntity {
  return { id: 'd', type: 'dimension', dimensionType: 'linear', styleId: 's', layerId: 'L', defPoints, rotation: 0 } as unknown as LinearDimensionEntity;
}
function ordinate(defPoints: Point2D[], datum: Point2D): OrdinateDimensionEntity {
  return { id: 'd', type: 'dimension', dimensionType: 'ordinate', styleId: 's', layerId: 'L', defPoints, datum, axis: 'x' } as unknown as OrdinateDimensionEntity;
}
function radius(defPoints: Point2D[]): RadiusDimensionEntity {
  return { id: 'd', type: 'dimension', dimensionType: 'radius', styleId: 's', layerId: 'L', defPoints } as unknown as RadiusDimensionEntity;
}

const A: Point2D = { x: 0, y: 0 };
const B: Point2D = { x: 100, y: 0 };
const C: Point2D = { x: 0, y: 20 };

describe('getDimGripAlignmentAnchors', () => {
  it('dim-defpoint-0 → partner origin (defPoints[1])', () => {
    expect(getDimGripAlignmentAnchors('dim-defpoint-0', aligned([A, B, C]))).toEqual([B]);
  });

  it('dim-defpoint-1 → partner origin (defPoints[0])', () => {
    expect(getDimGripAlignmentAnchors('dim-defpoint-1', aligned([A, B, C]))).toEqual([A]);
  });

  it('dim-line-ref → both measured origins', () => {
    expect(getDimGripAlignmentAnchors('dim-line-ref', aligned([A, B, C]))).toEqual([A, B]);
  });

  it('dim-text → both measured origins', () => {
    expect(getDimGripAlignmentAnchors('dim-text', aligned([A, B, C]))).toEqual([A, B]);
  });

  it('aligned dim-extra → both origins (patches defPoints[2])', () => {
    expect(getDimGripAlignmentAnchors('dim-extra', aligned([A, B, C]))).toEqual([A, B]);
  });

  it('radius dim-extra → centre (defPoints[0])', () => {
    expect(getDimGripAlignmentAnchors('dim-extra', radius([A, B]))).toEqual([A]);
  });

  it('ordinate dim-extra → leader origin (defPoints[0])', () => {
    expect(getDimGripAlignmentAnchors('dim-extra', ordinate([A], { x: 5, y: 5 }))).toEqual([A]);
  });

  it('linear dim-extra (rotation handle) → null (alignment skipped)', () => {
    expect(getDimGripAlignmentAnchors('dim-extra', linear([A, B, C]))).toBeNull();
  });

  it('degenerate single-point dim → empty anchors, never throws', () => {
    expect(getDimGripAlignmentAnchors('dim-defpoint-0', aligned([A]))).toEqual([]);
  });
});

describe('toDimensionEntity', () => {
  it('normalises a raw DimensionEntity', () => {
    const raw = aligned([A, B, C]);
    expect(toDimensionEntity(raw)).toBe(raw);
  });

  it('unwraps a DxfDimension render wrapper', () => {
    const inner = aligned([A, B, C]) as DimensionEntity;
    const wrapper = { type: 'dimension', dimensionEntity: inner };
    expect(toDimensionEntity(wrapper)).toBe(inner);
  });

  it('returns null for a non-dimension / missing entity', () => {
    expect(toDimensionEntity({ type: 'line' })).toBeNull();
    expect(toDimensionEntity(null)).toBeNull();
    expect(toDimensionEntity(undefined)).toBeNull();
  });
});
