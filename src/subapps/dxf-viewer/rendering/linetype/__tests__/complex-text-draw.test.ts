/**
 * Tests — ADR-642 Φ2 (#2): complex-text-draw embedded-text painting.
 *
 * In the node test env `resolveEntityFont` finds no loaded font → `paintTextRun`
 * takes the CSS `ctx.fillText` fallback, so a drawn glyph shows up as a `fillText`
 * call. We assert placement (translate), rotation, upright-flip, and the skip guards.
 */

import { describe, it, expect } from '@jest/globals';
import { drawTextElement, type TangentPoint } from '../complex-text-draw';
import type { TextElement } from '../../../config/complex-linetype-types';

interface Call { fn: string; args: readonly unknown[] }

function createMockCtx() {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]): void => { calls.push({ fn, args }); };
  const ctx = {
    save: rec('save'), restore: rec('restore'),
    translate: rec('translate'), rotate: rec('rotate'),
    fillText: rec('fillText'),
    measureText: (t: string) => { calls.push({ fn: 'measureText', args: [t] }); return { width: t.length * 5 }; },
    set font(_v: string) {}, set fillStyle(_v: string | CanvasGradient | CanvasPattern) {},
    get strokeStyle(): string { return '#abcdef'; }, set strokeStyle(_v: string) {},
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

const baseText: TextElement = {
  kind: 'text', value: 'GAS', styleId: 'arial', scale: 1,
  rotationDeg: 0, offsetXMm: 0, offsetYMm: 0, followPath: true,
};

const rightward: TangentPoint = { x: 10, y: 5, ux: 1, uy: 0 };
const call = (calls: readonly Call[], fn: string) => calls.find((c) => c.fn === fn);
const has = (calls: readonly Call[], fn: string) => calls.some((c) => c.fn === fn);

describe('drawTextElement — placement', () => {
  it('translates to the point (no offset) and paints the value', () => {
    const { ctx, calls } = createMockCtx();
    drawTextElement(ctx, baseText, rightward, 4);
    expect(call(calls, 'translate')?.args).toEqual([10, 5]);
    expect(call(calls, 'fillText')?.args[0]).toBe('GAS');
    // followPath along +X tangent, no user rotation → angle 0.
    expect(call(calls, 'rotate')?.args[0]).toBeCloseTo(0, 6);
  });

  it('applies X along tangent and Y along the left normal (−uy, ux)', () => {
    const { ctx, calls } = createMockCtx();
    // mmToPx 4, X=2mm → +8px along (1,0); Y=1mm → +4px along (0,1).
    drawTextElement(ctx, { ...baseText, offsetXMm: 2, offsetYMm: 1 }, rightward, 4);
    const [x, y] = call(calls, 'translate')!.args as [number, number];
    expect(x).toBeCloseTo(18, 6);
    expect(y).toBeCloseTo(9, 6);
  });

  it('adds the user rotation R (CAD CCW+, screen y-down → negated) when not following the path', () => {
    const { ctx, calls } = createMockCtx();
    drawTextElement(ctx, { ...baseText, followPath: false, rotationDeg: 90 }, rightward, 4);
    expect(call(calls, 'rotate')?.args[0]).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('keeps text upright: flips a leftward baseline by π (never mirrored)', () => {
    const { ctx, calls } = createMockCtx();
    drawTextElement(ctx, baseText, { x: 0, y: 0, ux: -1, uy: 0 }, 4);
    // atan2(0,-1)=π, cos(π)<0 → +π ⇒ 2π (upright).
    expect(call(calls, 'rotate')?.args[0]).toBeCloseTo(2 * Math.PI, 6);
  });
});

describe('drawTextElement — skip guards', () => {
  it('no-op for an empty value', () => {
    const { ctx, calls } = createMockCtx();
    drawTextElement(ctx, { ...baseText, value: '  ' }, rightward, 4);
    expect(has(calls, 'fillText')).toBe(false);
  });

  it('no-op for sub-pixel height (never a smear)', () => {
    const { ctx, calls } = createMockCtx();
    drawTextElement(ctx, { ...baseText, scale: 0.01 }, rightward, 4); // 0.01×2.5×4 = 0.1px
    expect(has(calls, 'fillText')).toBe(false);
  });

  it('no-op for non-positive mmToPx', () => {
    const { ctx, calls } = createMockCtx();
    drawTextElement(ctx, baseText, rightward, 0);
    expect(has(calls, 'fillText')).toBe(false);
  });
});
