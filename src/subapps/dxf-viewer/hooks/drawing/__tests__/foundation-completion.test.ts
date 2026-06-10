/**
 * ADR-436 Slice 1 — foundation-completion builder tests.
 */

import {
  buildDefaultFoundationParams,
  buildFoundationEntity,
  completeFoundationFromClick,
} from '../foundation-completion';

describe('buildDefaultFoundationParams', () => {
  it('places a pad at the clicked point', () => {
    const p = buildDefaultFoundationParams({ x: 100, y: 200 }, 'pad');
    expect(p.kind).toBe('pad');
    if (p.kind !== 'pad') throw new Error('expected pad');
    expect(p.position).toEqual({ x: 100, y: 200, z: 0 });
  });

  it('applies overrides (width/length/thickness/topElevation/anchor)', () => {
    const p = buildDefaultFoundationParams({ x: 0, y: 0 }, 'pad', {
      width: 1800, length: 1200, thicknessMm: 600, topElevationMm: -1500, anchor: 'ne',
    });
    if (p.kind !== 'pad') throw new Error('expected pad');
    expect(p.width).toBe(1800);
    expect(p.length).toBe(1200);
    expect(p.thicknessMm).toBe(600);
    expect(p.topElevationMm).toBe(-1500);
    expect(p.anchor).toBe('ne');
  });
});

describe('buildFoundationEntity', () => {
  it('builds a valid foundation entity with computed geometry + IFC mixin', () => {
    const params = buildDefaultFoundationParams({ x: 0, y: 0 }, 'pad');
    const result = buildFoundationEntity(params, 'layer-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.type).toBe('foundation');
    expect(result.entity.kind).toBe('pad');
    expect(result.entity.ifcType).toBe('IfcFooting');
    expect(result.entity.predefinedType).toBe('PAD_FOOTING');
    expect(result.entity.id.startsWith('fnd')).toBe(true);
    expect(result.entity.geometry.area).toBeGreaterThan(0);
    expect(result.entity.layerId).toBe('layer-1');
  });

  it('rejects params with hard errors (non-positive width)', () => {
    const params = buildDefaultFoundationParams({ x: 0, y: 0 }, 'pad', { width: 0 });
    const result = buildFoundationEntity(params, 'layer-1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hardErrors.length).toBeGreaterThan(0);
  });
});

describe('completeFoundationFromClick', () => {
  it('builds an entity end-to-end from a click point', () => {
    const result = completeFoundationFromClick({ x: 500, y: 500 }, 'layer-9', 'pad');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.params.kind).toBe('pad');
  });
});
