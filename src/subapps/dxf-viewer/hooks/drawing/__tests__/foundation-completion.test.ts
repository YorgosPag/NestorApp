/**
 * ADR-436 Slice 1 — foundation-completion builder tests.
 */

import {
  buildDefaultFoundationParams,
  buildFoundationEntity,
  completeFoundationFromClick,
  completeFoundationFromTwoClicks,
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

describe('completeFoundationFromTwoClicks (Slice 2 — line kinds)', () => {
  it('builds a strip from 2 clicks with axis start→end', () => {
    const result = completeFoundationFromTwoClicks({ x: 0, y: 0 }, { x: 3000, y: 0 }, 'layer-1', 'strip');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.entity.params;
    expect(p.kind).toBe('strip');
    if (p.kind === 'pad') throw new Error('expected line');
    expect(p.start).toEqual({ x: 0, y: 0, z: 0 });
    expect(p.end).toEqual({ x: 3000, y: 0, z: 0 });
    expect(result.entity.predefinedType).toBe('STRIP_FOOTING');
  });

  it('builds a tie-beam with FOOTING_BEAM predefined type', () => {
    const result = completeFoundationFromTwoClicks({ x: 0, y: 0 }, { x: 2000, y: 0 }, 'layer-1', 'tie-beam');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.params.kind).toBe('tie-beam');
    expect(result.entity.predefinedType).toBe('FOOTING_BEAM');
  });

  it('honours width override (e.g. from-wall thickness)', () => {
    const result = completeFoundationFromTwoClicks({ x: 0, y: 0 }, { x: 2000, y: 0 }, 'layer-1', 'strip', { width: 350 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.params.width).toBe(350);
  });

  it('rejects a zero-length axis (degenerate → hard error)', () => {
    const result = completeFoundationFromTwoClicks({ x: 100, y: 100 }, { x: 100, y: 100 }, 'layer-1', 'strip');
    expect(result.ok).toBe(false);
  });
});
