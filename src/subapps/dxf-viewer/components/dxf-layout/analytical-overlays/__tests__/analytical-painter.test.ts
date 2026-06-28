/**
 * ADR-552 — Analytical overlay dispatch canvas: `paintAnalyticalFrame` (pull model).
 *
 * Επιβεβαιώνει ότι ο dispatch κάνει size+clear ΜΙΑ φορά και καλεί τους ενεργούς painters
 * με σωστή σειρά (z-order), παραλείποντας τους `null`. Mock canvas/ctx — μηδέν DOM/React.
 */

import { paintAnalyticalFrame } from '../analytical-painter';
import type { AnalyticalPainter } from '../analytical-painter';
import type { ViewTransform, Viewport } from '../../../../rendering/types/Types';

const TRANSFORM: ViewTransform = { scale: 2, offsetX: 10, offsetY: 20 };
const VIEWPORT: Viewport = { width: 800, height: 600 };

interface MockCtx {
  setTransform: jest.Mock;
  clearRect: jest.Mock;
}

function makeCanvas(initialW = 0, initialH = 0): { canvas: HTMLCanvasElement; ctx: MockCtx } {
  const ctx: MockCtx = { setTransform: jest.fn(), clearRect: jest.fn() };
  const canvas = {
    width: initialW,
    height: initialH,
    getContext: jest.fn(() => ctx as unknown as CanvasRenderingContext2D),
  } as unknown as HTMLCanvasElement;
  return { canvas, ctx };
}

describe('paintAnalyticalFrame (ADR-552)', () => {
  it('clears the canvas exactly once before painting', () => {
    const { canvas, ctx } = makeCanvas();
    const painter: AnalyticalPainter = jest.fn();
    paintAnalyticalFrame(canvas, [painter], TRANSFORM, VIEWPORT);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.setTransform).toHaveBeenCalledTimes(1);
  });

  it('calls active painters in array (z-) order with ctx, transform, viewport', () => {
    const { canvas, ctx } = makeCanvas();
    const order: string[] = [];
    const a: AnalyticalPainter = jest.fn(() => void order.push('a'));
    const b: AnalyticalPainter = jest.fn(() => void order.push('b'));
    const c: AnalyticalPainter = jest.fn(() => void order.push('c'));
    paintAnalyticalFrame(canvas, [a, b, c], TRANSFORM, VIEWPORT);
    expect(order).toEqual(['a', 'b', 'c']);
    expect(a).toHaveBeenCalledWith(ctx, TRANSFORM, VIEWPORT);
    expect(c).toHaveBeenCalledWith(ctx, TRANSFORM, VIEWPORT);
  });

  it('skips null painters (inactive layers) but keeps the order of the rest', () => {
    const { canvas } = makeCanvas();
    const order: string[] = [];
    const first: AnalyticalPainter = jest.fn(() => void order.push('first'));
    const last: AnalyticalPainter = jest.fn(() => void order.push('last'));
    paintAnalyticalFrame(canvas, [null, first, null, null, last, null], TRANSFORM, VIEWPORT);
    expect(order).toEqual(['first', 'last']);
    expect(first).toHaveBeenCalledTimes(1);
    expect(last).toHaveBeenCalledTimes(1);
  });

  it('paints nothing (just clears) when every painter is null — e.g. 3D mode', () => {
    const { canvas, ctx } = makeCanvas();
    paintAnalyticalFrame(canvas, [null, null, null, null, null, null, null], TRANSFORM, VIEWPORT);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });

  it('resizes the DPR-aware backing store only when the size changes', () => {
    // jsdom devicePixelRatio defaults to 1 → backing store == viewport px.
    const { canvas } = makeCanvas(VIEWPORT.width, VIEWPORT.height);
    const setW = jest.fn();
    Object.defineProperty(canvas, 'width', {
      get: () => VIEWPORT.width,
      set: setW,
      configurable: true,
    });
    paintAnalyticalFrame(canvas, [], TRANSFORM, VIEWPORT);
    // already the right size → no reassignment
    expect(setW).not.toHaveBeenCalled();
  });

  it('is a no-op when getContext returns null', () => {
    const canvas = { getContext: jest.fn(() => null) } as unknown as HTMLCanvasElement;
    expect(() => paintAnalyticalFrame(canvas, [jest.fn()], TRANSFORM, VIEWPORT)).not.toThrow();
  });
});
