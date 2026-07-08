/**
 * ADR-505 — `drawRebarPlanGeometry` shared 2Δ rebar draw loop (SSoT).
 *
 * Επιβεβαιώνει ότι ο ενοποιημένος loop αναπαράγει τη συμπεριφορά των πρώην 4
 * ανά-μέλος `draw*Rebar2D` βρόχων byte-for-byte:
 *   - paths → stroke (moveTo/lineTo), closePath ΜΟΝΟ όταν `closed`,
 *   - dashed path → `setLineDash([6,4])`· αλλιώς `[]`,
 *   - lineWidth = max(0.6, diameterMm·pxPerMm),
 *   - dots → arc + fill, radius = max(0.8, diameterMm/2·pxPerMm),
 *   - χρώμα stroke+fill = rebar-catalog SSoT (crimson),
 *   - κενή γεωμετρία → μόνο save/restore, καμία stroke/fill.
 */

import { drawRebarPlanGeometry } from '../draw-rebar-plan-geometry';
import { REBAR_COLOR_HEX } from '../../structural/rebar-catalog';
import type { RebarPlanGeometry } from '../../structural/reinforcement/rebar-plan-geometry-types';
import type { Point2D } from '../../../rendering/types/Types';

interface Call { fn: string; args: readonly unknown[] }

function createMockCtx() {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]): void => {
    calls.push({ fn, args });
  };
  const ctx = {
    save: rec('save'), restore: rec('restore'), beginPath: rec('beginPath'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), closePath: rec('closePath'),
    arc: rec('arc'), stroke: rec('stroke'), fill: rec('fill'), setLineDash: rec('setLineDash'),
    set strokeStyle(v: string) { calls.push({ fn: 'set:strokeStyle', args: [v] }); },
    set fillStyle(v: string) { calls.push({ fn: 'set:fillStyle', args: [v] }); },
    set lineWidth(v: number) { calls.push({ fn: 'set:lineWidth', args: [v] }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** Identity mapping — world == screen για ελεγξιμότητα. */
const identity = (p: Point2D): Point2D => ({ x: p.x, y: p.y });

describe('drawRebarPlanGeometry (ADR-505 shared draw loop)', () => {
  it('στρώνει χρώμα crimson (stroke + fill) από το rebar-catalog SSoT', () => {
    const { ctx, calls } = createMockCtx();
    drawRebarPlanGeometry(ctx, { paths: [], dots: [] }, 1, identity);
    expect(calls.find((c) => c.fn === 'set:strokeStyle')?.args[0]).toBe(REBAR_COLOR_HEX);
    expect(calls.find((c) => c.fn === 'set:fillStyle')?.args[0]).toBe(REBAR_COLOR_HEX);
  });

  it('κενή γεωμετρία → μόνο save/restore, καμία stroke/fill/arc', () => {
    const { ctx, calls } = createMockCtx();
    drawRebarPlanGeometry(ctx, { paths: [], dots: [] }, 1, identity);
    expect(calls.some((c) => c.fn === 'stroke')).toBe(false);
    expect(calls.some((c) => c.fn === 'fill')).toBe(false);
    expect(calls.some((c) => c.fn === 'arc')).toBe(false);
    expect(calls.filter((c) => c.fn === 'save')).toHaveLength(1);
    expect(calls.filter((c) => c.fn === 'restore')).toHaveLength(1);
  });

  it('closed path → closePath· open path → όχι closePath', () => {
    const geo: RebarPlanGeometry = {
      paths: [
        { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true, diameterMm: 8 },
        { points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], closed: false, diameterMm: 8 },
      ],
      dots: [],
    };
    const { ctx, calls } = createMockCtx();
    drawRebarPlanGeometry(ctx, geo, 1, identity);
    expect(calls.filter((c) => c.fn === 'closePath')).toHaveLength(1);
    expect(calls.filter((c) => c.fn === 'stroke')).toHaveLength(2);
  });

  it('dashed path → setLineDash([6,4])· non-dashed → setLineDash([])', () => {
    const geo: RebarPlanGeometry = {
      paths: [
        { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false, diameterMm: 8, dashed: true },
        { points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], closed: false, diameterMm: 8 },
      ],
      dots: [],
    };
    const { ctx, calls } = createMockCtx();
    drawRebarPlanGeometry(ctx, geo, 1, identity);
    const dashArgs = calls.filter((c) => c.fn === 'setLineDash').map((c) => c.args[0]);
    expect(dashArgs).toContainEqual([6, 4]);
    expect(dashArgs).toContainEqual([]);
  });

  it('lineWidth = max(0.6, diameterMm·pxPerMm)', () => {
    const geo: RebarPlanGeometry = {
      paths: [
        { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false, diameterMm: 10 }, // 10·0.05=0.5 → floor 0.6
        { points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], closed: false, diameterMm: 20 }, // 20·0.05=1.0
      ],
      dots: [],
    };
    const { ctx, calls } = createMockCtx();
    drawRebarPlanGeometry(ctx, geo, 0.05, identity);
    const widths = calls.filter((c) => c.fn === 'set:lineWidth').map((c) => c.args[0]);
    expect(widths).toContain(0.6);
    expect(widths).toContain(1.0);
  });

  it('dots → arc + fill, radius = max(0.8, diameterMm/2·pxPerMm)', () => {
    const geo: RebarPlanGeometry = {
      paths: [],
      dots: [
        { center: { x: 1, y: 1 }, diameterMm: 40 }, // 20·0.05=1.0
        { center: { x: 2, y: 2 }, diameterMm: 10 }, // 5·0.05=0.25 → floor 0.8
      ],
    };
    const { ctx, calls } = createMockCtx();
    drawRebarPlanGeometry(ctx, geo, 0.05, identity);
    const radii = calls.filter((c) => c.fn === 'arc').map((c) => c.args[2]);
    expect(radii).toContain(1.0);
    expect(radii).toContain(0.8);
    expect(calls.filter((c) => c.fn === 'fill')).toHaveLength(2);
  });
});
