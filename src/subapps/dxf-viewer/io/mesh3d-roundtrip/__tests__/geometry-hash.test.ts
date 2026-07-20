/**
 * ADR-683 Φ2 — geometry fingerprint (SSoT export + import).
 *
 * Κάθε test καρφώνει μια **απόφαση** που, αν σπάσει, δεν βγάζει σφάλμα αλλά **λάθος ερώτηση στον
 * χρήστη**: είτε ρωτά για στοιχεία που κανείς δεν άγγιξε (θόρυβος → το gate γίνεται άχρηστο),
 * είτε δεν ρωτά για στοιχεία που όντως άλλαξαν (σιωπηλή απώλεια — το χειρότερο).
 */

import * as THREE from 'three';
import {
  computeGeometryFingerprint,
  compareGeometry,
  GEOMETRY_QUANTUM_M,
} from '../geometry-hash';

function box(w: number, h: number, d: number, segments = 1): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d, segments, segments, segments));
}

/** Ίδιο σχήμα, με θόρυβο float κάτω από την ανοχή του περιγραφέα (αλλά πάνω από τον κάδο). */
function jitter(mesh: THREE.Mesh, amount: number): THREE.Mesh {
  const position = mesh.geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    // Ντετερμινιστικός «θόρυβος» — ποτέ Math.random σε test.
    const sign = i % 2 === 0 ? 1 : -1;
    position.setX(i, position.getX(i) + sign * amount);
    position.setZ(i, position.getZ(i) - sign * amount);
  }
  position.needsUpdate = true;
  return mesh;
}

describe('computeGeometryFingerprint', () => {
  it('gives the SAME hash for the same shape — αλλιώς κάθε αμετάβλητο στοιχείο θα ρωτούσε', () => {
    const a = computeGeometryFingerprint(box(1, 3, 1));
    const b = computeGeometryFingerprint(box(1, 3, 1));

    expect(a).not.toBeNull();
    expect(a?.hash).toBe(b?.hash);
  });

  it('is position-independent — το floor stacking / re-centring δεν είναι αλλαγή σχήματος', () => {
    const moved = box(1, 3, 1);
    moved.position.set(10, 20, 30);

    expect(computeGeometryFingerprint(moved)?.hash).toBe(computeGeometryFingerprint(box(1, 3, 1))?.hash);
  });

  it('bakes the node scale — μεγέθυνση κόμβου ΕΙΝΑΙ αλλαγή σχήματος', () => {
    const scaled = box(1, 3, 1);
    scaled.scale.set(1, 2, 1);

    expect(computeGeometryFingerprint(scaled)?.hash).not.toBe(
      computeGeometryFingerprint(box(1, 3, 1))?.hash,
    );
  });

  it('records the real dimensions in the signature (m)', () => {
    const signature = computeGeometryFingerprint(box(1, 3, 2))?.signature;

    expect(signature?.sizeM[0]).toBeCloseTo(1, 6);
    expect(signature?.sizeM[1]).toBeCloseTo(3, 6);
    expect(signature?.sizeM[2]).toBeCloseTo(2, 6);
    // 2·(1·3) + 2·(1·2) + 2·(3·2) = 6 + 4 + 12
    expect(signature?.areaM2).toBeCloseTo(22, 5);
  });

  it('returns null for geometry with no vertices — «άγνωστο», ποτέ «ίδιο»', () => {
    const empty = new THREE.Mesh(new THREE.BufferGeometry());

    expect(computeGeometryFingerprint(empty)).toBeNull();
  });
});

describe('compareGeometry', () => {
  it('identical — ίδιο ακριβές hash (κατάσταση A/B: εφάρμοσε την εμφάνιση αυτόματα)', () => {
    const a = computeGeometryFingerprint(box(1, 3, 1));
    const b = computeGeometryFingerprint(box(1, 3, 1));

    expect(compareGeometry(a, b)).toBe('identical');
  });

  it('equivalent — θόρυβος float σπάει το hash αλλά ΟΧΙ τον περιγραφέα', () => {
    const noise = GEOMETRY_QUANTUM_M * 3; // σπάει σίγουρα κάδους, μένει κάτω από το 1 mm
    const clean = computeGeometryFingerprint(box(1, 3, 1));
    const noisy = computeGeometryFingerprint(jitter(box(1, 3, 1), noise));

    expect(noisy?.hash).not.toBe(clean?.hash);
    expect(compareGeometry(clean, noisy)).toBe('equivalent');
  });

  it('equivalent — ο παραλήπτης ξανα-τριγωνοποίησε (άλλα πλήθη, ίδιο σχήμα)', () => {
    const coarse = computeGeometryFingerprint(box(1, 3, 1, 1));
    const fine = computeGeometryFingerprint(box(1, 3, 1, 2));

    expect(fine?.signature.triangleCount).toBeGreaterThan(coarse?.signature.triangleCount ?? 0);
    expect(compareGeometry(coarse, fine)).toBe('equivalent');
  });

  it('changed — «ο εξωτερικός σήκωσε το στηθαίο» (ADR-683 §5 κατάσταση C)', () => {
    const before = computeGeometryFingerprint(box(0.25, 1.0, 3));
    const after = computeGeometryFingerprint(box(0.25, 1.1, 3));

    expect(compareGeometry(before, after)).toBe('changed');
  });

  it('fails closed — άγνωστο fingerprint σε οποιαδήποτε πλευρά ⇒ ρώτα, μη μαντεύεις', () => {
    const known = computeGeometryFingerprint(box(1, 1, 1));

    expect(compareGeometry(known, null)).toBe('changed');
    expect(compareGeometry(null, known)).toBe('changed');
    expect(compareGeometry(null, null)).toBe('changed');
  });
});
