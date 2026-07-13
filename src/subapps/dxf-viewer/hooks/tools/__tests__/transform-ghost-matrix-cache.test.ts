/**
 * transform-ghost-matrix-cache.test.ts — pure affine math for the O(1)/frame matrix ghost (ADR-646 Φ6).
 *
 * Covers ONLY the pure functions (the DOM cache class needs a real canvas/drawImage, out of scope for
 * jsdom). The end-to-end invariant that matters: the base point of a scale-about-base drag must land on
 * its exact current-screen position through the full composed matrix — so the ghost is world-locked.
 */

import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';
import { CoordinateTransforms, COORDINATE_LAYOUT } from '../../../rendering/core/CoordinateTransforms';
import {
  type Affine2x3,
  type CaptureRect,
  composeAffine,
  scaleAboutBaseWorldAffine,
  worldToScreenAffine,
  offscreenToWorldAffine,
  captureRectFromBBox,
  buildCaptureTransform,
  MATRIX_GHOST_MARGIN_PX,
  MATRIX_GHOST_MAX_CSS,
} from '../transform-ghost-matrix';

const IDENTITY: Affine2x3 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Apply a canvas-semantics affine to a point: x'=a·x+c·y+e ; y'=b·x+d·y+f. */
function applyAffine(m: Affine2x3, p: Point2D): Point2D {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/** The offscreen pixel a world point maps to at capture (mirrors `buildCaptureTransform`). */
function worldToOffscreenPx(rect: CaptureRect, scale0: number, world: Point2D): Point2D {
  return {
    x: rect.margin + (world.x - rect.wxMin) * scale0,
    y: rect.margin + (rect.wyMax - world.y) * scale0,
  };
}

describe('composeAffine', () => {
  it('is a right/left identity', () => {
    const m: Affine2x3 = { a: 2, b: 0.5, c: -0.3, d: 3, e: 10, f: -4 };
    expect(composeAffine(m, IDENTITY)).toEqual(m);
    expect(composeAffine(IDENTITY, m)).toEqual(m);
  });

  it('applies m1 first then m2', () => {
    const m1: Affine2x3 = { a: 1, b: 0, c: 0, d: 1, e: 5, f: 7 };   // translate
    const m2: Affine2x3 = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 };   // scale ×2
    const composed = composeAffine(m2, m1);
    const p = { x: 3, y: 4 };
    expect(applyAffine(composed, p)).toEqual(applyAffine(m2, applyAffine(m1, p)));
    // scale(translate(p)) = 2·(p + t)
    expect(applyAffine(composed, p)).toEqual({ x: 2 * (3 + 5), y: 2 * (4 + 7) });
  });
});

describe('scaleAboutBaseWorldAffine', () => {
  it('leaves the base point fixed for any factor', () => {
    const base = { x: 120, y: -35 };
    for (const s of [0.25, 1, 2.5, -1.5]) {
      const p = applyAffine(scaleAboutBaseWorldAffine(base, s, s), base);
      expect(p.x).toBeCloseTo(base.x, 9);
      expect(p.y).toBeCloseTo(base.y, 9);
    }
  });

  it('scales a point away from the base by the factor (non-uniform)', () => {
    const base = { x: 0, y: 0 };
    const p = applyAffine(scaleAboutBaseWorldAffine(base, 3, 2), { x: 10, y: 10 });
    expect(p).toEqual({ x: 30, y: 20 }); // circle→ellipse comes from sx≠sy
  });
});

describe('worldToScreenAffine', () => {
  it('matches CoordinateTransforms.worldToScreen on the ready-state path', () => {
    const transform: ViewTransform = { scale: 1.7, offsetX: 42, offsetY: -11 };
    const viewport: Viewport = { width: 1600, height: 900 };
    const m = worldToScreenAffine(transform, viewport);
    for (const world of [{ x: 0, y: 0 }, { x: 250, y: -80 }, { x: -500, y: 640 }]) {
      const viaMatrix = applyAffine(m, world);
      const viaSsot = CoordinateTransforms.worldToScreen(world, transform, viewport);
      expect(viaMatrix.x).toBeCloseTo(viaSsot.x, 9);
      expect(viaMatrix.y).toBeCloseTo(viaSsot.y, 9);
    }
  });
});

describe('captureRectFromBBox', () => {
  const bbox = { minX: -10, minY: -20, maxX: 30, maxY: 40 };

  it('sizes CSS extent = world extent × scale0 + 2·margin', () => {
    const rect = captureRectFromBBox(bbox, 2, MATRIX_GHOST_MARGIN_PX, MATRIX_GHOST_MAX_CSS);
    expect(rect).not.toBeNull();
    expect(rect!.wCss).toBe((30 - -10) * 2 + 2 * MATRIX_GHOST_MARGIN_PX);
    expect(rect!.hCss).toBe((40 - -20) * 2 + 2 * MATRIX_GHOST_MARGIN_PX);
    expect(rect!.wxMin).toBe(-10);
    expect(rect!.wyMax).toBe(40);
  });

  it('returns null above the memory cap (→ caller falls back to LOD)', () => {
    expect(captureRectFromBBox(bbox, 1e6, MATRIX_GHOST_MARGIN_PX, MATRIX_GHOST_MAX_CSS)).toBeNull();
  });

  it('returns null for a non-positive capture zoom', () => {
    expect(captureRectFromBBox(bbox, 0, MATRIX_GHOST_MARGIN_PX, MATRIX_GHOST_MAX_CSS)).toBeNull();
  });
});

describe('buildCaptureTransform ∘ offscreenToWorldAffine round-trip', () => {
  it('offscreen-pixel → world → offscreen-pixel is identity', () => {
    const rect = captureRectFromBBox({ minX: 5, minY: 5, maxX: 105, maxY: 205 }, 1.3,
      MATRIX_GHOST_MARGIN_PX, MATRIX_GHOST_MAX_CSS)!;
    const scale0 = 1.3;
    const fromPx = offscreenToWorldAffine(rect, scale0);
    for (const world of [{ x: 5, y: 205 }, { x: 105, y: 5 }, { x: 40, y: 120 }]) {
      const px = worldToOffscreenPx(rect, scale0, world);
      const back = applyAffine(fromPx, px);
      expect(back.x).toBeCloseTo(world.x, 6);
      expect(back.y).toBeCloseTo(world.y, 6);
    }
    // buildCaptureTransform must agree with worldToScreen into the offscreen (via SSoT).
    const { transform, viewport } = buildCaptureTransform(rect, scale0);
    const px = CoordinateTransforms.worldToScreen({ x: 40, y: 120 }, transform, viewport);
    const expected = worldToOffscreenPx(rect, scale0, { x: 40, y: 120 });
    expect(px.x).toBeCloseTo(expected.x, 6);
    expect(px.y).toBeCloseTo(expected.y, 6);
  });
});

describe('end-to-end blit matrix (the world-lock invariant)', () => {
  it('maps the base point through the full composed matrix onto its current-screen position', () => {
    const rect = captureRectFromBBox({ minX: -50, minY: -50, maxX: 150, maxY: 150 }, 2,
      MATRIX_GHOST_MARGIN_PX, MATRIX_GHOST_MAX_CSS)!;
    const scale0 = 2;
    const base = { x: 20, y: 60 };
    const current: ViewTransform = { scale: 3.1, offsetX: 90, offsetY: 25 };
    const viewport: Viewport = { width: 1920, height: 1080 };

    // Full mapping used by TransformGhostMatrixCache.blit, for a scale factor f about the base.
    for (const f of [0.4, 1, 2.75]) {
      const m = composeAffine(
        worldToScreenAffine(current, viewport),
        composeAffine(scaleAboutBaseWorldAffine(base, f, f), offscreenToWorldAffine(rect, scale0)),
      );
      const basePx = worldToOffscreenPx(rect, scale0, base);
      const screened = applyAffine(m, basePx);
      // Scale-about-base leaves the base fixed in world → it must land on worldToScreen(base, current).
      const expected = CoordinateTransforms.worldToScreen(base, current, viewport);
      expect(screened.x).toBeCloseTo(expected.x, 4);
      expect(screened.y).toBeCloseTo(expected.y, 4);
    }
  });
});

describe('exported guards', () => {
  it('exposes sane margin + cap constants', () => {
    expect(MATRIX_GHOST_MARGIN_PX).toBeGreaterThan(0);
    expect(MATRIX_GHOST_MAX_CSS).toBeGreaterThan(1000);
    expect(COORDINATE_LAYOUT.MARGINS.left).toBe(30); // guards the affine's baked-in margin
  });
});
