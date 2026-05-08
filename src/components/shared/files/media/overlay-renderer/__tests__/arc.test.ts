import { drawArc } from '../arc';
import type { SceneBounds, FitTransform } from '../types';

function makeMockCtx() {
  return {
    strokeStyle: '' as string,
    lineWidth: 0,
    beginPath: jest.fn(),
    arc: jest.fn(),
    stroke: jest.fn(),
  };
}

const bounds: SceneBounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
const fit: FitTransform = { scale: 1, offsetX: 0, offsetY: 0 };

describe('drawArc — Y-flip', () => {
  it('negates startAngle, endAngle and swaps CCW flag for canvas Y-flip', () => {
    const ctx = makeMockCtx();
    drawArc(
      ctx as unknown as CanvasRenderingContext2D,
      { x: 50, y: 50 }, 10,
      Math.PI / 4,   // world startAngle
      Math.PI / 2,   // world endAngle
      true,          // world CCW
      bounds, fit,
      { stroke: '#000', lineWidth: 1 },
    );
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    const [, , , canvasStart, canvasEnd, canvasCcw] = ctx.arc.mock.calls[0] as
      [number, number, number, number, number, boolean];
    expect(canvasStart).toBeCloseTo(-Math.PI / 4);
    expect(canvasEnd).toBeCloseTo(-Math.PI / 2);
    expect(canvasCcw).toBe(false); // !true
  });

  it('swaps CCW=false to true on Y-flip', () => {
    const ctx = makeMockCtx();
    drawArc(ctx as unknown as CanvasRenderingContext2D, { x: 50, y: 50 }, 10, 0, Math.PI, false, bounds, fit, { stroke: '#000', lineWidth: 1 });
    const [, , , , , canvasCcw] = ctx.arc.mock.calls[0] as [number, number, number, number, number, boolean];
    expect(canvasCcw).toBe(true); // !false
  });

  it('skips drawing for zero radius', () => {
    const ctx = makeMockCtx();
    drawArc(ctx as unknown as CanvasRenderingContext2D, { x: 50, y: 50 }, 0, 0, Math.PI, false, bounds, fit, { stroke: '#000', lineWidth: 1 });
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});
