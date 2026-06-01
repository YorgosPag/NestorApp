/**
 * Wall piece geometry (ADR-401 Phase B2) — κεκλιμένη/σκαλωτή κορυφή τοίχου.
 *
 * Ένα `WallOpeningPiece` με **κεκλιμένη** κορυφή (`zTopAM ≠ zTopBM` — στέγη /
 * κεκλιμένο δοκάρι) δεν μπορεί να βγει με `ExtrudeGeometry` (σταθερό depth). Εδώ
 * χτίζουμε ένα στερεό «σφήνα» (wedge): επίπεδη βάση στο `zBotM`, κεκλιμένη κορυφή
 * που πάει από `zTopAM` (boundary `a`) σε `zTopBM` (boundary `b`). Επίπεδη κορυφή
 * (`zTopAM === zTopBM`) εξακολουθεί να βγαίνει φθηνότερα με `ExtrudeGeometry` στον
 * καλούντα — αυτό το builder είναι ΜΟΝΟ για την κεκλιμένη περίπτωση.
 *
 * Coordinate convention (ίδιο με BimToThreeConverter): plan `(x, y)` → world
 * `(x, height, -y)`. Η γεωμετρία είναι σε **floor-local Y** (ο καλών την
 * τοποθετεί στο `floorY`).
 *
 * @see wall-opening-pieces.ts — η πηγή των `WallOpeningPiece` (quad + zBot/zTopA/zTopB)
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.4
 */

import * as THREE from 'three';
import type { WallOpeningPiece } from './wall-opening-pieces';
import type { WallTopLoftBand } from './wall-top-clip';

const LOFT_DEGENERATE_EPS = 1e-6;

/**
 * Στερεό «σφήνα» για κομμάτι τοίχου με κεκλιμένη κορυφή **ή/και** κεκλιμένο πάτο
 * (ADR-401 (γ) base-attach). 8 κορυφές (4 βάση @zBotA/@zBotB, 4 κορυφή
 * @zTopA/@zTopB), 6 έδρες (12 τρίγωνα). Επιστρέφει null αν το ύψος εκφυλίζεται
 * (κορυφή ≤ βάση παντού).
 */
export function buildSlopedWallPieceGeometry(piece: WallOpeningPiece): THREE.BufferGeometry | null {
  const { quad, zBotAM, zBotBM, zTopAM, zTopBM } = piece;
  if (zTopAM - zBotAM < 1e-6 && zTopBM - zBotBM < 1e-6) return null;

  const [pAo, pBo, pBi, pAi] = quad;
  // Y ανά boundary: a-boundary = quad[0]/quad[3] (zBotA/zTopA), b-boundary =
  // quad[1]/quad[2] (zBotB/zTopB). plan (x, y) → world (x, height, -y).
  const positions = new Float32Array([
    // bottom: Ao@zBotA, Bo@zBotB, Bi@zBotB, Ai@zBotA
    pAo.x, zBotAM, -pAo.y, // 0
    pBo.x, zBotBM, -pBo.y, // 1
    pBi.x, zBotBM, -pBi.y, // 2
    pAi.x, zBotAM, -pAi.y, // 3
    // top: Ao@zTopA, Bo@zTopB, Bi@zTopB, Ai@zTopA
    pAo.x, zTopAM, -pAo.y, // 4
    pBo.x, zTopBM, -pBo.y, // 5
    pBi.x, zTopBM, -pBi.y, // 6
    pAi.x, zTopAM, -pAi.y, // 7
  ]);

  // 6 έδρες κουτιού (CCW προς τα έξω → computeVertexNormals για σωστό φωτισμό).
  const index = [
    // bottom (κοιτά κάτω)
    0, 2, 1, 0, 3, 2,
    // top (κοιτά πάνω)
    4, 5, 6, 4, 6, 7,
    // outer side (Ao→Bo)
    0, 1, 5, 0, 5, 4,
    // inner side (Bi→Ai)
    2, 3, 7, 2, 7, 6,
    // end A (Ai→Ao)
    3, 0, 4, 3, 4, 7,
    // end B (Bo→Bi)
    1, 2, 6, 1, 6, 5,
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/**
 * ADR-404 ↔ ADR-401 (Phase 4.2) — **loft band** της μεταβατικής ζώνης `Hu→nominal`
 * γερμένου τοίχου κάτω από κατακόρυφο δοκάρι.
 *
 * Αντίθετα από τον `buildColumnPrismGeometry` (ΕΝΑ footprint + per-corner ύψη), εδώ
 * οι **δύο δακτύλιοι έχουν διαφορετική κάτοψη**: `bottomFootprint @huLocalM` και
 * `topFootprint @nominalLocalM` (1:1 αντιστοιχία κορυφών, βλ. `clipWallBandTopRegionsTilted`).
 * Έτσι, μετά τον ομοιόμορφο `applyWallTilt` (emit), οι παρειές του τοίχου γέρνουν ενώ η
 * κοπή του δοκαριού ξαναγίνεται **κατακόρυφη** στο `host_real` (το `bottom`/`top` cut
 * vertices είναι pre-shifted κατά `−shear(Hu)`/`−shear(nominal)` αντίστοιχα).
 *
 * Καθρέφτης του `buildColumnPrismGeometry`: 2n κορυφές, καπάκια με
 * `triangulateShape` (concave-safe) ανά **contour χωριστά** (τα δύο footprints
 * διαφέρουν), πλευρές ένα quad ανά ακμή, `toNonIndexed` flat shading.
 *
 * @returns BufferGeometry, ή null αν εκφυλίζεται (`n<3`, αναντιστοιχία μηκών, ή
 *          μηδενικό ύψος ζώνης).
 * @see clipWallBandTopRegionsTilted — η πηγή των `WallTopLoftBand`
 * @see buildColumnPrismGeometry — ο δίδυμος (single-footprint prism)
 */
export function buildWallLoftBandGeometry(band: WallTopLoftBand): THREE.BufferGeometry | null {
  const { bottomFootprint, topFootprint, huLocalM, nominalLocalM } = band;
  const n = bottomFootprint.length;
  if (n < 3 || topFootprint.length !== n) return null;
  if (nominalLocalM - huLocalM <= LOFT_DEGENERATE_EPS) return null;

  // 2n κορυφές: [0..n) κάτω δακτύλιος @huLocalM, [n..2n) πάνω δακτύλιος @nominalLocalM.
  // plan (x, y) → world (x, Y, -y).
  const positions = new Float32Array(2 * n * 3);
  for (let i = 0; i < n; i++) {
    const b = bottomFootprint[i];
    positions[i * 3] = b.x;
    positions[i * 3 + 1] = huLocalM;
    positions[i * 3 + 2] = -b.y;
    const t = (n + i) * 3;
    const tp = topFootprint[i];
    positions[t] = tp.x;
    positions[t + 1] = nominalLocalM;
    positions[t + 2] = -tp.y;
  }

  const index: number[] = [];

  // ── Καπάκια: τριγωνοποίηση **κάθε** contour χωριστά (τα footprints διαφέρουν). ──
  // Mirror του buildColumnPrismGeometry winding: CCW footprint υπό (x,y)→(x,·,-y) →
  // πάνω cap normal +Y (ίδια φορά), κάτω cap −Y (αντίστροφη φορά).
  const botFaces = THREE.ShapeUtils.triangulateShape(
    bottomFootprint.map((p) => new THREE.Vector2(p.x, p.y)), [],
  );
  for (const [a, b, c] of botFaces) index.push(a, c, b); // κάτω (κοιτά κάτω)
  const topFaces = THREE.ShapeUtils.triangulateShape(
    topFootprint.map((p) => new THREE.Vector2(p.x, p.y)), [],
  );
  for (const [a, b, c] of topFaces) index.push(n + a, n + b, n + c); // πάνω (κοιτά πάνω)

  // ── Πλευρές: ένα quad ανά ακμή i→j (j = (i+1) mod n). ──────────────────────
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const bi = i, bj = j, ti = n + i, tj = n + j;
    index.push(bi, bj, tj);
    index.push(bi, tj, ti);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(index);
  // Flat shading (mirror buildColumnPrismGeometry): per-face normals → ομοιόχρωμες έδρες.
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
