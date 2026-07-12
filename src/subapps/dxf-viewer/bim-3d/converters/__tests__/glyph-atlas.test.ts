/**
 * glyph-atlas.test.ts — ADR-645 Φάση B.
 *
 * The pure shelf packer (`packRect`) + the atlas cell geometry via a deterministic stub opentype
 * font (`installStubFont`), so advance / UV / quad extents are machine-independent. Pixel drawing
 * needs a real 2D context (browser); jsdom has none, so the atlas computes metrics-only cells —
 * exactly the path these tests assert.
 */

import { packRect, GlyphAtlas, type ShelfPackState } from '../glyph-atlas';
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';
import { resolveTextFont } from '../dxf-text-font-resolution';
import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';

describe('packRect — shelf bin packing', () => {
  it('places rects left-to-right on one shelf, advancing the cursor', () => {
    const s: ShelfPackState = { x: 0, y: 0, rowH: 0 };
    expect(packRect(s, 40, 80, 2048)).toEqual({ px: 0, py: 0 });
    expect(packRect(s, 30, 60, 2048)).toEqual({ px: 40, py: 0 });
    expect(s.x).toBe(70);
    expect(s.rowH).toBe(80); // tallest on the shelf
  });

  it('wraps to a new shelf (y += rowH) when the row overflows', () => {
    const s: ShelfPackState = { x: 2040, y: 0, rowH: 50 };
    expect(packRect(s, 40, 30, 2048)).toEqual({ px: 0, py: 50 });
  });

  it('returns null when the atlas is full or the rect is wider than the atlas', () => {
    expect(packRect({ x: 0, y: 2040, rowH: 0 }, 40, 40, 2048)).toBeNull(); // no vertical room
    expect(packRect({ x: 0, y: 0, rowH: 0 }, 3000, 40, 2048)).toBeNull();  // wider than atlas
  });
});

describe('GlyphAtlas — cell geometry (stub font)', () => {
  let cleanup: () => void;
  beforeAll(() => { cleanup = installStubFont(0.6, 'arial'); }); // 0.6 em advance, ascent .8 / descent .2
  afterAll(() => cleanup());

  const font = () => resolveTextFont({ id: 't', type: 'text', text: 'A', height: 10, position: { x: 0, y: 0 }, textStyle: { fontFamily: 'arial' } } as DxfText);

  it('an ink glyph advances 0.6 em with pad-inflated quad extents + a packed UV rect', () => {
    const atlas = new GlyphAtlas();
    const cell = atlas.getCell(font(), 'A');
    expect(cell.hasInk).toBe(true);
    expect(cell.advanceEm).toBeCloseTo(0.6, 6);
    expect(cell.leftEm).toBeCloseTo(-0.15, 6);          // −PAD
    expect(cell.rightEm).toBeCloseTo(0.6 + 0.15, 6);    // advance + PAD
    expect(cell.topEm).toBeCloseTo(0.8 + 0.15, 6);      // ascent + PAD
    expect(cell.bottomEm).toBeCloseTo(-(0.2 + 0.15), 6); // −(descent + PAD)
    expect(cell.u1).toBeGreaterThan(cell.u0);
    expect(cell.v1).toBeGreaterThan(cell.v0);
    atlas.dispose();
  });

  it('whitespace → advance-only cell (no ink, no packed rect)', () => {
    const atlas = new GlyphAtlas();
    const cell = atlas.getCell(font(), ' ');
    expect(cell.hasInk).toBe(false);
    expect(cell.advanceEm).toBeGreaterThan(0);
    expect(cell.u0).toBe(cell.u1);
    atlas.dispose();
  });

  it('dedups: the same (face, char) returns the cached cell', () => {
    const atlas = new GlyphAtlas();
    const f = font();
    expect(atlas.getCell(f, 'A')).toBe(atlas.getCell(f, 'A'));
    atlas.dispose();
  });

  it('font metrics are em ratios of the resolved face', () => {
    const atlas = new GlyphAtlas();
    const fm = atlas.getFontMetrics(font());
    expect(fm.ascentEm).toBeCloseTo(0.8, 6);
    expect(fm.descentEm).toBeCloseTo(0.2, 6);
    atlas.dispose();
  });
});
