import { drawCircle } from '../circle';
import type { SceneBounds, FitTransform } from '../types';

function makeMockCtx() {
  return {
    strokeStyle: '' as string,
    lineWidth: 0,
    fillStyle: '' as string,
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
  };
}

const bounds: SceneBounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
const fit: FitTransform = { scale: 2, offsetX: 0, offsetY: 0 };

describe('drawCircle', () => {
  it('calls arc with radius scaled by fit.scale and strokes', () => {
    const ctx = makeMockCtx();
    drawCircle(
      ctx as unknown as CanvasRenderingContext2D,
      { x: 50, y: 50 }, 10,
      bounds, fit,
      { stroke: '#f00', lineWidth: 1 },
    );
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    const [, , r, , , cw] = ctx.arc.mock.calls[0] as [number, number, number, number, number, boolean];
    expect(r).toBe(20); // 10 * scale(2)
    expect(cw).toBe(false);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('fills when fill style is given', () => {
    const ctx = makeMockCtx();
    drawCircle(
      ctx as unknown as CanvasRenderingContext2D,
      { x: 50, y: 50 }, 5,
      bounds, fit,
      { stroke: '#f00', lineWidth: 1, fill: '#00f' },
    );
    expect(ctx.fillStyle).toBe('#00f');
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it('skips drawing for zero radius', () => {
    const ctx = makeMockCtx();
    drawCircle(ctx as unknown as CanvasRenderingContext2D, { x: 50, y: 50 }, 0, bounds, fit, { stroke: '#f00', lineWidth: 1 });
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('skips drawing for negative radius', () => {
    const ctx = makeMockCtx();
    drawCircle(ctx as unknown as CanvasRenderingContext2D, { x: 50, y: 50 }, -5, bounds, fit, { stroke: '#f00', lineWidth: 1 });
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});
