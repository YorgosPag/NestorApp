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

describe('ADR-687 Φ1 — per-material appearance override', () => {
  const appearance = { baseColorHex: '#ff8800', metalness: 0.9, roughness: 0.2 };
  function matAppear(
    id: string,
    category: string,
    ap: { baseColorHex: string; metalness: number; roughness: number } | null,
  ): BimMaterial {
    return { id, category, pbrTextures: null, appearance: ap } as unknown as BimMaterial;
  }

  it('appearance overrides the category def (colour + metalness + roughness)', () => {
    setUserMaterials([matAppear('bmat_o', 'concrete', appearance)]);
    const def = getUserMaterialAppearance('bmat_o')?.def;
    expect(def?.color).toBe(0xff8800); // user colour, NOT concrete 0xb0b0b0
    expect(def?.metalness).toBeCloseTo(0.9);
    expect(def?.roughness).toBeCloseTo(0.2);
  });

  it('falls back to the category def when appearance is null (back-compat)', () => {
    setUserMaterials([matAppear('bmat_c', 'concrete', null)]);
    expect(getUserMaterialAppearance('bmat_c')?.def.color).toBe(0xb0b0b0);
  });

  it('re-bumps the version + re-resolves when only the appearance changes', () => {
    setUserMaterials([matAppear('bmat_o', 'concrete', appearance)]);
    const v1 = getUserMaterialSetVersion('bmat_o');
    setUserMaterials([matAppear('bmat_o', 'concrete', { ...appearance, baseColorHex: '#00ff00' })]);
    expect(getUserMaterialSetVersion('bmat_o')).toBe(v1 + 1);
    expect(getUserMaterialAppearance('bmat_o')?.def.color).toBe(0x00ff00);
  });

  it('clamps out-of-range persisted metalness/roughness into 0..1', () => {
    setUserMaterials([matAppear('bmat_x', 'concrete', { baseColorHex: '#ffffff', metalness: 5, roughness: -3 })]);
    const def = getUserMaterialAppearance('bmat_x')?.def;
    expect(def?.metalness).toBe(1);
    expect(def?.roughness).toBe(0);
  });
});

describe('ADR-687 Φ4 — emissive + opacity override', () => {
  function matAp(id: string, ap: Record<string, unknown>): BimMaterial {
    return { id, category: 'concrete', pbrTextures: null, appearance: ap } as unknown as BimMaterial;
  }

  it('maps emissive colour + intensity into the def', () => {
    setUserMaterials([matAp('bmat_e', { baseColorHex: '#222222', metalness: 0, roughness: 0.5, emissiveHex: '#ff0000', emissiveIntensity: 0.8 })]);
    const def = getUserMaterialAppearance('bmat_e')?.def;
    expect(def?.emissive).toBe(0xff0000);
    expect(def?.emissiveIntensity).toBeCloseTo(0.8);
  });

  it('maps opacity < 1 into opacity + transparent', () => {
    setUserMaterials([matAp('bmat_t2', { baseColorHex: '#88ccff', metalness: 0, roughness: 0.1, opacity: 0.3 })]);
    const def = getUserMaterialAppearance('bmat_t2')?.def;
    expect(def?.opacity).toBeCloseTo(0.3);
    expect(def?.transparent).toBe(true);
  });

  it('defaults to opaque + no emissive when Φ4 fields are absent (back-compat with Φ1 docs)', () => {
    setUserMaterials([matAp('bmat_bc', { baseColorHex: '#ffffff', metalness: 0, roughness: 0.5 })]);
    const def = getUserMaterialAppearance('bmat_bc')?.def;
    expect(def?.opacity).toBe(1);
    expect(def?.transparent).toBe(false);
    expect(def?.emissive).toBe(0x000000);
    expect(def?.emissiveIntensity).toBe(0);
  });

  it('re-bumps the version when only opacity changes', () => {
    setUserMaterials([matAp('bmat_e2', { baseColorHex: '#222222', metalness: 0, roughness: 0.5, opacity: 1 })]);
    const v1 = getUserMaterialSetVersion('bmat_e2');
    setUserMaterials([matAp('bmat_e2', { baseColorHex: '#222222', metalness: 0, roughness: 0.5, opacity: 0.4 })]);
    expect(getUserMaterialSetVersion('bmat_e2')).toBe(v1 + 1);
    expect(getUserMaterialAppearance('bmat_e2')?.def.opacity).toBeCloseTo(0.4);
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
    albedoHash: null,
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
