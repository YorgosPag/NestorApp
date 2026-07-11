/**
 * ADR-375 / ADR-040 — «DXF Σχέδιο» V/G row bitmap-cache invalidation guarantee.
 *
 * The DXF bitmap cache (ADR-040 normal-state buffer) folds the per-view
 * `dxfImport` override (visibility + colour + lineweight for every raw DXF
 * entity) into its cache key via `bimSettingsHash` (JSON.stringify, see
 * dxf-bitmap-cache.ts). The «DXF Σχέδιο» overrides are baked into the cached
 * normal-state pixels (DxfRenderer.isEntityLayerSkipped + resolveStyleForRender),
 * so toggling visibility, recolouring, or reweighting the imported drawing MUST
 * bust the cache and force a one-shot full-scene rebuild.
 *
 * Regression pin for the 2026-07-11 bug: the toggle marked the canvas dirty
 * (dxf-canvas-renderer subscribes to the whole store) but the bitmap key did
 * NOT include `dxfImport`, so the stale bitmap was re-blitted and the DXF stayed
 * visible on screen.
 *
 * Mirrors dxf-bitmap-cache-subcategory-invalidation.test.ts — it pins the
 * contract end-to-end through the public `rebuild()` / `isDirty()` API and does
 * NOT modify the ADR-040 source file. The offscreen canvas + entity renderer are
 * stubbed (jsdom has no 2D context; we exercise only cache-key invalidation).
 */

import { act } from '@testing-library/react';
import { DxfBitmapCache } from '../dxf-bitmap-cache';
import type { DxfScene } from '../dxf-types';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { DEFAULT_OBJECT_STYLES } from '../../../config/bim-object-styles';
import {
  DEFAULT_DRAWING_SCALE,
  DEFAULT_DXF_IMPORT_STYLE,
} from '../../../config/bim-render-settings-types';
import { DEFAULT_VIEW_RANGE } from '../../../config/bim-view-range';

// Entity renderer: irrelevant to cache-key invalidation — make rebuild() a no-op render.
jest.mock('../DxfRenderer', () => ({
  DxfRenderer: jest.fn().mockImplementation(() => ({ render: jest.fn() })),
}));

// Stable non-BIM cache-key inputs so the only moving part is dxfImport.
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

// dxfImport setters debounce-persist to Firestore — stub it out.
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
    .mockReturnValue({ setTransform: jest.fn() } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
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
      dxfImport: { ...DEFAULT_DXF_IMPORT_STYLE },
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

describe('DxfBitmapCache — ADR-375 «DXF Σχέδιο» dxfImport invalidation (ADR-040)', () => {
  it('is clean immediately after rebuild with unchanged inputs', () => {
    const cache = freshCache();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);
  });

  it('invalidates when DXF visibility is toggled off (the reported bug)', () => {
    const cache = freshCache();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);

    act(() => get().setDxfImportVisibility(false));

    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(true);
  });

  it('invalidates when a colour override is applied', () => {
    const cache = freshCache();
    act(() => get().setDxfImportColor('#ff0000'));
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(true);
  });

  it('invalidates when a lineweight override is applied', () => {
    const cache = freshCache();
    act(() => get().setDxfImportLineweight(0.35));
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(true);
  });

  it('invalidates again when visibility is toggled back on from off', () => {
    act(() => get().setDxfImportVisibility(false));
    const cache = freshCache(); // key now embeds visible:false
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);

    act(() => get().setDxfImportVisibility(true));

    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(true);
  });

  it('invalidates again when a colour override is cleared back to default', () => {
    act(() => get().setDxfImportColor('#00ff00'));
    const cache = freshCache(); // key now embeds the colour override
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);

    act(() => get().setDxfImportColor(null));

    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(true);
  });

  it('does NOT invalidate when dxfImport is unchanged (control — no over-invalidation)', () => {
    const cache = freshCache();
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);
  });
});
