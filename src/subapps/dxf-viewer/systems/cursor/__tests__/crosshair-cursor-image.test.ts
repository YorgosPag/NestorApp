/**
 * Tests for the CSS hardware-cursor crosshair image builder (ADR-549 Phase 8).
 * The builder rasterises a PNG via an offscreen canvas (Chrome rejects SVG cursors), so we mock
 * the canvas + 2D context and assert the draw contract + the returned `cursor` value shape.
 */

import { buildCrosshairCursorValue } from '../crosshair-cursor-image';

interface MockCtx {
  clearRect: jest.Mock; beginPath: jest.Mock; moveTo: jest.Mock; lineTo: jest.Mock;
  stroke: jest.Mock; strokeRect: jest.Mock;
  globalAlpha: number; strokeStyle: string; lineWidth: number;
}

let ctx: MockCtx;
let canvas: { width: number; height: number; getContext: jest.Mock; toDataURL: jest.Mock };
const origCreate = document.createElement.bind(document);

beforeEach(() => {
  ctx = {
    clearRect: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(),
    stroke: jest.fn(), strokeRect: jest.fn(),
    globalAlpha: 1, strokeStyle: '', lineWidth: 1,
  };
  canvas = {
    width: 0, height: 0,
    getContext: jest.fn(() => ctx),
    toDataURL: jest.fn(() => 'data:image/png;base64,ABC'),
  };
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : origCreate(tag),
  );
});

afterEach(() => jest.restoreAllMocks());

describe('buildCrosshairCursorValue', () => {
  it('returns a PNG url with centre hotspot + crosshair fallback', () => {
    const v = buildCrosshairCursorValue({ color: '#00ff00', size: 32 });
    expect(v).toBe('url("data:image/png;base64,ABC") 16 16, crosshair');
  });

  it('sizes the canvas to the requested side and draws the 4 arms', () => {
    buildCrosshairCursorValue({ color: '#fff', size: 64 });
    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(64);
    expect(ctx.moveTo).toHaveBeenCalledTimes(4);
    expect(ctx.lineTo).toHaveBeenCalledTimes(4);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe('#fff');
  });

  it('clamps the size to ≤128 (Chrome cursor limit)', () => {
    const v = buildCrosshairCursorValue({ color: '#fff', size: 999 });
    expect(v).toContain('") 64 64, crosshair'); // hotspot = 128/2
    expect(canvas.width).toBe(128);
  });

  it('draws the pickbox rect only when pickbox > 0', () => {
    buildCrosshairCursorValue({ color: '#fff', pickbox: 0 });
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    buildCrosshairCursorValue({ color: '#fff', pickbox: 10 });
    expect(ctx.strokeRect).toHaveBeenCalled();
  });
});
