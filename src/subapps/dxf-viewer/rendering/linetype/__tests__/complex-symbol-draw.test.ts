/**
 * Tests — ADR-642 Φ3 (#3): complex-symbol-draw embedded-symbol painting.
 *
 * `drawSymbolElement` resolves a glyph from the catalog and stamps its unit-space
 * primitives at the arc-length point, oriented along the tangent. We use the `tick`
 * glyph (a single vertical line [0,±0.5]) as a clean placement probe and assert the
 * insertion offset, tangent orientation, user rotation, and the skip guards.
 */

import { describe, it, expect } from '@jest/globals';
import { drawSymbolElement } from '../complex-symbol-draw';
import type { TangentPoint } from '../complex-text-draw';
import type { SymbolElement } from '../../../config/complex-linetype-types';

interface Call { fn: string; args: readonly unknown[] }

function createMockCtx() {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]): void => { calls.push({ fn, args }); };
  const ctx = {
    beginPath: rec('beginPath'), closePath: rec('closePath'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), arc: rec('arc'),
    stroke: rec('stroke'), fill: rec('fill'),
    save: rec('save'), restore: rec('restore'),
    translate: rec('translate'), rotate: rec('rotate'), transform: rec('transform'),
    fillText: rec('fillText'),
    set font(_v: string) {}, set fillStyle(_v: unknown) {},
    set textAlign(_v: string) {}, set textBaseline(_v: string) {},
    get lineWidth(): number { return 1; }, set lineWidth(_v: number) {},
    get strokeStyle(): string { return '#111'; }, set strokeStyle(_v: string) {},
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

const tick: SymbolElement = {
  kind: 'symbol', glyphId: 'tick', role: 'side', scale: 1,
  rotationDeg: 0, offsetXMm: 0, offsetYMm: 0,
};
const rightward: TangentPoint = { x: 10, y: 5, ux: 1, uy: 0 };
const moveTos = (calls: readonly Call[]) => calls.filter((c) => c.fn === 'moveTo').map((c) => c.args as [number, number]);
const lineTos = (calls: readonly Call[]) => calls.filter((c) => c.fn === 'lineTo').map((c) => c.args as [number, number]);
const has = (calls: readonly Call[], fn: string) => calls.some((c) => c.fn === fn);

describe('drawSymbolElement — placement (tick glyph)', () => {
  it('stamps the glyph at the point, vertical along the left normal', () => {
    const { ctx, calls } = createMockCtx();
    drawSymbolElement(ctx, tick, rightward, 4); // unitToPx = 1×2.5×4 = 10
    // tick = line [0,-0.5]→[0,0.5]; rightward tangent, no offset → x stays 10, y spans 10..0.
    const [mx, my] = moveTos(calls)[0];
    const [lx, ly] = lineTos(calls)[0];
    expect(mx).toBeCloseTo(10, 6);
    expect(lx).toBeCloseTo(10, 6);
    expect(my).toBeCloseTo(10, 6); // [0,-0.5] → 5 − 10×(−0.5) = 10
    expect(ly).toBeCloseTo(0, 6);  // [0, 0.5] → 5 − 10×( 0.5) = 0
  });

  it('shifts the insertion along the tangent by offsetX (mm→px)', () => {
    const { ctx, calls } = createMockCtx();
    drawSymbolElement(ctx, { ...tick, offsetXMm: 1 }, rightward, 4); // +1mm × 4 = +4px along (1,0)
    expect(moveTos(calls)[0][0]).toBeCloseTo(14, 6);
    expect(lineTos(calls)[0][0]).toBeCloseTo(14, 6);
  });

  it('rotates the glyph with the user R (90° CCW turns the vertical tick horizontal)', () => {
    const { ctx, calls } = createMockCtx();
    drawSymbolElement(ctx, { ...tick, rotationDeg: 90 }, rightward, 4);
    // both endpoints now share the same y (horizontal), x spans ±5 around 10.
    const [, my] = moveTos(calls)[0];
    const [, ly] = lineTos(calls)[0];
    expect(my).toBeCloseTo(5, 6);
    expect(ly).toBeCloseTo(5, 6);
  });
});

describe('drawSymbolElement — glyph resolution + guards', () => {
  it('falls back to the default glyph for an unknown id (still draws)', () => {
    const { ctx, calls } = createMockCtx();
    drawSymbolElement(ctx, { ...tick, glyphId: 'nope-shx-9' }, rightward, 4);
    expect(has(calls, 'stroke')).toBe(true); // cross fallback = two strokes
  });

  it('no-op for non-positive mmToPx', () => {
    const { ctx, calls } = createMockCtx();
    drawSymbolElement(ctx, tick, rightward, 0);
    expect(has(calls, 'stroke')).toBe(false);
  });

  it('no-op for a sub-pixel size (never a smear)', () => {
    const { ctx, calls } = createMockCtx();
    drawSymbolElement(ctx, { ...tick, scale: 0.02 }, rightward, 4); // 0.02×2.5×4 = 0.2px < 1
    expect(has(calls, 'stroke')).toBe(false);
  });
});
