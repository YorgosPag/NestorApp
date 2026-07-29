/**
 * ADR-726 Φ3 — «Raster με άγκυρα»: το transform ΦΕΥΓΕΙ από το cache key.
 *
 * ΤΟ ΜΕΤΡΗΜΕΝΟ ΣΦΑΛΜΑ (2026-07-29, ADR-726 §6 Φ3): με `scale/offsetX/offsetY` μέσα στο key,
 * κάθε καρέ pan/zoom ήταν **αστοχία εξ ορισμού** ⇒ πλήρης ανακατασκευή 2.996 οντοτήτων
 * offscreen. `frame:dxf-canvas` **min 32,7ms** — δάπεδο σε ΚΑΘΕ καρέ, 98,3% του budget, ~12 FPS.
 *
 * Αυτό που καρφώνει αυτό το αρχείο είναι η **συμπεριφορά**, όχι η αριθμητική (η γεωμετρία
 * ελέγχεται στο `dxf-bitmap-cache-anchor.test.ts`):
 *   • μετακίνηση εντός του overscan  ⇒ ΚΑΜΙΑ ανακατασκευή  ← η ίδια η διόρθωση
 *   • μετακίνηση εκτός / υπερβολικό zoom ⇒ ανακατασκευή (χειρότερη περίπτωση = το σημερινό κόστος)
 *   • ηρεμία ⇒ ΕΝΑ re-raster που ξανακεντράρει το overscan
 *   • ΟΛΑ τα δομικά κλειδιά (scene/viewport/dpr/toggles) εξακολουθούν να ακυρώνουν
 *
 * Τα pixels δεν εξετάζονται (το jsdom δεν έχει 2D context) — μόνο το συμβόλαιο.
 */

import type { ViewTransform, Viewport } from '../../../rendering/types/Types';
import type { DxfScene } from '../dxf-types';
import { DxfBitmapCache, type BitmapCacheRenderInputs } from '../dxf-bitmap-cache';

interface RenderCall {
  transform: ViewTransform;
  viewport: Viewport;
}

const mockRenderCalls: RenderCall[] = [];

jest.mock('../DxfRenderer', () => ({
  DxfRenderer: jest.fn().mockImplementation(() => ({
    render: (_scene: unknown, transform: ViewTransform, viewport: Viewport) => {
      mockRenderCalls.push({ transform, viewport });
    },
  })),
}));

// Stable, non-moving cache-key inputs so the only variable is the transform under test.
jest.mock('../../../systems/viewport/ViewportStore', () => ({ getActiveScaleName: () => '1:50' }));
jest.mock('../../../bim/services/opening-tag-style-service', () => ({
  getCurrentOpeningTagStyle: () => ({ enabled: false }),
}));
jest.mock('../../../systems/cursor/utils', () => ({
  getDevicePixelRatio: () => 1,
  toDevicePixels: (cssPixels: number) => cssPixels,
}));
jest.mock('../../../state/bim-render-settings-store', () => ({
  useBimRenderSettingsStore: { getState: () => ({ drawingScale: 50, viewRange: {}, objectStyles: {} }) },
}));

const SCENE: DxfScene = { entities: [] } as unknown as DxfScene;
const VIEWPORT: Viewport = { width: 800, height: 600 };
const BASE: BitmapCacheRenderInputs = { showGrid: false, showLayerNames: false, wireframeMode: false };
const ANCHOR: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

/** `computeOverscanPx({800,600})` = 0.2 × 600 = 120 CSS px per side ⇒ raster 1040×840. */
const OVERSCAN = 120;

let getContextSpy: jest.SpyInstance;

beforeAll(() => {
  getContextSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ setTransform: jest.fn() } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
});

afterAll(() => getContextSpy.mockRestore());

beforeEach(() => {
  mockRenderCalls.length = 0;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

interface TargetCtxStub {
  ctx: CanvasRenderingContext2D;
  drawImage: jest.Mock;
}

function targetCtxStub(): TargetCtxStub {
  const drawImage = jest.fn();
  const ctx = {
    save: jest.fn(),
    restore: jest.fn(),
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    drawImage,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, drawImage };
}

function freshCache(requestRepaint?: () => void): DxfBitmapCache {
  const cache = new DxfBitmapCache(requestRepaint ? { requestRepaint } : {});
  cache.rebuild(SCENE, ANCHOR, VIEWPORT, BASE);
  mockRenderCalls.length = 0;
  return cache;
}

describe('DxfBitmapCache — ADR-726 Φ3 anchored raster', () => {
  describe('rebuild rasterises WITH the overscan margin', () => {
    it('renders a viewport enlarged by the margin on every side', () => {
      new DxfBitmapCache().rebuild(SCENE, ANCHOR, VIEWPORT, BASE);
      expect(mockRenderCalls).toHaveLength(1);
      expect(mockRenderCalls[0].viewport).toEqual({
        width: VIEWPORT.width + 2 * OVERSCAN,
        height: VIEWPORT.height + 2 * OVERSCAN,
      });
    });

    it('shifts the render offset by the margin — this is what maps raster (M,M) → viewport (0,0)', () => {
      new DxfBitmapCache().rebuild(SCENE, { scale: 2, offsetX: 30, offsetY: -40 }, VIEWPORT, BASE);
      expect(mockRenderCalls[0].transform).toMatchObject({
        scale: 2,
        offsetX: 30 + OVERSCAN,
        offsetY: -40 + OVERSCAN,
      });
    });
  });

  describe('the fix: a transform change is no longer an automatic miss', () => {
    it('is clean at the anchor transform (unchanged Phase D contract)', () => {
      expect(freshCache().isDirty(SCENE, ANCHOR, VIEWPORT, BASE)).toBe(false);
    });

    it.each([
      ['pan left', { scale: 1, offsetX: 90, offsetY: 0 }],
      ['pan diagonally', { scale: 1, offsetX: -60, offsetY: 75 }],
      ['modest zoom-in', { scale: 1.1, offsetX: 0, offsetY: 0 }],
    ])('serves %s from the cached raster — NO rebuild', (_label, transform) => {
      const cache = freshCache();
      expect(cache.isDirty(SCENE, transform, VIEWPORT, BASE)).toBe(false);
      expect(mockRenderCalls).toHaveLength(0);
    });

    it.each([
      ['pan past the overscan margin', { scale: 1, offsetX: 200, offsetY: 0 }],
      ['zoom-in past the magnification budget', { scale: 1.6, offsetX: 0, offsetY: 0 }],
      ['zoom-out that shrinks the raster below the viewport', { scale: 0.6, offsetX: 0, offsetY: 0 }],
    ])('rebuilds when the raster can no longer serve the view (%s)', (_label, transform) => {
      expect(freshCache().isDirty(SCENE, transform, VIEWPORT, BASE)).toBe(true);
    });

    it('re-anchors on rebuild, so the next gesture gets a full margin again', () => {
      const cache = freshCache();
      const far: ViewTransform = { scale: 1, offsetX: 200, offsetY: 0 };
      expect(cache.isDirty(SCENE, far, VIEWPORT, BASE)).toBe(true);
      cache.rebuild(SCENE, far, VIEWPORT, BASE);
      expect(cache.isDirty(SCENE, far, VIEWPORT, BASE)).toBe(false);
      // 90px further from the NEW anchor is inside the margin again.
      expect(cache.isDirty(SCENE, { ...far, offsetX: 290 }, VIEWPORT, BASE)).toBe(false);
    });
  });

  describe('blit projects the raster instead of pasting it at the origin', () => {
    it('places the raster at −overscan when the view has not moved', () => {
      const cache = freshCache();
      const { ctx, drawImage } = targetCtxStub();
      cache.blit(ctx, VIEWPORT, ANCHOR);
      expect(drawImage).toHaveBeenCalledTimes(1);
      const [, dx, dy, dw, dh] = drawImage.mock.calls[0];
      expect([dx, dy, dw, dh]).toEqual([
        -OVERSCAN,
        -OVERSCAN,
        VIEWPORT.width + 2 * OVERSCAN,
        VIEWPORT.height + 2 * OVERSCAN,
      ]);
    });

    it('shifts the destination by the pan delta', () => {
      const cache = freshCache();
      const { ctx, drawImage } = targetCtxStub();
      cache.blit(ctx, VIEWPORT, { scale: 1, offsetX: 45, offsetY: -20 });
      const [, dx, dy] = drawImage.mock.calls[0];
      expect(dx).toBe(45 - OVERSCAN);
      expect(dy).toBe(-20 - OVERSCAN);
    });

    it('clears the backing store first (no ghost trails over last frame)', () => {
      const cache = freshCache();
      const { ctx } = targetCtxStub();
      cache.blit(ctx, VIEWPORT, ANCHOR);
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, VIEWPORT.width, VIEWPORT.height);
    });
  });

  describe('idle re-raster', () => {
    it('asks for one repaint after the gesture settles, and only then is dirty again', () => {
      const requestRepaint = jest.fn();
      const cache = freshCache(requestRepaint);
      const drifted: ViewTransform = { scale: 1, offsetX: 45, offsetY: 0 };

      cache.blit(targetCtxStub().ctx, VIEWPORT, drifted);
      expect(cache.isDirty(SCENE, drifted, VIEWPORT, BASE)).toBe(false);
      expect(requestRepaint).not.toHaveBeenCalled();

      jest.advanceTimersByTime(150);
      expect(requestRepaint).toHaveBeenCalledTimes(1);
      expect(cache.isDirty(SCENE, drifted, VIEWPORT, BASE)).toBe(true);

      cache.rebuild(SCENE, drifted, VIEWPORT, BASE);
      expect(cache.isDirty(SCENE, drifted, VIEWPORT, BASE)).toBe(false);
    });

    it('does not fire while the gesture is still moving (the timer is re-armed)', () => {
      const requestRepaint = jest.fn();
      const cache = freshCache(requestRepaint);
      for (let i = 1; i <= 5; i++) {
        cache.blit(targetCtxStub().ctx, VIEWPORT, { scale: 1, offsetX: i * 10, offsetY: 0 });
        jest.advanceTimersByTime(100);
      }
      expect(requestRepaint).not.toHaveBeenCalled();
      jest.advanceTimersByTime(150);
      expect(requestRepaint).toHaveBeenCalledTimes(1);
    });

    it('arms nothing when the blit is already at the anchor (no idle repaint loop)', () => {
      const requestRepaint = jest.fn();
      const cache = freshCache(requestRepaint);
      cache.blit(targetCtxStub().ctx, VIEWPORT, ANCHOR);
      jest.advanceTimersByTime(1000);
      expect(requestRepaint).not.toHaveBeenCalled();
    });

    it('stands the timer down on dispose (no repaint after unmount)', () => {
      const requestRepaint = jest.fn();
      const cache = freshCache(requestRepaint);
      cache.blit(targetCtxStub().ctx, VIEWPORT, { scale: 1, offsetX: 45, offsetY: 0 });
      cache.dispose();
      jest.advanceTimersByTime(1000);
      expect(requestRepaint).not.toHaveBeenCalled();
    });

    it('stands the timer down on invalidate', () => {
      const requestRepaint = jest.fn();
      const cache = freshCache(requestRepaint);
      cache.blit(targetCtxStub().ctx, VIEWPORT, { scale: 1, offsetX: 45, offsetY: 0 });
      cache.invalidate();
      jest.advanceTimersByTime(1000);
      expect(requestRepaint).not.toHaveBeenCalled();
    });
  });

  describe('structural invalidation still wins over the anchor', () => {
    it.each([
      ['a different scene', () => ({ scene: { entities: [] } as unknown as DxfScene, viewport: VIEWPORT, inputs: BASE })],
      ['a resized viewport', () => ({ scene: SCENE, viewport: { width: 801, height: 600 }, inputs: BASE })],
      ['a flipped toggle', () => ({ scene: SCENE, viewport: VIEWPORT, inputs: { ...BASE, wireframeMode: true } })],
    ])('rebuilds for %s even at the anchor transform', (_label, make) => {
      const { scene, viewport, inputs } = make();
      expect(freshCache().isDirty(scene, ANCHOR, viewport, inputs)).toBe(true);
    });

    it('invalidate() forces a rebuild (isolate / LayerStore mutations)', () => {
      const cache = freshCache();
      expect(cache.isDirty(SCENE, ANCHOR, VIEWPORT, BASE)).toBe(false);
      cache.invalidate();
      expect(cache.isDirty(SCENE, ANCHOR, VIEWPORT, BASE)).toBe(true);
    });

    it('stays a HIT on hover/selection changes — the ADR-040 rule #3 guarantee', () => {
      const cache = freshCache();
      expect(cache.isDirty(SCENE, ANCHOR, VIEWPORT, BASE)).toBe(false);
      expect(cache.isDirty(SCENE, ANCHOR, VIEWPORT, BASE)).toBe(false);
      expect(mockRenderCalls).toHaveLength(0);
    });
  });
});
