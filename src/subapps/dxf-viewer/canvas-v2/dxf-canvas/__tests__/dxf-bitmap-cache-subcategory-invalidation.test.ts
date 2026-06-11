/**
 * ADR-377 Phase F — explicit ADR-040 bitmap-cache invalidation guarantee.
 *
 * The DXF bitmap cache (ADR-040 normal-state buffer) folds the BIM
 * `objectStyles` snapshot into its cache key via `bimSettingsHash`
 * (JSON.stringify of viewRange + objectStyles + opening-tag style, see
 * dxf-bitmap-cache.ts). Per-subcategory style overrides (ADR-377) live under
 * `objectStyles[cat].subcategories[key]`, so a subcategory pen/colour/pattern
 * change MUST bust the cache and force a one-shot full-scene rebuild.
 *
 * This test pins that contract end-to-end through the public `rebuild()` /
 * `isDirty()` API — it deliberately does NOT modify the ADR-040 source file.
 *
 * The offscreen canvas + entity renderer are stubbed (jsdom has no 2D context
 * and we are not exercising pixels here — only the cache-key invalidation).
 */

import { act } from '@testing-library/react';
import { DxfBitmapCache } from '../dxf-bitmap-cache';
import type { DxfScene } from '../dxf-types';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { DEFAULT_OBJECT_STYLES } from '../../../config/bim-object-styles';
import { DEFAULT_DRAWING_SCALE } from '../../../config/bim-render-settings-types';
import { DEFAULT_VIEW_RANGE } from '../../../config/bim-view-range';

// Entity renderer: irrelevant to cache-key invalidation — make rebuild() a no-op render.
jest.mock('../DxfRenderer', () => ({
  DxfRenderer: jest.fn().mockImplementation(() => ({ render: jest.fn() })),
}));

// Stable non-BIM cache-key inputs so the only moving part is objectStyles.
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

// Subcategory setters debounce-persist to Firestore — stub it out.
jest.mock('../../../services/bim-render-settings.service', () => ({
  saveBimRenderSettings: jest.fn().mockResolvedValue(undefined),
}));

const get = () => useBimRenderSettingsStore.getState();

const SCENE: DxfScene = { entities: [] } as unknown as DxfScene;
const TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const VIEWPORT: Viewport = { width: 800, height: 600 };
const BASE_OPTIONS = { showGrid: false, showLayerNames: false, wireframeMode: false };

let getContextSpy: jest.SpyInstance;

beforeAll(() => {
  // jsdom returns null for getContext('2d'); ensureOffscreen only needs setTransform.
  getContextSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ setTransform: jest.fn() } as unknown as CanvasRenderingContext2D);
});

afterAll(() => {
  getContextSpy.mockRestore();
});

beforeEach(() => {
  act(() => {
    useBimRenderSettingsStore.setState({
      drawingScale: DEFAULT_DRAWING_SCALE,
      viewRange: DEFAULT_VIEW_RANGE,
      objectStyles: JSON.parse(JSON.stringify(DEFAULT_OBJECT_STYLES)),
      rawSettings: null,
      currentLevelId: 'test-level',
    });
  });
});

/** Build a freshly-populated cache whose key reflects the current store state. */
function freshCache(): DxfBitmapCache {
  const cache = new DxfBitmapCache();
  cache.rebuild(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS);
  return cache;
}

describe('DxfBitmapCache — ADR-377 subcategory style invalidation (ADR-040)', () => {
  it('is clean immediately after rebuild with unchanged inputs', () => {
    const cache = freshCache();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);
  });

  it('invalidates when a subcategory style field is set', () => {
    const cache = freshCache();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);

    act(() => get().setSubcategoryStyleField('wall', 'common-edges', 'cutColor', '#ff0000'));

    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(true);
  });

  it('invalidates when a subcategory line pattern changes', () => {
    const cache = freshCache();
    act(() => get().setSubcategoryStyleField('beam', 'section-profile', 'linePattern', 'dashed'));
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(true);
  });

  it('invalidates again when a previously-set subcategory style is cleared', () => {
    act(() => get().setSubcategoryStyleField('wall', 'common-edges', 'cutColor', '#ff0000'));
    const cache = freshCache(); // key now embeds the override
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);

    act(() => get().clearSubcategoryStyle('wall', 'common-edges'));

    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(true);
  });

  it('does NOT invalidate when an unrelated, non-keyed input is unchanged (control)', () => {
    const cache = freshCache();
    // No store mutation → cache must stay valid (guards against over-invalidation).
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);
  });
});
