/**
 * ADR-557 Φ-attachment — attachment-aware text-box geometry SSoT tests.
 *
 * The box must land EXACTLY where the 2D renderer paints the glyphs for every one of
 * the 9 attachment points (TL..BR), so the grips, the 2D hover frame, the 3D mesh, the
 * hitTest and culling all coincide and 2D ≡ 3D. Covers:
 *   - `resolveTextBox` centre per attachment (the full 9-point grid),
 *   - default (no textStyle) === TL (the renderer's default baseline/align),
 *   - corners for BR (position pinned to the bottom-right corner),
 *   - 2D grip move-handle === the SSoT centre the 3D mesh anchors at (2D ≡ 3D),
 *   - `textBoxToPosition` inverse round-trip (incl. rotation) — resize pins the anchor,
 *   - rotation + `textBoxAABB`.
 */

import type { DxfText, DxfTextStyle } from '../../../canvas-v2/dxf-canvas/dxf-types';
import {
  resolveTextBox,
  textBoxToPosition,
  textBoxCornersWorld,
  textBoxAABB,
  effectiveTextWidth,
  resolveBoxHeight,
} from '../text-box';
import { getTextGrips } from '../text-grips';
// ADR-557 Φ-attachment — the box now measures the real glyph advance; pin a stub font
// at the 0.6 monospace ratio so these hand-computed widths stay deterministic (the jest
// jsdom canvas would otherwise feed machine-dependent metrics into the tier-2 fallback).
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';

let __stubCleanup: () => void;
beforeAll(() => { __stubCleanup = installStubFont(); });
afterAll(() => __stubCleanup());

// "DDD" (3) × height 10 × CHAR_WIDTH_MONOSPACE 0.6 = 18 → halfWidth 9; height 10 → halfLength 5.
function text(extra: Partial<DxfText> = {}): DxfText {
  return { id: 't1', type: 'text', visible: true, position: { x: 0, y: 0 }, text: 'DDD', height: 10, ...extra };
}

// attachment 'XY' (Y∈T/M/B vertical, X∈L/C/R horizontal) → renderer style fields.
function style(att: string): DxfTextStyle {
  const row = att[0], col = att[1];
  return {
    textAlign: col === 'C' ? 'center' : col === 'R' ? 'right' : 'left',
    textBaseline: row === 'M' ? 'middle' : row === 'B' ? 'bottom' : 'top',
  };
}

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const nearP = (p: { x: number; y: number }, x: number, y: number, eps = 1e-9) =>
  near(p.x, x, eps) && near(p.y, y, eps);

describe('resolveTextBox — width/height SSoT', () => {
  it('effectiveTextWidth: TEXT formula, widthFactor, MTEXT frame (hug vs constrained)', () => {
    expect(effectiveTextWidth(text())).toBeCloseTo(18, 9);
    expect(effectiveTextWidth(text({ widthFactor: 2 }))).toBeCloseTo(36, 9);
    // MTEXT wide frame → hugs the glyphs (Giorgio 2026-07-07); narrow frame → the frame wins.
    expect(effectiveTextWidth(text({ width: 50, text: 'X' }))).toBeCloseTo(6, 9); // content 'X', NOT 50
    expect(effectiveTextWidth(text({ width: 4, text: 'X' }))).toBeCloseTo(4, 9);  // 4 < content 6
  });
  it('resolveBoxHeight falls back to the AutoCAD DIMTXT default for a bad height', () => {
    expect(resolveBoxHeight(text({ height: 0 }))).toBeCloseTo(2.5, 9);
    expect(resolveBoxHeight(text({ height: 7 }))).toBeCloseTo(7, 9);
  });
});

describe('resolveTextBox — centre per attachment (9-point grid)', () => {
  // position (0,0), box 18×10 → halfWidth 9, halfLength 5. Expected box centres:
  const cases: Array<[string, number, number]> = [
    ['TL', 9, -5], ['TC', 0, -5], ['TR', -9, -5],
    ['ML', 9, 0], ['MC', 0, 0], ['MR', -9, 0],
    ['BL', 9, 5], ['BC', 0, 5], ['BR', -9, 5],
  ];
  it.each(cases)('%s → centre (%f, %f)', (att, cx, cy) => {
    const f = resolveTextBox(text({ textStyle: style(att) }));
    expect(nearP(f.center, cx, cy)).toBe(true);
    expect(f.halfWidth).toBeCloseTo(9, 9);
    expect(f.halfLength).toBeCloseTo(5, 9);
  });

  it('no textStyle defaults to TL (the renderer default top/left)', () => {
    expect(nearP(resolveTextBox(text()).center, 9, -5)).toBe(true);
  });
});

describe('resolveTextBox — corners pin the attachment point', () => {
  it('BR: position (0,0) is the bottom-right corner; box extends left + up', () => {
    const c = textBoxCornersWorld(text({ textStyle: style('BR') })); // NE, NW, SW, SE
    expect(nearP(c[0], 0, 10)).toBe(true);    // NE (top-right)
    expect(nearP(c[1], -18, 10)).toBe(true);  // NW (top-left)
    expect(nearP(c[2], -18, 0)).toBe(true);   // SW (bottom-left)
    expect(nearP(c[3], 0, 0)).toBe(true);     // SE = position (BR anchor)
  });

  it('TL: position (0,0) is the top-left corner; box extends right + down', () => {
    const c = textBoxCornersWorld(text({ textStyle: style('TL') }));
    expect(nearP(c[1], 0, 0)).toBe(true);     // NW = position (TL anchor)
    expect(nearP(c[3], 18, -10)).toBe(true);  // SE (bottom-right)
  });
});

describe('2D ≡ 3D parity — the grip move-handle is the SSoT centre the 3D mesh uses', () => {
  it.each(['TL', 'MC', 'BR'])('%s: move grip === resolveTextBox().center', (att) => {
    const t = text({ textStyle: style(att), position: { x: 5, y: -3 } });
    const move = getTextGrips(t).find((g) => g.textGripKind === 'text-move')!.position;
    expect(nearP(move, resolveTextBox(t).center.x, resolveTextBox(t).center.y)).toBe(true);
  });
});

describe('textBoxToPosition — inverse round-trip (resize/rotate pins the anchor)', () => {
  it.each(['TL', 'TC', 'MR', 'BL', 'BR'])('%s round-trips position with zero drift', (att) => {
    const t = text({ textStyle: style(att), position: { x: 12, y: -7 } });
    expect(nearP(textBoxToPosition(resolveTextBox(t), t), 12, -7)).toBe(true);
  });

  it('round-trips a rotated box', () => {
    const t = text({ textStyle: style('BR'), rotation: 30, position: { x: 4, y: 9 } });
    expect(nearP(textBoxToPosition(resolveTextBox(t), t), 4, 9, 1e-6)).toBe(true);
  });
});

describe('rotation + textBoxAABB', () => {
  it('rotates the centre offset about the position (CCW)', () => {
    // BL localCentre (9,5) rotated +90° → (-5, 9).
    const f = resolveTextBox(text({ textStyle: style('BL'), rotation: 90 }));
    expect(nearP(f.center, -5, 9, 1e-6)).toBe(true);
    expect(f.rotationDeg).toBe(90);
  });

  it('AABB encloses the (axis-aligned) attachment-aware box', () => {
    // TL at (10,20), box 6×5 ("AB" → 2×5×0.6 = 6) → x∈[10,16], y∈[15,20].
    const b = textBoxAABB(text({ text: 'AB', height: 5, position: { x: 10, y: 20 } }));
    expect(b.minX).toBeCloseTo(10, 9);
    expect(b.maxX).toBeCloseTo(16, 9);
    expect(b.minY).toBeCloseTo(15, 9);
    expect(b.maxY).toBeCloseTo(20, 9);
  });
});
