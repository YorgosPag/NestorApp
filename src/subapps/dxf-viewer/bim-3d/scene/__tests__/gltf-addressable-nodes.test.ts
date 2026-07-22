/**
 * ADR-683 §mesh-load-nesting — ο SSoT walker των διευθυνσιοδοτήσιμων glTF κόμβων.
 *
 * Το κρίσιμο test είναι το **nested**: ο παλιός cache ευρετηρίαζε μόνο `scene.children` και άφηνε
 * nested κόμβους ως μόνιμο κουτί. Εδώ κατοχυρώνεται ότι ο walker τους βλέπει — και ότι παραμένει
 * bit-for-bit ίδιος με τον παλιό κανόνα του parser (faced solids, ανώνυμα, non-mesh).
 */

import * as THREE from 'three';
import {
  collectAddressableGltfNodes,
  readGltfFaceKeys,
} from '../gltf-addressable-nodes';

function mesh(name: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  m.name = name;
  return m;
}

const names = (root: THREE.Object3D): string[] =>
  collectAddressableGltfNodes(root).map((n) => n.name);

describe('collectAddressableGltfNodes (ADR-683 §mesh-load-nesting)', () => {
  it('βλέπει NESTED κόμβους — το bug που κρατούσε την καρέκλα κουτί (parser deep, index shallow)', () => {
    const root = new THREE.Group();
    const armature = new THREE.Group();
    armature.name = 'Armature';
    armature.add(mesh('HArmPads'), mesh('HBase'), mesh('HSpndle'));
    root.add(armature);

    // Ούτε ένας από τους 3 δεν είναι top-level `scene.children` — ο shallow index θα τους έχανε.
    expect(names(root)).toEqual(['HArmPads', 'HBase', 'HSpndle']);
  });

  it('flat σκηνή — σειρά traversal διατηρείται', () => {
    const root = new THREE.Group();
    root.add(mesh('Rail_01'), mesh('Rail_02'), mesh('Rail_03'));
    expect(names(root)).toEqual(['Rail_01', 'Rail_02', 'Rail_03']);
  });

  it('faced solid = ΕΝΑ αντικείμενο· τα per-face children ΔΕΝ μετρώνται', () => {
    const group = new THREE.Group();
    group.name = 'Roof_r-1';
    group.userData = { faceKeyByMaterialIndex: ['bottom', 'top'] };
    group.add(mesh('bottom-child'), mesh('top-child'));
    const root = new THREE.Group();
    root.add(group);

    expect(names(root)).toEqual(['Roof_r-1']);
  });

  it('single-mesh faced node (χωρίς children) = ο εαυτός του', () => {
    const m = mesh('Roof_water');
    m.userData = { faceKeyByMaterialIndex: ['sub:0:x'] };
    expect(names(m)).toEqual(['Roof_water']);
  });

  it('ανώνυμα meshes κρατιούνται (κενό όνομα) — δεν εξαφανίζονται σιωπηλά', () => {
    const root = new THREE.Group();
    root.add(mesh(''));
    expect(collectAddressableGltfNodes(root)).toHaveLength(1);
    expect(names(root)).toEqual(['']);
  });

  it('non-mesh nodes (φώτα/κάμερες/κενά groups) αγνοούνται', () => {
    const root = new THREE.Group();
    root.add(new THREE.Object3D(), new THREE.Group());
    expect(collectAddressableGltfNodes(root)).toHaveLength(0);
  });

  it('readGltfFaceKeys — έγκυρος πίνακας strings ναι, οτιδήποτε άλλο null', () => {
    const faced = new THREE.Object3D();
    faced.userData = { faceKeyByMaterialIndex: ['a', 'b'] };
    expect(readGltfFaceKeys(faced)).toEqual(['a', 'b']);

    const empty = new THREE.Object3D();
    empty.userData = { faceKeyByMaterialIndex: [] };
    expect(readGltfFaceKeys(empty)).toBeNull();

    const mixed = new THREE.Object3D();
    mixed.userData = { faceKeyByMaterialIndex: ['a', 3] };
    expect(readGltfFaceKeys(mixed)).toBeNull();

    expect(readGltfFaceKeys(new THREE.Object3D())).toBeNull();
    expect(readGltfFaceKeys(null)).toBeNull();
  });
});
