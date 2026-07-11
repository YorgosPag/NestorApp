/**
 * ADR-639 Στάδιο 5 — ownership-predicate matrix (correctness invariant).
 *
 * Cross-checks `isWebglOwnedLine` against the EXACT exclusions of the Canvas2D
 * LINE batch loop (`DxfRenderer.ts:157-185`): the GPU-owned set must be a strict
 * subset of what Canvas2D would otherwise stroke, so no line is ever double-drawn
 * or dropped. N.17-safe (jest only).
 */

import { isWebglOwnedLine, type WebglLineOwnershipContext } from '../is-webgl-owned-line';
import type { DxfEntityUnion } from '../../dxf-canvas/dxf-types';
import type { ResolvedRenderStyle } from '../../dxf-canvas/dxf-renderer-style-resolve';

const SOLID_STYLE: ResolvedRenderStyle = { colorHex: '#ffffff', lineWidthPx: 1, alpha: 1, dashMm: [] };
const DASHED_STYLE: ResolvedRenderStyle = { colorHex: '#ffffff', lineWidthPx: 1, alpha: 1, dashMm: [5, -5] };

/** Default context: nothing skipped/selected/hovered (the "eligible" baseline). */
const OPEN_CTX: WebglLineOwnershipContext = {
  isLayerSkipped: () => false,
  isSelected: () => false,
  isHovered: () => false,
};

function line(over: Partial<DxfEntityUnion> = {}): DxfEntityUnion {
  return {
    id: 'l1',
    type: 'line',
    visible: true,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 10 },
    ...over,
  } as DxfEntityUnion;
}

function polyline(over: Partial<DxfEntityUnion> = {}): DxfEntityUnion {
  return {
    id: 'p1',
    type: 'polyline',
    visible: true,
    closed: false,
    vertices: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ],
    ...over,
  } as DxfEntityUnion;
}

describe('isWebglOwnedLine — TRUE (GPU-owned)', () => {
  it('owns a solid, visible LINE on an active layer', () => {
    expect(isWebglOwnedLine(line(), SOLID_STYLE, OPEN_CTX)).toBe(true);
  });

  it('owns a plain open polyline', () => {
    expect(isWebglOwnedLine(polyline(), SOLID_STYLE, OPEN_CTX)).toBe(true);
  });

  it('owns a plain closed polyline', () => {
    expect(isWebglOwnedLine(polyline({ closed: true } as Partial<DxfEntityUnion>), SOLID_STYLE, OPEN_CTX)).toBe(true);
  });

  it('owns a polyline whose bulge/width arrays are all zero', () => {
    const e = polyline({ bulges: [0, 0], startWidths: [0, 0], endWidths: [0, 0] } as Partial<DxfEntityUnion>);
    expect(isWebglOwnedLine(e, SOLID_STYLE, OPEN_CTX)).toBe(true);
  });
});

describe('isWebglOwnedLine — FALSE (stays Canvas2D)', () => {
  it('rejects a non-line/polyline type', () => {
    expect(isWebglOwnedLine(line({ type: 'circle' } as Partial<DxfEntityUnion>), SOLID_STYLE, OPEN_CTX)).toBe(false);
  });

  it('rejects an invisible line', () => {
    expect(isWebglOwnedLine(line({ visible: false }), SOLID_STYLE, OPEN_CTX)).toBe(false);
  });

  it('rejects a line on a frozen/skipped layer', () => {
    expect(isWebglOwnedLine(line(), SOLID_STYLE, { ...OPEN_CTX, isLayerSkipped: () => true })).toBe(false);
  });

  it('rejects a selected line (mirrors DxfRenderer.ts:163)', () => {
    expect(isWebglOwnedLine(line(), SOLID_STYLE, { ...OPEN_CTX, isSelected: (id) => id === 'l1' })).toBe(false);
  });

  it('rejects a hovered line (mirrors DxfRenderer.ts:164)', () => {
    expect(isWebglOwnedLine(line(), SOLID_STYLE, { ...OPEN_CTX, isHovered: (id) => id === 'l1' })).toBe(false);
  });

  it('rejects a measurement line', () => {
    expect(isWebglOwnedLine(line({ measurement: true } as Partial<DxfEntityUnion>), SOLID_STYLE, OPEN_CTX)).toBe(false);
  });

  it('rejects a raw non-solid lineType (DxfRenderer.ts:167)', () => {
    expect(isWebglOwnedLine(line({ lineType: 'dashed' } as Partial<DxfEntityUnion>), SOLID_STYLE, OPEN_CTX)).toBe(false);
  });

  it('rejects a resolved dashed style even when raw lineType is solid', () => {
    expect(isWebglOwnedLine(line(), DASHED_STYLE, OPEN_CTX)).toBe(false);
  });

  it('rejects a bulged polyline', () => {
    const e = polyline({ bulges: [0.5, 0] } as Partial<DxfEntityUnion>);
    expect(isWebglOwnedLine(e, SOLID_STYLE, OPEN_CTX)).toBe(false);
  });

  it('rejects a width-band polyline (per-vertex widths)', () => {
    const e = polyline({ startWidths: [2, 2], endWidths: [2, 2] } as Partial<DxfEntityUnion>);
    expect(isWebglOwnedLine(e, SOLID_STYLE, OPEN_CTX)).toBe(false);
  });

  it('rejects a constant-width polyline', () => {
    const e = polyline({ constantWidth: 3 } as Partial<DxfEntityUnion>);
    expect(isWebglOwnedLine(e, SOLID_STYLE, OPEN_CTX)).toBe(false);
  });
});
