/**
 * Tests — ADR-642 Φ3 (#3): the stroker routes symbol elements through the walk.
 *
 * A `[gap, symbol]` cycle has no dash, so any stroke ops on the canvas come ONLY from
 * the stamped glyph — proving the stroker reaches `drawSymbolElement` (not skipped like
 * Φ1/Φ2). The `cross` glyph = two spokes, so we expect an even, non-zero moveTo count.
 */

import { describe, it, expect } from '@jest/globals';
import { strokeStyledPolyline } from '../ComplexLineStroker';
import type { ComplexLinetypeDef } from '../../../config/complex-linetype-types';
import type { Point } from '../complex-stroke-geometry';

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
    setLineDash: rec('setLineDash'), fillText: rec('fillText'),
    set font(_v: string) {}, set fillStyle(_v: unknown) {},
    set textAlign(_v: string) {}, set textBaseline(_v: string) {},
    set lineJoin(_v: string) {}, set miterLimit(_v: number) {},
    get lineWidth(): number { return 1; }, set lineWidth(_v: number) {},
    get strokeStyle(): string { return '#111'; }, set strokeStyle(_v: string) {},
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

/** A gap-then-`×` cycle: no dash, so strokes come only from the stamped fence symbol. */
const fenceDef: ComplexLinetypeDef = {
  name: 'Fence-X',
  description: '──×──',
  layers: [{ elements: [
    { kind: 'gap', lengthMm: 10 },
    { kind: 'symbol', glyphId: 'cross', role: 'side', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
  ] }],
  scaleSpace: 'model',
  origin: 'user-created',
};

const line: readonly Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

describe('strokeStyledPolyline — symbol routing', () => {
  it('stamps the fence glyph along the line (even, non-zero spoke count)', () => {
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, line, fenceDef, { worldToScreenScale: 4, ltscale: 1 });
    const moveTos = calls.filter((c) => c.fn === 'moveTo').length;
    expect(moveTos).toBeGreaterThan(0);
    expect(moveTos % 2).toBe(0); // cross = 2 spokes per stamp
    // no native dash fast-path (the type is not simple-expressible with a symbol)
    expect(calls.some((c) => c.fn === 'setLineDash')).toBe(false);
  });

  it('draws nothing extra for a degenerate (too-short) line but never throws', () => {
    const { ctx } = createMockCtx();
    expect(() =>
      strokeStyledPolyline(ctx, [{ x: 0, y: 0 }], fenceDef, { worldToScreenScale: 4, ltscale: 1 }),
    ).not.toThrow();
  });
});
