/**
 * ADR-909 Γ1β — `preloadCaptureAssets` / `captureAssetFidelity`: **ΚΑΙ ΤΑ ΔΥΟ** είδη πόρων, στο ΕΝΑ σημείο.
 *
 * Οι δύο raster λήψεις (raster PDF, δημόσια κάτοψη) καλούν αυτά τα δύο. Αν το ένα είδος πόρου λείψει από εδώ,
 * λείπει και από τις δύο λήψεις — σιωπηλά: οι εικόνες φορτώνουν, τα έπιπλα βγαίνουν κουτιά, και κανένα test
 * των καλούντων δεν το βλέπει (μιμούνται ολόκληρο το `capture-2d`).
 */

import type { SceneModel } from '../../../types/entities';

const preloadImages = jest.fn();
const preloadMeshes = jest.fn();
const missingImages = jest.fn();
const missingMeshes = jest.fn();
const convert = jest.fn();

jest.mock('../preload-scene-images', () => ({
  __esModule: true,
  preloadSceneImages: (...args: unknown[]) => preloadImages(...args),
  missingSceneImageWarnings: (...args: unknown[]) => missingImages(...args),
}));

jest.mock('../preload-scene-meshes', () => ({
  __esModule: true,
  preloadSceneMeshes: (...args: unknown[]) => preloadMeshes(...args),
  missingSceneMeshWarnings: (...args: unknown[]) => missingMeshes(...args),
}));

jest.mock('../../../hooks/canvas/useDxfSceneConversion', () => ({
  __esModule: true,
  convertSceneToDxf: (...args: unknown[]) => convert(...args),
}));

import { preloadCaptureAssets } from '../capture-2d';
import { captureAssetFidelity } from '../capture-asset-fidelity';

const SOURCE = { entities: [] } as unknown as SceneModel;
const CONVERTED = [{ id: 'c1', type: 'furniture' }];

beforeEach(() => {
  jest.clearAllMocks();
  convert.mockReturnValue({ entities: CONVERTED });
  preloadImages.mockResolvedValue(undefined);
  preloadMeshes.mockResolvedValue(undefined);
  missingImages.mockReturnValue([]);
  missingMeshes.mockReturnValue([]);
});

describe('preloadCaptureAssets (ADR-909 Β2.6 · Γ1β)', () => {
  it('Ο1 🔴 φέρνει ΚΑΙ εικόνες ΚΑΙ σχήματα 3Δ, πάνω στην ΙΔΙΑ μετατραπείσα σκηνή', async () => {
    await preloadCaptureAssets(SOURCE, 'grayscale', 'mm');

    expect(convert).toHaveBeenCalledWith(SOURCE, 'mm');
    expect(preloadImages).toHaveBeenCalledWith(CONVERTED, 'grayscale');
    expect(preloadMeshes).toHaveBeenCalledWith(CONVERTED);
  });

  it('Ο2 περιμένει ΚΑΙ τα δύο πριν επιστρέψει', async () => {
    let releaseMeshes: () => void = () => undefined;
    preloadMeshes.mockReturnValue(new Promise<void>((resolve) => { releaseMeshes = resolve; }));
    let done = false;
    const pending = preloadCaptureAssets(SOURCE, 'monochrome').then(() => { done = true; });

    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(done).toBe(false);

    releaseMeshes();
    await pending;
    expect(done).toBe(true);
  });
});

describe('captureAssetFidelity (ADR-909 Γ1β)', () => {
  it('Ο3 🔴 ενώνει τις απώλειες των δύο ειδών σε σημειώσεις με πλήθος', () => {
    missingImages.mockReturnValue(['image-fill:decode-failed']);
    missingMeshes.mockReturnValue(['mesh:not-loaded', 'mesh:not-loaded']);

    expect(captureAssetFidelity(CONVERTED, 'colour')).toStrictEqual([
      { code: 'hatch-image-solid', count: 1 },
      { code: 'mesh-shape-missing', count: 2 },
    ]);
    expect(missingImages).toHaveBeenCalledWith(CONVERTED, 'colour');
    expect(missingMeshes).toHaveBeenCalledWith(CONVERTED);
  });

  it('Ο4 τίποτα δεν λείπει ⇒ καμία σημείωση', () => {
    expect(captureAssetFidelity(CONVERTED, 'monochrome')).toStrictEqual([]);
  });
});
