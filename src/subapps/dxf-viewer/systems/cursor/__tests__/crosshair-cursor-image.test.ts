/**
 * Tests for the CSS hardware-cursor crosshair image builder (ADR-549 Phase 8).
 * The builder rasterises a PNG via an offscreen canvas (Chrome rejects SVG cursors), so we mock
 * the canvas + 2D context and assert the draw contract + the returned `cursor` value shape.
 *
 * DPR-awareness (the «crosshair vanishes on HiDPI / zoom» fix): the builder shrinks the CSS size so
 * the DEVICE size (cssSize × dpr) never exceeds the hardware-cursor cap (32px), so the browser never
 * rejects the image → the crosshair never disappears.
 */

import { buildCrosshairCursorValue } from '../crosshair-cursor-image';

interface MockCtx {
  clearRect: jest.Mock; beginPath: jest.Mock; moveTo: jest.Mock; lineTo: jest.Mock;
  stroke: jest.Mock; strokeRect: jest.Mock; scale: jest.Mock;
  globalAlpha: number; strokeStyle: string; lineWidth: number;
}

let ctx: MockCtx;
let canvas: { width: number; height: number; getContext: jest.Mock; toDataURL: jest.Mock };
const origCreate = document.createElement.bind(document);
const origDpr = window.devicePixelRatio;

const setDpr = (v: number) =>
  Object.defineProperty(window, 'devicePixelRatio', { value: v, configurable: true, writable: true });

beforeEach(() => {
  ctx = {
    clearRect: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(),
    stroke: jest.fn(), strokeRect: jest.fn(), scale: jest.fn(),
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
  setDpr(1);
});

afterEach(() => {
  jest.restoreAllMocks();
  setDpr(origDpr);
});

describe('buildCrosshairCursorValue', () => {
  it('returns a plain PNG url with centre hotspot + crosshair fallback at dpr 1', () => {
    const v = buildCrosshairCursorValue({ color: '#00ff00', size: 32 });
    expect(v).toBe('url("data:image/png;base64,ABC") 16 16, crosshair');
  });

  it('draws the 4 arms and applies the colour', () => {
    buildCrosshairCursorValue({ color: '#fff', size: 32 });
    expect(ctx.moveTo).toHaveBeenCalledTimes(4);
    expect(ctx.lineTo).toHaveBeenCalledTimes(4);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe('#fff');
  });

  it('draws the pickbox rect only when pickbox > 0', () => {
    buildCrosshairCursorValue({ color: '#fff', pickbox: 0 });
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    buildCrosshairCursorValue({ color: '#fff', pickbox: 10 });
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  describe('device-size cap (never rejected → never vanishes)', () => {
    it('caps the DEVICE size to ≤ 32px even when a huge size is requested', () => {
      buildCrosshairCursorValue({ color: '#fff', size: 999 });
      expect(canvas.width).toBeLessThanOrEqual(32);
      expect(canvas.height).toBeLessThanOrEqual(32);
    });

    it('keeps the physical backing store ≤ 32px across HiDPI ratios', () => {
      for (const dpr of [1, 1.25, 1.5, 2, 3]) {
        setDpr(dpr);
        buildCrosshairCursorValue({ color: '#fff', size: 32 });
        expect(canvas.width).toBeLessThanOrEqual(32);
      }
    });

    it('rasterises via image-set at the physical resolution on HiDPI (crisp, not rejected)', () => {
      setDpr(2);
      const v = buildCrosshairCursorValue({ color: '#fff', size: 32 });
      // cssSize shrinks to 16 (16×2 = 32 device px = cap), hotspot = 8, declared as 2x.
      expect(v).toBe('image-set(url("data:image/png;base64,ABC") 2x) 8 8, crosshair');
      expect(canvas.width).toBe(32);
      expect(ctx.scale).toHaveBeenCalledWith(2, 2);
    });
  });

  describe('hotspot ≡ visual centre (2026-07-04 fix — "cursor centre ≠ read point")', () => {
    it('puts the hotspot at the DISPLAYED-image centre on sub-1 dpr (plain url)', () => {
      // dpr 0.8 (e.g. 80% zoom): cssSize stays 32 but the PNG rasterises to
      // round(32×0.8)=26 device px and is emitted as a plain url() → shown 1:1 at 26
      // CSS px, whose centre is 13. The hotspot MUST be 13 (not the old 16 = cssSize/2),
      // else the true pointer sits ~3px off the cross the user sees.
      setDpr(0.8);
      const v = buildCrosshairCursorValue({ color: '#fff', size: 32 });
      expect(v).toBe('url("data:image/png;base64,ABC") 13 13, crosshair');
      expect(canvas.width).toBe(26);
    });
  });
});
