/**
 * glyph-atlas-text-layout.test.ts — ADR-645 Φάση B.
 *
 * Pure geometry of `layoutTextGlyphs` with a FAKE glyph source (deterministic cells), so the
 * placement contract (glyph count, width/height, widthFactor, oblique shear, rotation, multi-line
 * stacking) is verified without a real atlas / font / canvas. Assertions use corner DIFFERENCES
 * that cancel the em-box anchor, so they hold regardless of `resolveTextEmBox`'s absolute centre.
 */

import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { layoutTextGlyphs, type GlyphCell, type GlyphLayoutSource } from '../glyph-atlas-text-layout';
import type { TextFontResolution } from '../dxf-text-font-resolution';

const EM = 10;
const ADVANCE = 0.6;

/** A deterministic ink cell: advance 0.6·em, full em height (ascent 0.8 / descent 0.2), no pad. */
function inkCell(advanceEm = ADVANCE): GlyphCell {
  return { hasInk: true, advanceEm, leftEm: 0, rightEm: advanceEm, topEm: 0.8, bottomEm: -0.2, u0: 0, v0: 0, u1: 1, v1: 1 };
}
const SPACE_CELL: GlyphCell = { hasInk: false, advanceEm: 0.5, leftEm: 0, rightEm: 0, topEm: 0, bottomEm: 0, u0: 0, v0: 0, u1: 0, v1: 0 };

const source: GlyphLayoutSource = {
  fontMetrics: { ascentEm: 0.8, descentEm: 0.2 },
  getCell: (ch) => (ch === ' ' ? SPACE_CELL : inkCell()),
};

function font(widthFactor = 1, tracking = 1): TextFontResolution {
  return { resolved: null, tracking, widthFactor, fallbackFont: () => '', faceKey: 'k' };
}

function text(overrides: Partial<DxfText>): DxfText {
  return { id: 't', type: 'text', text: 'A', height: EM, position: { x: 0, y: 0 }, visible: true, ...overrides } as DxfText;
}

describe('layoutTextGlyphs — glyph count', () => {
  it('empty / whitespace text → no quads', () => {
    expect(layoutTextGlyphs(text({ text: '' }), font(), source)).toHaveLength(0);
    expect(layoutTextGlyphs(text({ text: '   ' }), font(), source)).toHaveLength(0);
  });

  it('one ink quad per ink glyph; spaces advance but emit nothing', () => {
    expect(layoutTextGlyphs(text({ text: 'A' }), font(), source)).toHaveLength(1);
    expect(layoutTextGlyphs(text({ text: 'AB' }), font(), source)).toHaveLength(2);
    expect(layoutTextGlyphs(text({ text: 'A B' }), font(), source)).toHaveLength(2); // space → no quad
  });

  it('newlines split into stacked lines (no glyph for \\n)', () => {
    expect(layoutTextGlyphs(text({ text: 'A\nB' }), font(), source)).toHaveLength(2);
  });
});

describe('layoutTextGlyphs — dimensions (rotation 0)', () => {
  it('a single glyph quad spans advance·em wide and full em tall', () => {
    const [q] = layoutTextGlyphs(text({ text: 'A' }), font(), source);
    // TL→TR is the horizontal top edge; TL→BL is the vertical left edge.
    expect(q.x1 - q.x0).toBeCloseTo(ADVANCE * EM, 6); // width = 0.6·10 = 6
    expect(q.y1 - q.y0).toBeCloseTo(0, 6);            // top edge horizontal at rot 0
    expect(q.y0 - q.y3).toBeCloseTo(EM, 6);           // top − bottom = (0.8+0.2)·10 = 10
  });

  it('widthFactor X-scales the glyph width but not its height', () => {
    const [q] = layoutTextGlyphs(text({ text: 'A' }), font(2), source);
    expect(q.x1 - q.x0).toBeCloseTo(ADVANCE * EM * 2, 6); // width doubles
    expect(q.y0 - q.y3).toBeCloseTo(EM, 6);              // height unchanged
  });

  it('\\T tracking widens the pen advance between glyphs (glyph shape unchanged)', () => {
    const g1 = layoutTextGlyphs(text({ text: 'AB' }), font(1, 1), source);
    const g2 = layoutTextGlyphs(text({ text: 'AB' }), font(1, 2), source);
    const gap1 = g1[1].x0 - g1[0].x0; // pen step A→B
    const gap2 = g2[1].x0 - g2[0].x0;
    expect(gap2).toBeGreaterThan(gap1);
    expect(g1[0].x1 - g1[0].x0).toBeCloseTo(g2[0].x1 - g2[0].x0, 6); // glyph width identical
  });
});

describe('layoutTextGlyphs — oblique shear & rotation', () => {
  it('oblique angle leans the top of the glyph forward (top-right of the bottom)', () => {
    const [q] = layoutTextGlyphs(text({ text: 'A', textStyle: { obliqueAngle: 15 } }), font(), source);
    const shear = Math.tan((15 * Math.PI) / 180);
    // TL.x − BL.x = shear·(topV − bottomV) = shear·em (top corner pushed +x vs bottom).
    expect(q.x0 - q.x3).toBeCloseTo(shear * EM, 5);
  });

  it('plan rotation rotates the top edge vector by the same angle', () => {
    const [q] = layoutTextGlyphs(text({ text: 'A', rotation: 90 }), font(), source);
    // rot 90° (CCW): the +x top edge (length 6) becomes +y.
    expect(q.x1 - q.x0).toBeCloseTo(0, 5);
    expect(q.y1 - q.y0).toBeCloseTo(ADVANCE * EM, 5);
  });
});

describe('layoutTextGlyphs — multi-line stacking', () => {
  it('the second line sits one line-advance (1.2·em) below the first', () => {
    const [a, b] = layoutTextGlyphs(text({ text: 'A\nB' }), font(), source);
    const midY = (q: { y0: number; y3: number }) => (q.y0 + q.y3) / 2;
    expect(midY(a) - midY(b)).toBeCloseTo(1.2 * EM, 5); // LINE_HEIGHT_RATIO·em, first line higher
  });
});
