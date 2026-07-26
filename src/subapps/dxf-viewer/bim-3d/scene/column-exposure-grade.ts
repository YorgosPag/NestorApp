/**
 * ADR-713 — ο ΚΟΙΝΟΣ χάρτης στάθμης εδάφους ανά κολώνα (`columnId → gradeAbsMm`).
 *
 * Χτίζεται **ΜΙΑ φορά ανά sync** και τον διαβάζουν **και οι δύο** καταναλωτές που πρέπει να
 * κόψουν στο ίδιο ύψος:
 *   - ο **πυρήνας** (`syncColumns` → `columnToMesh`) — πού σταματά η επένδυση όψης και πού
 *     αρχίζει η στεγανωτική επάλειψη,
 *   - ο **σοβάς** (`syncStructuralFinishSkin` → silhouette) — πού σταματά το επίχρισμα.
 *
 * Ίδιο μοτίβο (και ίδιος λόγος ύπαρξης) με το `buildColumnVerticalExtents` του ADR-449: αν
 * ο καθένας υπολόγιζε μόνος του τη στάθμη, θα δειγματολήπτιζε το έδαφος ξεχωριστά και θα
 * μπορούσαν να διαφωνήσουν κατά ένα χιλιοστό — που στο render διαβάζεται ως λωρίδα τούβλου
 * κάτω από τον σοβά. **Ένας χάρτης, δύο αναγνώστες, μηδέν απόκλιση.**
 *
 * Ο ίδιος ο cascade ζει στο pure `bim/geometry/column-exposure-zone.ts` — εδώ γίνεται μόνο
 * η **συλλογή** των εισόδων του (store reads + geo μετασχηματισμοί), ώστε η απόφαση να
 * παραμένει unit-testable χωρίς stores.
 *
 * @see ../../bim/geometry/column-exposure-zone — ο pure cascade + ο διαχωρισμός ζωνών
 * @see ../../systems/topography/grade-at-plan-point — το tier 1 (δειγματοληψία TIN)
 * @see docs/centralized-systems/reference/adrs/ADR-713-buried-column-segment-exposure-zone.md
 */

import type { ColumnEntity } from '../../bim/types/column-types';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import { resolveExposureGradeAbsMm } from '../../bim/geometry/column-exposure-zone';
import {
  getFinishedGradeAtPlanPointMm,
  hasFinishedGradeSurface,
} from '../../systems/topography/grade-at-plan-point';
import { footprintGradeSamplePointMm } from '../../bim/geometry/plan-sample-point';

/** `columnId → απόλυτη στάθμη τελειωμένου εδάφους (building-relative mm)`. */
export type ColumnGradeLookup = ReadonlyMap<string, number>;

const M_TO_MM = 1000;

/** Ό,τι χρειάζεται ο χάρτης από το sync context — minimal shape, ώστε να ελέγχεται εύκολα. */
export interface ColumnGradeContext {
  readonly floorElevationMm: number;
  readonly floors: readonly FloorRef[];
  readonly buildings: readonly BuildingRef[];
}

/**
 * Ο χάρτης στάθμης εδάφους για όλες τις κολώνες ενός sync.
 *
 * **Fast path:** χωρίς τοπογραφικό (η συνήθης περίπτωση) το tier 1 παρακάμπτεται συνολικά —
 * ένας έλεγχος, όχι ένας ανά κολώνα.
 */
export function buildColumnGradeLookup(
  columns: readonly ColumnEntity[],
  ctx: ColumnGradeContext,
): ColumnGradeLookup {
  const map = new Map<string, number>();
  const sampleTerrain = hasFinishedGradeSurface();

  for (const column of columns) {
    const verts = column.geometry?.footprint?.vertices;
    if (!column.id || !verts || verts.length < 3) continue;

    const nominalBaseAbsMm = ctx.floorElevationMm + (column.params.baseOffset ?? 0);

    // Tier 1 — τοπογραφικό στη θέση ΑΥΤΗΣ της κολώνας (επικλινές οικόπεδο: κάθε κολώνα
    // παίρνει τη δική της στάθμη). `null` = δεν καλύπτεται από επιφάνεια → πέφτει στο tier 2.
    let terrainGradeAbsMm: number | null = null;
    if (sampleTerrain) {
      const at = footprintGradeSamplePointMm(verts, column.params.sceneUnits);
      if (at) terrainGradeAbsMm = getFinishedGradeAtPlanPointMm(at.x, at.y);
    }

    // Tier 2 — σταθερά κτιρίου (METRES στο doc → mm εδώ, ΜΙΑ μετατροπή).
    const gradeDropM = resolveEntityBuilding(column, ctx.floors, ctx.buildings)?.gradeDropBelowBase;

    map.set(column.id, resolveExposureGradeAbsMm({
      nominalBaseAbsMm,
      gradeDropBelowBaseMm: gradeDropM === undefined ? undefined : gradeDropM * M_TO_MM,
      terrainGradeAbsMm,
    }));
  }
  return map;
}
