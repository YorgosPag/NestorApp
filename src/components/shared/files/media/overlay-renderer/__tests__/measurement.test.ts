import { drawMeasurement } from '../measurement';
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
    arc: jest.fn(),
    strokeText: jest.fn(),
    fillText: jest.fn(),
  };
}

const bounds: SceneBounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
const fit: FitTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const style = { stroke: '#f00', lineWidth: 1 };

describe('drawMeasurement', () => {
  it('skips draw when fewer than 2 points', () => {
    const ctx = makeMockCtx();
    drawMeasurement(ctx as unknown as CanvasRenderingContext2D, { points: [{ x: 0, y: 0 }], mode: 'distance', value: 0, unit: 'm' }, bounds, fit, style);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('distance: draws polyline + tick dots + label', () => {
    const ctx = makeMockCtx();
    drawMeasurement(
      ctx as unknown as CanvasRenderingContext2D,
      { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], mode: 'distance', value: 10, unit: 'm' },
      bounds, fit, style,
    );
    // polyline: beginPath(1) + moveTo(1) + lineTo(1) + stroke(1)
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    // ticks: 2 × arc + 2 × fill
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
    // label
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
  });

  it('area: closed polygon with translucent fill + label at centroid', () => {
    const ctx = makeMockCtx();
    drawMeasurement(
      ctx as unknown as CanvasRenderingContext2D,
      { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }], mode: 'area', value: 50, unit: 'm²' },
      bounds, fit, style,
    );
    expect(ctx.closePath).toHaveBeenCalledTimes(1);
    expect(ctx.fill).toHaveBeenCalledTimes(1);   // area fill
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
  });

  it('angle: label positioned at first point (vertex)', () => {
    const ctx = makeMockCtx();
    // vertex at world (5,5) → screen (5, 95) via Y-flip
    drawMeasurement(
      ctx as unknown as CanvasRenderingContext2D,
      { points: [{ x: 5, y: 5 }, { x: 10, y: 5 }, { x: 5, y: 10 }], mode: 'angle', value: 90, unit: '°' },
      bounds, fit, style,
    );
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    const [, lx, ly] = ctx.fillText.mock.calls[0] as [string, number, number];
    expect(lx).toBeCloseTo(5);
    expect(ly).toBeCloseTo(85); // screen y(95) - 10
  });
});
