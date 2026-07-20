/**
 * ADR-683 Φ3.1 — όγκος & στεγανότητα εισαγόμενου πλέγματος (§10.2).
 *
 * Κάθε test καρφώνει μια **απόφαση κοστολόγησης**. Η αστοχία εδώ δεν βγάζει σφάλμα — βγάζει
 * **νούμερο στον προϋπολογισμό** που ο χρήστης εμπιστεύεται. Οι δύο κατευθύνσεις αστοχίας:
 *   - ψευδώς **κλειστό** → κοστολογεί όγκο κουτιού για ανοιχτό αντικείμενο (κάγκελο ×25)·
 *   - ψευδώς **ανοιχτό** → κρύβει τη μονάδα m³ από συμπαγή αντικείμενα που τη δικαιούνται.
 */

import * as THREE from 'three';

import { measureMeshSolid, MIN_SOLID_VOLUME_M3 } from '../mesh-solid-measure';

function cube(size = 1): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(size, size, size));
}

/** Αφαιρεί μία έδρα (2 τρίγωνα = 6 δείκτες) → κέλυφος με τρύπα. */
function openBox(): THREE.Mesh {
  const mesh = cube();
  const index = mesh.geometry.getIndex();
  if (index === null) throw new Error('BoxGeometry αναμένεται indexed');
  mesh.geometry.setIndex(Array.from(index.array).slice(0, index.count - 6));
  return mesh;
}

/** Αντιστρέφει τη φορά κάθε τριγώνου — νόμιμη εξαγωγή DCC, όχι αρνητικός όγκος. */
function reverseWinding(mesh: THREE.Mesh): THREE.Mesh {
  const index = mesh.geometry.getIndex();
  if (index === null) throw new Error('αναμένεται indexed');
  const flipped: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    flipped.push(index.getX(t), index.getX(t + 2), index.getX(t + 1));
  }
  mesh.geometry.setIndex(flipped);
  return mesh;
}

describe('measureMeshSolid — κλειστά πλέγματα', () => {
  it('μετρά τον πραγματικό όγκο κύβου 1×1×1', () => {
    const { isWatertight, volumeM3 } = measureMeshSolid(cube(1));

    expect(isWatertight).toBe(true);
    expect(volumeM3).toBeCloseTo(1, 6);
  });

  it('ψήνει την κλίμακα του κόμβου — ο όγκος ακολουθεί τον κύβο του συντελεστή', () => {
    const scaled = cube(1);
    scaled.scale.set(2, 2, 2);

    expect(measureMeshSolid(scaled).volumeM3).toBeCloseTo(8, 5);
  });

  it('ΔΕΝ επιστρέφει αρνητικό όγκο σε αντεστραμμένη φορά τριγώνων', () => {
    const { isWatertight, volumeM3 } = measureMeshSolid(reverseWinding(cube(1)));

    expect(isWatertight).toBe(true);
    expect(volumeM3).toBeCloseTo(1, 6);
  });

  it('κρατά ακρίβεια σε γεωαναφερμένες συντεταγμένες — αλλιώς ο όγκος γίνεται θόρυβος', () => {
    const far = cube(1);
    far.position.set(500_000, 0, 4_200_000);

    expect(measureMeshSolid(far).volumeM3).toBeCloseTo(1, 4);
  });

  it('συγκολλά τις διπλές κορυφές των σκληρών ακμών — αλλιώς ΚΑΘΕ στερεό θα έβγαινε ανοιχτό', () => {
    // Το BoxGeometry δίνει 24 κορυφές για 8 γεωμετρικά σημεία (χωριστά normals ανά έδρα).
    expect(cube().geometry.getAttribute('position').count).toBe(24);
    expect(measureMeshSolid(cube()).isWatertight).toBe(true);
  });
});

describe('measureMeshSolid — ό,τι ΔΕΝ στηρίζει την ερώτηση', () => {
  it('ανοιχτό κέλυφος → null, όχι όγκος κουτιού (η περίπτωση του κάγκελου)', () => {
    const { isWatertight, volumeM3 } = measureMeshSolid(openBox());

    expect(isWatertight).toBe(false);
    expect(volumeM3).toBeNull();
  });

  it('επίπεδο → null (δεν οριοθετεί χώρο)', () => {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(10, 4));

    expect(measureMeshSolid(plane).volumeM3).toBeNull();
  });

  it('κενή γεωμετρία → null, ποτέ 0', () => {
    const empty = new THREE.Mesh(new THREE.BufferGeometry());

    expect(measureMeshSolid(empty)).toEqual({ isWatertight: false, volumeM3: null });
  });

  it('εκφυλισμένο κλειστό κέλυφος (συμπτυγμένο) → null, ώστε να μην κοστολογηθεί 0 €', () => {
    const flat = cube(1);
    flat.scale.set(1, MIN_SOLID_VOLUME_M3 / 100, 1);

    expect(measureMeshSolid(flat).volumeM3).toBeNull();
  });

  it('μη πολλαπλή γεωμετρία (τρίτο τρίγωνο σε υπάρχουσα ακμή) → null', () => {
    const mesh = cube();
    const index = mesh.geometry.getIndex();
    if (index === null) throw new Error('αναμένεται indexed');
    // Επανάληψη του πρώτου τριγώνου → οι ακμές του εμφανίζονται τρεις φορές.
    mesh.geometry.setIndex([...Array.from(index.array), index.getX(0), index.getX(1), index.getX(2)]);

    expect(measureMeshSolid(mesh).isWatertight).toBe(false);
  });
});

describe('measureMeshSolid — non-indexed γεωμετρία', () => {
  it('χειρίζεται κλειστό πλέγμα χωρίς index buffer', () => {
    const mesh = new THREE.Mesh(cube(1).geometry.toNonIndexed());

    expect(mesh.geometry.getIndex()).toBeNull();
    expect(measureMeshSolid(mesh).volumeM3).toBeCloseTo(1, 6);
  });
});
