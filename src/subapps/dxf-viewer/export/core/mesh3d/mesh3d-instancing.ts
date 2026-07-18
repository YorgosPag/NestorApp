/**
 * ADR-668 §4.8 — «ψήσιμο» (bake) των `InstancedMesh` σε κανονική γεωμετρία για το export.
 *
 * Ο οπλισμός (ADR-463 `buildRods`) χτίζεται ως **`InstancedMesh`**: ΕΝΑΣ unit κύλινδρος + N
 * instance matrices (μία ανά ράβδο-segment) — άριστο για το live GPU rendering. **Αλλά** ο three
 * `OBJExporter` **δεν επεκτείνει instances** (γράφει τη base γεωμετρία ΜΙΑ φορά στο origin, αγνοεί
 * τα per-instance matrices) → στο C4D ο κλωβός θα ερχόταν ως ένας κύλινδρος στο (0,0,0). Το OBJ δεν
 * έχει καμία έννοια instancing, και το C4D R15 δεν διαβάζει το glTF `EXT_mesh_gpu_instancing`.
 *
 * Άρα για την εξαγωγή ψήνουμε κάθε `InstancedMesh` σε ΕΝΑ merged `Mesh`: κάθε instance = ένα
 * αντίγραφο της base γεωμετρίας με το instance matrix ψημένο μέσα, όλα ενωμένα. Το baked mesh
 * κρατά την ταυτότητα (`userData`), το όνομα, το υλικό και το τοπικό transform του instanced —
 * οπότε ονομάζεται/χρωματίζεται σαν κάθε άλλη οντότητα (σοβάς κ.λπ.). Καθαρά export-only: το live
 * viewport κρατά τον αποδοτικό `InstancedMesh` — αυτό τρέχει στη headless export σκηνή.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-668-mesh3d-export-obj-gltf.md §4.8
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Αντικαθιστά κάθε `InstancedMesh` κάτω από το `root` με ένα merged `Mesh` (instances ψημένα σε
 * πραγματική γεωμετρία). @returns πλήθος instanced meshes που ψήθηκαν.
 */
export function bakeInstancedMeshesForExport(root: THREE.Object3D): number {
  const instanced: THREE.InstancedMesh[] = [];
  root.traverse((node) => {
    if ((node as THREE.InstancedMesh).isInstancedMesh === true) {
      instanced.push(node as THREE.InstancedMesh);
    }
  });

  for (const inst of instanced) {
    const parent = inst.parent;
    if (!parent) continue;

    // Ένα αντίγραφο base-γεωμετρίας ανά instance, με το instance matrix ψημένο μέσα.
    const copies: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, m);
      copies.push(inst.geometry.clone().applyMatrix4(m));
    }

    parent.remove(inst);
    const merged = copies.length > 0 ? mergeGeometries(copies, false) : null;
    copies.forEach((g) => g.dispose());
    inst.geometry.dispose();
    if (!merged) continue; // count 0 — τίποτα να ψηθεί

    const baked = new THREE.Mesh(merged, inst.material);
    // Υιοθέτησε το ΔΙΚΟ του τοπικό transform του instanced (τα instance matrices είναι σχετικά με
    // αυτό)· ο γονέας μένει στη θέση του, άρα η αλυσίδα transforms διατηρείται ακριβώς.
    inst.updateMatrix();
    baked.applyMatrix4(inst.matrix);
    baked.userData = { ...inst.userData };
    baked.name = inst.name;
    parent.add(baked);
  }

  return instanced.length;
}
