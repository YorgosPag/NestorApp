import { drawLine } from '../line';
import type { SceneBounds, FitTransform } from '../types';

function makeMockCtx() {
  return {
    strokeStyle: '' as string,
    lineWidth: 0,
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    setLineDash: jest.fn(),
  };
}

const bounds: SceneBounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
const fit: FitTransform = { scale: 1, offsetX: 0, offsetY: 0 };

describe('drawLine', () => {
  it('sets strokeStyle + lineWidth and calls beginPath/moveTo/lineTo/stroke', () => {
    const ctx = makeMockCtx();
    drawLine(
      ctx as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0 }, { x: 10, y: 10 },
      bounds, fit,
      { stroke: '#ff0000', lineWidth: 2 },
    );
    expect(ctx.strokeStyle).toBe('#ff0000');
    expect(ctx.lineWidth).toBe(2);
    expect(ctx.beginPath).toHaveBeenCalledTimes(1);
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.setLineDash).not.toHaveBeenCalled();
  });

  it('sets dashed pattern and resets it afterward', () => {
    const ctx = makeMockCtx();
    drawLine(
      ctx as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0 }, { x: 10, y: 0 },
      bounds, fit,
      { stroke: '#000', lineWidth: 1, dashed: true },
    );
    expect(ctx.setLineDash).toHaveBeenCalledTimes(2);
    expect(ctx.setLineDash).toHaveBeenNthCalledWith(1, [6, 4]);
    expect(ctx.setLineDash).toHaveBeenNthCalledWith(2, []);
  });

  it('applies worldToScreen transform: Y-flip maps world y=0 to canvas y=100', () => {
    const ctx = makeMockCtx();
    drawLine(
      ctx as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0 }, { x: 0, y: 0 },
      bounds, fit,
      { stroke: '#000', lineWidth: 1 },
    );
    // worldToScreen(0,0) = { x: 0, y: 100 } (Y-flip)
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 100);
    expect(ctx.lineTo).toHaveBeenCalledWith(0, 100);
  });
});
