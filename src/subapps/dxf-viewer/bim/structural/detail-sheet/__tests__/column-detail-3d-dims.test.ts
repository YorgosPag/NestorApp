/**
 * ADR-457 Slice 3 — 3D dimension spec tests.
 *
 * `computeColumnDimSpecs3d` returns the W/D/H measured 3D points + value text
 * (later projected + drawn as 2D `dim` primitives). Verifies the three specs,
 * their texts, and empty output for unsupported kinds / degenerate height.
 */

import { computeColumnDimSpecs3d } from '../render/column-detail-3d-dims';
import type { ColumnParams, ColumnEntity } from '../../../types/column-types';

function column(params: ColumnParams): ColumnEntity {
  return { id: 'c1', type: 'column', ifcType: 'IfcColumn', params } as ColumnEntity;
}

const RECT: ColumnParams = {
  kind: 'rectangular',
  position: { x: 0, y: 0, z: 0 },
  anchor: 'center',
  width: 400,
  depth: 600,
  height: 3000,
  rotation: 0,
  baseBinding: 'storey-floor',
  topBinding: 'storey-ceiling',
  baseOffset: 0,
  topOffset: 0,
  reinforcement: {
    longitudinal: { diameterMm: 16, count: 8 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
    coverMm: 25,
  },
};

describe('computeColumnDimSpecs3d (ADR-457 Slice 3)', () => {
  it('returns width / depth / height specs with the raw mm values', () => {
    const specs = computeColumnDimSpecs3d(column(RECT));
    expect(specs).toHaveLength(3);
    expect(specs.map((s) => s.text)).toEqual(['400', '600', '3000']);
  });

  it('spans the full column height in the height spec (base → top in metres)', () => {
    const height = computeColumnDimSpecs3d(column(RECT))[2];
    expect(Math.abs(height.b.y - height.a.y)).toBeCloseTo(3000 * 0.001, 6);
  });

  it('ADR-460 — emits W/D/H dims for a non-rectangular (circular) column', () => {
    expect(computeColumnDimSpecs3d(column({ ...RECT, kind: 'circular' }))).toHaveLength(3);
  });

  it('returns empty for a degenerate (zero) height', () => {
    expect(computeColumnDimSpecs3d(column({ ...RECT, height: 0 }))).toHaveLength(0);
  });
});
