/**
 * ADR-678 Φ4 — COLLADA (.dae) parser: **round-trip guard**. `serialiseCollada` (write-side) →
 * `parseColladaScene` (read-side) → ίδια objects/materials/faceMaterials. Ο parser είναι το ακριβές
 * mirror του writer· ο κοινός τους έλεγχος αποτρέπει σιωπηλή απόκλιση των δύο πλευρών.
 */

import * as THREE from 'three';
import {
  serialiseCollada,
  type ColladaExportOptions,
} from '../../../export/core/mesh3d/mesh3d-collada-writer';
import type { ExportMaterialEntry } from '../../../export/core/mesh3d/mesh3d-materials';
import { parseColladaScene } from '../dae-material-parse';
import { assignExportMaterials } from '../../../export/core/mesh3d/mesh3d-materials';
import { resolveImportAppearance } from '../resolve-import-appearance';
import { buildKnownMaterialResolver } from '../known-import-materials';
import type { BimMaterial } from '../../../bim/types/bim-material-types';

const CM: ColladaExportOptions = { unit: 'centimeters', createdIso: '2026-07-21T00:00:00.000Z' };

function entry(name: string, hex: number, opacity = 1, transparent = false): ExportMaterialEntry {
  return { name, color: new THREE.Color(hex), opacity, transparent };
}

/** Non-indexed geometry με `triCount` τρίγωνα (3 μοναδικές κορυφές το καθένα). */
function makeTriangleGeometry(triCount: number): THREE.BufferGeometry {
  const positions = new Float32Array(triCount * 9);
  for (let i = 0; i < positions.length; i += 1) positions[i] = (i % 7) * 0.5 - 1.5;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function named(name: string, color = 0x808080): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color });
  m.name = name;
  return m;
}

function rootWith(...meshes: THREE.Mesh[]): THREE.Group {
  const root = new THREE.Group();
  meshes.forEach((m) => root.add(m));
  return root;
}

describe('parseColladaScene — round-trip (write → read)', () => {
  it('single-material flat: objectName + dominant materialName + flat color (sRGB)', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), named('mat_ff0000', 0xff0000));
    mesh.name = 'Column_col-1';
    const dae = serialiseCollada(rootWith(mesh), [entry('mat_ff0000', 0xff0000)], CM);

    const { objects, materials } = parseColladaScene(dae);

    expect(objects).toHaveLength(1);
    expect(objects[0].objectName).toBe('Column_col-1');
    expect(objects[0].materialName).toBe('mat_ff0000');
    expect(objects[0].faceMaterials).toBeUndefined();
    expect(materials.get('mat_ff0000')).toEqual({ name: 'mat_ff0000', colorHex: '#ff0000', opacity: 1 });
  });

  it('per-face (2 groups + faceKeys): faceMaterials χαρτογραφεί faceKey → όνομα υλικού', () => {
    const geo = makeTriangleGeometry(4);
    geo.clearGroups();
    geo.addGroup(0, 6, 0);
    geo.addGroup(6, 6, 1);
    const mesh = new THREE.Mesh(geo, [named('mat_ff0000', 0xff0000), named('mat_00ff00', 0x00ff00)]);
    mesh.name = 'Slab_s-1';
    mesh.userData['faceKeyByMaterialIndex'] = ['bottom', 'top'];
    const materials = [entry('mat_ff0000', 0xff0000), entry('mat_00ff00', 0x00ff00)];

    const { objects, materials: colors } = parseColladaScene(serialiseCollada(rootWith(mesh), materials, CM));

    expect(objects).toHaveLength(1);
    const fm = objects[0].faceMaterials;
    expect(fm).toBeDefined();
    expect(fm?.get('bottom')).toBe('mat_ff0000');
    expect(fm?.get('top')).toBe('mat_00ff00');
    expect(colors.get('mat_ff0000')?.colorHex).toBe('#ff0000');
    expect(colors.get('mat_00ff00')?.colorHex).toBe('#00ff00');
  });

  it('textured υλικό: το όνομα ταξιδεύει, αλλά ΔΕΝ μπαίνει στον flat-color πίνακα', () => {
    const geo = makeTriangleGeometry(1);
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1]), 2));
    const mesh = new THREE.Mesh(geo, named('mat_oak'));
    mesh.name = 'Wall_w-1';
    const textured: ExportMaterialEntry = {
      name: 'mat_oak',
      color: new THREE.Color(0xffffff),
      opacity: 1,
      transparent: false,
      map: { fileName: 'textures/mat_oak.jpg', url: 'https://x/oak.jpg' },
    };

    const { objects, materials } = parseColladaScene(serialiseCollada(rootWith(mesh), [textured], CM));

    expect(objects[0].materialName).toBe('mat_oak');
    expect(materials.has('mat_oak')).toBe(false);
  });

  it('γκρι 0x808080 → round-trip σε #808080 (sRGB και στις δύο πλευρές)', () => {
    const mesh = new THREE.Mesh(makeTriangleGeometry(1), named('mat_808080', 0x808080));
    mesh.name = 'G';
    const { materials } = parseColladaScene(serialiseCollada(rootWith(mesh), [entry('mat_808080', 0x808080)], CM));

    expect(materials.get('mat_808080')?.colorHex).toBe('#808080');
  });

  it('διαφανές (hidden) υλικό → opacity 0 από το <transparency><float>', () => {
    const mesh = new THREE.Mesh(makeTriangleGeometry(1), named('HIDDEN_mat_ff0000', 0xff0000));
    mesh.name = 'H';
    const { materials } = parseColladaScene(
      serialiseCollada(rootWith(mesh), [entry('HIDDEN_mat_ff0000', 0xff0000, 0, true)], CM),
    );

    expect(materials.get('HIDDEN_mat_ff0000')?.opacity).toBe(0);
  });

  it('πολλαπλά nodes → ένα object ανά node, στη σειρά', () => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), named('mat_ff0000', 0xff0000));
    a.name = 'A';
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), named('mat_00ff00', 0x00ff00));
    b.name = 'B';
    const materials = [entry('mat_ff0000', 0xff0000), entry('mat_00ff00', 0x00ff00)];

    const { objects } = parseColladaScene(serialiseCollada(rootWith(a, b), materials, CM));

    expect(objects.map((o) => o.objectName)).toEqual(['A', 'B']);
  });

  it('escaped όνομα υλικού (& < >) αποκωδικοποιείται σωστά από τον DOM', () => {
    const mesh = new THREE.Mesh(makeTriangleGeometry(1), named('mat_a&b<c', 0xffffff));
    mesh.name = 'E';
    const { objects } = parseColladaScene(serialiseCollada(rootWith(mesh), [entry('mat_a&b<c', 0xffffff)], CM));

    expect(objects[0].materialName).toBe('mat_a&b<c');
  });
});

/**
 * Ground-truth C4D R15.037: ο native COLLADA exporter γράφει `symbol="Material1"` (ΟΧΙ `sym_i`),
 * ID-based targets, ΚΑΝΕΝΑ `<extra profile="NESTOR">`, και ενώνει τα per-face groups. Ο parser πρέπει
 * να διαβάζει το ανά-στοιχείο υλικό ανεξάρτητα από τη μορφή του symbol (per-object dominant).
 */
describe('parseColladaScene — ξένος (C4D R15) .dae', () => {
  const C4D_DAE = `<?xml version="1.0"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <library_effects>
    <effect id="ID2"><profile_COMMON><technique sid="COMMON"><blinn>
      <diffuse><color>0.8 0.1 0.1 1</color></diffuse>
      <specular><color>0.2 0.2 0.2 1</color></specular>
    </blinn></technique></profile_COMMON></effect>
  </library_effects>
  <library_materials>
    <material id="ID1" name="paint-red"><instance_effect url="#ID2"/></material>
  </library_materials>
  <library_visual_scenes><visual_scene id="scene">
    <node id="ID10" name="Column_col-7"><instance_geometry url="#g"><bind_material><technique_common>
      <instance_material symbol="Material1" target="#ID1"/>
    </technique_common></bind_material></instance_geometry></node>
  </visual_scene></library_visual_scenes>
</COLLADA>`;

  it('διαβάζει το ανά-στοιχείο υλικό παρά το symbol="Material1" + κανένα <extra>', () => {
    const { objects, materials } = parseColladaScene(C4D_DAE);

    expect(objects).toHaveLength(1);
    expect(objects[0].objectName).toBe('Column_col-7');
    expect(objects[0].materialName).toBe('paint-red');
    expect(objects[0].faceMaterials).toBeUndefined(); // no <extra> → per-object, όχι per-face
    expect(materials.get('paint-red')?.colorHex).toBe('#cc1a1a'); // 0.8→cc, 0.1→1a (sRGB)
  });

  // Ground-truth C4D R15: ο χρήστης έφτιαξε δεύτερο υλικό ΟΝΟΜΑΤΙ "Mat" (ροζ) δίπλα στο default
  // "Mat" (γκρι). Binding by ID → το ροζ ΔΕΝ πρέπει να κρύβεται πίσω από το γκρι.
  const C4D_DUP_NAMES = `<?xml version="1.0"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <library_effects>
    <effect id="ID2"><profile_COMMON><technique sid="COMMON"><blinn>
      <diffuse><color>0.8 0.8 0.8 1</color></diffuse></blinn></technique></profile_COMMON></effect>
    <effect id="ID4"><profile_COMMON><technique sid="COMMON"><blinn>
      <diffuse><color>1 0.501961 1 1</color></diffuse></blinn></technique></profile_COMMON></effect>
  </library_effects>
  <library_materials>
    <material id="ID1" name="Mat"><instance_effect url="#ID2"/></material>
    <material id="ID3" name="Mat"><instance_effect url="#ID4"/></material>
  </library_materials>
  <library_visual_scenes><visual_scene id="scene">
    <node id="ID440" name="Column_col-7"><instance_geometry url="#g"><bind_material><technique_common>
      <instance_material symbol="Material1" target="#ID3"/>
    </technique_common></bind_material></instance_geometry></node>
  </visual_scene></library_visual_scenes>
</COLLADA>`;

  it('duplicate name "Mat" με διαφορετικά χρώματα → binding by ID δίνει το ΣΩΣΤΟ (ροζ)', () => {
    const { objects, materials } = parseColladaScene(C4D_DUP_NAMES);

    // και τα δύο χρώματα διατηρούνται (το ροζ δεν κρύβεται πίσω από το γκρι)
    expect(materials.get('Mat')?.colorHex).toBe('#cccccc'); // γκρι (ID1, πρώτο)
    expect(materials.get('Mat#ID3')?.colorHex).toBe('#ff80ff'); // ροζ (ID3, disambiguated)
    // ο κόμβος δένει στο ID3 → παίρνει το ροζ
    expect(objects[0].materialName).toBe('Mat#ID3');
  });
});

/**
 * ADR-678 Φ2 — round-trip identity end-to-end: ένα per-face `bmat_*` υλικό (με σφραγισμένο
 * `userData.nestorMaterialId`, όπως το `getFaceMaterial3D`) → `assignExportMaterials` το ονομάζει με
 * την ΤΑΥΤΟΤΗΤΑ (`bmat_oak`, όχι `tex_*`) → `serialiseCollada` → `parseColladaScene` → το όνομα
 * ταξιδεύει → `resolveImportAppearance` το λύνει σε `{materialId}`. Χωρίς αυτό, το textured υλικό
 * επέστρεφε ως άγνωστο `tex_*` → no-op.
 */
describe('round-trip identity (ADR-678 Φ2): export bmat → import materialId', () => {
  it('per-face bmat_ (σφραγισμένο id) → όνομα bmat_ → parse → resolveImportAppearance {materialId}', () => {
    const tex = new THREE.Texture();
    tex.userData = { url: 'https://s/bim-material-textures/bmat_oak/albedo.jpg' };
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    faceMat.map = tex;
    faceMat.userData['nestorMaterialId'] = 'bmat_oak';
    const geo = makeTriangleGeometry(2);
    geo.clearGroups();
    geo.addGroup(0, 3, 0);
    geo.addGroup(3, 3, 0);
    const mesh = new THREE.Mesh(geo, [faceMat]);
    mesh.name = 'Column_col-1';
    mesh.userData['faceKeyByMaterialIndex'] = ['side:0'];
    const root = rootWith(mesh);

    const table = assignExportMaterials(root);
    expect(table[0].name).toBe('bmat_oak'); // export ταυτότητα (όχι tex_oak_albedo)

    const { objects } = parseColladaScene(serialiseCollada(root, table, CM));
    const carriedName = objects[0].materialName ?? objects[0].faceMaterials?.get('side:0') ?? null;
    expect(carriedName).toBe('bmat_oak'); // ταξιδεύει ακέραιο

    const resolveKnown = buildKnownMaterialResolver([
      { id: 'bmat_oak', nameEl: 'Δρυς', nameEn: 'Oak' } as unknown as BimMaterial,
    ]);
    expect(resolveImportAppearance('bmat_oak', new Map(), resolveKnown)).toEqual({ materialId: 'bmat_oak' });
  });
});

describe('parseColladaScene — σφάλματα', () => {
  it('μη έγκυρο XML → throw', () => {
    expect(() => parseColladaScene('<<<not xml')).toThrow();
  });

  it('έγκυρο XML αλλά όχι COLLADA root → throw', () => {
    expect(() => parseColladaScene('<?xml version="1.0"?><other></other>')).toThrow();
  });
});
