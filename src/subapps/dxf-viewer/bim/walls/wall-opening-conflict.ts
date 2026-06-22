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
 *   · `projectPointToWallOffsetMm` (opening-geometry) → οριζόντιο `abut` (offset επί του host άξονα).
 *   · `getSiblingOpeningsOnWall` (opening-siblings) → ανοίγματα ενός host τοίχου.
 *
 * **Revit-grade host = snapped reference (ΟΧΙ re-derive):** ο host τοίχος δίνεται από έξω — είναι η
 * ταυτότητα που **ήδη επέλεξε το snap** (`MemberGhostSnapResult.targetId`) και διαδίδεται σε preview
 * (live) ΚΑΙ commit (locked `anchoredHostId`). Εδώ απλώς υπολογίζεται το `abut` του γνωστού host.
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
import { projectPointToWallOffsetMm } from '../geometry/opening-geometry';
import { getSiblingOpeningsOnWall } from './opening-siblings';
import { getEntityZExtents, type EntityZExtentsMm } from '../visibility/entity-z-extents';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { WallEntity } from '../types/wall-types';
import type { OpeningEntity } from '../types/opening-types';

/**
 * Z-extents ενός scene τοίχου/ανοίγματος μέσω του **ADR-452 SSoT** `getEntityZExtents`. Το SSoT είναι
 * typed για το canvas `DxfEntityUnion`, αλλά είναι τεκμηριωμένα σχεδιασμένο να δέχεται ΚΑΙ flat scene
 * entities (το `nestedParams` fallback του). Τα scene `WallEntity`/`OpeningEntity` είναι **structurally
 * ταυτόσημα** για τον z-τύπο (`params.baseOffset/height`, `params.sillHeight/height`) αλλά **nominally**
 * διαφορετικά (`BimEntity` base vs `DxfEntity` base) → ένα boundary-cast ΕΔΩ (ΟΧΙ `as any`), ώστε να
 * κρατήσουμε το SSoT reuse χωρίς να αντιγράψουμε τον z-τύπο.
 */
function zExtentsOf(e: WallEntity | OpeningEntity): EntityZExtentsMm | null {
  return getEntityZExtents(e as unknown as DxfEntityUnion);
}

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
  const ghostZ = zExtentsOf(ghostWall);
  if (!ghostZ) return null;
  const half = ghostThicknessMm / 2;
  const hLo = abutMm - half;
  const hHi = abutMm + half;
  for (const opening of openings) {
    const { offsetFromStart: oLo, width } = opening.params;
    // Οριζόντια τομή κατά τον host άξονα (πάχος ghost ∩ άνοιγμα).
    if (overlapLength(hLo, hHi, oLo, oLo + width) <= 0) continue;
    // Κατακόρυφη τομή (κενό ανοίγματος ∩ εύρος νέου τοίχου) — reuse getEntityZExtents.
    const oz = zExtentsOf(opening);
    if (!oz) continue;
    const lo = Math.max(ghostZ.zBottomMm, oz.zBottomMm);
    const hi = Math.min(ghostZ.zTopMm, oz.zTopMm);
    if (hi - lo > 0) return { opening, bandMm: [lo, hi] };
  }
  return null;
}

/**
 * Έλεγξε αν ο νέος τοίχος κόβει άνοιγμα του **γνωστού host** (= ο τοίχος που επέλεξε το snap,
 * `MemberGhostSnapResult.targetId`). **ΕΝΑ SSoT για preview ΚΑΙ commit** — η ταυτότητα του host ΔΕΝ
 * ξανα-υπολογίζεται εδώ (Revit-grade reference propagation). Το μόνο που υπολογίζεται είναι το `abut`
 * (offset του σημείου επαφής επί του host άξονα) μέσω του SSoT `projectPointToWallOffsetMm`.
 * `null` όταν δεν υπάρχει host (free placement) ή κανένα άνοιγμα δεν κόβεται.
 */
export function resolveWallOpeningConflictForHost(
  contactPt: Readonly<Point2D>,
  ghostWall: WallEntity,
  ghostThicknessMm: number,
  hostWall: WallEntity | null,
  allOpenings: readonly OpeningEntity[],
): WallOpeningConflict | null {
  if (!hostWall) return null;
  const hosted = getSiblingOpeningsOnWall(hostWall.id, allOpenings, '');
  if (hosted.length === 0) return null;
  const abutMm = projectPointToWallOffsetMm(contactPt, hostWall);
  return wallGhostBlocksOpening(ghostWall, abutMm, ghostThicknessMm, hosted);
}
