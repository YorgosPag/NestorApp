/**
 * ADR-726 Φ3 / ADR-040 Phase XXII.B — anchored-raster geometry.
 *
 * 🔴 **ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΓΡΑΦΤΗΚΕ ΔΥΟ ΦΟΡΕΣ. Η ΠΡΩΤΗ ΕΚΔΟΣΗ ΗΤΑΝ ΠΡΑΣΙΝΗ ΚΑΙ ΛΑΘΟΣ.**
 * Ξανάγραφε μόνη της τη μετατροπή world→screen, αντιγράφοντας τη σύμβαση από **σχόλιο** του
 * `dxf-viewport-culling` (`screen.y = world.y·scale + offsetY`). Η αληθινή σύμβαση είναι
 * `CoordinateTransforms.worldToScreen`: `screenY = (viewport.height − top) − world.y·scale −
 * **offsetY**` — Y ανεστραμμένο, `offsetY` **αφαιρούμενο**, περιθώρια και στους δύο άξονες.
 * Το test περνούσε επειδή **κώδικας και έλεγχος έκαναν το ΙΔΙΟ λάθος**. Στην οθόνη: το σχέδιο
 * πήγαινε ανάποδα στο pan, η επιλεγμένη οντότητα ξεκόλλαγε από το ψημένο αντίγραφό της
 * («δεύτερη μπαλίτσα»), και η κάλυψη έσπαγε κάθε καρέ ⇒ **το lag δεν έφυγε ποτέ**.
 *
 * **Ο κανόνας που επιβάλλει τώρα το αρχείο: καμία γραμμή εδώ δεν ξαναγράφει τη μετατροπή.**
 * Και ο κώδικας και ο έλεγχος **ρωτούν** το `CoordinateTransforms`. Αν αλλάξει η σύμβαση,
 * αλλάζουν μαζί· αν κάποιος την ξαναγράψει με το χέρι, το test το βλέπει.
 */

import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { Point2D, Viewport } from '../../../rendering/types/Types';
import {
  ANCHOR_PROBE_WORLD_POINT,
  IDLE_RERASTER_MS,
  type AnchorTransform,
  type AnchoredProbe,
  computeAnchoredBlitRect,
  computeOverscanPx,
  coversViewport,
  isAnchoredBlitAcceptable,
  isSameTransform,
  magnification,
  maxMagnification,
  overscannedRenderTransform,
  overscannedViewport,
} from '../dxf-bitmap-cache-anchor';

const VIEWPORT: Viewport = { width: 800, height: 600 };
const OVERSCAN = 120;

/** Where a world point sits inside the raster, in the raster's own CSS coordinates. */
function inRaster(world: Point2D, anchor: AnchorTransform, viewport: Viewport, overscanPx: number): Point2D {
  return CoordinateTransforms.worldToScreen(
    world,
    overscannedRenderTransform(anchor, overscanPx),
    overscannedViewport(viewport, overscanPx),
  );
}

/** Exactly what the cache builds — same probe point, same SSoT calls. */
function probeFor(
  anchor: AnchorTransform,
  current: AnchorTransform,
  viewport: Viewport,
  overscanPx: number,
): AnchoredProbe {
  return {
    raster: inRaster(ANCHOR_PROBE_WORLD_POINT, anchor, viewport, overscanPx),
    screen: CoordinateTransforms.worldToScreen(ANCHOR_PROBE_WORLD_POINT, current, viewport),
  };
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

describe('the overscanned offscreen pass', () => {
  it('grows the viewport by the margin on every side', () => {
    expect(overscannedViewport(VIEWPORT, OVERSCAN)).toEqual({ width: 1040, height: 840 });
  });

  it('places raster CSS point (M, M) exactly on visible-canvas point (0, 0)', () => {
    // The load-bearing property of the +overscan offset shift — asserted through the REAL
    // conversion, including the Y-inversion that a hand-written formula got backwards.
    const anchor: AnchorTransform = { scale: 1.7, offsetX: 42, offsetY: -8 };
    for (const world of [{ x: 0, y: 0 }, { x: 130, y: -75 }, { x: -410, y: 260 }]) {
      const raster = inRaster(world, anchor, VIEWPORT, OVERSCAN);
      const screen = CoordinateTransforms.worldToScreen(world, anchor, VIEWPORT);
      expect(raster.x - screen.x).toBeCloseTo(OVERSCAN, 6);
      expect(raster.y - screen.y).toBeCloseTo(OVERSCAN, 6);
    }
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
  it.each([
    ['pure pan', { scale: 1, offsetX: 0, offsetY: 0 }, { scale: 1, offsetX: 57, offsetY: -31 }, 1],
    ['pan upward (positive offsetY)', { scale: 1, offsetX: 0, offsetY: 0 }, { scale: 1, offsetX: 0, offsetY: 64 }, 1],
    ['zoom in', { scale: 1, offsetX: 0, offsetY: 0 }, { scale: 1.1, offsetX: 12, offsetY: 4 }, 1],
    ['zoom out', { scale: 2, offsetX: 10, offsetY: -5 }, { scale: 1.4, offsetX: -60, offsetY: 33 }, 1],
    ['dpr 2 + zoom', { scale: 2, offsetX: 10, offsetY: 10 }, { scale: 3, offsetX: -25, offsetY: 7 }, 2],
  ])('projects world points to their TRUE screen position (%s)', (_label, anchor, current, dpr) => {
    const rasterW = (VIEWPORT.width + 2 * OVERSCAN) * dpr;
    const rasterH = (VIEWPORT.height + 2 * OVERSCAN) * dpr;
    const k = magnification(anchor, current);
    const rect = computeAnchoredBlitRect(probeFor(anchor, current, VIEWPORT, OVERSCAN), k, rasterW, rasterH, dpr);

    for (const world of [{ x: -250, y: 90 }, { x: 0, y: 0 }, { x: 37.5, y: -12 }, { x: 410, y: 305 }]) {
      // Where the offscreen pass actually put it (device px inside the raster).
      const raster = inRaster(world, anchor, VIEWPORT, OVERSCAN);
      const projectedX = (raster.x * dpr / rasterW) * rect.dw + rect.dx;
      const projectedY = (raster.y * dpr / rasterH) * rect.dh + rect.dy;
      // Where the renderer would have drawn it had it re-rendered this frame.
      const truth = CoordinateTransforms.worldToScreen(world, current, VIEWPORT);

      // ≤0.5 device px: the deliberate whole-pixel snap on pure pan.
      expect(projectedX).toBeCloseTo(truth.x * dpr, 0);
      expect(projectedY).toBeCloseTo(truth.y * dpr, 0);
    }
  });

  it('🔴 moves the raster UP for a positive offsetY (the sign that was inverted)', () => {
    const anchor: AnchorTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const atAnchor = computeAnchoredBlitRect(probeFor(anchor, anchor, VIEWPORT, OVERSCAN), 1, 1040, 840, 1);
    const pannedUp = computeAnchoredBlitRect(
      probeFor(anchor, { ...anchor, offsetY: 50 }, VIEWPORT, OVERSCAN),
      1, 1040, 840, 1,
    );
    // screenY = (height − top) − world.y·scale − offsetY ⇒ MORE offsetY = SMALLER screenY.
    expect(pannedUp.dy).toBe(atAnchor.dy - 50);
  });

  it('sits at exactly −overscan when the current transform IS the anchor', () => {
    const anchor: AnchorTransform = { scale: 1.7, offsetX: 42, offsetY: -8 };
    const rect = computeAnchoredBlitRect(probeFor(anchor, anchor, VIEWPORT, OVERSCAN), 1, 1040, 840, 1);
    expect(rect).toEqual({ dx: -OVERSCAN, dy: -OVERSCAN, dw: 1040, dh: 840 });
  });

  it('snaps a pure pan to whole device pixels (1:1 bitmap, no resample blur)', () => {
    const anchor: AnchorTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const rect = computeAnchoredBlitRect(
      probeFor(anchor, { scale: 1, offsetX: 17.4, offsetY: -3.6 }, VIEWPORT, OVERSCAN),
      1, 1040, 840, 1,
    );
    expect(Number.isInteger(rect.dx)).toBe(true);
    expect(Number.isInteger(rect.dy)).toBe(true);
    expect(rect.dw).toBe(1040);
  });

  it('does NOT snap when scale changed (rounding there would mis-register the drawing)', () => {
    const anchor: AnchorTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const current: AnchorTransform = { scale: 1.13, offsetX: 17.4, offsetY: 0 };
    const rect = computeAnchoredBlitRect(probeFor(anchor, current, VIEWPORT, OVERSCAN), 1.13, 1040, 840, 1);
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

describe('isAnchoredBlitAcceptable', () => {
  const COVERING = { dx: -120, dy: -120, dw: 1040, dh: 840 };

  it('accepts a covering rect at a sane magnification', () => {
    expect(isAnchoredBlitAcceptable({ rect: COVERING, magnification: 1, dpr: 1, physW: 800, physH: 600 })).toBe(true);
  });

  it('refuses a rect that leaves a hole', () => {
    const holed = { ...COVERING, dw: 700 };
    expect(isAnchoredBlitAcceptable({ rect: holed, magnification: 1, dpr: 1, physW: 800, physH: 600 })).toBe(false);
  });

  it('refuses magnification past the budget even when the rect covers', () => {
    const big = { dx: -400, dy: -400, dw: 2000, dh: 1800 };
    expect(isAnchoredBlitAcceptable({ rect: big, magnification: 1.5, dpr: 1, physW: 800, physH: 600 })).toBe(false);
    // …and accepts the very same projection on a dpr=2 screen, where it is still native-res.
    expect(isAnchoredBlitAcceptable({ rect: big, magnification: 1.5, dpr: 2, physW: 800, physH: 600 })).toBe(true);
  });

  it.each([
    ['zero magnification (anchor scale was 0)', 0],
    ['negative magnification', -1],
    ['NaN magnification', Number.NaN],
  ])('refuses a degenerate magnification (%s)', (_label, k) => {
    expect(isAnchoredBlitAcceptable({ rect: COVERING, magnification: k, dpr: 1, physW: 800, physH: 600 })).toBe(false);
  });

  it('refuses a non-finite destination (a NaN transform must not reach drawImage)', () => {
    const broken = { ...COVERING, dx: Number.NaN };
    expect(isAnchoredBlitAcceptable({ rect: broken, magnification: 1, dpr: 1, physW: 800, physH: 600 })).toBe(false);
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
