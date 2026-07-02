/**
 * ADR-563 — entity factory unit tests.
 */

import { buildAutoDimensionEntities } from '../auto-dimension-entity-factory';
import type { PlannedSegment } from '../auto-dimension-types';

function seg(overrides: Partial<PlannedSegment> = {}): PlannedSegment {
  return {
    side: 'south',
    tier: 'detail',
    defPoints: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 0, y: -600 },
    ],
    rotation: 0,
    source1: { id: 'wallA', edge: 'min' },
    source2: { id: 'wallB', edge: 'max' },
    ...overrides,
  };
}

const CTX = { styleId: 'dimstyle_iso_129', layerId: 'lyr_dims' };

describe('buildAutoDimensionEntities', () => {
  it('produces a linear dimension entity with the expected shape', () => {
    const [dim] = buildAutoDimensionEntities([seg()], CTX);
    expect(dim.type).toBe('dimension');
    expect(dim.dimensionType).toBe('linear');
    expect(dim.styleId).toBe('dimstyle_iso_129');
    expect(dim.layerId).toBe('lyr_dims');
    expect(dim.rotation).toBe(0);
    expect(dim.userText).toBe('<>');
    expect(dim.defPoints).toEqual([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 0, y: -600 },
    ]);
  });

  it('maps sources to per-def-point bimExtent associations (axis from side)', () => {
    const [dim] = buildAutoDimensionEntities([seg()], CTX);
    expect(dim.associations).toEqual([
      { defPointIndex: 0, geometryId: 'wallA', associationType: 'bimExtent', bimAnchor: { axis: 'x', edge: 'min' } },
      { defPointIndex: 1, geometryId: 'wallB', associationType: 'bimExtent', bimAnchor: { axis: 'x', edge: 'max' } },
    ]);
  });

  it('uses the Y axis for E/W (vertical) chains', () => {
    const [dim] = buildAutoDimensionEntities([seg({ side: 'west' })], CTX);
    expect(dim.associations?.[0].bimAnchor?.axis).toBe('y');
  });

  it('omits associations for source-less (overall) segments', () => {
    const [dim] = buildAutoDimensionEntities([seg({ source1: undefined, source2: undefined })], CTX);
    expect(dim.associations).toBeUndefined();
  });

  it('assigns a unique, non-empty enterprise id per entity', () => {
    const dims = buildAutoDimensionEntities([seg(), seg()], CTX);
    expect(dims[0].id).toBeTruthy();
    expect(dims[1].id).toBeTruthy();
    expect(dims[0].id).not.toBe(dims[1].id);
  });
});
