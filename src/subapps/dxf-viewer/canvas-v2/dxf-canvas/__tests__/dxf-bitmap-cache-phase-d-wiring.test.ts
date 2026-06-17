/**
 * ADR-040 Phase D wiring (2026-06-11) — bitmap-cache key + invalidate() contract.
 *
 * The DXF normal-state entity layer is now served from DxfBitmapCache instead of
 * a full N-entity redraw every dirty frame (the FPS-0 / 1793ms-freeze cause).
 * This test pins the two additions that make the wiring correct:
 *
 *  1. The render toggles that reach the renderer via renderOptions (NOT a store
 *     the cache subscribes to) — wireframeMode / showLayerNames / showGrid — are
 *     part of the cache key, so flipping one busts the cache.
 *  2. invalidate() forces a rebuild for inputs read from stores at paint time
 *     (isolate alpha, LayerStore flags) that are deliberately kept out of the key.
 *
 * Pixels are not exercised (jsdom has no 2D context); only key invalidation.
 */

import { DxfBitmapCache, type BitmapCacheRenderInputs } from '../dxf-bitmap-cache';
import type { DxfScene } from '../dxf-types';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';

// Entity renderer is irrelevant to key invalidation — make render() a no-op.
jest.mock('../DxfRenderer', () => ({
  DxfRenderer: jest.fn().mockImplementation(() => ({ render: jest.fn() })),
}));

// Stable, non-moving cache-key inputs so the only variable is the toggle under test.
jest.mock('../../../systems/viewport/ViewportStore', () => ({
  getActiveScaleName: () => '1:50',
}));
jest.mock('../../../bim/services/opening-tag-style-service', () => ({
  getCurrentOpeningTagStyle: () => ({ enabled: false }),
}));
jest.mock('../../../systems/cursor/utils', () => ({
  getDevicePixelRatio: () => 1,
  toDevicePixels: (cssPixels: number) => cssPixels,
}));
jest.mock('../../../state/bim-render-settings-store', () => ({
  useBimRenderSettingsStore: {
    getState: () => ({ drawingScale: 50, viewRange: {}, objectStyles: {} }),
  },
}));

const SCENE: DxfScene = { entities: [] } as unknown as DxfScene;
const TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const VIEWPORT: Viewport = { width: 800, height: 600 };
const BASE: BitmapCacheRenderInputs = { showGrid: false, showLayerNames: false, wireframeMode: false };

let getContextSpy: jest.SpyInstance;

beforeAll(() => {
  getContextSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    // Cast to the full getContext return union (includes GPUCanvasContext via @webgpu/types overload).
    .mockReturnValue({ setTransform: jest.fn() } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
});

afterAll(() => getContextSpy.mockRestore());

function freshCache(inputs: BitmapCacheRenderInputs = BASE): DxfBitmapCache {
  const cache = new DxfBitmapCache();
  cache.rebuild(SCENE, TRANSFORM, VIEWPORT, inputs);
  return cache;
}

describe('DxfBitmapCache — ADR-040 Phase D wiring', () => {
  it('is clean immediately after rebuild with unchanged inputs', () => {
    const cache = freshCache();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE)).toBe(false);
  });

  it('busts the cache when wireframeMode flips', () => {
    const cache = freshCache();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, { ...BASE, wireframeMode: true })).toBe(true);
  });

  it('busts the cache when showLayerNames flips', () => {
    const cache = freshCache();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, { ...BASE, showLayerNames: true })).toBe(true);
  });

  it('busts the cache when showGrid flips', () => {
    const cache = freshCache();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, { ...BASE, showGrid: true })).toBe(true);
  });

  it('treats hover/selection (same scene+transform+toggles) as a cache HIT — the FPS-0 fix', () => {
    const cache = freshCache();
    // A hover change does not touch scene/transform/toggles → no rebuild, just a blit.
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE)).toBe(false);
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE)).toBe(false);
  });

  it('invalidate() forces a rebuild (isolate / LayerStore mutations)', () => {
    const cache = freshCache();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE)).toBe(false);
    cache.invalidate();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE)).toBe(true);
  });
});
