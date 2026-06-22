/**
 * wall-opening-conflict — pure SSoT: ένας τοίχος-φάντασμα κάθετος στην παρειά υφιστάμενου τοίχου
 * ΚΟΒΕΙ ένα άνοιγμα (πόρτα/παράθυρο) όταν το **κατακόρυφο** εύρος του νέου τοίχου τέμνει το **κενό**
 * του ανοίγματος ΚΑΙ ταυτόχρονα τέμνεται **οριζόντια** με αυτό κατά μήκος του host άξονα (3D έλεγχος
 * σε 2D κάτοψη). Conflict ⇒ 🔴 + block commit (ίδιο μονοπάτι με το short-end overlap).
 *
 * **ΕΝΑΣ κανόνας πόρτα/παράθυρο** (ο διαχωρισμός βγαίνει από το `sillHeight`):
 * ```
 * 🔴 ⇔  [abut − t/2, abut + t/2] ∩ [offsetFromStart, offsetFromStart+width] ≠ ∅   (οριζόντια, mm)
 *  ΚΑΙ  ghostZ ∩ openingZ                                                  ≠ ∅   (κατακόρυφα, mm)
 * ```
 * Μερική επικάλυψη μετράει. Άγγιγμα-άκρο (μηδενική τομή) = 🟢.
 *
 * **FULL SSoT reuse — μηδέν νέος μηχανισμός (Giorgio SSoT audit):**
 *   · `getEntityZExtents` (ADR-452) → κατακόρυφο εύρος ΚΑΙ του τοίχου ΚΑΙ του ανοίγματος.
 *   · `projectPointToWallOffsetMm` / `wallAxisPointAtOffsetMm` (opening-geometry) → οριζόντιο `abut` + host detection.
 *   · `getSiblingOpeningsOnWall` (opening-siblings) → ανοίγματα ενός host τοίχου.
 *
 * Pure — zero React/DOM/store. Καταναλώνεται ΟΜΟΙΑ από preview (`wall-preview-helpers`) ΚΑΙ
 * commit (`use-wall-commit`) → preview === commit.
 *
 * @see ../visibility/entity-z-extents.ts — getEntityZExtents (Z-extents SSoT)
 * @see ../geometry/opening-geometry.ts — projectPointToWallOffsetMm / wallAxisPointAtOffsetMm
 * @see ./opening-siblings.ts — getSiblingOpeningsOnWall
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { getEntityZExtents } from '../visibility/entity-z-extents';
import { projectPointToWallOffsetMm, wallAxisPointAtOffsetMm } from '../geometry/opening-geometry';
import { getSiblingOpeningsOnWall } from './opening-siblings';
import type { WallEntity } from '../types/wall-types';
import type { OpeningEntity } from '../types/opening-types';

/** Η σύγκρουση που εντοπίστηκε: το άνοιγμα + το κατακόρυφο εύρος επικάλυψης (mm) για το tooltip. */
export interface WallOpeningConflict {
  readonly opening: OpeningEntity;
  /** [lo, hi] mm — η κατακόρυφη τομή νέου-τοίχου ∩ κενού ανοίγματος (η «κομμένη» ζώνη). */
  readonly bandMm: readonly [number, number];
}

/** Μήκος τομής δύο διαστημάτων (strict — άγγιγμα-άκρο = 0). */
function overlapLength(aLo: number, aHi: number, bLo: number, bHi: number): number {
  return Math.min(aHi, bHi) - Math.max(aLo, bLo);
}

/**
 * `true`/conflict όταν ο τοίχος-φάντασμα (κάθετος, με κέντρο επαφής `abutMm` και πάχος
 * `ghostThicknessMm`) κόβει κάποιο από τα `openings` του host τοίχου. Επιστρέφει το ΠΡΩΤΟ
 * συγκρουόμενο άνοιγμα + την κατακόρυφη ζώνη επικάλυψης· `null` αν κανένα δεν κόβεται.
 */
export function wallGhostBlocksOpening(
  ghostWall: WallEntity,
  abutMm: number,
  ghostThicknessMm: number,
  openings: readonly OpeningEntity[],
): WallOpeningConflict | null {
  const ghostZ = getEntityZExtents(ghostWall);
  if (!ghostZ) return null;
  const half = ghostThicknessMm / 2;
  const hLo = abutMm - half;
  const hHi = abutMm + half;
  for (const opening of openings) {
    const { offsetFromStart: oLo, width } = opening.params;
    // Οριζόντια τομή κατά τον host άξονα (πάχος ghost ∩ άνοιγμα).
    if (overlapLength(hLo, hHi, oLo, oLo + width) <= 0) continue;
    // Κατακόρυφη τομή (κενό ανοίγματος ∩ εύρος νέου τοίχου) — reuse getEntityZExtents.
    const oz = getEntityZExtents(opening);
    if (!oz) continue;
    const lo = Math.max(ghostZ.zBottomMm, oz.zBottomMm);
    const hi = Math.min(ghostZ.zTopMm, oz.zTopMm);
    if (hi - lo > 0) return { opening, bandMm: [lo, hi] };
  }
  return null;
}

/**
 * Βρες τον host τοίχο πάνω στην παρειά του οποίου ακουμπά το σημείο επαφής `contactPt` (το
 * centerline start του φαντάσματος / committed τοίχου) και έλεγξε αν ο νέος τοίχος κόβει άνοιγμά του.
 * **ΕΝΑ SSoT για preview ΚΑΙ commit.** `null` όταν δεν υπάρχει host κοντά ή κανένα άνοιγμα δεν κόβεται.
 *
 * Host detection (μηδέν νέο projection): για κάθε τοίχο με ανοίγματα, `abut = projectPointToWallOffsetMm`,
 * `axisPt = wallAxisPointAtOffsetMm(abut)`· host = ο πλησιέστερος του οποίου η παρειά αγγίζει το `contactPt`
 * (απόσταση ≤ μισό-host + μισό-ghost). Έτσι ελεύθερη τοποθέτηση μακριά από τοίχο → καμία false-positive.
 */
export function resolveWallStartOpeningConflict(
  contactPt: Readonly<Point2D>,
  ghostWall: WallEntity,
  ghostThicknessMm: number,
  walls: readonly WallEntity[],
  openings: readonly OpeningEntity[],
  sceneUnits: SceneUnits,
): WallOpeningConflict | null {
  const mmFactor = mmToSceneUnits(sceneUnits);
  const halfGhostScene = (ghostThicknessMm / 2) * mmFactor;
  const eps = mmFactor; // ~1mm ανοχή στο scene frame

  let host: WallEntity | null = null;
  let hostAbutMm = 0;
  let bestDist = Infinity;
  for (const wall of walls) {
    const hosted = getSiblingOpeningsOnWall(wall.id, openings, '');
    if (hosted.length === 0) continue;
    const abutMm = projectPointToWallOffsetMm(contactPt, wall);
    const axisPt = wallAxisPointAtOffsetMm(wall, abutMm);
    const dist = Math.hypot(contactPt.x - axisPt.x, contactPt.y - axisPt.y);
    const halfHostScene = (wall.params.thickness / 2) * mmFactor;
    if (dist <= halfHostScene + halfGhostScene + eps && dist < bestDist) {
      bestDist = dist;
      host = wall;
      hostAbutMm = abutMm;
    }
  }
  if (!host) return null;
  return wallGhostBlocksOpening(ghostWall, hostAbutMm, ghostThicknessMm, getSiblingOpeningsOnWall(host.id, openings, ''));
}
