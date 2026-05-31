/**
 * ADR-401 Phase F.2 — per-corner column prism (μεταβλητή/κεκλιμένη κορυφή & βάση).
 *
 * Καλύπτει το `buildColumnPrismGeometry`:
 *   - flat prism (όλες οι γωνίες ίσες) → σωστός αριθμός κορυφών + Y ανά δακτύλιο
 *   - per-corner κεκλιμένη κορυφή (γωνίες διαφέρουν → στρεβλό top)
 *   - μεταβλητή βάση (base-attach)
 *   - concave footprint (L-shape 6 γωνίες) → triangulated καπάκια
 *   - εκφυλισμός (κορυφή ≤ βάση παντού) → null
 *   - guards (λάθος μήκη / < 3 γωνίες)
 *   - φορά normals (top κοιτά πάνω, bottom κάτω, πλευρά εξωτερικά)
 *
 * Literal corner arrays — decoupled από τον resolver (όπως ο wall stepped test).
 */

import * as THREE from 'three';
import { buildColumnPrismGeometry } from '../column-piece-geometry';

const TOL = 6;

/** Τετράγωνο 1×1 footprint (CCW, scene units m) γύρω από το origin. */
const SQUARE = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** L-shape 6-vertex CCW (concave). */
const L_SHAPE = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 2 },
  { x: 0, y: 2 },
];

describe('F.2 — flat prism (όλες οι γωνίες ίσες)', () => {
  it('τετράγωνο, base 0 / top 3 → 8 κορυφές, σωστά Y ανά δακτύλιο', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [3, 3, 3, 3])!;
    expect(geo).not.toBeNull();
    const pos = geo.getAttribute('position');
    expect(pos.count).toBe(8); // 2n = 8
    // Κάτω δακτύλιος [0..4): Y = 0.
    for (let i = 0; i < 4; i++) expect(pos.getY(i)).toBeCloseTo(0, TOL);
    // Πάνω δακτύλιος [4..8): Y = 3.
    for (let i = 4; i < 8; i++) expect(pos.getY(i)).toBeCloseTo(3, TOL);
  });

  it('plan (x,y) → world (x, Y, -y)', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [3, 3, 3, 3])!;
    const pos = geo.getAttribute('position');
    // corner 2 = (1,1) → world (1, ·, -1)
    expect(pos.getX(2)).toBeCloseTo(1, TOL);
    expect(pos.getZ(2)).toBeCloseTo(-1, TOL);
  });
});

describe('F.2 — per-corner κεκλιμένη κορυφή', () => {
  it('top γωνίες 2.0/2.0/3.0/3.0 → στρεβλό (διαφορετικά top Y)', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [2, 2, 3, 3])!;
    const pos = geo.getAttribute('position');
    expect(pos.getY(4)).toBeCloseTo(2, TOL); // top corner 0
    expect(pos.getY(5)).toBeCloseTo(2, TOL); // top corner 1
    expect(pos.getY(6)).toBeCloseTo(3, TOL); // top corner 2
    expect(pos.getY(7)).toBeCloseTo(3, TOL); // top corner 3
  });

  it('μεταβλητή βάση (base-attach): base γωνίες -0.5/-0.5/0/0', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [-0.5, -0.5, 0, 0], [3, 3, 3, 3])!;
    const pos = geo.getAttribute('position');
    expect(pos.getY(0)).toBeCloseTo(-0.5, TOL);
    expect(pos.getY(2)).toBeCloseTo(0, TOL);
  });
});

describe('F.2 — concave footprint (L-shape)', () => {
  it('6 γωνίες → 12 κορυφές, triangulated καπάκια (concave-safe)', () => {
    const base = new Array(6).fill(0);
    const top = new Array(6).fill(3);
    const geo = buildColumnPrismGeometry(L_SHAPE, base, top)!;
    expect(geo).not.toBeNull();
    const pos = geo.getAttribute('position');
    expect(pos.count).toBe(12); // 2 × 6
    // index: 2 καπάκια × (6−2) τρίγωνα + 6 πλευρές × 2 τρίγωνα = 8 + 12 = 20 τρίγωνα.
    expect(geo.getIndex()!.count).toBe(20 * 3);
  });
});

describe('F.2 — εκφυλισμός & guards', () => {
  it('κορυφή ≤ βάση σε ΟΛΕΣ τις γωνίες → null', () => {
    expect(buildColumnPrismGeometry(SQUARE, [3, 3, 3, 3], [3, 3, 3, 3])).toBeNull();
  });

  it('μερικός εκφυλισμός (μία γωνία θετική) → geometry (όχι null)', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [0, 0, 0, 2]);
    expect(geo).not.toBeNull();
  });

  it('< 3 γωνίες → null', () => {
    expect(buildColumnPrismGeometry([{ x: 0, y: 0 }, { x: 1, y: 0 }], [0, 0], [3, 3])).toBeNull();
  });

  it('αναντιστοιχία μηκών → null', () => {
    expect(buildColumnPrismGeometry(SQUARE, [0, 0, 0], [3, 3, 3, 3])).toBeNull();
  });
});

describe('F.2 — φορά εδρών (winding → φωτισμός)', () => {
  /** Γεωμετρικό normal τριγώνου index[k..k+2] από τις θέσεις. */
  function faceNormal(geo: THREE.BufferGeometry, triStart: number): THREE.Vector3 {
    const idx = geo.getIndex()!;
    const pos = geo.getAttribute('position');
    const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(triStart));
    const b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(triStart + 1));
    const c = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(triStart + 2));
    return new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  }

  it('bottom cap τρίγωνο (index 0) κοιτά -Y, top cap (index 1) κοιτά +Y', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [3, 3, 3, 3])!;
    // index layout: ανά triangulated face → [bottom-tri, top-tri], μετά οι πλευρές.
    expect(faceNormal(geo, 0).y).toBeLessThan(-0.9);  // bottom → κάτω
    expect(faceNormal(geo, 3).y).toBeGreaterThan(0.9); // top → πάνω
  });

  it('πλευρικό τρίγωνο εξωτερικό normal (CCW footprint → προς τα έξω)', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [3, 3, 3, 3])!;
    // Οι πλευρές μπαίνουν ΤΕΛΕΥΤΑΙΕΣ: n ακμές × 2 τρίγωνα × 3 indices = 24 για square.
    // Πρώτο side-τρίγωνο = ακμή 0→1 = (0,0)→(1,0).
    const sideStart = geo.getIndex()!.count - SQUARE.length * 2 * 3;
    const nrm = faceNormal(geo, sideStart);
    expect(Math.abs(nrm.y)).toBeLessThan(1e-3); // οριζόντιο
    // ακμή κατά +X, footprint interior προς +Y(plan) → εξωτερικό plan -Y → world +Z.
    expect(nrm.z).toBeGreaterThan(0.9);
  });

  it('όλα τα vertex normals μοναδιαία (valid mesh)', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [3, 3, 3, 3])!;
    const normals = geo.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) {
      const len = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i));
      expect(len).toBeCloseTo(1, 4);
    }
  });
});
