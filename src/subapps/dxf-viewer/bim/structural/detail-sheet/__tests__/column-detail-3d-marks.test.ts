/**
 * ADR-457 Slice 3 — 3D bar-mark spec tests.
 *
 * `computeColumnBarMarkSpecs3d` returns one 3D anchor (bar top) + number text per
 * longitudinal bar (later projected + drawn as 2D `text` primitives).
 */

import { computeColumnBarMarkSpecs3d } from '../render/column-detail-3d-marks';
import { computeColumnRebarLayout } from '../../reinforcement/column-rebar-layout';
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
  reinforcement: {
    longitudinal: { diameterMm: 16, count: 8 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
    coverMm: 25,
  },
};

describe('computeColumnBarMarkSpecs3d (ADR-457 Slice 3)', () => {
  it('returns one spec per longitudinal bar, numbered 1..N', () => {
    const specs = computeColumnBarMarkSpecs3d(column(RECT));
    const layout = computeColumnRebarLayout(RECT.reinforcement!, RECT.width, RECT.depth)!;
    expect(specs).toHaveLength(layout.longitudinalBarsMm.length);
    expect([...specs.map((s) => Number(s.text))].sort((a, b) => a - b))
      .toEqual(Array.from({ length: specs.length }, (_, i) => i + 1));
  });

  it('anchors every mark above the bar tops (y > column height in metres)', () => {
    for (const s of computeColumnBarMarkSpecs3d(column(RECT))) {
      expect(s.pos.y).toBeGreaterThan(3000 * 0.001);
    }
  });

  it('ADR-460 — emits bar marks for a non-rectangular (circular) column', () => {
    expect(computeColumnBarMarkSpecs3d(column({ ...RECT, kind: 'circular' })).length).toBeGreaterThan(0);
  });
});
