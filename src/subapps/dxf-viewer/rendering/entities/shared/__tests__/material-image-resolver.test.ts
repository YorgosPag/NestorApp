/**
 * ADR-643 Φ2 — Material image resolver unit tests.
 * Verifies catalog id → texture URL (via ADR-413 resolveTextureUrl) and the
 * null-for-unknown contract that lets HatchImageCache fall back to the raw assetId.
 */

// Mock the ADR-413 texture-source SSoT so the test never touches Firebase.
jest.mock('../../../../bim-3d/materials/texture-source', () => ({
  resolveTextureUrl: (slug: string, map: string): Promise<string | null> =>
    Promise.resolve(`/textures/${slug}/${map}.jpg`),
}));

import { resolveMaterialImageSrc } from '../material-image-resolver';

describe('resolveMaterialImageSrc() (ADR-643 Φ2)', () => {
  it('resolves a builtin catalog id to its texture slug albedo URL', async () => {
    await expect(resolveMaterialImageSrc('matimg-ceramic-tile')).resolves.toBe('/textures/tile/albedo.jpg');
  });

  it('resolves marble to the shared stone texture (façade over ADR-413)', async () => {
    await expect(resolveMaterialImageSrc('matimg-marble')).resolves.toBe('/textures/stone/albedo.jpg');
  });

  it('returns null for unknown ids so the cache falls back to the raw assetId', async () => {
    await expect(resolveMaterialImageSrc('https://example.com/tile.jpg')).resolves.toBeNull();
    await expect(resolveMaterialImageSrc('mat_img_userupload_xyz')).resolves.toBeNull();
  });
});
