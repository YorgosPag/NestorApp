/**
 * ADR-643 Φ2 + Φ4 — Material image resolver unit tests.
 * Verifies user-upload priority (Φ4), catalog id → texture URL (via ADR-413
 * resolveTextureUrl), and the null-for-unknown contract that lets HatchImageCache
 * fall back to the raw assetId.
 */

// Mock the ADR-413 texture-source SSoT so the test never touches Firebase.
jest.mock('../../../../bim-3d/materials/texture-source', () => ({
  resolveTextureUrl: (slug: string, map: string): Promise<string | null> =>
    Promise.resolve(`/textures/${slug}/${map}.jpg`),
}));

import { resolveMaterialImageSrc } from '../material-image-resolver';
import {
  registerUserMaterialImage,
  __resetUserMaterialImageStoreForTests,
} from '../user-material-image-store';

describe('resolveMaterialImageSrc() (ADR-643 Φ2)', () => {
  afterEach(() => __resetUserMaterialImageStoreForTests());

  it('resolves a builtin catalog id to its texture slug albedo URL', async () => {
    await expect(resolveMaterialImageSrc('matimg-ceramic-tile')).resolves.toBe('/textures/tile/albedo.jpg');
  });

  it('resolves marble to the shared stone texture (façade over ADR-413)', async () => {
    await expect(resolveMaterialImageSrc('matimg-marble')).resolves.toBe('/textures/stone/albedo.jpg');
  });

  it('returns null for unknown ids so the cache falls back to the raw assetId', async () => {
    await expect(resolveMaterialImageSrc('https://example.com/tile.jpg')).resolves.toBeNull();
    await expect(resolveMaterialImageSrc('bmat_userupload_xyz')).resolves.toBeNull();
  });
});

describe('resolveMaterialImageSrc() user uploads (ADR-643 Φ4)', () => {
  afterEach(() => __resetUserMaterialImageStoreForTests());

  it('resolves a registered user upload to its stored download URL', async () => {
    registerUserMaterialImage('bmat_abc', 'https://storage.example/img.jpg');
    await expect(resolveMaterialImageSrc('bmat_abc')).resolves.toBe('https://storage.example/img.jpg');
  });

  it('prefers the user upload over the builtin catalog when ids collide', async () => {
    registerUserMaterialImage('matimg-marble', 'https://storage.example/custom.jpg');
    await expect(resolveMaterialImageSrc('matimg-marble')).resolves.toBe('https://storage.example/custom.jpg');
  });

  it('falls back to null once the user upload is cleared', async () => {
    registerUserMaterialImage('bmat_abc', 'https://storage.example/img.jpg');
    __resetUserMaterialImageStoreForTests();
    await expect(resolveMaterialImageSrc('bmat_abc')).resolves.toBeNull();
  });
});
