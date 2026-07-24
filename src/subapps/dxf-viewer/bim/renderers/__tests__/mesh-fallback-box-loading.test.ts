/**
 * ADR-683 — `drawMeshFallbackBox` (κοινός SSoT placeholder του μετρημένου bbox).
 *
 * Ελέγχει το «loading» affordance: όσο το `.glb` φορτώνει (`loading:true`) το περίγραμμα βάφεται
 * **dashed** (provisional «το σχήμα έρχεται»)· αλλιώς solid. Πάντα reset του dash στο τέλος ώστε να
 * μη διαρρεύσει στο επόμενο σχέδιο. Pure helper — καμία store subscription (ADR-040).
 */

import { drawMeshFallbackBox } from '../mesh-silhouette-draw';

interface MockCall { fn: string; args: readonly unknown[] }

function createMockCtx() {
  const calls: MockCall[] = [];
  const record = (fn: string) => (...args: unknown[]): unknown => { calls.push({ fn, args }); return undefined; };
  const ctx = {
    beginPath: record('beginPath'), moveTo: record('moveTo'), lineTo: record('lineTo'),
    closePath: record('closePath'), stroke: record('stroke'), fill: record('fill'),
    setLineDash: record('setLineDash'),
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

const SQUARE = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
];
const PALETTE = { stroke: '#5b6b7a', fill: 'rgba(91, 107, 122, 0.28)' };
const identity = (p: { x: number; y: number }) => p;

function dashArgs(calls: readonly MockCall[]): unknown[] {
  return calls.filter((c) => c.fn === 'setLineDash').map((c) => c.args[0]);
}

describe('drawMeshFallbackBox — loading affordance (ADR-683)', () => {
  it('loading=true → dashed provisional outline (μη-κενό dash pattern) + reset στο τέλος', () => {
    const { calls, ctx } = createMockCtx();
    drawMeshFallbackBox({ ctx, worldToScreen: identity, vertices: SQUARE, palette: PALETTE, lineWidth: 2, loading: true });
    const dashes = dashArgs(calls) as number[][];
    // Ένα non-empty dash (provisional) + ένα reset [] στο τέλος.
    expect(dashes.some((d) => Array.isArray(d) && d.length > 0)).toBe(true);
    expect(dashes[dashes.length - 1]).toEqual([]);
    // Fill + outline όντως βάφτηκαν.
    expect(calls.some((c) => c.fn === 'fill')).toBe(true);
    expect(calls.some((c) => c.fn === 'stroke')).toBe(true);
  });

  it('loading=false → solid outline (κάθε setLineDash με κενό pattern)', () => {
    const { calls, ctx } = createMockCtx();
    drawMeshFallbackBox({ ctx, worldToScreen: identity, vertices: SQUARE, palette: PALETTE, lineWidth: 2, loading: false });
    const dashes = dashArgs(calls) as number[][];
    expect(dashes.length).toBeGreaterThan(0);
    expect(dashes.every((d) => Array.isArray(d) && d.length === 0)).toBe(true);
  });

  it('λιγότερες από 3 κορυφές → καμία βαφή (no-op)', () => {
    const { calls, ctx } = createMockCtx();
    drawMeshFallbackBox({ ctx, worldToScreen: identity, vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }], palette: PALETTE, lineWidth: 2, loading: true });
    expect(calls.some((c) => c.fn === 'fill' || c.fn === 'stroke')).toBe(false);
  });
});
