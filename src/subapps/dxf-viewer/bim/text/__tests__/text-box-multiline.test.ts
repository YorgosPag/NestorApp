/**
 * ADR-557 (multi-line) — a flat `text` with `\n` breaks stacks into lines: the box height =
 * Σ γραμμών, width = max γραμμής, anchored so `position` stays the attachment point (T grows
 * down, B up, M symmetric). Drives grips / hover / hitTest / 3D anchor / culling / resize.
 *
 * Default stub font (ink == em metrics: ascent 0.8 / descent 0.2, advance 0.6·em·char), so the
 * VISUAL box == the NOMINAL em box vertically and the numbers are hand-computable.
 * Line spacing = LINE_HEIGHT_RATIO (1.2) × factor(1.0) = 1.2 em baseline-to-baseline.
 */

import type { DxfText, DxfTextStyle } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { resolveTextBox, resolveTextEmBox, textBoxToPosition, isTextBoxFrameConstrained } from '../text-box';
import { applyTextGripDrag } from '../text-grips';
import { splitTextLines, textLineCount, resolveLineSpacingRatio, resolveMultilineExtents } from '../text-lines';
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';

let __cleanup: () => void;
beforeAll(() => { __cleanup = installStubFont(0.6, 'arial'); });
afterAll(() => __cleanup());

function text(extra: Partial<DxfText> = {}): DxfText {
  return { id: 't1', type: 'text', visible: true, position: { x: 0, y: 0 }, text: 'CDE', height: 10, ...extra };
}
function style(att: string): DxfTextStyle {
  const row = att[0], col = att[1];
  return {
    textAlign: col === 'C' ? 'center' : col === 'R' ? 'right' : 'left',
    textBaseline: row === 'M' ? 'middle' : row === 'B' ? 'bottom' : 'top',
  };
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe('splitTextLines / textLineCount', () => {
  it('splits on all newline conventions and never returns empty', () => {
    expect(splitTextLines('a\nb')).toEqual(['a', 'b']);
    expect(splitTextLines('a\r\nb\rc')).toEqual(['a', 'b', 'c']);
    expect(splitTextLines('a\n')).toEqual(['a', '']); // trailing break = a blank line
    expect(splitTextLines('')).toEqual(['']);
    expect(splitTextLines(undefined)).toEqual(['']);
    expect(textLineCount('x\ny\nz')).toBe(3);
    expect(textLineCount('single')).toBe(1);
  });
});

describe('resolveLineSpacingRatio', () => {
  it('is LINE_HEIGHT_RATIO (1.2) by default', () => {
    expect(resolveLineSpacingRatio(text())).toBeCloseTo(1.2, 9);
  });
  it('multiplies by the node line-spacing factor', () => {
    const t = text() as DxfText & { textNode?: unknown };
    (t as { textNode?: unknown }).textNode = { lineSpacing: { factor: 1.5 } };
    expect(resolveLineSpacingRatio(t)).toBeCloseTo(1.8, 9); // 1.2 × 1.5
  });
});

describe('resolveMultilineExtents (attachment distribution)', () => {
  it('single line → no extra', () => {
    expect(resolveMultilineExtents('T', 1, 1.2)).toEqual({ topAdd: 0, bottomAdd: 0 });
  });
  it('T grows down, B grows up, M symmetric (2 lines, spacing 1.2 → extra 1.2)', () => {
    expect(resolveMultilineExtents('T', 2, 1.2)).toEqual({ topAdd: 0, bottomAdd: 1.2 });
    expect(resolveMultilineExtents('B', 2, 1.2)).toEqual({ topAdd: 1.2, bottomAdd: 0 });
    expect(resolveMultilineExtents('M', 2, 1.2)).toEqual({ topAdd: 0.6, bottomAdd: 0.6 });
  });
});

describe('VISUAL box — 2 lines, height 10, TL', () => {
  const t = text({ text: 'AB\nCDE', textStyle: style('TL') });

  it('width = widest line, height = stacked block, top pinned at position', () => {
    const f = resolveTextBox(t);
    expect(f.halfWidth).toBeCloseTo(9, 6);   // widest line 'CDE' = 3 × 0.6 × 10 = 18
    expect(f.halfLength).toBeCloseTo(11, 6); // (1 + 1.2)·10 / 2
    expect(near(f.center.y + f.halfLength, 0)).toBe(true);   // block top = position.y (TL)
    expect(near(f.center.y - f.halfLength, -22)).toBe(true); // block bottom = -22
  });

  it('is taller than the single-line box (parity: grips/hover/hit follow)', () => {
    const single = resolveTextBox(text({ text: 'CDE', textStyle: style('TL') }));
    expect(single.halfLength).toBeCloseTo(5, 6);
    expect(resolveTextBox(t).halfLength).toBeGreaterThan(single.halfLength);
  });
});

describe('VISUAL box — M attachment stays centred on position', () => {
  it('2 lines centre symmetrically about position.y', () => {
    const f = resolveTextBox(text({ text: 'AB\nCDE', textStyle: style('MC') }));
    expect(near(f.center.y, 0)).toBe(true);   // centred anchor unchanged by line count
    expect(f.halfLength).toBeCloseTo(11, 6);  // (1 + 1.2)·10 / 2
  });
});

describe('NOMINAL em box (3D plane + culling) is multi-line aware', () => {
  it('em box height grows with the line count', () => {
    const em = resolveTextEmBox(text({ text: 'AB\nCDE', textStyle: style('TL') }));
    expect(em.halfLength).toBeCloseTo(11, 6); // matches the visual box (default stub: ink == em)
    expect(near(em.center.y + em.halfLength, 0)).toBe(true);
  });
});

describe('MTEXT box HUGS the glyphs when the frame is wider than the text (Giorgio 2026-07-07)', () => {
  it('a wide editor-overlay frame does NOT widen the box — it hugs the content', () => {
    // Reported case: MTEXT with a 100-unit frame but a 18-unit line → box = content, not frame.
    const t = text({ text: 'CDE', width: 100, textStyle: style('TL') });
    expect(isTextBoxFrameConstrained(t)).toBe(false);
    expect(resolveTextBox(t).halfWidth).toBeCloseTo(9, 6); // content 'CDE' 18 / 2, NOT 50
  });

  it('multi-line wide-frame MTEXT: width = widest line, height = stacked block', () => {
    const t = text({ text: 'AB\nCDE', width: 100, textStyle: style('TL') });
    const f = resolveTextBox(t);
    expect(f.halfWidth).toBeCloseTo(9, 6);   // widest line 'CDE'
    expect(f.halfLength).toBeCloseTo(11, 6); // 3-line stack unaffected by the frame
  });

  it('a NARROW frame still wins (text wraps to the column)', () => {
    const t = text({ text: 'CDE', width: 8, textStyle: style('TL') });
    expect(isTextBoxFrameConstrained(t)).toBe(true);
    expect(resolveTextBox(t).halfWidth).toBeCloseTo(4, 6); // frame 8 / 2
  });
});

describe('wide-frame MTEXT width-resize holds (no snap-back to content)', () => {
  it('E-edge drag writes widthFactor (hug), and the box keeps the dragged width', () => {
    const t0 = text({ text: 'CDE', width: 100, textStyle: style('TL') }); // hug halfWidth 9
    const patch = applyTextGripDrag('text-edge-e', { entity: t0, delta: { x: 12, y: 0 } });
    expect(patch.width).toBeUndefined();          // NOT a frame resize
    expect(typeof patch.widthFactor).toBe('number'); // stretches like TEXT
    const t1 = { ...t0, ...patch } as DxfText;
    expect(resolveTextBox(t1).halfWidth).toBeCloseTo(15, 6); // 9 + 12/2 held — no jump on release
  });
});

describe('resize inverse round-trips for multi-line (no drift)', () => {
  it('textBoxToPosition recovers position for a rotated 3-line box', () => {
    const t = text({ text: 'A\nBB\nCCC', textStyle: style('BR'), rotation: 25, position: { x: 7, y: -3 } });
    const p = textBoxToPosition(resolveTextBox(t), t);
    expect(near(p.x, 7) && near(p.y, -3)).toBe(true);
  });
});
