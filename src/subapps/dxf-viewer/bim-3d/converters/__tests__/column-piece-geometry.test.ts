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

/**
 * Y-τιμές ΟΛΩΝ των κορυφών στη world-θέση μιας plan-γωνίας `(px,py)` → world
 * `(px, ·, -py)`. Το geometry είναι **non-indexed/flat** (κάθε τρίγωνο ξεχωριστές
 * κορυφές) → μια plan-γωνία εμφανίζεται σε πολλές κορυφές· μαζεύουμε όλα τα Y.
 */
function cornerYs(geo: THREE.BufferGeometry, px: number, py: number): number[] {
  const pos = geo.getAttribute('position');
  const ys: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i) - px) < 1e-6 && Math.abs(pos.getZ(i) - -py) < 1e-6) {
      ys.push(pos.getY(i));
    }
  }
  return ys;
}

describe('F.2 — flat prism (όλες οι γωνίες ίσες)', () => {
  it('τετράγωνο, base 0 / top 3 → non-indexed flat (36 κορυφές), σωστά Y', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [3, 3, 3, 3])!;
    expect(geo).not.toBeNull();
    // Flat shading → non-indexed: 12 τρίγωνα (4 cap + 8 side) × 3 = 36 κορυφές.
    expect(geo.getIndex()).toBeNull();
    expect(geo.getAttribute('position').count).toBe(36);
    // Κάθε plan-γωνία εμφανίζεται με Y ∈ {0 (base), 3 (top)}.
    for (const c of SQUARE) {
      const ys = cornerYs(geo, c.x, c.y);
      expect(Math.min(...ys)).toBeCloseTo(0, TOL);
      expect(Math.max(...ys)).toBeCloseTo(3, TOL);
    }
  });

  it('plan (x,y) → world (x, Y, -y)', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [3, 3, 3, 3])!;
    // corner (1,1) → world (1, ·, -1): υπάρχει κορυφή εκεί.
    expect(cornerYs(geo, 1, 1).length).toBeGreaterThan(0);
  });
});

describe('F.2 — per-corner κεκλιμένη κορυφή', () => {
  it('top γωνίες 2.0/2.0/3.0/3.0 → στρεβλό (διαφορετικά top Y ανά γωνία)', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [2, 2, 3, 3])!;
    // corner 0 (0,0) & 1 (1,0) → top 2· corner 2 (1,1) & 3 (0,1) → top 3.
    expect(Math.max(...cornerYs(geo, 0, 0))).toBeCloseTo(2, TOL);
    expect(Math.max(...cornerYs(geo, 1, 0))).toBeCloseTo(2, TOL);
    expect(Math.max(...cornerYs(geo, 1, 1))).toBeCloseTo(3, TOL);
    expect(Math.max(...cornerYs(geo, 0, 1))).toBeCloseTo(3, TOL);
  });

  it('μεταβλητή βάση (base-attach): base γωνίες -0.5/-0.5/0/0', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [-0.5, -0.5, 0, 0], [3, 3, 3, 3])!;
    expect(Math.min(...cornerYs(geo, 0, 0))).toBeCloseTo(-0.5, TOL); // corner 0
    expect(Math.min(...cornerYs(geo, 1, 1))).toBeCloseTo(0, TOL);    // corner 2
  });
});

describe('F.2 — concave footprint (L-shape)', () => {
  it('6 γωνίες → non-indexed flat, 20 τρίγωνα (concave-safe καπάκια)', () => {
    const base = new Array(6).fill(0);
    const top = new Array(6).fill(3);
    const geo = buildColumnPrismGeometry(L_SHAPE, base, top)!;
    expect(geo).not.toBeNull();
    // 2 καπάκια × (6−2) τρίγωνα + 6 πλευρές × 2 = 8 + 12 = 20 τρίγωνα × 3 = 60 κορυφές.
    expect(geo.getIndex()).toBeNull();
    expect(geo.getAttribute('position').count).toBe(20 * 3);
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
  /** Γεωμετρικό normal του τριγώνου `tri` (non-indexed: κορυφές 3·tri..3·tri+2). */
  function faceNormal(geo: THREE.BufferGeometry, tri: number): THREE.Vector3 {
    const pos = geo.getAttribute('position');
    const a = new THREE.Vector3().fromBufferAttribute(pos, 3 * tri);
    const b = new THREE.Vector3().fromBufferAttribute(pos, 3 * tri + 1);
    const c = new THREE.Vector3().fromBufferAttribute(pos, 3 * tri + 2);
    return new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  }

  it('bottom cap τρίγωνο (tri 0) κοιτά -Y, top cap (tri 1) κοιτά +Y', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [3, 3, 3, 3])!;
    // Layout (non-indexed, σειρά index build): ανά cap-face → [bottom-tri, top-tri].
    expect(faceNormal(geo, 0).y).toBeLessThan(-0.9);  // bottom → κάτω
    expect(faceNormal(geo, 1).y).toBeGreaterThan(0.9); // top → πάνω
  });

  it('flat caps: top κορυφές normal +Y ≈ 1 (μηδέν smooth-tilt — ομοιόχρωμος φωτισμός)', () => {
    // Regression του «διαφορετικές σκιές»: indexed computeVertexNormals έμιξε τα cap
    // normals με τις πλευρές (normal.y ≈ 0.09)· flat → επίπεδες έδρες (+Y ≈ 1).
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [3, 3, 3, 3])!;
    const nrm = geo.getAttribute('normal');
    const pos = geo.getAttribute('position');
    let topCapCount = 0;
    for (let i = 0; i < nrm.count; i++) {
      if (Math.abs(pos.getY(i) - 3) < 1e-6 && nrm.getY(i) > 0.5) { // κορυφή top cap (κοιτά πάνω)
        expect(nrm.getY(i)).toBeCloseTo(1, 4);
        topCapCount++;
      }
    }
    expect(topCapCount).toBeGreaterThan(0);
  });

  it('πλευρικό τρίγωνο εξωτερικό normal (CCW footprint → προς τα έξω)', () => {
    const geo = buildColumnPrismGeometry(SQUARE, [0, 0, 0, 0], [3, 3, 3, 3])!;
    // Πλευρές ΜΕΤΑ τα καπάκια: cap-faces = 2·(n−2) = 4 τρίγωνα → πρώτο side = tri 4 (ακμή 0→1).
    const sideTri0 = 2 * (SQUARE.length - 2);
    const nrm = faceNormal(geo, sideTri0);
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
