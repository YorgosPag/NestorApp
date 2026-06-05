/**
 * MaterialCatalog3D — user-material (bmat_*) resolution tests (ADR-413 §2D Phase 3).
 *
 * Guards the core gap-closing behaviour: a `bim_materials` library material no
 * longer COLLAPSES to concrete (the pre-Phase-3 bug). It renders flat by its
 * category colour (and, when textures are uploaded + loaded, textured — covered by
 * the registry spec). Uses REAL three (like the system-tint spec) + the real
 * registry fed via `setUserMaterials`; the no-texture paths never hit the loader.
 */

import { getMaterial3D, disposeMaterialCatalog3D } from '../MaterialCatalog3D';
import {
  setUserMaterials,
  __resetUserMaterialRegistryForTests,
} from '../user-material-registry';
import type { BimMaterial } from '../../../bim/types/bim-material-types';

function mat(id: string, category: string): BimMaterial {
  return { id, category, pbrTextures: null } as unknown as BimMaterial;
}

afterEach(() => {
  __resetUserMaterialRegistryForTests();
  disposeMaterialCatalog3D();
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
