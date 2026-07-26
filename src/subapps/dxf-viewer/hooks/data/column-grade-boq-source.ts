/**
 * ADR-713 — ο χάρτης στάθμης τελειωμένου εδάφους για την **ΕΠΙΜΕΤΡΗΣΗ** (`columnId → mm`).
 *
 * Αδελφό του `column-continuity-boq-source` (ADR-712) και ίδιου σχήματος: μια non-React
 * πηγή που χτίζεται **on-demand μέσα στην κλήση** και πεθαίνει μαζί της — καμία δημοσίευση,
 * κανένας νέος store (ADR-489 §7).
 *
 * Γιατί ξεχωριστό από το 3Δ `buildColumnGradeLookup`: εκεί ο cascade τροφοδοτείται από το
 * `SyncContext` (floors + buildings του view)· εδώ η διαδρομή είναι το persistence layer,
 * που βλέπει **έναν όροφο τη φορά** και δεν κρατά building refs. Οι είσοδοι διαφέρουν, ο
 * **cascade είναι ο ΙΔΙΟΣ** (`resolveExposureGradeAbsMm`) — μία απόφαση, δύο τροφοδοσίες.
 *
 * Οι δύο tiers εδώ:
 *   1. **Τοπογραφικό** — ίδια δειγματοληψία με το 3Δ (`getFinishedGradeAtPlanPointMm`).
 *   2. **Σταθερά κτιρίου** — από το `foundation-level-store`, όπου τη δημοσιεύει ο owner
 *      `useFoundationLevelSync` (μόνο εκείνος διαβάζει το building doc). Χωρίς owner → `0`,
 *      δηλαδή έδαφος στο FFL: **fail-safe** που κάνει τη θαμμένη ζώνη να ταυτίζεται με το
 *      κοντόστυλο του ADR-712 — η σημερινή, ήδη τιμολογημένη ποσότητα.
 *
 * @see ./column-continuity-boq-source — το αδελφό transport (baseDropMm)
 * @see ../../bim/geometry/column-exposure-zone — ο κοινός pure cascade
 * @see docs/centralized-systems/reference/adrs/ADR-713-buried-column-segment-exposure-zone.md
 */

import type { Entity } from '../../types/entities';
import { isColumnEntity } from '../../types/entities';
import { resolveExposureGradeAbsMm } from '../../bim/geometry/column-exposure-zone';
import {
  getFinishedGradeAtPlanPointMm,
  hasFinishedGradeSurface,
} from '../../systems/topography/grade-at-plan-point';
import { useFoundationLevelStore } from '../../state/foundation-level-store';
// ADR-713 — ΤΟ ΙΔΙΟ σημείο δειγματοληψίας με το render (αλλιώς σε επικλινές οικόπεδο η όψη
// θα κοβόταν σε άλλο ύψος από αυτό που τιμολογείται).
import { footprintGradeSamplePointMm } from '../../bim/geometry/plan-sample-point';

/** `columnId → απόλυτη στάθμη τελειωμένου εδάφους (mm, floor-relative datum)`. */
export type ColumnGradeBoqMap = ReadonlyMap<string, number>;

/**
 * Ο χάρτης στάθμης εδάφους για τις κολώνες του ενεργού ορόφου.
 *
 * Η σκηνή είναι floor-relative (FFL ορόφου = 0, ίδια σύμβαση με τον `column-boq-feed`), άρα
 * η nominal βάση κάθε κολώνας είναι σκέτο το `baseOffset`.
 */
export function buildColumnGradeMap(activeEntities: readonly Entity[]): ColumnGradeBoqMap {
  const map = new Map<string, number>();
  const sampleTerrain = hasFinishedGradeSurface();
  const gradeDropBelowBaseMm = useFoundationLevelStore.getState().buildingGradeDropBelowBaseMm;

  for (const entity of activeEntities) {
    if (!isColumnEntity(entity)) continue;
    const verts = entity.geometry?.footprint?.vertices;
    if (!verts || verts.length < 3) continue;

    let terrainGradeAbsMm: number | null = null;
    if (sampleTerrain) {
      const at = footprintGradeSamplePointMm(verts, entity.params.sceneUnits);
      if (at) terrainGradeAbsMm = getFinishedGradeAtPlanPointMm(at.x, at.y);
    }

    map.set(entity.id, resolveExposureGradeAbsMm({
      nominalBaseAbsMm: entity.params.baseOffset ?? 0,
      gradeDropBelowBaseMm,
      terrainGradeAbsMm,
    }));
  }
  return map;
}
