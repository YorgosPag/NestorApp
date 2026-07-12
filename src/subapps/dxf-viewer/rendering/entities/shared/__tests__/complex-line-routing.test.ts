/**
 * Tests — ADR-642 Φ2-B full-canvas complex-linetype routing seam + arc/circle samplers.
 *
 * Covers the ONE seam every entity renderer calls (`strokeStyledEntityPolyline`): it draws
 * the `──GAS──` text via the complex stroker ONLY when the entity carries a genuine complex
 * linetype, and returns `false` (native fast path) otherwise. Plus the screen-space
 * tessellation used for arcs/circles (no polyline vertices of their own).
 */

import {
  strokeStyledEntityPolyline,
  sampleArcScreen,
  sampleCircleScreen,
} from '../complex-line-routing';
import { patternToComplex } from '../../../../config/complex-linetype-adapters';
import type { ComplexLinetypeDef } from '../../../../config/complex-linetype-types';

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

// ──GAS──: dash 5 / gap 2 / text GAS / gap 5 → cycle 12mm (mirror of the stroker test fixture).
const gasLine: ComplexLinetypeDef = {
  name: 'GAS', description: '', origin: 'user-created',
  layers: [{ elements: [
    { kind: 'dash', lengthMm: 5 },
    { kind: 'gap', lengthMm: 2 },
    { kind: 'text', value: 'GAS', styleId: 'arial', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0, followPath: true },
    { kind: 'gap', lengthMm: 5 },
  ] }],
};

const dashedSimple: ComplexLinetypeDef = patternToComplex({
  name: 'Dashed', description: '', pattern: [12.7, -6.35], origin: 'iso-baseline',
});

const LONG = [{ x: 0, y: 0 }, { x: 48, y: 0 }];
const fillTexts = (calls: readonly Call[]) => calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);

describe('strokeStyledEntityPolyline — routing seam', () => {
  it('returns false and draws nothing when the entity has no complex linetype', () => {
    const { ctx, calls } = createMockCtx();
    const drew = strokeStyledEntityPolyline(ctx, LONG, {}, 4);
    expect(drew).toBe(false);
    expect(calls.length).toBe(0); // caller does its own native stroke
  });

  it('returns true and paints the embedded text when a genuine complex linetype is present', () => {
    const { ctx, calls } = createMockCtx();
    const drew = strokeStyledEntityPolyline(ctx, LONG, { complex: gasLine }, 4);
    expect(drew).toBe(true);
    const texts = fillTexts(calls);
    expect(texts.length).toBeGreaterThanOrEqual(1);
    expect(texts.every((t) => t === 'GAS')).toBe(true);
  });

  it('returns false for a simple-expressible complex def (belongs on the native dash path)', () => {
    const { ctx } = createMockCtx();
    expect(strokeStyledEntityPolyline(ctx, LONG, { complex: dashedSimple }, 4)).toBe(false);
  });

  it('returns false for a degenerate (< 2-point) polyline', () => {
    const { ctx } = createMockCtx();
    expect(strokeStyledEntityPolyline(ctx, [{ x: 0, y: 0 }], { complex: gasLine }, 4)).toBe(false);
  });

  it('honours per-object CELTSCALE (ltscale): stretches the cycle ×2, still paints on a long line', () => {
    // celtscale 2 stretches the 12mm cycle to 24mm → ×4px/mm ×2 = 192px. Need a line long
    // enough to fit at least one stretched cycle, else no text slot lands (correct behaviour).
    const veryLong = [{ x: 0, y: 0 }, { x: 300, y: 0 }];
    const { ctx, calls } = createMockCtx();
    const drew = strokeStyledEntityPolyline(ctx, veryLong, { complex: gasLine, ltscale: 2 }, 4);
    expect(drew).toBe(true);
    expect(fillTexts(calls).length).toBeGreaterThanOrEqual(1);
  });
});

describe('sampleArcScreen — screen-space arc tessellation', () => {
  const C = { x: 100, y: 100 };
  const R = 50;
  const dist = (p: { x: number; y: number }) => Math.hypot(p.x - C.x, p.y - C.y);

  it('every sample lies on the arc radius, endpoints match start/end angle', () => {
    const start = 0;
    const end = Math.PI / 2; // quarter turn
    const pts = sampleArcScreen(C, R, start, end, false);
    expect(pts.length).toBeGreaterThanOrEqual(13); // clamp min 12 segments + 1
    for (const p of pts) expect(dist(p)).toBeCloseTo(R, 6);
    expect(pts[0]).toEqual({ x: C.x + R, y: C.y }); // angle 0
    const last = pts[pts.length - 1];
    expect(last.x).toBeCloseTo(C.x, 6);
    expect(last.y).toBeCloseTo(C.y + R, 6); // angle +90° (screen y-down)
  });

  it('direction flag flips the sweep (ccw goes the other way round)', () => {
    const cw = sampleArcScreen(C, R, 0, Math.PI / 2, false);
    const ccw = sampleArcScreen(C, R, 0, Math.PI / 2, true);
    // Second sample: clockwise sweep goes toward +angle (y grows), ccw toward −angle (y shrinks).
    expect(cw[1].y).toBeGreaterThan(C.y);
    expect(ccw[1].y).toBeLessThan(C.y);
  });

  it('sample count scales with on-screen arc length (bigger radius → more points)', () => {
    const small = sampleArcScreen(C, 10, 0, Math.PI * 2 * 0.99, false);
    const big = sampleArcScreen(C, 400, 0, Math.PI * 2 * 0.99, false);
    expect(big.length).toBeGreaterThan(small.length);
  });
});

describe('sampleCircleScreen — closed-loop tessellation', () => {
  const C = { x: 0, y: 0 };

  it('returns a closed loop of on-radius points, first NOT duplicated', () => {
    const R = 40;
    const pts = sampleCircleScreen(C, R);
    expect(pts.length).toBeGreaterThanOrEqual(24);
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(R, 6);
    // first at angle 0; last strictly before the wrap (no duplicate of the first point)
    expect(pts[0]).toEqual({ x: R, y: 0 });
    expect(pts[pts.length - 1]).not.toEqual(pts[0]);
  });
});
