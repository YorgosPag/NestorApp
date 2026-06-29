/**
 * Tests for the pure Canvas2D crosshair renderer (ADR-549 Phase 6). Verifies the
 * draw contract with a mock 2D context: clip-to-area, 4 arms, dash patterns,
 * aperture gating, and the "+"/"−" badge.
 */

import {
  paintCrosshairFrame,
  dashPattern,
  computeCrosshairClearRects,
  type CrosshairPaintFrame,
} from '../crosshair-compositor-paint';

function makeCtx() {
  return {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    setLineDash: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    strokeRect: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    globalAlpha: 1,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '' as CanvasTextAlign,
    textBaseline: '' as CanvasTextBaseline,
  };
}

const BASE: CrosshairPaintFrame = {
  cx: 100,
  cy: 80,
  clip: { x: 0, y: 0, w: 800, h: 600 },
  color: '#00ff00',
  opacity: 0.8,
  lineWidth: 1,
  lineStyle: 'solid',
  armLength: 50,
  gap: 5,
  aperture: { visible: false, size: 0 },
  badge: { visible: false },
};

describe('dashPattern', () => {
  it('solid ⇒ empty (continuous)', () => expect(dashPattern('solid')).toEqual([]));
  it('dotted / dashed / dash-dot ⇒ non-empty patterns', () => {
    expect(dashPattern('dotted').length).toBeGreaterThan(0);
    expect(dashPattern('dashed')).toEqual([6, 4]);
    expect(dashPattern('dash-dot').length).toBeGreaterThanOrEqual(4);
  });
});

describe('paintCrosshairFrame', () => {
  it('clips to the area rect and applies colour/opacity/line width', () => {
    const ctx = makeCtx();
    paintCrosshairFrame(ctx as unknown as CanvasRenderingContext2D, BASE);
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe('#00ff00');
    expect(ctx.globalAlpha).toBeCloseTo(0.8); // set before badge resets it
    expect(ctx.lineWidth).toBe(1);
  });

  it('draws the four arms (two H + two V) with the centre gap', () => {
    const ctx = makeCtx();
    paintCrosshairFrame(ctx as unknown as CanvasRenderingContext2D, BASE);
    // 4 arms ⇒ 4 moveTo + 4 lineTo on the arm path.
    expect(ctx.moveTo).toHaveBeenCalledTimes(4);
    expect(ctx.lineTo).toHaveBeenCalledTimes(4);
    expect(ctx.stroke).toHaveBeenCalled();
    // Left arm ends `gap` before centre.
    expect(ctx.lineTo).toHaveBeenCalledWith(BASE.cx - BASE.gap, BASE.cy);
  });

  it('solid style ⇒ continuous dash on the arms', () => {
    const ctx = makeCtx();
    paintCrosshairFrame(ctx as unknown as CanvasRenderingContext2D, BASE);
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
  });

  it('aperture: drawn only when visible', () => {
    const off = makeCtx();
    paintCrosshairFrame(off as unknown as CanvasRenderingContext2D, BASE);
    expect(off.strokeRect).not.toHaveBeenCalled();

    const on = makeCtx();
    paintCrosshairFrame(on as unknown as CanvasRenderingContext2D, {
      ...BASE,
      aperture: { visible: true, size: 10 },
    });
    expect(on.strokeRect).toHaveBeenCalledWith(BASE.cx - 5, BASE.cy - 5, 10, 10);
  });

  it('badge: background box + glyph only when visible', () => {
    const off = makeCtx();
    paintCrosshairFrame(off as unknown as CanvasRenderingContext2D, BASE);
    expect(off.fillText).not.toHaveBeenCalled();

    const on = makeCtx();
    paintCrosshairFrame(on as unknown as CanvasRenderingContext2D, {
      ...BASE,
      badge: { visible: true, text: '+', color: '#fff', backgroundColor: '#000' },
    });
    expect(on.fillRect).toHaveBeenCalled();
    expect(on.fillText).toHaveBeenCalledWith('+', expect.any(Number), expect.any(Number));
  });
});

describe('computeCrosshairClearRects (dirty-rect band-clear)', () => {
  const BASE_CLEAR = { cx: 200, cy: 150, armLength: 80, gap: 5, lineWidth: 1, aperture: 0, badge: false };

  it('always returns the two thin arm bands (H + V)', () => {
    const rects = computeCrosshairClearRects(BASE_CLEAR);
    expect(rects).toHaveLength(2);
    const [h, v] = rects;
    // H band: thin in height, wide in width; centred on cy / cx.
    expect(h.h).toBeLessThan(h.w);
    expect(v.w).toBeLessThan(v.h);
    // Bands span at least the full arm reach (gap + armLength) on each side of centre.
    const reach = BASE_CLEAR.gap + BASE_CLEAR.armLength;
    expect(h.w).toBeGreaterThanOrEqual(reach * 2);
    expect(v.h).toBeGreaterThanOrEqual(reach * 2);
  });

  it('the H band is NOT a full-canvas bbox — it stays thin around cy', () => {
    const rects = computeCrosshairClearRects(BASE_CLEAR);
    const [h] = rects;
    // lineWidth 1 + padding ⇒ a handful of px, never the cross's full vertical extent.
    expect(h.h).toBeLessThan(10);
    expect(h.y).toBeLessThan(BASE_CLEAR.cy);
    expect(h.y + h.h).toBeGreaterThan(BASE_CLEAR.cy);
  });

  it('adds an aperture box only when the centre square is visible', () => {
    expect(computeCrosshairClearRects({ ...BASE_CLEAR, aperture: 0 })).toHaveLength(2);
    const withAp = computeCrosshairClearRects({ ...BASE_CLEAR, aperture: 12 });
    expect(withAp).toHaveLength(3);
    const ap = withAp[2];
    // Box covers the aperture square (size 12) plus clearance, centred on the cursor.
    expect(ap.w).toBeGreaterThan(12);
    expect(ap.x).toBeLessThan(BASE_CLEAR.cx);
    expect(ap.x + ap.w).toBeGreaterThan(BASE_CLEAR.cx);
  });

  it('adds a badge box only when the badge is painted', () => {
    expect(computeCrosshairClearRects({ ...BASE_CLEAR, badge: false })).toHaveLength(2);
    const withBadge = computeCrosshairClearRects({ ...BASE_CLEAR, badge: true });
    expect(withBadge).toHaveLength(3);
    const badge = withBadge[2];
    // Badge sits top-right of centre ⇒ x > cx, y < cy.
    expect(badge.x).toBeGreaterThan(BASE_CLEAR.cx);
    expect(badge.y).toBeLessThan(BASE_CLEAR.cy);
  });

  it('emits both aperture + badge boxes when both are present (4 rects)', () => {
    const rects = computeCrosshairClearRects({ ...BASE_CLEAR, aperture: 10, badge: true });
    expect(rects).toHaveLength(4);
  });
});
