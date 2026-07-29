/**
 * ADR-726 Φ3 / ADR-040 Phase XXII.B — anchored-raster geometry.
 *
 * The load-bearing claim of the whole fix is ONE equation: a raster rasterised at the
 * anchor transform can be re-projected onto ANY other pure scale+translate transform with
 * a single `drawImage`. If that is wrong the drawing silently slides out of register
 * during every pan — a defect no snapshot test would catch, because the pixels are all
 * still there, just in the wrong place.
 *
 * So the central test here does NOT re-state the algebra (a mutated formula would be
 * copied into the assertion). It takes a WORLD point, computes where the renderer would
 * put it on screen, and asserts the projected raster puts it in exactly the same place.
 */

import {
  IDLE_RERASTER_MS,
  type AnchorTransform,
  canServeAnchoredBlit,
  computeAnchoredBlitRect,
  computeOverscanPx,
  coversViewport,
  isSameTransform,
  magnification,
  maxMagnification,
} from '../dxf-bitmap-cache-anchor';

/** Renderer convention (dxf-viewport-culling): screen = world * scale + offset. */
function worldToScreen(world: number, t: AnchorTransform, axis: 'x' | 'y'): number {
  return world * t.scale + (axis === 'x' ? t.offsetX : t.offsetY);
}

describe('computeOverscanPx', () => {
  it('scales with the short side of the viewport', () => {
    expect(computeOverscanPx({ width: 1600, height: 900 })).toBe(180);
  });

  it('clamps small viewports up to the floor', () => {
    expect(computeOverscanPx({ width: 300, height: 200 })).toBe(96);
  });

  it('clamps huge viewports down to the ceiling', () => {
    expect(computeOverscanPx({ width: 4000, height: 3000 })).toBe(256);
  });

  it('returns the floor for a degenerate viewport instead of 0 or NaN', () => {
    expect(computeOverscanPx({ width: 0, height: 0 })).toBe(96);
    expect(computeOverscanPx({ width: Number.NaN, height: 100 })).toBe(96);
  });
});

describe('maxMagnification', () => {
  it('allows up to native CSS resolution on a HiDPI screen', () => {
    expect(maxMagnification(2)).toBe(2);
    expect(maxMagnification(3)).toBe(3);
  });

  it('keeps a small pragmatic budget on a dpr=1 screen', () => {
    expect(maxMagnification(1)).toBe(1.25);
  });

  it('never returns 0 / NaN for a broken dpr', () => {
    expect(maxMagnification(0)).toBe(1.25);
    expect(maxMagnification(Number.NaN)).toBe(1.25);
  });
});

describe('computeAnchoredBlitRect — world-point registration', () => {
  // A raster of 1040×840 device px = an 800×600 viewport + 120 overscan per side, dpr 1.
  const OVERSCAN = 120;

  it.each([
    ['pure pan', { scale: 1, offsetX: 0, offsetY: 0 }, { scale: 1, offsetX: 57, offsetY: -31 }, 1],
    ['zoom in', { scale: 1, offsetX: 0, offsetY: 0 }, { scale: 1.1, offsetX: 12, offsetY: 4 }, 1],
    ['zoom out', { scale: 2, offsetX: 10, offsetY: -5 }, { scale: 1.4, offsetX: -60, offsetY: 33 }, 1],
    ['dpr 2 + zoom', { scale: 2, offsetX: 10, offsetY: 10 }, { scale: 3, offsetX: -25, offsetY: 7 }, 2],
  ])('projects a world point to its true screen position (%s)', (_label, anchor, current, dpr) => {
    const rasterW = (800 + 2 * OVERSCAN) * dpr;
    const rasterH = (600 + 2 * OVERSCAN) * dpr;
    const rect = computeAnchoredBlitRect(anchor, current, OVERSCAN, rasterW, rasterH, dpr);

    for (const world of [-250, 0, 37.5, 410]) {
      // Where the offscreen render put this point inside the raster (device px).
      const rasterX = (worldToScreen(world, anchor, 'x') + OVERSCAN) * dpr;
      const rasterY = (worldToScreen(world, anchor, 'y') + OVERSCAN) * dpr;
      // Where the projected raster puts it on the visible backing store.
      const projectedX = (rasterX / rasterW) * rect.dw + rect.dx;
      const projectedY = (rasterY / rasterH) * rect.dh + rect.dy;
      // Where the renderer would have drawn it had it re-rendered this frame.
      const expectedX = worldToScreen(world, current, 'x') * dpr;
      const expectedY = worldToScreen(world, current, 'y') * dpr;

      // ≤0.5 device px: the deliberate whole-pixel snap on pure pan (see below).
      expect(projectedX).toBeCloseTo(expectedX, 0);
      expect(projectedY).toBeCloseTo(expectedY, 0);
    }
  });

  it('sits at exactly −overscan when the current transform IS the anchor', () => {
    const anchor: AnchorTransform = { scale: 1.7, offsetX: 42, offsetY: -8 };
    const rect = computeAnchoredBlitRect(anchor, anchor, OVERSCAN, 1040, 840, 1);
    expect(rect).toEqual({ dx: -120, dy: -120, dw: 1040, dh: 840 });
  });

  it('snaps a pure pan to whole device pixels (1:1 bitmap, no resample blur)', () => {
    const anchor: AnchorTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const rect = computeAnchoredBlitRect(anchor, { scale: 1, offsetX: 17.4, offsetY: -3.6 }, OVERSCAN, 1040, 840, 1);
    expect(Number.isInteger(rect.dx)).toBe(true);
    expect(Number.isInteger(rect.dy)).toBe(true);
    expect(rect.dw).toBe(1040);
  });

  it('does NOT snap when scale changed (rounding there would mis-register the drawing)', () => {
    const anchor: AnchorTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const rect = computeAnchoredBlitRect(anchor, { scale: 1.13, offsetX: 17.4, offsetY: 0 }, OVERSCAN, 1040, 840, 1);
    expect(Number.isInteger(rect.dx)).toBe(false);
  });
});

describe('coversViewport', () => {
  it('accepts a rect that fully contains the backing store', () => {
    expect(coversViewport({ dx: -120, dy: -120, dw: 1040, dh: 840 }, 800, 600)).toBe(true);
  });

  it.each([
    ['left edge exposed', { dx: 5, dy: -120, dw: 1040, dh: 840 }],
    ['top edge exposed', { dx: -120, dy: 5, dw: 1040, dh: 840 }],
    ['right edge exposed', { dx: -120, dy: -120, dw: 900, dh: 840 }],
    ['bottom edge exposed', { dx: -120, dy: -120, dw: 1040, dh: 700 }],
  ])('rejects a rect that leaves a hole (%s)', (_label, rect) => {
    expect(coversViewport(rect, 800, 600)).toBe(false);
  });

  it('tolerates sub-device-pixel rounding rather than forcing a rebuild', () => {
    expect(coversViewport({ dx: 0.4, dy: 0.4, dw: 800, dh: 600 }, 800, 600)).toBe(true);
  });
});

describe('canServeAnchoredBlit', () => {
  const BASE = {
    anchor: { scale: 1, offsetX: 0, offsetY: 0 } as AnchorTransform,
    overscanPx: 120,
    rasterDeviceW: 1040,
    rasterDeviceH: 840,
    dpr: 1,
    physW: 800,
    physH: 600,
  };

  it('serves a pan that stays inside the overscan margin', () => {
    expect(canServeAnchoredBlit({ ...BASE, current: { scale: 1, offsetX: 100, offsetY: -100 } })).toBe(true);
  });

  it('refuses a pan that runs past the overscan margin', () => {
    expect(canServeAnchoredBlit({ ...BASE, current: { scale: 1, offsetX: 200, offsetY: 0 } })).toBe(false);
  });

  it('serves a modest zoom-in on a dpr=1 screen', () => {
    expect(canServeAnchoredBlit({ ...BASE, current: { scale: 1.1, offsetX: 0, offsetY: 0 } })).toBe(true);
  });

  it('refuses a zoom-in past the magnification budget (would look soft)', () => {
    expect(canServeAnchoredBlit({ ...BASE, current: { scale: 1.5, offsetX: 0, offsetY: 0 } })).toBe(false);
  });

  it('refuses a zoom-out that shrinks the raster below the viewport', () => {
    expect(canServeAnchoredBlit({ ...BASE, current: { scale: 0.7, offsetX: 0, offsetY: 0 } })).toBe(false);
  });

  it.each([
    ['zero anchor scale', { scale: 1, offsetX: 0, offsetY: 0 }, 0],
    ['negative scale', { scale: -1, offsetX: 0, offsetY: 0 }, 1],
  ])('refuses a degenerate transform pair (%s)', (_label, current, anchorScale) => {
    const result = canServeAnchoredBlit({
      ...BASE,
      anchor: { ...BASE.anchor, scale: anchorScale },
      current,
    });
    expect(result).toBe(false);
  });
});

describe('isSameTransform', () => {
  it('is true only when all three components match', () => {
    const t: AnchorTransform = { scale: 2, offsetX: 3, offsetY: 4 };
    expect(isSameTransform(t, { ...t })).toBe(true);
    expect(isSameTransform(t, { ...t, scale: 2.0001 })).toBe(false);
    expect(isSameTransform(t, { ...t, offsetX: 3.0001 })).toBe(false);
    expect(isSameTransform(t, { ...t, offsetY: 4.0001 })).toBe(false);
  });
});

describe('magnification + policy constants', () => {
  it('is the ratio of current to anchor scale', () => {
    expect(magnification({ scale: 2, offsetX: 0, offsetY: 0 }, { scale: 3, offsetX: 0, offsetY: 0 })).toBe(1.5);
  });

  it('keeps the idle window short enough to feel instant after a gesture', () => {
    expect(IDLE_RERASTER_MS).toBeGreaterThan(0);
    expect(IDLE_RERASTER_MS).toBeLessThanOrEqual(200);
  });
});
