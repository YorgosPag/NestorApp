/**
 * ADR-557 — the render EntityModel must carry the text `widthFactor` (AutoCAD X-scale) +
 * the MTEXT `width` frame, so the drawn glyphs + grip box apply the SAME horizontal scale
 * the interaction/hover path reads from the scene entity. Regression: after a resize wrote
 * `widthFactor`, the render dropped it (box stayed wide) while hover-test narrowed → the
 * right/centre grips + move/rotation glyphs lost hover (Giorgio 2026-07-07).
 */

import type { DxfEntityUnion } from '../dxf-types';
import { buildEntityModelFromDxf } from '../dxf-renderer-entity-model';

const resolved = { colorHex: '#fff', lineWidthPx: 1, alpha: 1 };

function text(extra: Record<string, unknown> = {}): DxfEntityUnion {
  return {
    id: 't1', visible: true, type: 'text', position: { x: 0, y: 0 }, text: 'DDD', height: 10,
    ...extra,
  } as unknown as DxfEntityUnion;
}

describe('buildEntityModelFromDxf — text widthFactor / width parity (ADR-557)', () => {
  it('carries widthFactor onto the render EntityModel', () => {
    const m = buildEntityModelFromDxf(text({ widthFactor: 0.6 }), false, resolved) as unknown as { widthFactor?: number };
    expect(m.widthFactor).toBeCloseTo(0.6, 9);
  });

  it('carries the MTEXT width frame onto the render EntityModel', () => {
    const m = buildEntityModelFromDxf(text({ width: 120, text: 'X' }), false, resolved) as unknown as { width?: number };
    expect(m.width).toBeCloseTo(120, 9);
  });

  it('omits both when absent (plain TEXT → widthFactor 1 semantics, no width frame)', () => {
    const m = buildEntityModelFromDxf(text(), false, resolved) as unknown as { widthFactor?: number; width?: number };
    expect(m.widthFactor).toBeUndefined();
    expect(m.width).toBeUndefined();
  });

  it('carries the node lineSpacing factor onto the render EntityModel (ADR-557 «Διάστιχο»)', () => {
    const m = buildEntityModelFromDxf(
      text({ lineSpacing: { mode: 'multiple', factor: 2 } }), false, resolved,
    ) as unknown as { lineSpacing?: { factor: number } };
    expect(m.lineSpacing?.factor).toBeCloseTo(2, 9);
  });

  it('omits lineSpacing when absent (default factor 1 semantics)', () => {
    const m = buildEntityModelFromDxf(text(), false, resolved) as unknown as { lineSpacing?: unknown };
    expect(m.lineSpacing).toBeUndefined();
  });

  it('still carries the core text fields (position/text/height/rotation)', () => {
    const m = buildEntityModelFromDxf(text({ rotation: 30 }), false, resolved) as unknown as {
      type: string; text: string; height: number; rotation: number;
    };
    expect(m.type).toBe('text');
    expect(m.text).toBe('DDD');
    expect(m.height).toBeCloseTo(10, 9);
    expect(m.rotation).toBeCloseTo(30, 9);
  });
});
