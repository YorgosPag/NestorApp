/**
 * ADR-557 Φάση C — the shared single-line glyph-run paint SSoT (`glyph-run-draw.ts`).
 *
 * This is the ONE routine the 2D `TextRenderer` AND the 3D textured-plane converter both paint
 * through, so a glyph draws with the same outlines/tracking/fallback in every viewport. These
 * tests pin the two tiers (loaded font → vector glyph path; no font → CSS fillText) + the
 * align/baseline geometry + tracking, on a deterministic stub font with a recording mock ctx
 * (jsdom has no real 2D backend, so a mock is both deterministic and sufficient here).
 */

import { installStubFont } from './_stub-font';
import { resolveEntityFont } from '../font-resolver';
import { getGlyphRun } from '../glyph-path-cache';
import { drawGlyphRunToCanvas, paintTextRun, measureTextRunPx } from '../glyph-run-draw';

let __cleanup: () => void;
beforeAll(() => { __cleanup = installStubFont(); }); // 'arial', emPerChar 0.6, GLYPH_REFERENCE_SIZE 100
afterAll(() => __cleanup());

interface Call { fn: string; args: unknown[]; }
function makeMockCtx() {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]) => { calls.push({ fn, args }); };
  const ctx = {
    font: '', fillStyle: '', textAlign: 'left', textBaseline: 'alphabetic', letterSpacing: '',
    save: rec('save'), restore: rec('restore'),
    translate: rec('translate'), scale: rec('scale'), transform: rec('transform'),
    fill: rec('fill'), fillText: rec('fillText'),
    measureText: (t: string) => { calls.push({ fn: 'measureText', args: [t] }); return { width: t.length * 7 }; },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

// Stub 'AB' at GLYPH_REFERENCE_SIZE 100: width = 2·0.6·100 = 120, ascent = 80, descent = 20.
const arial = () => resolveEntityFont('arial')!;
const runAB = () => getGlyphRun(arial().font, arial().cacheName, 'AB', 1);
const find = (calls: Call[], fn: string) => calls.find((c) => c.fn === fn);

describe('drawGlyphRunToCanvas — glyph-path geometry', () => {
  it('center/middle: scale, x-offset −w/2, baseline (ascent−descent)/2, fills the path', () => {
    const { ctx, calls } = makeMockCtx();
    const w = drawGlyphRunToCanvas(ctx, runAB(), 100, 50, 10, 'center', 'middle');
    expect(w).toBeCloseTo(12); // 120 × (10/100)
    const t = find(calls, 'translate')!;
    expect(t.args[0]).toBeCloseTo(100 - 6);  // center xOff = −widthPx/2 = −6
    expect(t.args[1]).toBeCloseTo(50 + 3);   // middle = (8 − 2)/2 = 3
    expect(find(calls, 'scale')!.args).toEqual([0.1, 0.1]);
    expect(find(calls, 'fill')).toBeTruthy();
  });

  it('left/top: xOff 0, baseline = +ascent', () => {
    const { ctx, calls } = makeMockCtx();
    drawGlyphRunToCanvas(ctx, runAB(), 0, 0, 10, 'left', 'top');
    expect(find(calls, 'translate')!.args).toEqual([0, 8]); // xOff 0, top → ascentPx 8
  });

  it('right/bottom: xOff = −w, baseline = −descent', () => {
    const { ctx, calls } = makeMockCtx();
    drawGlyphRunToCanvas(ctx, runAB(), 0, 0, 10, 'right', 'bottom');
    expect(find(calls, 'translate')!.args).toEqual([-12, -2]); // right → −12, bottom → −descentPx −2
  });
});

describe('paintTextRun — tier selection', () => {
  it('resolved font → fills the glyph path, never CSS fillText', () => {
    const { ctx, calls } = makeMockCtx();
    const w = paintTextRun(ctx, 'AB', { originX: 0, originY: 0, targetHeight: 10, align: 'left', baseline: 'top', resolved: arial() });
    expect(w).toBeCloseTo(12);
    expect(find(calls, 'fill')).toBeTruthy();
    expect(find(calls, 'fillText')).toBeFalsy();
  });

  it('no resolved font → CSS fillText fallback (returns measured width)', () => {
    const { ctx, calls } = makeMockCtx();
    const w = paintTextRun(ctx, 'AB', { originX: 5, originY: 6, targetHeight: 10, align: 'left', baseline: 'top', resolved: null });
    const ft = find(calls, 'fillText')!;
    expect(ft.args).toEqual(['AB', 5, 6]);
    expect(find(calls, 'fill')).toBeFalsy();
    expect(w).toBe(14); // measureText 'AB' → 2 × 7
  });

  it('italic resolves to null → drives the CSS fallback (2D parity)', () => {
    expect(resolveEntityFont('arial', { italic: true })).toBeNull();
    const { ctx, calls } = makeMockCtx();
    paintTextRun(ctx, 'AB', { originX: 0, originY: 0, targetHeight: 10, align: 'left', baseline: 'top', resolved: resolveEntityFont('arial', { italic: true }) });
    expect(find(calls, 'fillText')).toBeTruthy();
  });

  it('CSS fallback + tracking: sets letterSpacing during paint and restores it', () => {
    const { ctx } = makeMockCtx();
    (ctx as unknown as { letterSpacing: string }).letterSpacing = 'PREV';
    paintTextRun(ctx, 'AB', { originX: 0, originY: 0, targetHeight: 10, align: 'left', baseline: 'top', resolved: null, tracking: 2 });
    // (2 − 1) × 10 = 10px applied between glyphs, then restored to the prior value.
    expect((ctx as unknown as { letterSpacing: string }).letterSpacing).toBe('PREV');
  });
});

describe('measureTextRunPx — mirrors paintTextRun without drawing', () => {
  it('resolved → glyph advance scaled, no draw calls', () => {
    const { ctx, calls } = makeMockCtx();
    const px = measureTextRunPx(ctx, 'AB', { targetHeight: 10, resolved: arial() });
    expect(px).toBeCloseTo(12);
    expect(find(calls, 'fill')).toBeFalsy();
    expect(find(calls, 'fillText')).toBeFalsy();
  });

  it('no font → CSS measureText', () => {
    const { ctx } = makeMockCtx();
    expect(measureTextRunPx(ctx, 'ABC', { targetHeight: 10, resolved: null })).toBe(21); // 3 × 7
  });
});
