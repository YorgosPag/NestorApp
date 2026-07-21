/**
 * ADR-678 Βήμα 3 — texture upload ξένων υφών. Καλύπτει τα τρία pure κομμάτια του chain:
 *  1. parser: `<library_images>` → `texturesByMaterialName` (surface→sampler→image chain).
 *  2. `withImportedMaterials`: επαύξηση resolver με τα νέα `bmat_*` (imported wins, id-first base).
 *  3. `importForeignTextures`: content-hash dedup (cross-session + within-import), create, skip.
 *
 * Ο service τεστάρεται με **injected** deps (μηδέν Firebase) — το DI σχήμα το επιτρέπει by design.
 */

import { parseColladaScene } from '../dae-material-parse';
import { buildKnownMaterialResolver, withImportedMaterials } from '../known-import-materials';
import { importForeignTextures, type ForeignTextureImporterDeps } from '../import-foreign-textures';
import type { BimMaterial, SaveBimMaterialInput } from '../../../bim/types/bim-material-types';

// ── 1. parser: textured effect → filename ─────────────────────────────────────

/** Ελάχιστο textured COLLADA 1.4.1 με την τυπική surface→sampler→image αλυσίδα. */
function texturedDae(materialName: string, imageUri: string): string {
  return `<?xml version="1.0"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <library_images>
    <image id="img-1"><init_from>${imageUri}</init_from></image>
  </library_images>
  <library_effects>
    <effect id="eff-1"><profile_COMMON>
      <newparam sid="surf-1"><surface type="2D"><init_from>img-1</init_from></surface></newparam>
      <newparam sid="samp-1"><sampler2D><source>surf-1</source></sampler2D></newparam>
      <technique sid="COMMON"><blinn>
        <diffuse><texture texture="samp-1" texcoord="UVSET0"/></diffuse>
      </blinn></technique>
    </profile_COMMON></effect>
  </library_effects>
  <library_materials>
    <material id="mat-1" name="${materialName}"><instance_effect url="#eff-1"/></material>
  </library_materials>
  <library_visual_scenes><visual_scene id="scene">
    <node name="Column_col-7"><instance_geometry url="#g"><bind_material><technique_common>
      <instance_material symbol="sym_0" target="#mat-1"/>
    </technique_common></bind_material></instance_geometry></node>
  </visual_scene></library_visual_scenes>
</COLLADA>`;
}

describe('parseColladaScene — texturesByMaterialName (ADR-678 Βήμα 3)', () => {
  it('εξάγει το basename της υφής ανά όνομα υλικού (chain surface→sampler→image)', () => {
    const scene = parseColladaScene(texturedDae('Ξερό-bark-21', 'textures/Ξερό-bark-21.jpg'));
    expect(scene.texturesByMaterialName.get('Ξερό-bark-21')).toBe('Ξερό-bark-21.jpg');
  });

  it('καθαρίζει file:// prefix και backslashes → μόνο basename', () => {
    const scene = parseColladaScene(texturedDae('bamboo', 'file:///C:/tex/bamboo.png'));
    expect(scene.texturesByMaterialName.get('bamboo')).toBe('bamboo.png');
  });

  it('flat υλικό (χωρίς texture) → κανένα texture entry', () => {
    const flat = `<?xml version="1.0"?><COLLADA version="1.4.1">
      <library_effects><effect id="e"><profile_COMMON><technique sid="COMMON"><blinn>
        <diffuse><color>0.5 0.2 0.2 1</color></diffuse></blinn></technique></profile_COMMON></effect></library_effects>
      <library_materials><material id="m" name="paint"><instance_effect url="#e"/></material></library_materials>
      <library_visual_scenes><visual_scene><node name="Column_col-7"><instance_geometry url="#g">
        <bind_material><technique_common><instance_material symbol="sym_0" target="#m"/>
        </technique_common></bind_material></instance_geometry></node></visual_scene></library_visual_scenes>
    </COLLADA>`;
    const scene = parseColladaScene(flat);
    expect(scene.texturesByMaterialName.size).toBe(0);
  });
});

// ── 2. withImportedMaterials ──────────────────────────────────────────────────

describe('withImportedMaterials (ADR-678 Βήμα 3)', () => {
  it('imported όνομα → νέο bmat_*, ενώ ο base μένει για τα υπόλοιπα', () => {
    const base = buildKnownMaterialResolver();
    const augmented = withImportedMaterials(base, new Map([['Ξερό-bark-21', 'bmat_new_1']]));
    expect(augmented('Ξερό-bark-21')).toBe('bmat_new_1');
    expect(augmented('unknown-material')).toBeNull();
  });

  it('άδειο imported → επιστρέφει τον base αυτούσιο (ίδια αναφορά)', () => {
    const base = buildKnownMaterialResolver();
    expect(withImportedMaterials(base, new Map())).toBe(base);
  });
});

// ── 3. importForeignTextures (DI, μηδέν Firebase) ─────────────────────────────

function fakeMaterial(id: string, albedoHash: string | null): BimMaterial {
  return {
    id, scope: 'company', nameEl: id, nameEn: id, category: 'other',
    density: null, defaultThickness: null, fireRating: 'none', atoeCategory: 'OIK-77.01',
    atoeArticle: null, defaultUnitCost: null, defaultUnit: 'm2', brand: null, brandModel: null,
    notes: null, thumbnailUrl: null,
    pbrTextures: albedoHash
      ? { albedoUrl: 'u', normalUrl: null, roughnessUrl: null, aoUrl: null, tileSizeM: 1, albedoHash }
      : null,
    builtin: false, companyId: 'co-1', projectId: null,
    createdBy: 'u', createdAt: {} as never, updatedBy: 'u', updatedAt: {} as never,
  };
}

function imageFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' });
}

interface Spy {
  saved: SaveBimMaterialInput[];
  uploads: { materialId: string }[];
  updates: { id: string; hash: string | null | undefined }[];
}

function makeDeps(
  existingMaterials: readonly BimMaterial[],
  hashByName: Record<string, string>,
): { deps: ForeignTextureImporterDeps; spy: Spy; ids: string[] } {
  const spy: Spy = { saved: [], uploads: [], updates: [] };
  const ids: string[] = [];
  let n = 0;
  const deps: ForeignTextureImporterDeps = {
    existingMaterials,
    saveMaterial: async (input) => {
      spy.saved.push(input);
      const id = `bmat_${(n += 1)}`;
      ids.push(id);
      return fakeMaterial(id, null);
    },
    updateMaterial: async (id, patch) => {
      spy.updates.push({ id, hash: patch.pbrTextures?.albedoHash });
    },
    uploadAlbedo: async (_file, materialId) => {
      spy.uploads.push({ materialId });
      return `https://storage/${materialId}/albedo.jpg`;
    },
    hashFile: async (file) => hashByName[(file as File).name] ?? 'h-default',
  };
  return { deps, spy, ids };
}

describe('importForeignTextures (ADR-678 Βήμα 3)', () => {
  it('create path: save (company/other) → upload albedo → update με albedoHash', async () => {
    const { deps, spy } = makeDeps([], { 'bark.jpg': 'hash-bark' });
    const out = await importForeignTextures(
      new Map([['Ξερό-bark-21', 'bark.jpg']]), [imageFile('bark.jpg')], deps,
    );
    expect(out.get('Ξερό-bark-21')).toBe('bmat_1');
    expect(spy.saved[0]).toMatchObject({ scope: 'company', category: 'other', nameEl: 'Ξερό-bark-21' });
    expect(spy.uploads).toEqual([{ materialId: 'bmat_1' }]);
    expect(spy.updates[0]).toEqual({ id: 'bmat_1', hash: 'hash-bark' });
  });

  it('within-import dedup: ίδια υφή σε δύο υλικά → ΕΝΑ save', async () => {
    const { deps, spy, ids } = makeDeps([], { 'bark.jpg': 'hash-bark' });
    const out = await importForeignTextures(
      new Map([['MatA', 'bark.jpg'], ['MatB', 'bark.jpg']]), [imageFile('bark.jpg')], deps,
    );
    expect(spy.saved).toHaveLength(1);
    expect(out.get('MatA')).toBe(ids[0]);
    expect(out.get('MatB')).toBe(ids[0]);
  });

  it('cross-session dedup: υπάρχον υλικό με ίδιο albedoHash → reuse, κανένα save', async () => {
    const existing = [fakeMaterial('bmat_existing', 'hash-bark')];
    const { deps, spy } = makeDeps(existing, { 'bark.jpg': 'hash-bark' });
    const out = await importForeignTextures(
      new Map([['Ξερό-bark-21', 'bark.jpg']]), [imageFile('bark.jpg')], deps,
    );
    expect(spy.saved).toHaveLength(0);
    expect(out.get('Ξερό-bark-21')).toBe('bmat_existing');
  });

  it('υφή χωρίς επιλεγμένη εικόνα → παραλείπεται (καμία εγγραφή, κανένα throw)', async () => {
    const { deps, spy } = makeDeps([], {});
    const out = await importForeignTextures(
      new Map([['Ξερό-bark-21', 'missing.jpg']]), [], deps,
    );
    expect(spy.saved).toHaveLength(0);
    expect(out.size).toBe(0);
  });
});
