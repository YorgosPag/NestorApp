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
