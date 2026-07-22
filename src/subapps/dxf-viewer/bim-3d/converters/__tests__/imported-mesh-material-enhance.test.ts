/**
 * imported-mesh-material-enhance.test — ADR-683 Φ4. Επικυρώνει το belt-and-suspenders gate:
 * το preset εφαρμόζεται ΜΟΝΟ σε αδιαμόρφωτο-default υλικό με γνωστό όνομα· τα authored/textured
 * υλικά (σωστό export) περνούν ΑΝΕΓΓΙΧΤΑ, και τα multi-slot meshes χειρίζονται ανά slot.
 */

import * as THREE from 'three';
import { applyImportedMeshMaterials } from '../imported-mesh-material-enhance';

/** Ένα «αδιαμόρφωτο default» υλικό όπως το βγάζει ο Blender glTF export (0.8 γκρι, ματ, non-metal). */
function defaultGray(name: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ name, color: 0xcccccc, metalness: 0, roughness: 1 });
}

function meshWith(material: THREE.Material | THREE.Material[]): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
}

describe('applyImportedMeshMaterials — gate «αδιαμόρφωτο default»', () => {
  it('βάφει default-γκρι υλικό με γνωστό όνομα → metal preset (metalness 0.9)', () => {
    const mesh = meshWith(defaultGray('HMI-_Polished_Al'));
    applyImportedMeshMaterials(mesh);
    expect((mesh.material as THREE.MeshStandardMaterial).metalness).toBeCloseTo(0.9, 5);
  });

  it('ΔΕΝ αγγίζει authored υλικό (metalness=1) — σωστό export περνά ανέγγιχτο', () => {
    const authored = new THREE.MeshStandardMaterial({
      name: 'HMI-_Polished_Al',
      color: 0xc0c0c0,
      metalness: 1,
      roughness: 0.2,
    });
    const mesh = meshWith(authored);
    applyImportedMeshMaterials(mesh);
    expect(mesh.material).toBe(authored); // ίδιο instance → δεν αντικαταστάθηκε
  });

  it('ΔΕΝ αγγίζει textured υλικό (έχει map) ακόμη κι αν είναι γκρι/non-metal', () => {
    const textured = defaultGray('HMI-_Polished_Al');
    textured.map = new THREE.Texture();
    const mesh = meshWith(textured);
    applyImportedMeshMaterials(mesh);
    expect(mesh.material).toBe(textured);
  });

  it('ΔΕΝ αγγίζει default-γκρι με ΑΓΝΩΣΤΟ όνομα (gate #2: preset=null)', () => {
    const unknown = defaultGray('SomeRandomThing');
    const mesh = meshWith(unknown);
    applyImportedMeshMaterials(mesh);
    expect(mesh.material).toBe(unknown);
  });

  it('ΔΕΝ αγγίζει authored ΣΚΟΥΡΟ χρώμα (δεν είναι default-γκρι) με γνωστό όνομα', () => {
    const darkAuthored = new THREE.MeshStandardMaterial({
      name: 'Leather_Black',
      color: 0x141210, // σκούρο → gate #1 false
      metalness: 0,
      roughness: 0.5,
    });
    const mesh = meshWith(darkAuthored);
    applyImportedMeshMaterials(mesh);
    expect(mesh.material).toBe(darkAuthored);
  });
});

describe('applyImportedMeshMaterials — multi-slot mesh (η καρέκλα = 4 slots)', () => {
  it('βάφει ανά slot ανεξάρτητα (μέταλλο vs δέρμα vs ύφασμα), κρατά authored slot', () => {
    const metal = defaultGray('HMI-_Polished_Al');
    const leather = defaultGray('HMI-Aeron-Leathe');
    const fabric = defaultGray('HMI-3D01__Pellic');
    const authoredFabric = new THREE.MeshStandardMaterial({
      name: 'HMI-Aeron-G1__Gr',
      color: 0x2b2f34,
      metalness: 0,
      roughness: 0.8,
    }); // authored σκούρο → μένει
    const mesh = meshWith([metal, leather, fabric, authoredFabric]);

    applyImportedMeshMaterials(mesh);

    const slots = mesh.material as THREE.MeshStandardMaterial[];
    expect(slots[0].metalness).toBeCloseTo(0.9, 5); // μέταλλο βάφτηκε
    expect(slots[0]).not.toBe(metal); // νέο instance (δεν μεταλλάχθηκε το κοινό template)
    expect(slots[1]).not.toBe(leather); // δέρμα βάφτηκε
    expect(slots[2]).not.toBe(fabric); // ύφασμα βάφτηκε
    expect(slots[3]).toBe(authoredFabric); // authored → ανέγγιχτο
  });
});

describe('applyImportedMeshMaterials — placeholder / κενά', () => {
  it('no-op σε mesh χωρίς όνομα υλικού (placeholder κουτί)', () => {
    const placeholder = defaultGray('');
    const mesh = meshWith(placeholder);
    applyImportedMeshMaterials(mesh);
    expect(mesh.material).toBe(placeholder);
  });

  it('δεν σκάει σε Object3D χωρίς meshes', () => {
    const empty = new THREE.Group();
    expect(() => applyImportedMeshMaterials(empty)).not.toThrow();
  });
});
