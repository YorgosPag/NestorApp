/**
 * userMaterialRegistry tests (ADR-413 §2D Phase 3).
 *
 * Covers the reactive feed (category → flat def + textures), change-versioning,
 * the shared resync bump, the async per-material texture load, and the Revit-grade
 * teardown (dispose GPU textures on texture change / material removal).
 *
 * `three` is mocked so we can track texture instances + dispose without a GL
 * context; the entities store is REAL so we assert the resync bump end-to-end.
 */

// ── three mock (trackable fake textures) ─────────────────────────────────────
jest.mock('three', () => {
  (globalThis as unknown as { __createdTextures: unknown[] }).__createdTextures = [];
  class FakeTexture {
    dispose = jest.fn();
    repeat = { set: jest.fn() };
    wrapS = 0;
    wrapT = 0;
    anisotropy = 0;
    colorSpace = '';
    needsUpdate = false;
  }
  return {
    RepeatWrapping: 'repeat',
    SRGBColorSpace: 'srgb',
    NoColorSpace: 'none',
    TextureLoader: class {
      loadAsync = jest.fn(async () => {
        const tex = new FakeTexture();
        (globalThis as unknown as { __createdTextures: unknown[] }).__createdTextures.push(tex);
        return tex;
      });
    },
  };
});

import {
  setUserMaterials,
  getUserMaterialAppearance,
  getUserMaterialTextureSet,
  getUserMaterialSetVersion,
  preloadUserMaterialTextures,
  __resetUserMaterialRegistryForTests,
} from '../user-material-registry';
import { useBim3DEntitiesStore } from '../../stores/Bim3DEntitiesStore';
import type { BimMaterial, PbrMaterialTextures } from '../../../bim/types/bim-material-types';

function mat(id: string, category: string, pbrTextures: PbrMaterialTextures | null = null): BimMaterial {
  return { id, category, pbrTextures } as unknown as BimMaterial;
}

function createdTextures(): Array<{ dispose: jest.Mock }> {
  return (globalThis as unknown as { __createdTextures: Array<{ dispose: jest.Mock }> }).__createdTextures;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  __resetUserMaterialRegistryForTests();
  createdTextures().length = 0;
});

describe('setUserMaterials — appearance resolution', () => {
  it('resolves a flat def by category + carries the textures field', () => {
    setUserMaterials([mat('bmat_a', 'concrete', null)]);
    const ap = getUserMaterialAppearance('bmat_a');
    expect(ap?.def.color).toBe(0xb0b0b0); // concrete
    expect(ap?.textures).toBeNull();
  });

  it('maps category → colour (door-frame → wood, masonry → brick)', () => {
    setUserMaterials([mat('bmat_w', 'door-frame', null), mat('bmat_b', 'masonry', null)]);
    expect(getUserMaterialAppearance('bmat_w')?.def.color).toBe(0x8b5e3c); // wood
    expect(getUserMaterialAppearance('bmat_b')?.def.color).toBe(0xb05030); // brick
  });

  it('returns null for an unknown id', () => {
    expect(getUserMaterialAppearance('bmat_unknown')).toBeNull();
  });
});

describe('change-versioning + resync bump', () => {
  it('bumps version + resync on change, but NOT on an unchanged snapshot', () => {
    const v0 = useBim3DEntitiesStore.getState().textureAssetVersion;
    setUserMaterials([mat('bmat_a', 'concrete', null)]);
    const ver1 = getUserMaterialSetVersion('bmat_a');
    expect(useBim3DEntitiesStore.getState().textureAssetVersion).toBe(v0 + 1);

    setUserMaterials([mat('bmat_a', 'concrete', null)]); // identical → no-op
    expect(getUserMaterialSetVersion('bmat_a')).toBe(ver1);
    expect(useBim3DEntitiesStore.getState().textureAssetVersion).toBe(v0 + 1);

    setUserMaterials([mat('bmat_a', 'masonry', null)]); // category changed
    expect(getUserMaterialSetVersion('bmat_a')).toBe(ver1 + 1);
    expect(useBim3DEntitiesStore.getState().textureAssetVersion).toBe(v0 + 2);
  });
});

describe('texture load + teardown', () => {
  const tex: PbrMaterialTextures = {
    albedoUrl: 'https://x/albedo.jpg', normalUrl: null, roughnessUrl: null, aoUrl: null, tileSizeM: 1,
  };

  it('loads only the present maps and exposes the set', async () => {
    setUserMaterials([mat('bmat_t', 'concrete', tex)]);
    preloadUserMaterialTextures('bmat_t');
    await flush();
    expect(getUserMaterialTextureSet('bmat_t')).not.toBeNull();
    expect(createdTextures().length).toBe(1); // albedo only (others null)
  });

  it('disposes the stale set when the texture URLs change', async () => {
    setUserMaterials([mat('bmat_t', 'concrete', tex)]);
    preloadUserMaterialTextures('bmat_t');
    await flush();
    const [albedoTex] = createdTextures();

    setUserMaterials([mat('bmat_t', 'concrete', { ...tex, albedoUrl: 'https://x/albedo2.jpg' })]);
    expect(albedoTex.dispose).toHaveBeenCalled();
    expect(getUserMaterialTextureSet('bmat_t')).toBeNull();
  });

  it('disposes + drops the appearance when the material is removed', async () => {
    setUserMaterials([mat('bmat_t', 'concrete', tex)]);
    preloadUserMaterialTextures('bmat_t');
    await flush();
    const [albedoTex] = createdTextures();

    setUserMaterials([]); // removed
    expect(getUserMaterialAppearance('bmat_t')).toBeNull();
    expect(albedoTex.dispose).toHaveBeenCalled();
  });

  it('no-ops preload when there is no albedo', async () => {
    setUserMaterials([mat('bmat_n', 'concrete', null)]);
    preloadUserMaterialTextures('bmat_n');
    await flush();
    expect(getUserMaterialTextureSet('bmat_n')).toBeNull();
    expect(createdTextures().length).toBe(0);
  });
});
