/**
 * Tests — ADR-642 Φ3: the shared unit-space primitive stamper (annotation + linetype).
 *
 * `stampSymbolPrimitive` is a pure ctx painter; we record canvas calls and assert each
 * primitive kind stamps the expected path ops (line/polyline/circle/arc/text), including
 * the world-CCW → screen Y-flip arc-angle negation and the closed-solid fill vs stroke.
 */

import { describe, it, expect } from '@jest/globals';
import {
  stampSymbolPrimitive,
  type SymbolStampContext,
} from '../symbol-primitive-stamp';
import type {
  AnnotationSymbolPrimitive,
  AnnotationSymbolPoint,
} from '../../../../config/annotation-symbol-catalog';

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

/** Identity placement: unit space === screen space, no rotation. */
const identity: SymbolStampContext = {
  toScreen: (p: AnnotationSymbolPoint) => ({ x: p[0], y: p[1] }),
  radiusScale: 100,
  rot: 0,
};
const call = (calls: readonly Call[], fn: string) => calls.find((c) => c.fn === fn);
const has = (calls: readonly Call[], fn: string) => calls.some((c) => c.fn === fn);

describe('stampSymbolPrimitive — path ops per kind', () => {
  it('line → moveTo/lineTo/stroke through toScreen', () => {
    const { ctx, calls } = createMockCtx();
    const prim: AnnotationSymbolPrimitive = { kind: 'line', from: [0, 0], to: [1, 2] };
    stampSymbolPrimitive(ctx, prim, identity);
    expect(call(calls, 'moveTo')?.args).toEqual([0, 0]);
    expect(call(calls, 'lineTo')?.args).toEqual([1, 2]);
    expect(has(calls, 'stroke')).toBe(true);
  });

  it('closed solid polyline → closePath + fill (no stroke)', () => {
    const { ctx, calls } = createMockCtx();
    const prim: AnnotationSymbolPrimitive = {
      kind: 'polyline', points: [[0, 0], [1, 0], [1, 1]], closed: true, solid: true,
    };
    stampSymbolPrimitive(ctx, prim, identity);
    expect(has(calls, 'closePath')).toBe(true);
    expect(has(calls, 'fill')).toBe(true);
    expect(has(calls, 'stroke')).toBe(false);
  });

  it('closed hollow polyline → closePath + stroke', () => {
    const { ctx, calls } = createMockCtx();
    const prim: AnnotationSymbolPrimitive = {
      kind: 'polyline', points: [[0, 0], [1, 0], [1, 1]], closed: true, solid: false,
    };
    stampSymbolPrimitive(ctx, prim, identity);
    expect(has(calls, 'closePath')).toBe(true);
    expect(has(calls, 'stroke')).toBe(true);
    expect(has(calls, 'fill')).toBe(false);
  });

  it('circle → arc(center, |r·radiusScale|, 0..2π)', () => {
    const { ctx, calls } = createMockCtx();
    const prim: AnnotationSymbolPrimitive = { kind: 'circle', center: [3, 4], radius: 0.5, solid: false };
    stampSymbolPrimitive(ctx, prim, identity);
    const a = call(calls, 'arc')!.args as number[];
    expect(a[0]).toBe(3);
    expect(a[1]).toBe(4);
    expect(a[2]).toBeCloseTo(50, 6); // 0.5 × radiusScale 100
    expect(a[3]).toBe(0);
    expect(a[4]).toBeCloseTo(Math.PI * 2, 6);
  });

  it('arc → world-CCW angles negated for the canvas Y-flip (+ rot offset)', () => {
    const { ctx, calls } = createMockCtx();
    const prim: AnnotationSymbolPrimitive = {
      kind: 'arc', center: [0, 0], radius: 0.4, startAngle: 30, endAngle: 150,
    };
    stampSymbolPrimitive(ctx, prim, { ...identity, rot: 0 });
    const a = call(calls, 'arc')!.args as number[];
    expect(a[3]).toBeCloseTo(-(30 * Math.PI) / 180, 6);
    expect(a[4]).toBeCloseTo(-(150 * Math.PI) / 180, 6);
    expect(a[5]).toBe(false); // counterclockwise flag dropped
  });

  it('text → fillText when the on-screen cap height clears the min', () => {
    const { ctx, calls } = createMockCtx();
    const prim: AnnotationSymbolPrimitive = { kind: 'text', at: [0, 0], value: 'N', heightFrac: 0.2 };
    stampSymbolPrimitive(ctx, prim, identity); // 0.2 × 100 = 20px ≥ 4
    expect(call(calls, 'fillText')?.args[0]).toBe('N');
  });

  it('text → skipped as a sub-pixel smear below the min height', () => {
    const { ctx, calls } = createMockCtx();
    const prim: AnnotationSymbolPrimitive = { kind: 'text', at: [0, 0], value: 'N', heightFrac: 0.2 };
    stampSymbolPrimitive(ctx, prim, { ...identity, radiusScale: 10 }); // 0.2 × 10 = 2px < 4
    expect(has(calls, 'fillText')).toBe(false);
  });
});
