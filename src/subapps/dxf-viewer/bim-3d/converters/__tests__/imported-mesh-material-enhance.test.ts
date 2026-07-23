/**
 * imported-mesh-material-enhance.test — ADR-683 Φ4 + §10.6 (culling fix).
 *
 * Δύο συμβόλαια:
 *  1. **Preset gate** (Φ4): το safety-net preset εφαρμόζεται ΜΟΝΟ σε αδιαμόρφωτο-default υλικό με
 *     γνωστό όνομα· τα authored/textured υλικά ΔΕΝ ξαναβάφονται (η ΕΜΦΑΝΙΣΗ τους μένει).
 *  2. **DoubleSide (§10.6)**: ΚΑΘΕ material εισαγόμενου mesh βγαίνει `THREE.DoubleSide` — το winding
 *     του partner .glb είναι αναξιόπιστο (mirror/negative-scale, ασυνεπείς exporters), οπότε render-
 *     άρουμε double-sided όπως Revit/C4D/Sketchfab, αντί να «διορθώνουμε» winding ανά face. Τα authored
 *     υλικά δεν μένουν το ίδιο instance (γίνονται cached DoubleSide clone), αλλά κρατούν την εμφάνισή τους.
 */

import * as THREE from 'three';
import { applyImportedMeshMaterials } from '../imported-mesh-material-enhance';

/** Ένα «αδιαμόρφωτο default» υλικό όπως το βγάζει ο Blender glTF export (0.8 γκρι, ματ, non-metal, FrontSide). */
function defaultGray(name: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ name, color: 0xcccccc, metalness: 0, roughness: 1 });
}

function meshWith(material: THREE.Material | THREE.Material[]): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
}

const only = (mesh: THREE.Mesh): THREE.MeshStandardMaterial =>
  mesh.material as THREE.MeshStandardMaterial;

describe('applyImportedMeshMaterials — gate «αδιαμόρφωτο default»', () => {
  it('βάφει default-γκρι υλικό με γνωστό όνομα → metal preset (metalness 0.9), DoubleSide', () => {
    const mesh = meshWith(defaultGray('HMI-_Polished_Al'));
    applyImportedMeshMaterials(mesh);
    expect(only(mesh).metalness).toBeCloseTo(0.9, 5);
    expect(only(mesh).side).toBe(THREE.DoubleSide);
  });

  it('authored υλικό (metalness=1): εμφάνιση αμετάβλητη ΑΛΛΑ DoubleSide clone (όχι re-preset)', () => {
    const authored = new THREE.MeshStandardMaterial({
      name: 'HMI-_Polished_Al',
      color: 0xc0c0c0,
      metalness: 1,
      roughness: 0.2,
    });
    const mesh = meshWith(authored);
    applyImportedMeshMaterials(mesh);
    expect(only(mesh)).not.toBe(authored); // DoubleSide variant, όχι το FrontSide πρωτότυπο
    expect(only(mesh).metalness).toBe(1); // authored look σεβαστό (δεν presettάρεται)
    expect(only(mesh).side).toBe(THREE.DoubleSide);
  });

  it('textured υλικό: μοιράζεται την υφή, DoubleSide clone, ΔΕΝ presettάρεται', () => {
    const textured = defaultGray('HMI-_Polished_Al');
    const tex = new THREE.Texture();
    textured.map = tex;
    const mesh = meshWith(textured);
    applyImportedMeshMaterials(mesh);
    expect(only(mesh)).not.toBe(textured);
    expect(only(mesh).map).toBe(tex); // ΙΔΙΟ texture object (clone μοιράζεται map refs)
    expect(only(mesh).side).toBe(THREE.DoubleSide);
  });

  it('default-γκρι με ΑΓΝΩΣΤΟ όνομα (gate #2: preset=null): εμφάνιση ίδια, DoubleSide clone', () => {
    const unknown = defaultGray('SomeRandomThing');
    const mesh = meshWith(unknown);
    applyImportedMeshMaterials(mesh);
    expect(only(mesh)).not.toBe(unknown);
    expect(only(mesh).metalness).toBe(0); // δεν presettάρεται (άγνωστο όνομα)
    expect(only(mesh).side).toBe(THREE.DoubleSide);
  });

  it('authored ΣΚΟΥΡΟ χρώμα (όχι default-γκρι) με γνωστό όνομα: χρώμα σεβαστό, DoubleSide clone', () => {
    const darkAuthored = new THREE.MeshStandardMaterial({
      name: 'Leather_Black',
      color: 0x141210, // σκούρο → gate #1 false → δεν presettάρεται
      metalness: 0,
      roughness: 0.5,
    });
    const mesh = meshWith(darkAuthored);
    applyImportedMeshMaterials(mesh);
    expect(only(mesh)).not.toBe(darkAuthored);
    expect(only(mesh).color.getHexString()).toBe('141210'); // authored χρώμα σεβαστό
    expect(only(mesh).side).toBe(THREE.DoubleSide);
  });
});

describe('applyImportedMeshMaterials — multi-slot mesh (η καρέκλα = 4 slots)', () => {
  it('βάφει ανά slot ανεξάρτητα, κρατά authored slot, ΟΛΑ DoubleSide', () => {
    const metal = defaultGray('HMI-_Polished_Al');
    const leather = defaultGray('HMI-Aeron-Leathe');
    const fabric = defaultGray('HMI-3D01__Pellic');
    const authoredFabric = new THREE.MeshStandardMaterial({
      name: 'HMI-Aeron-G1__Gr',
      color: 0x2b2f34,
      metalness: 0,
      roughness: 0.8,
    }); // authored σκούρο → εμφάνιση μένει, αλλά DoubleSide clone
    const mesh = meshWith([metal, leather, fabric, authoredFabric]);

    applyImportedMeshMaterials(mesh);

    const slots = mesh.material as THREE.MeshStandardMaterial[];
    expect(slots[0].metalness).toBeCloseTo(0.9, 5); // μέταλλο βάφτηκε
    expect(slots[0]).not.toBe(metal); // νέο instance (δεν μεταλλάχθηκε το κοινό template)
    expect(slots[1]).not.toBe(leather); // δέρμα βάφτηκε
    expect(slots[2]).not.toBe(fabric); // ύφασμα βάφτηκε
    expect(slots[3]).not.toBe(authoredFabric); // authored → DoubleSide clone
    expect(slots[3].color.getHexString()).toBe('2b2f34'); // authored χρώμα σεβαστό
    slots.forEach((s) => expect(s.side).toBe(THREE.DoubleSide)); // §10.6 — όλα double-sided
  });
});

// ADR-686 — user appearance override νικά το preset/embedded (κοινό `resolveFaceMaterial` SSoT).
describe('applyImportedMeshMaterials — appearance override (ADR-686)', () => {
  it('base override (*) βάφει ΟΛΑ τα slots με το χρώμα (ΣΩΜΑ), DoubleSide', () => {
    const metal = defaultGray('HMI-_Polished_Al');
    const leather = defaultGray('HMI-Aeron-Leathe');
    const mesh = meshWith([metal, leather]);
    applyImportedMeshMaterials(mesh, { '*': { colorHex: '#ff0000' } });
    const slots = mesh.material as THREE.MeshStandardMaterial[];
    expect(slots[0]).not.toBe(metal);
    expect(slots[0].color.getHexString()).toBe('ff0000');
    expect(slots[1].color.getHexString()).toBe('ff0000');
    slots.forEach((s) => expect(s.side).toBe(THREE.DoubleSide));
  });

  // ADR-686 Φ5 — το πραγματικό σενάριο του Material Mapping dialog: ο χρήστης διαλέγει catalog υλικό
  // (τούβλο) όχι σκέτο χρώμα. Πριν το registry fix, σε realistic OFF το `mat-brick` έβγαινε base look
  // (κανένας color provider δεν το γνώριζε) → η βαφή δεν φαινόταν.
  it('base override (*) με catalog materialId (τούβλο) βάφει — δεν μένει base look', () => {
    const src = defaultGray('HMI-_Polished_Al');
    const mesh = meshWith(src);
    applyImportedMeshMaterials(mesh, { '*': { materialId: 'mat-brick' } });
    expect(mesh.material).not.toBe(src); // αντικαταστάθηκε (βάφτηκε) αντί για base/preset
  });

  it('per-slot override (slot:name) βάφει ΜΟΝΟ το matching slot (ΠΟΛΥΓΩΝΑ), όλα DoubleSide', () => {
    const arm = defaultGray('Arm');
    // authored σκούρο + άγνωστο όνομα → χωρίς override + gate #1 false → εμφάνιση μένει (DoubleSide clone).
    const seat = new THREE.MeshStandardMaterial({ name: 'ZZ_Unknown', color: 0x141210, metalness: 0, roughness: 0.5 });
    const mesh = meshWith([arm, seat]);
    applyImportedMeshMaterials(mesh, { 'slot:Arm': { colorHex: '#00ff00' } });
    const slots = mesh.material as THREE.MeshStandardMaterial[];
    expect(slots[0].color.getHexString()).toBe('00ff00'); // Arm βάφτηκε (override)
    expect(slots[1]).not.toBe(seat); // Seat: DoubleSide clone (όχι το FrontSide πρωτότυπο)
    expect(slots[1].color.getHexString()).toBe('141210'); // αλλά εμφάνιση αμετάβλητη (χωρίς override)
    slots.forEach((s) => expect(s.side).toBe(THREE.DoubleSide));
  });

  it('override ΕΠΙΒΑΛΛΕΙ DoubleSide ακόμη κι όταν η πηγή είναι FrontSide (§10.6 — όχι τρύπες)', () => {
    const src = defaultGray('Arm'); // FrontSide (default)
    expect(src.side).toBe(THREE.FrontSide);
    const mesh = meshWith(src);
    applyImportedMeshMaterials(mesh, { 'slot:Arm': { colorHex: '#123456' } });
    const result = only(mesh);
    expect(result).not.toBe(src);
    expect(result.side).toBe(THREE.DoubleSide); // επιβλήθηκε, δεν κληρονομήθηκε το FrontSide
  });

  it('χωρίς override → αμετάβλητη preset συμπεριφορά (undefined faceAppearance), DoubleSide', () => {
    const metal = defaultGray('HMI-_Polished_Al');
    const mesh = meshWith(metal);
    applyImportedMeshMaterials(mesh, undefined);
    expect(only(mesh).metalness).toBeCloseTo(0.9, 5);
    expect(only(mesh).side).toBe(THREE.DoubleSide);
  });
});

// ADR-683 Φ4 — auto-tier από ΟΝΟΜΑ ΚΟΜΒΟΥ όταν το υλικό είναι ανώνυμο (πραγματικό HMI_Aeron:
// materials:[undefined], σημασιολογία μόνο στα node names HBase/HPellBk/HArmPads).
describe('applyImportedMeshMaterials — nodeName fallback (ανώνυμο partner υλικό)', () => {
  it('ανώνυμο default-γκρι + nodeName «HBase» → metal preset (μεταλλικό), DoubleSide', () => {
    const anonymous = defaultGray(''); // κανένα όνομα υλικού (πραγματικό HMI_Aeron)
    const mesh = meshWith(anonymous);
    applyImportedMeshMaterials(mesh, undefined, 'HBase');
    expect(mesh.material).not.toBe(anonymous); // αντικαταστάθηκε (νέο instance)
    expect(only(mesh).metalness).toBeCloseTo(0.9, 5);
    expect(only(mesh).side).toBe(THREE.DoubleSide);
  });

  it('ανώνυμο default-γκρι + nodeName «HPellBk» → fabric (ύφασμα, non-metal), DoubleSide', () => {
    const mesh = meshWith(defaultGray(''));
    applyImportedMeshMaterials(mesh, undefined, 'HPellBk');
    expect(only(mesh).metalness).toBe(0);
    expect(only(mesh).color.getHexString()).toBe('3a3d42');
    expect(only(mesh).side).toBe(THREE.DoubleSide);
  });

  it('όνομα υλικού κερδίζει το nodeName όταν αναγνωρίζεται', () => {
    const mesh = meshWith(defaultGray('HMI-_Polished_Al')); // υλικό=μέταλλο, κόμβος=ύφασμα
    applyImportedMeshMaterials(mesh, undefined, 'HPellBk');
    expect(only(mesh).metalness).toBeCloseTo(0.9, 5);
  });

  it('χωρίς nodeName ΚΑΙ χωρίς όνομα: καμία preset σημασιολογία, αλλά DoubleSide clone (όχι τρύπες)', () => {
    const placeholder = defaultGray('');
    const mesh = meshWith(placeholder);
    applyImportedMeshMaterials(mesh, undefined, undefined);
    expect(mesh.material).not.toBe(placeholder); // DoubleSide variant
    expect(only(mesh).metalness).toBe(0); // καμία preset βαφή (κανένα keyword)
    expect(only(mesh).side).toBe(THREE.DoubleSide);
  });
});

describe('applyImportedMeshMaterials — non-standard / κενά', () => {
  it('non-MeshStandardMaterial υλικό μένει ΑΝΕΓΓΙΧΤΟ (ο DoubleSide SSoT δεν το πιάνει)', () => {
    const basic = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = meshWith(basic);
    applyImportedMeshMaterials(mesh);
    expect(mesh.material).toBe(basic); // enhanceSlot: return material (δεν είναι Standard)
  });

  it('δεν σκάει σε Object3D χωρίς meshes', () => {
    const empty = new THREE.Group();
    expect(() => applyImportedMeshMaterials(empty)).not.toThrow();
  });
});
