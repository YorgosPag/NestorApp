/**
 * ADR-668 §4.8 — το χρώμα υλικού διαβάζεται από ΚΑΘΕ υλικό με `.color`, όχι μόνο MeshStandard.
 *
 * Ρίζα: ο οπλισμός (ADR-463) είναι `MeshBasicMaterial` (crimson). Το παλιό `isMeshStandard`-only
 * check τον έριχνε στο γκρι fallback (`mat_808080`) → ο κλωβός θα έβγαινε γκρι στο C4D αντί κόκκινος.
 */

import * as THREE from 'three';
import { assignExportMaterials, buildMaterialBaseline, type ExportMaterialEntry } from '../mesh3d-materials';
import { HIDDEN_NAME_PREFIX } from '../mesh3d-naming';

describe('assignExportMaterials — non-Standard material colour (ADR-668 §4.8)', () => {
  it('keeps a MeshBasicMaterial colour (rebar crimson), not the grey fallback', () => {
    const root = new THREE.Group();
    const rebar = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xdc143c }),
    );
    rebar.userData = { bimId: 'col-1', bimType: 'column' };
    root.add(rebar);

    const table = assignExportMaterials(root);

    expect(table).toHaveLength(1);
    expect(table[0].name).toBe('mat_dc143c'); // χρωματικό όνομα, όχι το γκρι 808080
    expect(table[0].color.getHex()).toBe(0xdc143c);
    expect((rebar.material as THREE.Material).name).toBe('mat_dc143c');
  });

  it('still resolves MeshStandard colours unchanged (no regression)', () => {
    const root = new THREE.Group();
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x9e9e9e }),
    );
    wall.userData = { bimId: 'w-1', bimType: 'wall' };
    root.add(wall);

    const table = assignExportMaterials(root);

    expect(table[0].name).toBe('mat_9e9e9e');
    expect(table[0].color.getHex()).toBe(0x9e9e9e);
  });
});

describe('assignExportMaterials — texture extraction (ADR-679 Φ1)', () => {
  it('εξάγει ExportTextureRef από υλικό με .map (url από userData) + relative fileName', () => {
    const root = new THREE.Group();
    const tex = new THREE.Texture();
    tex.userData = { url: 'https://storage/bim-material-textures/oak/albedo.jpg' };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    mat.map = tex;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    wall.userData = { bimId: 'w-tex', bimType: 'wall', matId: 'oak-01' };
    root.add(wall);

    const table = assignExportMaterials(root);

    expect(table[0].map).not.toBeNull();
    expect(table[0].map?.url).toBe('https://storage/bim-material-textures/oak/albedo.jpg');
    expect(table[0].map?.fileName).toBe('textures/oak-01.jpg'); // relative, από matId + .jpg
  });

  it('υλικό ΧΩΡΙΣ .map → map είναι null', () => {
    const root = new THREE.Group();
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x808080 }),
    );
    wall.userData = { bimId: 'w-plain', bimType: 'wall' };
    root.add(wall);

    const table = assignExportMaterials(root);

    expect(table[0].map).toBeNull();
  });
});

describe('assignExportMaterials — per-face (array) materials (ADR-678 Φ3 / ADR-683 Φ3)', () => {
  it('names every face of a uniform-colour array material and dedups to ONE table entry', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [
      new THREE.MeshStandardMaterial({ color: 0x112233 }),
      new THREE.MeshStandardMaterial({ color: 0x112233 }),
      new THREE.MeshStandardMaterial({ color: 0x112233 }),
    ]);
    mesh.userData = { bimId: 'roof-1', bimType: 'roof' };
    root.add(mesh);

    const table = assignExportMaterials(root);

    expect(table).toHaveLength(1);
    expect(table[0].name).toBe('mat_112233');
    const material = mesh.material as THREE.Material[];
    expect(material).toHaveLength(3);
    for (const m of material) expect(m.name).toBe('mat_112233');
  });

  it('names each differently-coloured face separately (multiple table entries, no dedup)', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
      new THREE.MeshStandardMaterial({ color: 0x222222 }),
      new THREE.MeshStandardMaterial({ color: 0x333333 }),
    ]);
    mesh.userData = { bimId: 'roof-2', bimType: 'roof' };
    root.add(mesh);

    const table = assignExportMaterials(root);

    expect(table.map((e) => e.name).sort()).toEqual(['mat_111111', 'mat_222222', 'mat_333333']);
    const material = mesh.material as THREE.Material[];
    expect(material.map((m) => m.name)).toEqual(['mat_111111', 'mat_222222', 'mat_333333']);
  });

  it('keeps mesh.material as an array of named CLONES — never mutates the shared source materials', () => {
    const root = new THREE.Group();
    const source = [
      new THREE.MeshStandardMaterial({ color: 0xaaaaaa }),
      new THREE.MeshStandardMaterial({ color: 0xbbbbbb }),
    ];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), source);
    root.add(mesh);

    assignExportMaterials(root);

    expect(Array.isArray(mesh.material)).toBe(true);
    const material = mesh.material as THREE.Material[];
    expect(material[0]).not.toBe(source[0]);
    expect(material[1]).not.toBe(source[1]);
    expect(source[0].name).toBe(''); // το πρωτότυπο, ζωντανό υλικό μένει ανέγγιχτο
  });

  it('single-material mesh is unaffected by the array path (regression)', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x9e9e9e }),
    );
    mesh.userData = { matId: 'mat-concrete-c25' };
    root.add(mesh);

    const table = assignExportMaterials(root);

    expect(table).toHaveLength(1);
    expect(table[0].name).toBe('mat-concrete-c25');
    expect(Array.isArray(mesh.material)).toBe(false);
  });
});

describe('buildMaterialBaseline (ADR-683 §7, Break C)', () => {
  const entry = (name: string, hex: number): ExportMaterialEntry => ({
    name,
    color: new THREE.Color(hex),
    opacity: 1,
    transparent: false,
  });

  it('maps clean material name → sRGB "#rrggbb"', () => {
    const baseline = buildMaterialBaseline([entry('mat-concrete-c25', 0x808080), entry('mat_a1b2c3', 0xa1b2c3)]);

    expect(baseline.get('mat-concrete-c25')).toBe('#808080');
    expect(baseline.get('mat_a1b2c3')).toBe('#a1b2c3');
  });

  it('collapses HIDDEN_<name> and <name> to ONE clean-name entry (format-agnostic baseline)', () => {
    const baseline = buildMaterialBaseline([
      entry('mat-concrete-c25', 0x808080),
      entry(`${HIDDEN_NAME_PREFIX}_mat-concrete-c25`, 0x808080),
    ]);

    expect(baseline.size).toBe(1);
    expect(baseline.get('mat-concrete-c25')).toBe('#808080');
  });

  it('first entry wins for a repeated clean name (deterministic)', () => {
    const baseline = buildMaterialBaseline([entry('mat-x', 0x111111), entry('mat-x', 0x222222)]);

    expect(baseline.get('mat-x')).toBe('#111111');
  });
});
