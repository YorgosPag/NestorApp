/**
 * ADR-557 Φ-attachment (vertical) — the VISUAL box hugs the drawn glyphs.
 *
 * With a cap-height font (ink ascent 0.7·em, zero descender — like all-caps "TEST"), the
 * VISUAL box (`resolveTextBox`, the 2D grip / hover / hitTest box) must:
 *   - seat its bottom on the baseline and its top at the cap top (no em gap above),
 *   - be SHORTER than the NOMINAL em box (`resolveTextEmBox`, the 3D plane + culling box),
 *   - and survive a resize with no jump (the dragged box height round-trips through the
 *     nominal `height` inverse).
 *
 * Stub metrics: font ascent 0.8 / descent 0.2 (baseline anchor), advance 0.6·em·char.
 */

import type { DxfText, DxfTextStyle } from '../../../canvas-v2/dxf-canvas/dxf-types';
import {
  resolveTextBox,
  resolveTextEmBox,
  textBoxToPosition,
  textVisualExtentRatio,
} from '../text-box';
import { applyTextGripDrag } from '../text-grips';
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';

let __cleanup: () => void;
// Cap-height stub: glyph ink is 0.7·em above the baseline, nothing below (all-caps).
beforeAll(() => { __cleanup = installStubFont(0.6, 'arial', { inkAscentEm: 0.7, inkDescentEm: 0 }); });
afterAll(() => __cleanup());

// "DDD" (3) × height 10 × 0.6 = 18 → halfWidth 9.
function text(extra: Partial<DxfText> = {}): DxfText {
  return { id: 't1', type: 'text', visible: true, position: { x: 0, y: 0 }, text: 'DDD', height: 10, ...extra };
}
function style(att: string): DxfTextStyle {
  const row = att[0], col = att[1];
  return {
    textAlign: col === 'C' ? 'center' : col === 'R' ? 'right' : 'left',
    textBaseline: row === 'M' ? 'middle' : row === 'B' ? 'bottom' : 'top',
  };
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('VISUAL box hugs the caps (TL, height 10)', () => {
  const t = text({ textStyle: style('TL') });

  it('bottom sits on the baseline, top at the cap top — no em gap above', () => {
    const f = resolveTextBox(t);
    // TL: baseline = position.y − fontAscent·h = 0 − 0.8·10 = −8. Cap top = baseline + 0.7·10 = −1.
    const boxTop = f.center.y + f.halfLength;
    const boxBottom = f.center.y - f.halfLength;
    expect(near(boxBottom, -8)).toBe(true); // baseline (glyph bottom)
    expect(near(boxTop, -1)).toBe(true);    // cap top (glyph top)
    expect(f.halfLength).toBeCloseTo(3.5, 9); // extent 0.7·10 = 7
    expect(f.halfWidth).toBeCloseTo(9, 9);    // width unchanged
  });

  it('is SHORTER than the nominal em box (which the 3D plane + culling still use)', () => {
    const em = resolveTextEmBox(t);
    expect(em.halfLength).toBeCloseTo(5, 9);          // em box unchanged (0.5·10)
    expect(em.center.y).toBeCloseTo(-5, 9);           // em centre (position.y − h/2)
    expect(resolveTextBox(t).halfLength).toBeLessThan(em.halfLength);
  });
});

describe('textVisualExtentRatio', () => {
  it('is the ink extent (cap height) ÷ em, not 1', () => {
    expect(textVisualExtentRatio(text({ textStyle: style('TL') }))).toBeCloseTo(0.7, 9);
  });
});

describe('resize round-trips with no jump (visual → nominal → visual)', () => {
  it('north-edge grow: the box holds the dragged height + pins the baseline', () => {
    const t0 = text({ textStyle: style('TL') });
    const f0 = resolveTextBox(t0);
    const baseBottom = f0.center.y - f0.halfLength; // baseline, must stay pinned (opposite edge)

    // Grow the top edge by +7 world → visual box height 7 → 14 (halfLength 3.5 → 7).
    const patch = applyTextGripDrag('text-edge-n', { entity: t0, delta: { x: 0, y: 7 } });
    expect(patch.height).toBeCloseTo(14 / 0.7, 9); // nominal em recovered = boxHeight / extentRatio = 20

    const t1 = { ...t0, ...patch } as DxfText;
    const f1 = resolveTextBox(t1);
    expect(f1.halfLength).toBeCloseTo(7, 6);  // dragged height held — NO jump on release
    expect(f1.halfWidth).toBeCloseTo(9, 6);   // width held (widthFactor compensated)
    expect(near(f1.center.y - f1.halfLength, baseBottom, 1e-6)).toBe(true); // baseline pinned
  });

  it('position inverse round-trips (no drift) for a rotated cap box', () => {
    const t = text({ textStyle: style('BR'), rotation: 30, position: { x: 4, y: 9 } });
    const p = textBoxToPosition(resolveTextBox(t), t);
    expect(near(p.x, 4, 1e-6) && near(p.y, 9, 1e-6)).toBe(true);
  });
});
