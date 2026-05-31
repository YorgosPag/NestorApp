/**
 * Column piece geometry (ADR-401 Phase F.2) — μεταβλητή/κεκλιμένη κορυφή & βάση κολώνας.
 *
 * Μια κολώνα που κάνει `attach` την κορυφή ή/και τη βάση της σε structural host
 * (δοκάρι / πλάκα / στέγη) σταματά **ανά γωνία του footprint** στην παρειά του
 * host (lower-envelope κορυφής / upper-envelope βάσης — βλ. `column-vertical-profile.ts`).
 * Όταν διαφορετικές γωνίες πέφτουν σε διαφορετικά / κεκλιμένα hosts, οι γωνίες
 * διαφέρουν ⇒ **στρεβλό/κεκλιμένο** prism που το `ExtrudeGeometry` (σταθερό depth)
 * δεν μπορεί να βγάλει. Εδώ χτίζουμε ρητό στερεό prism:
 *
 *   - κάτω δακτύλιος: μία κορυφή ανά footprint-corner στο `cornerBaseLocalM[i]`
 *   - πάνω δακτύλιος:  μία κορυφή ανά footprint-corner στο `cornerTopLocalM[i]`
 *   - καπάκια (top/bottom): τριγωνοποίηση του footprint (concave-safe — L/T/I) μέσω
 *     `THREE.ShapeUtils.triangulateShape`, ίδιο index set και στα δύο, αντίστροφη φορά
 *   - πλευρές: ένα quad (2 τρίγωνα) ανά ακμή του footprint
 *
 * Αναλογεί στον `buildSlopedWallPieceGeometry` (8-vertex wedge) γενικευμένο σε
 * **N-vertex per-corner** prism — η κολώνα έχει footprint polygon, όχι έναν άξονα.
 *
 * Coordinate convention (ίδιο με `BimToThreeConverter`): plan `(x, y)` → world
 * `(x, height, -y)`. Η γεωμετρία είναι σε **floor-local Y** (ο καλών την
 * τοποθετεί στο `floorY`). Το footprint `(x, y)` είναι ήδη σε scene units (m)·
 * μόνο το Z μετατρέπεται mm→m στον καλούντα.
 *
 * @see column-vertical-profile.ts — ο resolver που παράγει τα `cornerTopZmm`/`cornerBaseZmm`
 * @see wall-piece-geometry.ts — ο δίδυμος (κεκλιμένη κορυφή/βάση τοίχου)
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase F)
 */

import * as THREE from 'three';

/** Ελάχιστο 2D σημείο plan (scene units). */
interface FootPt {
  readonly x: number;
  readonly y: number;
}

const DEGENERATE_EPS = 1e-6;

/**
 * Στερεό prism κολώνας με per-corner κορυφή & βάση (floor-local Y, σε μέτρα).
 *
 * @param footprint  Κλειστό πολύγωνο footprint (scene units, CCW — όπως το βγάζει
 *                   το `computeColumnGeometry`). `n = footprint.length` γωνίες.
 * @param cornerBaseLocalM  Local-Y (m) της βάσης ανά γωνία — μήκος `n`.
 * @param cornerTopLocalM   Local-Y (m) της κορυφής ανά γωνία — μήκος `n`.
 * @returns BufferGeometry, ή null αν εκφυλίζεται (κορυφή ≤ βάση σε ΟΛΕΣ τις γωνίες,
 *          ή < 3 γωνίες / αναντιστοιχία μηκών).
 */
export function buildColumnPrismGeometry(
  footprint: readonly FootPt[],
  cornerBaseLocalM: readonly number[],
  cornerTopLocalM: readonly number[],
): THREE.BufferGeometry | null {
  const n = footprint.length;
  if (n < 3 || cornerBaseLocalM.length !== n || cornerTopLocalM.length !== n) return null;

  // Εκφυλισμός: αν καμία γωνία δεν έχει θετικό ύψος → null (ο καλών κάνει skip).
  let anyHeight = false;
  for (let i = 0; i < n; i++) {
    if (cornerTopLocalM[i] - cornerBaseLocalM[i] > DEGENERATE_EPS) { anyHeight = true; break; }
  }
  if (!anyHeight) return null;

  // 2n κορυφές: [0..n) κάτω δακτύλιος, [n..2n) πάνω δακτύλιος.
  // plan (x, y) → world (x, Y, -y). Y = local meters (base/top ανά γωνία).
  const positions = new Float32Array(2 * n * 3);
  for (let i = 0; i < n; i++) {
    const p = footprint[i];
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = cornerBaseLocalM[i];
    positions[i * 3 + 2] = -p.y;
    const t = (n + i) * 3;
    positions[t] = p.x;
    positions[t + 1] = cornerTopLocalM[i];
    positions[t + 2] = -p.y;
  }

  const index: number[] = [];

  // ── Καπάκια: τριγωνοποίηση του footprint (concave-safe). ───────────────────
  // Το footprint είναι CCW στο plan. Υπό τον μετασχηματισμό (x,y)→(x,·,-y) (κατοπτρισμός
  // στον y) η φορά αντιστρέφεται: ένα CCW-plan τρίγωνο στον ΠΑΝΩ δακτύλιο δίνει normal
  // **+Y** (κοιτά πάνω ✓), οπότε ο ΚΑΤΩ δακτύλιος χρειάζεται αντίστροφη φορά για να
  // κοιτά **κάτω** (-Y).
  const contour = footprint.map((p) => new THREE.Vector2(p.x, p.y));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  for (const [a, b, c] of faces) {
    // Bottom cap (κοιτά κάτω): αντίστροφη φορά.
    index.push(a, c, b);
    // Top cap (κοιτά πάνω): ίδια φορά με το CCW footprint, +n offset.
    index.push(n + a, n + b, n + c);
  }

  // ── Πλευρές: ένα quad ανά ακμή i→j (j = (i+1) mod n). ──────────────────────
  // Για CCW footprint, η σειρά (bot_i, bot_j, top_j) δίνει **εξωτερικό** normal
  // (παράγωγο: u×v ∝ (dy, 0, dx) = outward της CCW ακμής). Mirror του wall wedge.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const bi = i, bj = j, ti = n + i, tj = n + j;
    index.push(bi, bj, tj);
    index.push(bi, tj, ti);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}
