/**
 * SSoT canvas sizing primitive — `CanvasUtils.sizeCanvasToViewport`.
 *
 * Guards the race-proof contract behind the 2D-canvas-layer-size-desync fix (HANDOFF 2026-07-02):
 * every layer's backing store is sized from the ONE authoritative viewport (never a per-canvas
 * getBoundingClientRect), buffer = css × dpr, DPR-aware, and no-op re-sizes never clear the canvas.
 */

// Deterministic DPR + toDevicePixels so the arithmetic is exact and machine-independent.
jest.mock('../../../../systems/cursor/utils', () => ({
  getDevicePixelRatio: jest.fn(() => 2),
  toDevicePixels: (px: number, dpr: number) => Math.round(px * dpr),
}));

import { CanvasUtils } from '../CanvasUtils';
import { getDevicePixelRatio } from '../../../../systems/cursor/utils';

const mockDpr = getDevicePixelRatio as jest.MockedFunction<typeof getDevicePixelRatio>;

interface FakeCanvas {
  canvas: HTMLCanvasElement;
  ctx: { setTransform: jest.Mock; imageSmoothingEnabled: boolean };
  widthSet: jest.Mock;
  heightSet: jest.Mock;
  hasGetBoundingClientRect: () => boolean;
}

function makeFakeCanvas(getContextReturnsNull = false): FakeCanvas {
  const ctx = { setTransform: jest.fn(), imageSmoothingEnabled: true };
  const widthSet = jest.fn();
  const heightSet = jest.fn();
  let w = 0;
  let h = 0;
  const canvas = {
    getContext: jest.fn(() => (getContextReturnsNull ? null : ctx)),
    get width() {
      return w;
    },
    set width(v: number) {
      w = v;
      widthSet(v);
    },
    get height() {
      return h;
    },
    set height(v: number) {
      h = v;
      heightSet(v);
    },
    // NOTE: intentionally NO getBoundingClientRect — the primitive must never touch it.
  };
  return {
    canvas: canvas as unknown as HTMLCanvasElement,
    ctx,
    widthSet,
    heightSet,
    hasGetBoundingClientRect: () => 'getBoundingClientRect' in canvas,
  };
}

describe('CanvasUtils.sizeCanvasToViewport', () => {
  beforeEach(() => {
    mockDpr.mockReturnValue(2);
  });

  it('sizes the backing store to viewport × dpr and applies the DPR scale transform', () => {
    const { canvas, ctx } = makeFakeCanvas();
    const returned = CanvasUtils.sizeCanvasToViewport(canvas, { width: 100, height: 50 });

    expect(canvas.width).toBe(200); // 100 × 2
    expect(canvas.height).toBe(100); // 50 × 2
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(returned).toBe(ctx);
  });

  it('never reads getBoundingClientRect (authoritative viewport is the sole source)', () => {
    const fake = makeFakeCanvas();
    expect(fake.hasGetBoundingClientRect()).toBe(false);
    // Must not throw despite the element having no getBoundingClientRect.
    expect(() => CanvasUtils.sizeCanvasToViewport(fake.canvas, { width: 10, height: 10 })).not.toThrow();
  });

  it('skips the width/height assignment when unchanged (no gratuitous canvas clear)', () => {
    const { canvas, widthSet, heightSet } = makeFakeCanvas();
    CanvasUtils.sizeCanvasToViewport(canvas, { width: 100, height: 50 });
    expect(widthSet).toHaveBeenCalledTimes(1);
    expect(heightSet).toHaveBeenCalledTimes(1);

    // Same viewport again → buffer already correct → no reassignment (setting width clears canvas).
    CanvasUtils.sizeCanvasToViewport(canvas, { width: 100, height: 50 });
    expect(widthSet).toHaveBeenCalledTimes(1);
    expect(heightSet).toHaveBeenCalledTimes(1);
  });

  it('re-applies the DPR transform even on a no-op size (monitor/scaling switch)', () => {
    const { canvas, ctx } = makeFakeCanvas();
    CanvasUtils.sizeCanvasToViewport(canvas, { width: 100, height: 50 });
    ctx.setTransform.mockClear();

    mockDpr.mockReturnValue(3); // dpr changed; css size identical
    CanvasUtils.sizeCanvasToViewport(canvas, { width: 100, height: 50 });
    expect(canvas.width).toBe(300); // 100 × 3 — re-rasterized at the new dpr
    expect(ctx.setTransform).toHaveBeenCalledWith(3, 0, 0, 3, 0, 0);
  });

  it('honors enableHiDPI:false (dpr forced to 1)', () => {
    const { canvas, ctx } = makeFakeCanvas();
    CanvasUtils.sizeCanvasToViewport(canvas, { width: 100, height: 50 }, { enableHiDPI: false });
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(50);
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
  });

  it('honors an explicit devicePixelRatio override', () => {
    const { canvas } = makeFakeCanvas();
    CanvasUtils.sizeCanvasToViewport(canvas, { width: 100, height: 50 }, { devicePixelRatio: 4 });
    expect(canvas.width).toBe(400);
  });

  it('clamps degenerate (zero) viewport dimensions to a minimum 1px buffer', () => {
    const { canvas } = makeFakeCanvas();
    CanvasUtils.sizeCanvasToViewport(canvas, { width: 0, height: 0 });
    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
  });

  it('returns null for an invalid canvas or a missing 2D context', () => {
    expect(CanvasUtils.sizeCanvasToViewport(null as unknown as HTMLCanvasElement, { width: 10, height: 10 })).toBeNull();
    const { canvas } = makeFakeCanvas(true); // getContext → null
    expect(CanvasUtils.sizeCanvasToViewport(canvas, { width: 10, height: 10 })).toBeNull();
  });
});
