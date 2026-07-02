/**
 * SSoT dedup guard — `sizeCanvasToContainerDpr` (withCanvasState) must delegate the DPR-aware
 * backing-store math to the ONE primitive `CanvasUtils.sizeCanvasToViewport`, supplying the
 * container's own client size as the viewport. This proves the two former copies are now one.
 */

jest.mock('../../../systems/cursor/utils', () => ({
  getDevicePixelRatio: jest.fn(() => 2),
  toDevicePixels: (px: number, dpr: number) => Math.round(px * dpr),
}));

import { sizeCanvasToContainerDpr } from '../withCanvasState';

interface Fake {
  canvas: HTMLCanvasElement;
  ctx: { setTransform: jest.Mock; clearRect: jest.Mock; imageSmoothingEnabled: boolean };
  getContext: jest.Mock;
}

function makeFake(): Fake {
  const ctx = { setTransform: jest.fn(), clearRect: jest.fn(), imageSmoothingEnabled: true };
  const getContext = jest.fn(() => ctx);
  let w = 0;
  let h = 0;
  const canvas = {
    getContext,
    get width() {
      return w;
    },
    set width(v: number) {
      w = v;
    },
    get height() {
      return h;
    },
    set height(v: number) {
      h = v;
    },
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, ctx, getContext };
}

const container = (cw: number, ch: number) =>
  ({ clientWidth: cw, clientHeight: ch }) as unknown as HTMLElement;

describe('sizeCanvasToContainerDpr → delegates to CanvasUtils.sizeCanvasToViewport', () => {
  it('sizes the buffer to container.client × dpr and clears in CSS coords', () => {
    const { canvas, ctx } = makeFake();
    const returned = sizeCanvasToContainerDpr(canvas, container(100, 50));

    expect(canvas.width).toBe(200); // 100 × 2
    expect(canvas.height).toBe(100); // 50 × 2
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 50); // CSS-space clear
    expect(returned).toBe(ctx);
  });

  it('forwards the desynchronized context hint to getContext', () => {
    const { canvas, getContext } = makeFake();
    sizeCanvasToContainerDpr(canvas, container(10, 10), true);
    expect(getContext).toHaveBeenCalledWith('2d', { desynchronized: true });
  });

  it('returns null when the 2D context is unavailable', () => {
    const { canvas, getContext } = makeFake();
    getContext.mockReturnValueOnce(null);
    expect(sizeCanvasToContainerDpr(canvas, container(10, 10))).toBeNull();
  });
});
