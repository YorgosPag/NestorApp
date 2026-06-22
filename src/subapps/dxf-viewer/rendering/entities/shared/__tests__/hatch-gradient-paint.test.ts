/**
 * Hatch gradient paint SSoT — ADR-507 Φ5 / A3.
 *
 * Επιβεβαιώνει ότι ο pure paint helper (κοινός με τον committed `HatchRenderer` ΚΑΙ
 * το live grip-drag ghost) χτίζει το σωστό CanvasGradient σε screen space και ότι το
 * `origin` (gradient-origin λαβή, A3) ΜΕΤΑΚΙΝΕΙ τον άξονα της διαβάθμισης — η βάση του
 * real-time drag (preview === commit, μηδέν δεύτερη gradient math).
 */

import { describe, it, expect } from '@jest/globals';
import type { HatchGradient } from '../../../../bim/hatch/hatch-gradient';
import type { Point2D } from '../../../types/Types';
import { fillHatchGradient, traceHatchBoundary, type ToScreen } from '../hatch-gradient-paint';

interface GradientStub {
  readonly kind: 'linear' | 'radial';
  readonly coords: number[];
  readonly stops: Array<{ offset: number; color: string }>;
}

interface CtxRecorder {
  readonly ctx: CanvasRenderingContext2D;
  readonly gradients: GradientStub[];
  readonly pathOps: string[];
  readonly state: { fillRule: string | null };
}

/** Minimal recording 2D-context stub (μηδέν DOM — Node jest). */
function makeCtx(): CtxRecorder {
  const gradients: GradientStub[] = [];
  const pathOps: string[] = [];
  const state: { fillRule: string | null } = { fillRule: null };
  const makeGradient = (kind: 'linear' | 'radial', coords: number[]): CanvasGradient => {
    const stub: GradientStub = { kind, coords, stops: [] };
    gradients.push(stub);
    return { addColorStop: (offset: number, color: string) => stub.stops.push({ offset, color }) } as unknown as CanvasGradient;
  };
  const ctx = {
    fillStyle: '' as string | CanvasGradient,
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => makeGradient('linear', [x0, y0, x1, y1]),
    createRadialGradient: (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) =>
      makeGradient('radial', [x0, y0, r0, x1, y1, r1]),
    beginPath: () => pathOps.push('begin'),
    moveTo: (x: number, y: number) => pathOps.push(`move:${x},${y}`),
    lineTo: (x: number, y: number) => pathOps.push(`line:${x},${y}`),
    closePath: () => pathOps.push('close'),
    fill: (rule?: string) => { state.fillRule = rule ?? 'nonzero'; },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, gradients, pathOps, state };
}

/** Identity world→screen (scale 1) ώστε τα coords να ελέγχονται απευθείας. */
const identity: ToScreen = (p: Point2D) => ({ x: p.x, y: p.y });

const SQUARE: Point2D[] = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
];

describe('hatch-gradient-paint', () => {
  it('traceHatchBoundary — beginPath + κορυφές + closePath ανά subpath', () => {
    const r = makeCtx();
    traceHatchBoundary(r.ctx, [SQUARE], identity);
    expect(r.pathOps[0]).toBe('begin');
    expect(r.pathOps).toContain('move:0,0');
    expect(r.pathOps).toContain('line:100,0');
    expect(r.pathOps[r.pathOps.length - 1]).toBe('close');
  });

  it('traceHatchBoundary — παραλείπει degenerate path (< 2 κορυφές)', () => {
    const r = makeCtx();
    traceHatchBoundary(r.ctx, [[{ x: 5, y: 5 }]], identity);
    // begin εκτελείται· κανένα move/line/close για το μονό-σημείο path.
    expect(r.pathOps).toEqual(['begin']);
  });

  it('linear gradient — άξονας κεντραρισμένος στο bbox center όταν ΔΕΝ δίνεται origin', () => {
    const r = makeCtx();
    const g: HatchGradient = { type: 'linear', color1: '#FF0000', color2: '#0000FF', angleDeg: 0 };
    fillHatchGradient(r.ctx, [SQUARE], g, { toScreen: identity, scale: 1 });
    expect(r.gradients).toHaveLength(1);
    expect(r.gradients[0].kind).toBe('linear');
    // angle 0, half = 50, shift 0 → endpoints (0,50)-(100,50) γύρω από το center (50,50).
    expect(r.gradients[0].coords).toEqual([0, 50, 100, 50]);
    expect(r.gradients[0].stops).toEqual([
      { offset: 0, color: '#FF0000' }, { offset: 1, color: '#0000FF' },
    ]);
    expect(r.state.fillRule).toBe('evenodd');
  });

  it('A3 — το origin ΜΕΤΑΚΙΝΕΙ τον άξονα της διαβάθμισης (real-time drag)', () => {
    const r = makeCtx();
    const g: HatchGradient = { type: 'linear', color1: '#FF0000', color2: '#0000FF', angleDeg: 0 };
    // origin μετατοπισμένο από το center (50,50) → ο γραμμικός άξονας μετακινείται μαζί.
    fillHatchGradient(r.ctx, [SQUARE], g, { origin: { x: 20, y: 30 }, toScreen: identity, scale: 1 });
    // cx=20, cy=30, half=50 → endpoints (-30,30)-(70,30): ΑΛΛΑΓΜΕΝΑ vs το center default.
    expect(r.gradients[0].coords).toEqual([-30, 30, 70, 30]);
  });

  it('radial gradient (spherical) — createRadialGradient με κέντρο = origin', () => {
    const r = makeCtx();
    const g: HatchGradient = { type: 'spherical', color1: '#FFFFFF', color2: '#000000' };
    fillHatchGradient(r.ctx, [SQUARE], g, { origin: { x: 40, y: 60 }, toScreen: identity, scale: 1 });
    expect(r.gradients[0].kind).toBe('radial');
    const [x0, y0, r0, x1, y1] = r.gradients[0].coords;
    expect(x0).toBe(40); expect(y0).toBe(60); expect(r0).toBe(0);
    expect(x1).toBe(40); expect(y1).toBe(60);
  });

  it('degenerate bbox (zero-area) → κανένα gradient (early return)', () => {
    const r = makeCtx();
    const g: HatchGradient = { type: 'linear', color1: '#FF0000', color2: '#0000FF' };
    const line: Point2D[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    fillHatchGradient(r.ctx, [line], g, { toScreen: identity, scale: 1 });
    expect(r.gradients).toHaveLength(0);
    expect(r.state.fillRule).toBeNull();
  });
});
