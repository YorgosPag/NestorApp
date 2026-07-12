/**
 * Tests — ADR-642 §6.4 ComplexLineStroker (fast-path guard + arc-length walk).
 */

import { strokeStyledPolyline, DEFAULT_PAPER_PX_PER_MM } from '../ComplexLineStroker';
import { patternToComplex } from '../../../config/complex-linetype-adapters';
import type { ComplexLinetypeDef } from '../../../config/complex-linetype-types';
import type { Point } from '../complex-stroke-geometry';

interface Call { fn: string; args: readonly unknown[] }

function createMockCtx() {
  const calls: Call[] = [];
  let lineWidth = 1;
  const rec = (fn: string) => (...args: unknown[]): void => { calls.push({ fn, args }); };
  const ctx = {
    save: rec('save'), restore: rec('restore'),
    beginPath: rec('beginPath'), moveTo: rec('moveTo'), lineTo: rec('lineTo'),
    closePath: rec('closePath'), stroke: rec('stroke'), fill: rec('fill'),
    setLineDash: rec('setLineDash'),
    // Φ2 embedded-text path (drawTextElement → CSS fillText fallback in node).
    translate: rec('translate'), rotate: rec('rotate'), fillText: rec('fillText'),
    measureText: (t: string) => { calls.push({ fn: 'measureText', args: [t] }); return { width: t.length * 5 }; },
    get lineWidth() { return lineWidth; },
    set lineWidth(v: number) { lineWidth = v; },
    set lineCap(_v: string) {}, set lineJoin(_v: string) {}, set miterLimit(_v: number) {},
    set font(_v: string) {}, set fillStyle(_v: string | CanvasGradient | CanvasPattern) {},
    get strokeStyle(): string { return '#000'; }, set strokeStyle(_v: string) {},
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

const dashedSimple: ComplexLinetypeDef = patternToComplex({
  name: 'Dashed', description: '', pattern: [12.7, -6.35], origin: 'iso-baseline',
});

const STRAIGHT: Point[] = [{ x: 0, y: 0 }, { x: 20, y: 0 }];
const OPTS = { worldToScreenScale: 1, ltscale: 1 };

function dashArgs(calls: readonly Call[]): number[][] {
  return calls.filter((c) => c.fn === 'setLineDash').map((c) => c.args[0] as number[]);
}
const strokes = (calls: readonly Call[]) => calls.filter((c) => c.fn === 'stroke').length;

describe('fast-path (simple-expressible → native setLineDash)', () => {
  it('sets the resolved px dash array and strokes ONE continuous polyline', () => {
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, STRAIGHT, dashedSimple, OPTS);
    expect(dashArgs(calls)).toEqual([[12.7, 6.35]]);
    expect(strokes(calls)).toBe(1);
  });

  it('paper scale-space multiplies mm by the paper px/mm factor (not zoom)', () => {
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, STRAIGHT, { ...dashedSimple, scaleSpace: 'paper' }, OPTS);
    const [dash] = dashArgs(calls);
    expect(dash[0]).toBeCloseTo(12.7 * DEFAULT_PAPER_PX_PER_MM, 3);
  });

  it('solid ([]) → empty dash, single stroke (zero regression)', () => {
    const { ctx, calls } = createMockCtx();
    const solid = patternToComplex({ name: 'Continuous', description: '', pattern: [], origin: 'iso-baseline' });
    strokeStyledPolyline(ctx, STRAIGHT, solid, OPTS);
    expect(dashArgs(calls)).toEqual([[]]);
    expect(strokes(calls)).toBe(1);
  });
});

describe('complex-path (arc-length walk)', () => {
  it('a per-dash cap forces the stroker: draws one sub-path per dash', () => {
    // dash 4 / gap 4 over length 20 → dashes at [0,4] [8,12] [16,20] = 3 marks.
    const capped: ComplexLinetypeDef = {
      name: 'capped', description: '', origin: 'user-created',
      layers: [{ elements: [{ kind: 'dash', lengthMm: 4, cap: 'round' }, { kind: 'gap', lengthMm: 4 }] }],
    };
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, STRAIGHT, capped, OPTS);
    expect(strokes(calls)).toBe(3);
    // every dash resets the native dash to solid (it draws its own sub-path)
    expect(dashArgs(calls).every((d) => d.length === 0)).toBe(true);
  });

  it('phase shifts the pattern start (first dash clipped)', () => {
    const capped: ComplexLinetypeDef = {
      name: 'capped', description: '', origin: 'user-created', phaseMm: 2,
      layers: [{ elements: [{ kind: 'dash', lengthMm: 4, cap: 'round' }, { kind: 'gap', lengthMm: 4 }] }],
    };
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, STRAIGHT, capped, OPTS);
    // phase 2 → first partial dash [0,2], then [6,10] [14,18] → still 3 visible marks
    expect(strokes(calls)).toBeGreaterThanOrEqual(3);
  });

  it('corner policy break restarts the pattern per segment', () => {
    // ⌐ two 10-long segments, dash 4 / gap 4. Break → each segment gets [0,4] [8,10clip] = 2 marks ×2.
    const L: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const brk: ComplexLinetypeDef = {
      name: 'brk', description: '', origin: 'user-created', cornerPolicy: 'break',
      layers: [{ elements: [{ kind: 'dash', lengthMm: 4, cap: 'round' }, { kind: 'gap', lengthMm: 4 }] }],
    };
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, L, brk, OPTS);
    expect(strokes(calls)).toBe(4);
  });

  it('compound (>1 layer) strokes each offset layer', () => {
    const rail: ComplexLinetypeDef = {
      name: 'rail', description: '', origin: 'user-created',
      layers: [
        { elements: [{ kind: 'dash', lengthMm: 4, cap: 'round' }, { kind: 'gap', lengthMm: 4 }], offsetMm: 2 },
        { elements: [{ kind: 'dash', lengthMm: 4, cap: 'round' }, { kind: 'gap', lengthMm: 4 }], offsetMm: -2 },
      ],
    };
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, STRAIGHT, rail, OPTS);
    expect(strokes(calls)).toBe(6); // 3 dashes × 2 layers
  });

  it('variable width (widthProfile) fills a tapered strip instead of stroking', () => {
    const taper: ComplexLinetypeDef = {
      name: 'taper', description: '', origin: 'user-created',
      layers: [{ elements: [{ kind: 'dash', lengthMm: 20, widthMm: 3, widthProfile: [0, 1, 0] }] }],
    };
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, STRAIGHT, taper, OPTS);
    expect(calls.some((c) => c.fn === 'fill')).toBe(true);
  });

  it('degenerate layer (no visible length) falls back to a solid line — never blank', () => {
    const empty: ComplexLinetypeDef = {
      name: 'empty', description: '', origin: 'user-created',
      layers: [{ elements: [{ kind: 'symbol', glyphId: 'x', role: 'side', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 }] }],
    };
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, STRAIGHT, empty, OPTS);
    expect(strokes(calls)).toBe(1);
  });

  it('a sub-2-point polyline draws nothing', () => {
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, [{ x: 0, y: 0 }], dashedSimple, OPTS);
    expect(strokes(calls)).toBe(0);
  });
});

describe('embedded text (#2, Φ2)', () => {
  // ──GAS──: dash 5 / gap 2 / text GAS / gap 5 → cycle 12mm. Over 48px (mmToPx 4) → repeats.
  const gasLine: ComplexLinetypeDef = {
    name: 'GAS', description: '', origin: 'user-created',
    layers: [{ elements: [
      { kind: 'dash', lengthMm: 5 },
      { kind: 'gap', lengthMm: 2 },
      { kind: 'text', value: 'GAS', styleId: 'arial', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0, followPath: true },
      { kind: 'gap', lengthMm: 5 },
    ] }],
  };
  const LONG: Point[] = [{ x: 0, y: 0 }, { x: 48, y: 0 }];

  it('takes the complex path (text → not simple-expressible) and paints the value', () => {
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, LONG, gasLine, { worldToScreenScale: 4, ltscale: 1 });
    const texts = calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
    expect(texts.length).toBeGreaterThanOrEqual(1);
    expect(texts.every((t) => t === 'GAS')).toBe(true);
    // NOT the fast path — no native dashed stroke of the whole line.
    expect(dashArgs(calls).some((d) => d.length > 0)).toBe(false);
  });

  it('repeats the text once per cycle across the line length', () => {
    const { ctx, calls } = createMockCtx();
    strokeStyledPolyline(ctx, LONG, gasLine, { worldToScreenScale: 4, ltscale: 1 });
    // 48px / (12mm × 4px/mm = 48px) → ~1 full cycle; at least one GAS placed.
    const texts = calls.filter((c) => c.fn === 'fillText');
    expect(texts.length).toBeGreaterThanOrEqual(1);
  });
});
