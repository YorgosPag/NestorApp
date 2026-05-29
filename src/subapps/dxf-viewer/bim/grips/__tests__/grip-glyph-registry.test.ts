/**
 * ADR-397 §3 D1 — `grip-glyph-registry` SSoT tests.
 *
 * Coverage:
 *   - move/rotation glyph kinds across wall/stair/column resolve correctly.
 *   - unknown kinds + null/undefined → 'square' default.
 *   - registry is the single source (wall + stair + column share one table).
 */

import { gripGlyphShape, GRIP_GLYPH_REGISTRY } from '../grip-glyph-registry';

describe('gripGlyphShape', () => {
  it("MOVE handles → 'move' across every BIM entity", () => {
    expect(gripGlyphShape('wall-midpoint')).toBe('move');
    expect(gripGlyphShape('stair-base')).toBe('move');
    expect(gripGlyphShape('column-center')).toBe('move');
  });

  it("ROTATION handles → 'rotation' across every BIM entity", () => {
    expect(gripGlyphShape('wall-rotation')).toBe('rotation');
    expect(gripGlyphShape('stair-direction')).toBe('rotation');
    expect(gripGlyphShape('column-rotation')).toBe('rotation');
  });

  it("unknown / resize / variant kinds → 'square'", () => {
    for (const k of ['wall-start', 'wall-thickness', 'column-width', 'column-depth', 'stair-width', 'bogus']) {
      expect(gripGlyphShape(k)).toBe('square');
    }
  });

  it("null / undefined → 'square'", () => {
    expect(gripGlyphShape(undefined)).toBe('square');
    expect(gripGlyphShape(null)).toBe('square');
  });
});

describe('GRIP_GLYPH_REGISTRY (single source)', () => {
  it('every entry is move or rotation only', () => {
    for (const shape of Object.values(GRIP_GLYPH_REGISTRY)) {
      expect(['move', 'rotation']).toContain(shape);
    }
  });

  it('covers wall + stair + column move/rotation kinds', () => {
    expect(GRIP_GLYPH_REGISTRY['wall-midpoint']).toBe('move');
    expect(GRIP_GLYPH_REGISTRY['column-rotation']).toBe('rotation');
    expect(GRIP_GLYPH_REGISTRY['stair-direction']).toBe('rotation');
  });
});
