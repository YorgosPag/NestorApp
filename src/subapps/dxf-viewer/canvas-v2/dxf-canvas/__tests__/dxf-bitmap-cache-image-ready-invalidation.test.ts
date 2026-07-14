/**
 * ADR-654 / ADR-040 — «η εικόνα δεν φαίνεται μέχρι να κάνεις ανανέωση» (bug 1).
 *
 * Regression pin: μια raster εικόνα (entourage sprite / furniture-plan sprite / hatch image-fill)
 * αποκωδικοποιείται ΑΣΥΓΧΡΟΝΑ. Το πρώτο paint είναι ΠΑΝΤΑ placeholder· όταν ολοκληρωθεί το
 * `img.decode()` το `HatchImageCache` καλούσε ΜΟΝΟ `markAllCanvasDirty()` → νέο frame μεν, αλλά ο
 * `DxfBitmapCache` ήταν **HIT** (scene ref / transform / viewport / DPR αμετάβλητα) → ξανα-blit
 * του ΠΑΛΙΟΥ bitmap με το placeholder. Η εικόνα εμφανιζόταν μόνο μετά από pan/zoom/refresh.
 *
 * Το συμβόλαιο που κλειδώνει εδώ (ίδιο με το ADR-530 `subscribeFontReady`):
 *   1. κάθε επιτυχές decode εκπέμπει το `subscribeImageAssetReady` σήμα, ΚΑΙ
 *   2. το σήμα ΑΚΥΡΩΝΕΙ τον bitmap cache — «dirty» ΜΟΝΟ του δεν αρκεί, γιατί το key δεν άλλαξε.
 */

import { DxfBitmapCache } from '../dxf-bitmap-cache';
import type { DxfScene } from '../dxf-types';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';
import {
  HatchImageCache,
  subscribeImageAssetReady,
} from '../../../rendering/entities/shared/hatch-image-cache';

// Entity renderer: άσχετος με το cache-key invalidation — rebuild() = no-op render.
jest.mock('../DxfRenderer', () => ({
  DxfRenderer: jest.fn().mockImplementation(() => ({ render: jest.fn() })),
}));
// Σταθερά non-BIM cache-key inputs → το ΜΟΝΟ κινούμενο μέρος είναι το asset-ready σήμα.
jest.mock('../../../systems/viewport/ViewportStore', () => ({ getActiveScaleName: () => '1:50' }));
jest.mock('../../../bim/services/opening-tag-style-service', () => ({
  getCurrentOpeningTagStyle: () => ({ enabled: false }),
}));
jest.mock('../../../systems/cursor/utils', () => ({
  getDevicePixelRatio: () => 1,
  toDevicePixels: (cssPixels: number) => cssPixels,
}));

const SCENE: DxfScene = { entities: [] } as unknown as DxfScene;
const TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const VIEWPORT: Viewport = { width: 800, height: 600 };
const BASE_OPTIONS = { showGrid: false, showLayerNames: false, wireframeMode: false };

let getContextSpy: jest.SpyInstance;

beforeAll(() => {
  getContextSpy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ setTransform: jest.fn() } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
  // jsdom δεν υλοποιεί `HTMLImageElement.decode()` — το decode εδώ πετυχαίνει αμέσως.
  (HTMLImageElement.prototype as unknown as { decode: () => Promise<void> }).decode = () =>
    Promise.resolve();
});

afterAll(() => {
  getContextSpy.mockRestore();
});

/** Αφήνει το ουρά microtask του `load()` (resolveSrc → decode → set → notify) να τρέξει. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('ADR-654 — asset-ready σήμα σε κάθε επιτυχές decode', () => {
  it('το πρώτο resolve() είναι placeholder (null) και εκπέμπει το σήμα όταν φορτώσει', async () => {
    const onLoad = jest.fn();
    const listener = jest.fn();
    const unsubscribe = subscribeImageAssetReady(listener);
    const cache = new HatchImageCache(onLoad, async (url) => url);

    expect(cache.resolve('https://example.test/sprite.webp')).toBeNull(); // → placeholder
    expect(listener).not.toHaveBeenCalled();

    await flush();

    expect(onLoad).toHaveBeenCalledTimes(1);      // markAllCanvasDirty (νέο frame)
    expect(listener).toHaveBeenCalledTimes(1);    // ΚΑΙ invalidate (νέο bitmap) — αυτό έλειπε
    expect(cache.resolve('https://example.test/sprite.webp')).not.toBeNull(); // cache hit
    expect(listener).toHaveBeenCalledTimes(1);    // ΟΧΙ per-frame θόρυβος (ADR-040)
    unsubscribe();
  });
});

describe('ADR-654 — το asset-ready σήμα ακυρώνει τον DxfBitmapCache', () => {
  it('χωρίς invalidate ο cache είναι HIT παρότι έφτασε η εικόνα (η ρίζα του bug)', () => {
    const cache = new DxfBitmapCache();
    cache.rebuild(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS);
    // Τίποτα στο key δεν αλλάζει όταν προσγειώνεται μια εικόνα → ξανα-blit του placeholder.
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);
  });

  it('το invalidate() που τρέχει ο subscriber ξαναχτίζει το entity layer', async () => {
    const cache = new DxfBitmapCache();
    cache.rebuild(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS);
    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(false);

    // Ό,τι ακριβώς κάνει το `useDxfCanvasCacheInvalidation` στο σήμα.
    const unsubscribe = subscribeImageAssetReady(() => cache.invalidate());
    const imageCache = new HatchImageCache(jest.fn(), async (url) => url);
    imageCache.resolve('https://example.test/other-sprite.webp');
    await flush();

    expect(cache.isDirty(SCENE, TRANSFORM, VIEWPORT, BASE_OPTIONS)).toBe(true);
    unsubscribe();
  });
});
