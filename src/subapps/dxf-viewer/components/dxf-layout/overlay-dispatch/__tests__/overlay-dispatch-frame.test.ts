/**
 * ADR-554 — shared overlay dispatch frame renderer (`paintOverlayDispatchFrame`).
 *
 * The ONE pull-model frame renderer behind both the analytical (ADR-552) and proposal (ADR-554)
 * dispatch canvases: size+clear ONCE, then paint active painters in z-order, skipping `null`.
 * Mock canvas/ctx — zero DOM/React.
 */

import { paintOverlayDispatchFrame } from '../overlay-dispatch-frame';
import type { OverlayDispatchPainter } from '../overlay-dispatch-frame';
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

describe('paintOverlayDispatchFrame (ADR-554)', () => {
  it('clears the canvas exactly once before painting', () => {
    const { canvas, ctx } = makeCanvas();
    const painter: OverlayDispatchPainter = jest.fn();
    paintOverlayDispatchFrame(canvas, [painter], TRANSFORM, VIEWPORT);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.setTransform).toHaveBeenCalledTimes(1);
  });

  it('calls active painters in array (z-) order with ctx, transform, viewport', () => {
    const { canvas, ctx } = makeCanvas();
    const order: string[] = [];
    const a: OverlayDispatchPainter = jest.fn(() => void order.push('a'));
    const b: OverlayDispatchPainter = jest.fn(() => void order.push('b'));
    const c: OverlayDispatchPainter = jest.fn(() => void order.push('c'));
    paintOverlayDispatchFrame(canvas, [a, b, c], TRANSFORM, VIEWPORT);
    expect(order).toEqual(['a', 'b', 'c']);
    expect(a).toHaveBeenCalledWith(ctx, TRANSFORM, VIEWPORT);
    expect(c).toHaveBeenCalledWith(ctx, TRANSFORM, VIEWPORT);
  });

  it('skips null painters (inactive layers) but keeps the order of the rest', () => {
    const { canvas } = makeCanvas();
    const order: string[] = [];
    const first: OverlayDispatchPainter = jest.fn(() => void order.push('first'));
    const last: OverlayDispatchPainter = jest.fn(() => void order.push('last'));
    paintOverlayDispatchFrame(canvas, [null, first, null, null, last, null, null], TRANSFORM, VIEWPORT);
    expect(order).toEqual(['first', 'last']);
    expect(first).toHaveBeenCalledTimes(1);
    expect(last).toHaveBeenCalledTimes(1);
  });

  it('paints nothing (just clears) when every painter is null — e.g. no proposal under review', () => {
    const { canvas, ctx } = makeCanvas();
    paintOverlayDispatchFrame(canvas, [null, null, null, null, null, null, null], TRANSFORM, VIEWPORT);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });

  it('resizes the DPR-aware backing store only when the size changes', () => {
    const { canvas } = makeCanvas(VIEWPORT.width, VIEWPORT.height);
    const setW = jest.fn();
    Object.defineProperty(canvas, 'width', { get: () => VIEWPORT.width, set: setW, configurable: true });
    paintOverlayDispatchFrame(canvas, [], TRANSFORM, VIEWPORT);
    expect(setW).not.toHaveBeenCalled();
  });

  it('is a no-op when getContext returns null', () => {
    const canvas = { getContext: jest.fn(() => null) } as unknown as HTMLCanvasElement;
    expect(() => paintOverlayDispatchFrame(canvas, [jest.fn()], TRANSFORM, VIEWPORT)).not.toThrow();
  });
});
