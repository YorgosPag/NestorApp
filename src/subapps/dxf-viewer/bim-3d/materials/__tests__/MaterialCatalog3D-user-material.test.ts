/**
 * MaterialCatalog3D — user-material (bmat_*) resolution tests (ADR-413 §2D Phase 3).
 *
 * Guards the core gap-closing behaviour: a `bim_materials` library material no
 * longer COLLAPSES to concrete (the pre-Phase-3 bug). It renders flat by its
 * category colour (and, when textures are uploaded + loaded, textured — covered by
 * the registry spec). Uses REAL three (like the system-tint spec) + the real
 * registry fed via `setUserMaterials`; the no-texture paths never hit the loader.
 */

import * as THREE from 'three';
import { getMaterial3D, disposeMaterialCatalog3D, withAccurateGlassForExport } from '../MaterialCatalog3D';
import {
  setUserMaterials,
  __resetUserMaterialRegistryForTests,
} from '../user-material-registry';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import type { BimMaterial } from '../../../bim/types/bim-material-types';

function mat(id: string, category: string): BimMaterial {
  return { id, category, pbrTextures: null } as unknown as BimMaterial;
}

/** A library material carrying a real glass appearance (transmission > 0). */
function glassMat(id: string): BimMaterial {
  return {
    id,
    category: 'other',
    pbrTextures: null,
    appearance: { baseColorHex: '#66ccff', metalness: 0, roughness: 0, transmission: 1, ior: 1.5, thickness: 2 },
  } as unknown as BimMaterial;
}

afterEach(() => {
  __resetUserMaterialRegistryForTests();
  disposeMaterialCatalog3D();
  useBimRenderSettingsStore.getState().setGlassQuality('light'); // restore the performance-first default
});

describe('getMaterial3D for bmat_ library materials', () => {
  it('renders flat by the material category colour (no textures)', () => {
    setUserMaterials([mat('bmat_a', 'concrete')]);
    expect(getMaterial3D('bmat_a').color.getHex()).toBe(0xb0b0b0); // concrete
  });

  it('does NOT collapse a non-concrete category to concrete (the Phase-3 fix)', () => {
    setUserMaterials([mat('bmat_brick', 'masonry'), mat('bmat_wood', 'door-frame')]);
    expect(getMaterial3D('bmat_brick').color.getHex()).toBe(0xb05030); // brick, not concrete
    expect(getMaterial3D('bmat_wood').color.getHex()).toBe(0x8b5e3c);  // wood
  });

  it('falls back to default concrete when the registry has no such id', () => {
    expect(getMaterial3D('bmat_missing').color.getHex()).toBe(0xb0b0b0);
  });

  it('rebuilds a fresh material instance after a category change', () => {
    setUserMaterials([mat('bmat_x', 'concrete')]);
    const before = getMaterial3D('bmat_x');
    setUserMaterials([mat('bmat_x', 'masonry')]);
    const after = getMaterial3D('bmat_x');
    expect(after).not.toBe(before);
    expect(after.color.getHex()).toBe(0xb05030);
  });
});

describe('getMaterial3D — ADR-687 Φ9 glass quality (viewport light vs export accurate)', () => {
  beforeEach(() => {
    useBimRenderSettingsStore.getState().setGlassQuality('light');
  });

  it('renders glass as opacity (no transmission, cheap Standard) under the light viewport default', () => {
    setUserMaterials([glassMat('bmat_glass')]);
    const m = getMaterial3D('bmat_glass') as THREE.MeshPhysicalMaterial;
    expect(m.type).toBe('MeshStandardMaterial');
    expect(m.transmission ?? 0).toBe(0);
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBeLessThan(1);
  });

  it('forces full transmission for the export build (withAccurateGlassForExport)', () => {
    setUserMaterials([glassMat('bmat_glass')]);
    const exported = withAccurateGlassForExport(() => getMaterial3D('bmat_glass')) as THREE.MeshPhysicalMaterial;
    expect(exported.type).toBe('MeshPhysicalMaterial');
    expect(exported.transmission).toBeGreaterThan(0);
  });

  it('does NOT corrupt the live (light) cache when an export build runs in between', () => {
    setUserMaterials([glassMat('bmat_glass')]);
    const live1 = getMaterial3D('bmat_glass');
    withAccurateGlassForExport(() => getMaterial3D('bmat_glass')); // export bypasses + never touches the cache
    const live2 = getMaterial3D('bmat_glass');
    expect(live2).toBe(live1); // same cached light instance — the export never disposed/overwrote it
    expect((live2 as THREE.MeshPhysicalMaterial).transmission ?? 0).toBe(0);
  });

  it('rebuilds to full transmission when the viewport flips to accurate', () => {
    setUserMaterials([glassMat('bmat_glass')]);
    const light = getMaterial3D('bmat_glass');
    useBimRenderSettingsStore.getState().setGlassQuality('accurate');
    const accurate = getMaterial3D('bmat_glass') as THREE.MeshPhysicalMaterial;
    expect(accurate).not.toBe(light);
    expect(accurate.transmission).toBeGreaterThan(0);
  });
});
