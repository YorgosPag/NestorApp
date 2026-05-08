import { drawText } from '../text';
import type { SceneBounds, FitTransform } from '../types';

function makeMockCtx() {
  return {
    strokeStyle: '' as string,
    lineWidth: 0,
    fillStyle: '' as string,
    font: '',
    textAlign: '',
    textBaseline: '',
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    strokeText: jest.fn(),
    fillText: jest.fn(),
  };
}

const bounds: SceneBounds = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
const fit: FitTransform = { scale: 1, offsetX: 0, offsetY: 0 };

describe('drawText', () => {
  it('skips draw for empty text', () => {
    const ctx = makeMockCtx();
    drawText(ctx as unknown as CanvasRenderingContext2D, { position: { x: 10, y: 10 }, text: '' }, bounds, fit, { fill: '#000' });
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('rotates by -rotation to compensate Y-flip', () => {
    const ctx = makeMockCtx();
    drawText(ctx as unknown as CanvasRenderingContext2D, { position: { x: 10, y: 10 }, text: 'hi', rotation: Math.PI / 4 }, bounds, fit, { fill: '#000' });
    expect(ctx.rotate).toHaveBeenCalledWith(-Math.PI / 4);
  });

  it('clamps fontSize to min 8px', () => {
    const ctx = makeMockCtx();
    // fontSize 0.1 world unit × scale 1 = 0.1 px → clamp to 8px
    drawText(ctx as unknown as CanvasRenderingContext2D, { position: { x: 0, y: 0 }, text: 'tiny', fontSize: 0.1 }, bounds, fit, { fill: '#000' });
    expect(ctx.font).toContain('8px');
  });

  it('clamps fontSize to max 72px', () => {
    const ctx = makeMockCtx();
    // fontSize 200 × scale 1 = 200px → clamp to 72px
    drawText(ctx as unknown as CanvasRenderingContext2D, { position: { x: 0, y: 0 }, text: 'huge', fontSize: 200 }, bounds, fit, { fill: '#000' });
    expect(ctx.font).toContain('72px');
  });

  it('calls strokeText when stroke style is provided', () => {
    const ctx = makeMockCtx();
    drawText(ctx as unknown as CanvasRenderingContext2D, { position: { x: 10, y: 10 }, text: 'hi' }, bounds, fit, { fill: '#fff', stroke: '#000' });
    expect(ctx.strokeText).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
  });

  it('save/restore wraps the transform', () => {
    const ctx = makeMockCtx();
    drawText(ctx as unknown as CanvasRenderingContext2D, { position: { x: 10, y: 10 }, text: 'ok' }, bounds, fit, { fill: '#000' });
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });
});
