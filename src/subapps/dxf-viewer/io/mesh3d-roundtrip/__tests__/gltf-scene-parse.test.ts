/**
 * ADR-683 Φ2 κενό Κ1 — glTF import.
 *
 * Ο στόχος των tests: το glTF μονοπάτι πρέπει να παράγει **ακριβώς** ό,τι ήδη καταναλώνει ο
 * pipeline του ADR-678 (όνομα object + όνομα υλικού), ώστε να μην υπάρξει δεύτερο μονοπάτι
 * αντιστοίχισης. Το `collectGltfObjects` δοκιμάζεται pure (χωρίς αρχείο/loader), όπως τα
 * αντίστοιχα OBJ parsers.
 */

import * as THREE from 'three';
import { collectGltfObjects, collectGltfMaterials } from '../gltf-scene-parse';

function namedMesh(name: string, materialName: string | null): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial();
  if (materialName !== null) material.name = materialName;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.name = name;
  return mesh;
}

describe('collectGltfObjects', () => {
  it('reads the identity channel of ADR-678 §2 — UTF-8 ονόματα ταξιδεύουν ακέραια στο glTF', () => {
    const root = new THREE.Group();
    root.add(namedMesh('Ισόγειο_Wall_w-42', 'road_wood'));

    const [record] = collectGltfObjects(root);

    expect(record.objectName).toBe('Ισόγειο_Wall_w-42');
    expect(record.materialName).toBe('road_wood');
  });

  it('descends the real glTF tree — το OBJ είναι επίπεδο, το glTF έχει φωλιές', () => {
    const root = new THREE.Group();
    const wallGroup = new THREE.Group();
    wallGroup.add(namedMesh('Wall_w-1', 'mat-concrete-c25'));
    wallGroup.add(namedMesh('Opening_o-9', 'glass'));
    root.add(wallGroup);

    expect(collectGltfObjects(root).map((r) => r.objectName)).toEqual(['Wall_w-1', 'Opening_o-9']);
  });

  it('keeps unnamed meshes — πέφτουν στα «χωρίς αντιστοίχιση», δεν εξαφανίζονται σιωπηλά', () => {
    const root = new THREE.Group();
    root.add(namedMesh('', null));

    const records = collectGltfObjects(root);

    expect(records).toHaveLength(1);
    expect(records[0].objectName).toBe('');
    expect(records[0].materialName).toBeNull();
  });

  it('picks the first named material of a multi-material mesh — Φ1 είναι ανά-στοιχείο', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [
      new THREE.MeshStandardMaterial(), // ανώνυμο
      Object.assign(new THREE.MeshStandardMaterial(), { name: 'Aluminium' }),
    ]);
    mesh.name = 'Rail_01';
    const root = new THREE.Group();
    root.add(mesh);

    expect(collectGltfObjects(root)[0].materialName).toBe('Aluminium');
  });

  it('carries a geometry fingerprint — αυτό είναι που ΔΕΝ μπορεί να δώσει το OBJ μονοπάτι', () => {
    const root = new THREE.Group();
    root.add(namedMesh('Wall_w-1', 'mat-concrete-c25'));

    const [record] = collectGltfObjects(root);

    expect(record.fingerprint).not.toBeNull();
    expect(record.fingerprint?.signature.sizeM[1]).toBeCloseTo(1, 6);
  });

  it('ignores non-mesh nodes (φώτα/κάμερες/κενά groups του παραλήπτη)', () => {
    const root = new THREE.Group();
    root.add(new THREE.Object3D());
    root.add(new THREE.Group());

    expect(collectGltfObjects(root)).toHaveLength(0);
  });

  it('legacy single-material mesh has no faceMaterials (back-compat, ADR-678 Φ3)', () => {
    const root = new THREE.Group();
    root.add(namedMesh('Wall_w-9', 'mat-concrete-c25'));

    const [record] = collectGltfObjects(root);

    expect(record.faceMaterials).toBeUndefined();
  });

  /**
   * ADR-678 Φ3 — ο GLTFLoader επιστρέφει ένα per-face-βαμμένο solid ως THREE.Group με ένα
   * single-material child ανά primitive/materialIndex (σειρά 1:1 με το `faceKeyByMaterialIndex`
   * του node userData, μετρημένο). Το `collectGltfObjects` πρέπει να το διαβάσει ως ΕΝΑ record.
   */
  describe('faced solid (per-face materials, ADR-678 Φ3)', () => {
    function facedGroup(name: string, faceKeys: readonly string[], children: readonly THREE.Mesh[]): THREE.Group {
      const group = new THREE.Group();
      group.name = name;
      group.userData = { faceKeyByMaterialIndex: [...faceKeys] };
      group.add(...children);
      return group;
    }

    it('collects a faced solid as ONE record with a positional zip of faceMaterials', () => {
      const bottom = namedMesh('bottom-child', 'mat_112233');
      const top = namedMesh('top-child', 'mat_445566');
      const side = namedMesh('side-child', 'mat_778899');
      const group = facedGroup('Roof_r-1', ['bottom', 'top', 'side:0'], [bottom, top, side]);

      const root = new THREE.Group();
      root.add(group);

      const records = collectGltfObjects(root);

      expect(records).toHaveLength(1); // τα 3 children ΔΕΝ γίνονται ξεχωριστά records
      const [record] = records;
      expect(record.objectName).toBe('Roof_r-1');
      expect(record.faceMaterials).toEqual(
        new Map([
          ['bottom', 'mat_112233'],
          ['top', 'mat_445566'],
          ['side:0', 'mat_778899'],
        ]),
      );
    });

    it('uses the first named child material as the dominant materialName (back-compat field)', () => {
      const bottom = namedMesh('bottom-child', 'mat_112233');
      const top = namedMesh('top-child', 'mat_445566');
      const group = facedGroup('Roof_r-2', ['bottom', 'top'], [bottom, top]);

      const [record] = collectGltfObjects(group);

      expect(record.materialName).toBe('mat_112233');
    });

    it('carries a fingerprint/solid from the MERGED faced representative, not a single child', () => {
      const bottom = namedMesh('bottom-child', 'mat_112233');
      const top = namedMesh('top-child', 'mat_445566');
      const group = facedGroup('Roof_r-3', ['bottom', 'top'], [bottom, top]);

      const [record] = collectGltfObjects(group);

      expect(record.fingerprint).not.toBeNull();
      expect(record.solid).toBeDefined();
    });

    it('treats a single-mesh faced node (no children, e.g. one-water roof) as its own faced child', () => {
      const mesh = namedMesh('Roof_water', 'mat_112233');
      mesh.userData = { faceKeyByMaterialIndex: ['sub:0:x'] };

      const records = collectGltfObjects(mesh);

      expect(records).toHaveLength(1);
      expect(records[0].objectName).toBe('Roof_water');
      expect(records[0].faceMaterials).toEqual(new Map([['sub:0:x', 'mat_112233']]));
      expect(records[0].fingerprint).not.toBeNull();
    });
  });
});

/**
 * ADR-683 Φ2-UI — το glTF ανάλογο του `.mtl`. **Αυτό ήταν το κενό που θα έκανε το glTF import να
 * «δουλεύει» χάνοντας σιωπηλά κάθε χρώμα:** ο `resolveImportAppearance` ψάχνει τα χρώματα σε
 * `Map<name, ImportedMaterial>` — χωρίς αυτή τη συλλογή ο χάρτης θα ήταν πάντα κενός.
 */
describe('collectGltfMaterials', () => {
  it('βγάζει το χρώμα από το ΙΔΙΟ το αρχείο — το glTF δεν έχει sidecar .mtl', () => {
    const material = new THREE.MeshStandardMaterial({ color: 0xc0392b });
    material.name = 'road_wood';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    const root = new THREE.Group();
    root.add(mesh);

    expect(collectGltfMaterials(root).get('road_wood')).toEqual({
      name: 'road_wood',
      colorHex: '#c0392b',
      opacity: 1,
    });
  });

  it('κρατά τη διαφάνεια (γυαλί του συνεργάτη) — αντίστοιχο του `d` στο .mtl', () => {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, opacity: 0.35 });
    material.name = 'Glass';
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));

    expect(collectGltfMaterials(root).get('Glass')?.opacity).toBeCloseTo(0.35, 6);
  });

  it('αγνοεί ανώνυμα υλικά — το κλειδί αντιστοίχισης είναι το όνομα (ADR-678 §2)', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));

    expect(collectGltfMaterials(root).size).toBe(0);
  });

  it('πρώτη εμφάνιση κερδίζει — ίδιο όνομα υλικού σε δεκάδες meshes, μία εγγραφή', () => {
    const root = new THREE.Group();
    for (const hex of [0x112233, 0x445566]) {
      const m = new THREE.MeshStandardMaterial({ color: hex });
      m.name = 'Shared';
      root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m));
    }

    const materials = collectGltfMaterials(root);
    expect(materials.size).toBe(1);
    expect(materials.get('Shared')?.colorHex).toBe('#112233');
  });
});
