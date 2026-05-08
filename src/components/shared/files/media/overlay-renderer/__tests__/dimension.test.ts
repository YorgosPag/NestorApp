import { drawDimension } from '../dimension';
import type { SceneBounds, FitTransform } from '../types';

function makeMockCtx() {
  return {
    strokeStyle: '' as string,
    lineWidth: 0,
    fillStyle: '' as string,
    font: '',
    textAlign: '',
    textBaseline: '',
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    closePath: jest.fn(),
    strokeText: jest.fn(),
    fillText: jest.fn(),
  };
}

const bounds: SceneBounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
const fit: FitTransform = { scale: 1, offsetX: 0, offsetY: 0 };

describe('drawDimension', () => {
  it('draws dimension line + 2 arrowheads (3 beginPath, 2 fill, 1 stroke)', () => {
    const ctx = makeMockCtx();
    drawDimension(
      ctx as unknown as CanvasRenderingContext2D,
      { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
      bounds, fit,
      { stroke: '#f00', lineWidth: 1 },
    );
    expect(ctx.beginPath).toHaveBeenCalledTimes(3); // main line + 2 arrowheads
    expect(ctx.fill).toHaveBeenCalledTimes(2);      // 2 arrowheads
    expect(ctx.stroke).toHaveBeenCalledTimes(1);    // main line
    expect(ctx.fillText).not.toHaveBeenCalled();    // no label without unitsPerMeter
  });

  it('draws center label from unitsPerMeter conversion', () => {
    const ctx = makeMockCtx();
    drawDimension(
      ctx as unknown as CanvasRenderingContext2D,
      { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
      bounds, fit,
      { stroke: '#f00', lineWidth: 1 },
      1, // 1 unit = 1 m → distance = 10 m
    );
    expect(ctx.strokeText).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    const [text] = ctx.fillText.mock.calls[0] as [string, ...unknown[]];
    expect(text).toContain('10');
  });

  it('prefers explicit value over computed distance', () => {
    const ctx = makeMockCtx();
    drawDimension(
      ctx as unknown as CanvasRenderingContext2D,
      { from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, value: '5.00 m' },
      bounds, fit,
      { stroke: '#f00', lineWidth: 1 },
    );
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    const [text] = ctx.fillText.mock.calls[0] as [string, ...unknown[]];
    expect(text).toBe('5.00 m');
  });
});
