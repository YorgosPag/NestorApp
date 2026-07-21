/**
 * ADR-668/678 Φ3.1 — group-aware OBJ writer.
 *
 * Δύο εγγυήσεις:
 *  1. **Single-material parity:** byte-for-byte ίδια έξοδος με τον stock three `OBJExporter` (μηδέν
 *     regression στα υπάρχοντα OBJ exports).
 *  2. **Per-face:** ένα multi-material mesh (per-face βαφή, ADR-539) γράφει **ΕΝΑ `usemtl` ανά
 *     `geometry.group`**, στη σειρά των groups (= σειρά όψεων του `buildFacedIndex`) — αυτό που ο
 *     stock exporter ΔΕΝ κάνει (αγνοεί groups + material array).
 */

import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { serialiseObjGroupAware } from '../mesh3d-obj-writer';
import { buildFacedPrism } from '../../../../bim-3d/converters/bim-three-faced-prism';

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

/** Οι τιμές που ακολουθούν ένα keyword (π.χ. όλα τα `usemtl <x>` → `['x', …]`), στη σειρά. */
function valuesOf(objText: string, keyword: string): string[] {
  return objText
    .split('\n')
    .filter((l) => l.startsWith(`${keyword} `))
    .map((l) => l.slice(keyword.length + 1).trim());
}

describe('serialiseObjGroupAware — single-material parity με stock OBJExporter', () => {
  it('βγάζει ταυτόσημη έξοδο με τον stock για single-material mesh', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(makeTriangleGeometry(2), named('mat_c0392b'));
    mesh.name = 'Wall_w-1';
    mesh.position.set(3, 0, -2);
    root.add(mesh);
    root.updateMatrixWorld(true); // ο stock δεν το κάνει· εξισώνουμε την αφετηρία

    expect(serialiseObjGroupAware(root)).toBe(new OBJExporter().parse(root));
  });

  it('παγκόσμιοι δείκτες κορυφών: το 2ο mesh δείχνει με offset (parity με stock)', () => {
    const root = new THREE.Group();
    const a = new THREE.Mesh(makeTriangleGeometry(1), named('mat_a'));
    a.name = 'A';
    const b = new THREE.Mesh(makeTriangleGeometry(1), named('mat_b'));
    b.name = 'B';
    b.position.set(10, 0, 0);
    root.add(a, b);
    root.updateMatrixWorld(true);

    expect(serialiseObjGroupAware(root)).toBe(new OBJExporter().parse(root));
  });
});

describe('serialiseObjGroupAware — per-face (multi-material groups)', () => {
  it('γράφει ΕΝΑ usemtl ανά group, στη σειρά των groups', () => {
    const geo = makeTriangleGeometry(4); // 12 κορυφές, 4 τρίγωνα
    geo.clearGroups();
    geo.addGroup(0, 6, 0); // τρίγωνα 0-1 → material[0]
    geo.addGroup(6, 6, 1); // τρίγωνα 2-3 → material[1]
    const mesh = new THREE.Mesh(geo, [named('mat_red', 0xff0000), named('mat_green', 0x00ff00)]);
    mesh.name = 'Slab_s-1';
    const root = new THREE.Group();
    root.add(mesh);

    const obj = serialiseObjGroupAware(root);

    expect(valuesOf(obj, 'usemtl')).toEqual(['mat_red', 'mat_green']);
    // ένα object, όχι σπασμένο σε πολλά
    expect(valuesOf(obj, 'o')).toEqual(['Slab_s-1']);
    // 4 faces συνολικά, καθένα σε ένα group
    expect(obj.split('\n').filter((l) => l.startsWith('f '))).toHaveLength(4);
  });

  it('ο stock OBJExporter ΔΕΝ γράφει usemtl για το ίδιο multi-material mesh (η ρίζα του Φ3.1)', () => {
    const geo = makeTriangleGeometry(2);
    geo.clearGroups();
    geo.addGroup(0, 3, 0);
    geo.addGroup(3, 3, 1);
    const mesh = new THREE.Mesh(geo, [named('mat_red'), named('mat_green')]);
    mesh.name = 'X';
    const root = new THREE.Group();
    root.add(mesh);

    expect(valuesOf(new OBJExporter().parse(root), 'usemtl')).toEqual([]); // stock: τίποτα
    expect(valuesOf(serialiseObjGroupAware(root), 'usemtl')).toEqual(['mat_red', 'mat_green']);
  });

  it('πραγματικό faced prism: usemtl ανά όψη, στη σειρά του faceKeyByMaterialIndex', () => {
    const topRing = [
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(4, 1, 0),
      new THREE.Vector3(4, 1, -3),
      new THREE.Vector3(0, 1, -3),
    ];
    const prism = buildFacedPrism(topRing, 1);
    expect(prism).not.toBeNull();
    if (!prism) return;

    // ένα ονομασμένο υλικό ανά όψη (bottom, top, side:0..3) — 6 όψεις
    const materials = prism.faceKeyByMaterialIndex.map((fk) => named(`mat_${fk.replace(/[^a-z0-9]/gi, '_')}`));
    const mesh = new THREE.Mesh(prism.geometry, materials);
    mesh.name = 'Slab_s-2';
    const root = new THREE.Group();
    root.add(mesh);

    const usemtls = valuesOf(serialiseObjGroupAware(root), 'usemtl');
    expect(usemtls).toHaveLength(prism.faceKeyByMaterialIndex.length);
    expect(usemtls).toEqual(materials.map((m) => m.name));
  });

  it('ομοιόμορφη βαφή (ίδιο όνομα σε όλες τις όψεις): ένα usemtl ανά group, όλα ίδια', () => {
    const geo = makeTriangleGeometry(3);
    geo.clearGroups();
    geo.addGroup(0, 3, 0);
    geo.addGroup(3, 3, 1);
    geo.addGroup(6, 3, 2);
    const shared = named('mat_808080');
    const mesh = new THREE.Mesh(geo, [shared, shared, shared]);
    mesh.name = 'Uniform';
    const root = new THREE.Group();
    root.add(mesh);

    // ο import (parseObjObjects) μετρά την ΑΚΟΛΟΥΘΙΑ των usemtl → το collapse σε '*' γίνεται εκεί
    expect(valuesOf(serialiseObjGroupAware(root), 'usemtl')).toEqual(['mat_808080', 'mat_808080', 'mat_808080']);
  });
});
