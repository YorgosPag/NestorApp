/**
 * ADR-668/678 Φ3.1 — COLLADA 1.4.1 (.dae) writer.
 *
 * Εγγυήσεις:
 *  1. **Έγκυρος σκελετός 1.4.1** — asset (unit/up_axis), effects, materials, geometries, scene.
 *  2. **Per-face** — ένα `<triangles material="sym_i">` ανά `geometry.group` + binding ανά group.
 *  3. **sRGB χρώμα** — τα `<color>` βγαίνουν σε sRGB (ΟΧΙ linear, το bug του `.mtl`).
 *  4. **Μονάδα** — `<unit meter>` αληθεύει τη ψημένη κλίμακα (cm→0.01, mm→0.001, m→1).
 */

import * as THREE from 'three';
import { serialiseCollada, type ColladaExportOptions } from '../mesh3d-collada-writer';
import type { ExportMaterialEntry } from '../mesh3d-materials';

const CREATED = '2026-07-21T00:00:00.000Z';
const CM: ColladaExportOptions = { unit: 'centimeters', createdIso: CREATED };

function entry(name: string, hex: number, opacity = 1, transparent = false): ExportMaterialEntry {
  return { name, color: new THREE.Color(hex), opacity, transparent };
}

/** Non-indexed geometry με `triCount` τρίγωνα (κάθε τρίγωνο = 3 μοναδικές κορυφές). */
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

/** Πλήθος εμφανίσεων υποσυμβολοσειράς. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function rootWith(mesh: THREE.Mesh): THREE.Group {
  const root = new THREE.Group();
  root.add(mesh);
  return root;
}

describe('serialiseCollada — σκελετός 1.4.1', () => {
  it('γράφει έγκυρο COLLADA 1.4.1 header, unit (cm) και Y_UP', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), named('mat_ff0000', 0xff0000));
    mesh.name = 'Column_col-1';
    const dae = serialiseCollada(rootWith(mesh), [entry('mat_ff0000', 0xff0000)], CM);

    expect(dae).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(dae).toContain('version="1.4.1"');
    expect(dae).toContain('<unit name="centimeter" meter="0.01"/>');
    expect(dae).toContain('<up_axis>Y_UP</up_axis>');
    expect(dae).toContain(`<created>${CREATED}</created>`);
    // ΕΝΑ geometry, ΕΝΑ node — το «ένα object = ένα στοιχείο» συμβόλαιο (όπως OBJ).
    expect(count(dae, '<geometry ')).toBe(1);
    expect(count(dae, '<node ')).toBe(1);
  });

  it('red cube: diffuse σε καθαρό κόκκινο sRGB + σωστό binding (ground-truth R15)', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), named('mat_ff0000', 0xff0000));
    mesh.name = 'Cube';
    const dae = serialiseCollada(rootWith(mesh), [entry('mat_ff0000', 0xff0000)], CM);

    expect(dae).toContain('<color>1 0 0 1</color>');
    // BoxGeometry = 12 τρίγωνα, single-material → ΕΝΑ triangles group
    expect(dae).toContain('<triangles material="sym_0" count="12">');
    expect(dae).toContain('<material id="material_0" name="mat_ff0000">');
    // ΚΡΙΣΙΜΟ (ground-truth native C4D R15.037): το instance_material ΠΡΕΠΕΙ να κουβαλά
    // <bind_vertex_input> προς υπαρκτό UV set, αλλιώς ο αυστηρός importer αφήνει την όψη γκρι
    // (αποδεδειγμένο: ακόμα και single-material κύβος γκρι χωρίς αυτό).
    expect(dae).toContain('<instance_material symbol="sym_0" target="#material_0">');
    expect(dae).toContain('<bind_vertex_input semantic="UVSET0" input_semantic="TEXCOORD" input_set="0"/>');
    // TEXCOORD source + input (offset 2 μετά VERTEX/NORMAL) — αντίγραφο native C4D
    expect(dae).toContain('<input semantic="TEXCOORD" source="#geom_0_uv" offset="2" set="0"/>');
    // Shader = blinn + sid="COMMON" (όπως τα colored υλικά του native C4D, ΟΧΙ lambert)
    expect(dae).toContain('<technique sid="COMMON"><blinn>');
    expect(dae).not.toContain('<lambert>');
    // ΚΡΙΣΙΜΟ (ground-truth R15): opaque υλικό → ΚΑΝΕΝΑ transparency block, αλλιώς το «Fix
    // transparency for incompatible files» του R15 σπάει την εμφάνιση (γκρι αντί κόκκινο).
    expect(dae).not.toContain('<transparency>');
    expect(dae).not.toContain('<transparent ');
  });
});

describe('serialiseCollada — per-face (multi-material groups)', () => {
  it('γράφει ΕΝΑ <triangles> + binding ανά group, στη σειρά των groups', () => {
    const geo = makeTriangleGeometry(4);
    geo.clearGroups();
    geo.addGroup(0, 6, 0); // τρίγωνα 0-1 → material[0] (κόκκινο)
    geo.addGroup(6, 6, 1); // τρίγωνα 2-3 → material[1] (πράσινο)
    const mesh = new THREE.Mesh(geo, [named('mat_ff0000', 0xff0000), named('mat_00ff00', 0x00ff00)]);
    mesh.name = 'Slab_s-1';
    const materials = [entry('mat_ff0000', 0xff0000), entry('mat_00ff00', 0x00ff00)];

    const dae = serialiseCollada(rootWith(mesh), materials, CM);

    expect(count(dae, '<triangles ')).toBe(2);
    expect(dae).toContain('<triangles material="sym_0" count="2">');
    expect(dae).toContain('<triangles material="sym_1" count="2">');
    expect(dae).toContain('<instance_material symbol="sym_0" target="#material_0">');
    expect(dae).toContain('<instance_material symbol="sym_1" target="#material_1">');
    // ΕΝΑ bind_vertex_input ανά group (per-face binding == native C4D)
    expect(count(dae, '<bind_vertex_input ')).toBe(2);
    // κόκκινο = material_0, πράσινο = material_1
    expect(dae).toContain('<color>1 0 0 1</color>');
    expect(dae).toContain('<color>0 1 0 1</color>');
    // NORMAL input υπάρχει (η γεωμετρία έχει normals)
    expect(dae).toContain('semantic="NORMAL"');
  });
});

describe('serialiseCollada — faceKeys <extra> (ADR-678 Φ4 round-trip identity)', () => {
  it('γράφει <extra> profile=NESTOR με ένα <k> ανά όψη, στη σειρά των groups', () => {
    const geo = makeTriangleGeometry(4);
    geo.clearGroups();
    geo.addGroup(0, 6, 0);
    geo.addGroup(6, 6, 1);
    const mesh = new THREE.Mesh(geo, [named('mat_ff0000', 0xff0000), named('mat_00ff00', 0x00ff00)]);
    mesh.name = 'Slab_s-1';
    mesh.userData['faceKeyByMaterialIndex'] = ['bottom', 'top'];
    const materials = [entry('mat_ff0000', 0xff0000), entry('mat_00ff00', 0x00ff00)];

    const dae = serialiseCollada(rootWith(mesh), materials, CM);

    expect(dae).toContain(
      '<extra><technique profile="NESTOR"><face_keys><k>bottom</k><k>top</k></face_keys></technique></extra>',
    );
    // Το <extra> ζει ΜΕΣΑ στο <node>, μετά το </instance_geometry>
    expect(dae).toContain('</instance_geometry><extra>');
  });

  it('single-material mesh χωρίς faceKeyByMaterialIndex → κανένα <extra>', () => {
    const mesh = new THREE.Mesh(makeTriangleGeometry(1), named('mat_ff0000', 0xff0000));
    mesh.name = 'X';
    const dae = serialiseCollada(rootWith(mesh), [entry('mat_ff0000', 0xff0000)], CM);

    expect(dae).not.toContain('<extra>');
  });

  it('faceKeys με ειδικούς χαρακτήρες (side:0, hole:0:1) περνούν αυτούσια', () => {
    const geo = makeTriangleGeometry(2);
    geo.clearGroups();
    geo.addGroup(0, 3, 0);
    geo.addGroup(3, 3, 1);
    const mesh = new THREE.Mesh(geo, [named('m0', 0xffffff), named('m1', 0x000000)]);
    mesh.name = 'H';
    mesh.userData['faceKeyByMaterialIndex'] = ['side:0', 'hole:0:1'];
    const dae = serialiseCollada(rootWith(mesh), [entry('m0', 0xffffff), entry('m1', 0x000000)], CM);

    expect(dae).toContain('<k>side:0</k><k>hole:0:1</k>');
  });
});

describe('serialiseCollada — χρώμα/διαφάνεια/μονάδα', () => {
  it('γκρι 0x808080 → sRGB συνιστώσες (ΟΧΙ linear)', () => {
    const mesh = new THREE.Mesh(makeTriangleGeometry(1), named('mat_808080', 0x808080));
    mesh.name = 'G';
    const dae = serialiseCollada(rootWith(mesh), [entry('mat_808080', 0x808080)], CM);

    const c = (128 / 255).toString(); // 0.5019607843137255 — sRGB, όχι το linear ~0.2159
    expect(dae).toContain(`<color>${c} ${c} ${c} 1</color>`);
  });

  it('διαφανές υλικό (hidden) → transparency float = opacity', () => {
    const mesh = new THREE.Mesh(makeTriangleGeometry(1), named('HIDDEN_mat_ff0000', 0xff0000));
    mesh.name = 'H';
    const dae = serialiseCollada(rootWith(mesh), [entry('HIDDEN_mat_ff0000', 0xff0000, 0, true)], CM);

    expect(dae).toContain('<transparent opaque="A_ONE"><color>1 1 1 1</color></transparent>');
    expect(dae).toContain('<transparency><float>0</float></transparency>');
  });

  it('μονάδα mm/m → σωστό meter στο <unit>', () => {
    const mesh = new THREE.Mesh(makeTriangleGeometry(1), named('mat_x', 0x123456));
    mesh.name = 'X';
    const mm = serialiseCollada(rootWith(mesh), [entry('mat_x', 0x123456)], { unit: 'millimeters', createdIso: CREATED });
    const m = serialiseCollada(rootWith(mesh), [entry('mat_x', 0x123456)], { unit: 'meters', createdIso: CREATED });

    expect(mm).toContain('<unit name="millimeter" meter="0.001"/>');
    expect(m).toContain('<unit name="meter" meter="1"/>');
  });

  it('escaping XML στο όνομα υλικού (& < >)', () => {
    const mesh = new THREE.Mesh(makeTriangleGeometry(1), named('mat_a&b<c', 0xffffff));
    mesh.name = 'E';
    const dae = serialiseCollada(rootWith(mesh), [entry('mat_a&b<c', 0xffffff)], CM);

    expect(dae).toContain('name="mat_a&amp;b&lt;c"');
    expect(dae).not.toContain('name="mat_a&b<c"');
  });
});

describe('serialiseCollada — textures + πραγματικά UVs (ADR-679 Φ1)', () => {
  it('υλικό με .map → library_images + surface/sampler + texture diffuse (native C4D δομή)', () => {
    const geo = makeTriangleGeometry(1);
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1]), 2));
    const mesh = new THREE.Mesh(geo, named('mat_oak'));
    mesh.name = 'Wall';
    const textured: ExportMaterialEntry = {
      name: 'mat_oak',
      color: new THREE.Color(0xffffff),
      opacity: 1,
      transparent: false,
      map: { fileName: 'textures/mat_oak.jpg', url: 'https://x/oak.jpg' },
    };
    const dae = serialiseCollada(rootWith(mesh), [textured], CM);

    expect(dae).toContain('<library_images><image id="image_0"><init_from>textures/mat_oak.jpg</init_from></image></library_images>');
    expect(dae).toContain('<newparam sid="surf_0"><surface type="2D"><init_from>image_0</init_from></surface></newparam>');
    expect(dae).toContain('<newparam sid="samp_0"><sampler2D><source>surf_0</source></sampler2D></newparam>');
    expect(dae).toContain('<diffuse><texture texture="samp_0" texcoord="UVSET0"/></diffuse>');
    // Textured ⇒ ΚΑΝΕΝΑ flat <diffuse><color>
    expect(dae).not.toContain('<diffuse><color>');
    // Πραγματικά UVs στο TEXCOORD source (ΟΧΙ το placeholder "0 0")
    expect(dae).toContain('<float_array id="geom_0_uv_arr" count="6">0 0 1 0 1 1</float_array>');
  });

  it('υλικό ΧΩΡΙΣ .map → κανένα library_images, flat color diffuse, placeholder UV', () => {
    const mesh = new THREE.Mesh(makeTriangleGeometry(1), named('mat_ff0000', 0xff0000));
    mesh.name = 'Flat';
    const dae = serialiseCollada(rootWith(mesh), [entry('mat_ff0000', 0xff0000)], CM);

    expect(dae).not.toContain('<library_images>');
    expect(dae).toContain('<diffuse><color>');
    expect(dae).not.toContain('<texture ');
    // Χωρίς uv attribute → placeholder (0,0) — αλλά το bind_vertex_input παραμένει
    expect(dae).toContain('<float_array id="geom_0_uv_arr" count="2">0 0</float_array>');
    expect(dae).toContain('<bind_vertex_input semantic="UVSET0" input_semantic="TEXCOORD" input_set="0"/>');
  });
});
