/**
 * ADR-713 — «σε ποια στάθμη είναι το τελειωμένο έδαφος ΣΕ ΑΥΤΟ το σημείο κάτοψης;»
 *
 * Ο tier 1 του cascade στάθμης εδάφους (βλ. `bim/geometry/column-exposure-zone.ts`): όταν
 * το έργο έχει τοπογραφικό, το όριο «όψη ↔ χώμα» **δεν χρειάζεται καμία ρύθμιση** — το
 * διαβάζουμε από την επιφάνεια, ακριβώς κάτω από κάθε στοιχείο. Σε επικλινές οικόπεδο η
 * ανάντη κολώνα θάβεται περισσότερο από την κατάντη, χωρίς ο μηχανικός να το δηλώσει.
 *
 * Αυτό ξεπερνά το Revit («Split Face + Paint»: χειροκίνητο σκαρίφημα ανά instance, στατικό,
 * σπάει μόλις μετακινηθεί το στοιχείο) και το ArchiCAD (η κολώνα έχει **μία** surface για
 * όλες τις πλευρές — ούτε per-face δεν διαχωρίζει).
 *
 * ### Οι τρεις μετασχηματισμοί, ο καθένας ΜΙΑ φορά και εδώ
 *   1. **plan → WORLD** — τα footprints ζουν σε canvas units του κτιρίου· η επιφάνεια σε
 *      ΕΓΣΑ'87 WORLD mm. `localToWorld` (geo-transform SSoT) — ο ακριβής αντίστροφος του
 *      `WorldToDisplayProjector` που χρησιμοποιεί το `tin-to-three`.
 *   2. **δειγματοληψία** — `createTinSampler().zAtMm()` (βαρυκεντρική, ακριβής, ΟΧΙ IDW).
 *      Εκτός τριγωνισμού → `null`, **ποτέ 0**: «δεν έχω έδαφος εδώ» ≠ «το έδαφος είναι στο 0».
 *   3. **WORLD Z → building-relative** — μείον το project vertical datum (ADR-650 M10c), το
 *      ΙΔΙΟ που ξανακαθίζει το ανάγλυφο πάνω στο κτίριο. Χωρίς αυτό, μια στάθμη +106m θα
 *      έθαβε ολόκληρο το κτίριο.
 *
 * ### Προτεραιότητα επιφανειών: `proposed` → `existing`
 * Το όριο της όψης είναι το **τελειωμένο** έδαφος (μετά τις χωματουργικές), δηλαδή η
 * μελετημένη επιφάνεια. Όπου δεν υπάρχει μελέτη, το υπάρχον έδαφος είναι η καλύτερη
 * διαθέσιμη αλήθεια. Καμία από τις δύο → `null` → ο caller πέφτει στο tier 2 (σταθερά
 * κτιρίου) — **ποτέ σιωπηλό 0**.
 *
 * Pure/impure split ίδιο με το αδελφό `vertical-datum.ts`: όλη η λογική στον pure resolver,
 * ένα μόνο impure entry point για τα store reads.
 *
 * @see ./vertical-datum — ο αδελφός (ποια στάθμη ΕΙΝΑΙ το internal z=0)
 * @see ../../bim/geometry/column-exposure-zone — ο καταναλωτής (tier 1 του cascade)
 * @see docs/centralized-systems/reference/adrs/ADR-713-buried-column-segment-exposure-zone.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { TinSurface } from './topo-types';
import { getTinSampler } from './tin-sampler';
import { getTopoSurface } from './topo-surface';
import { getActiveVerticalDatumMm } from './vertical-datum';
import { getGeoReference } from '../geo-referencing/geo-reference-store';
import { localToWorld, IDENTITY_GEO_REFERENCE } from '../geo-referencing/geo-transform';

/**
 * Building-relative στάθμη (canonical mm) του τελειωμένου εδάφους στο **WORLD** σημείο, ή
 * `null` όταν καμία επιφάνεια δεν απαντά εκεί.
 *
 * Pure — οι επιφάνειες και το datum δίνονται από τον caller, ώστε να ελέγχεται χωρίς stores.
 * Η σειρά του `surfaces` ΕΙΝΑΙ η προτεραιότητα (πρώτη που απαντά κερδίζει).
 */
export function resolveFinishedGradeAtWorldMm(
  surfaces: readonly TinSurface[],
  verticalDatumMm: number,
  worldXMm: number,
  worldYMm: number,
): number | null {
  if (!Number.isFinite(worldXMm) || !Number.isFinite(worldYMm)) return null;
  const datumMm = Number.isFinite(verticalDatumMm) ? verticalDatumMm : 0;
  for (const tin of surfaces) {
    if (tin.triangles.length === 0) continue;
    // Memoised ανά identity επιφάνειας — ADR-713 ρωτά **ανά στοιχείο**, όχι μία φορά.
    const worldZmm = getTinSampler(tin).zAtMm(worldXMm, worldYMm);
    // `null` = εκτός τριγωνισμού· συνέχισε στην επόμενη επιφάνεια (ΟΧΙ fallback σε 0).
    if (worldZmm !== null && Number.isFinite(worldZmm)) return worldZmm - datumMm;
  }
  return null;
}

/**
 * True όταν το έργο έχει έστω μία τριγωνισμένη επιφάνεια — δηλαδή όταν η δειγματοληψία έχει
 * νόημα. Οι callers που ρωτούν **ανά στοιχείο** το ελέγχουν ΜΙΑ φορά και παρακάμπτουν
 * ολόκληρο το tier 1 στα (συνηθέστερα) έργα χωρίς τοπογραφικό — μηδέν κόστος ανά κολώνα.
 */
export function hasFinishedGradeSurface(): boolean {
  return getTopoSurface('proposed').triangles.length > 0
    || getTopoSurface('existing').triangles.length > 0;
}

/**
 * Building-relative στάθμη τελειωμένου εδάφους (canonical mm) κάτω από ένα σημείο **κάτοψης
 * του κτιρίου** (canonical mm, ίδιο frame με τα BIM footprints), ή `null` χωρίς τοπογραφικό.
 *
 * Το ΕΝΑ impure entry — mirror του `getActiveVerticalDatumMm`, ώστε κάθε καταναλωτής να
 * διαβάζει την ΙΔΙΑ επιφάνεια με το ΙΔΙΟ datum και να μη διαφωνήσουν ποτέ κατακόρυφα.
 */
export function getFinishedGradeAtPlanPointMm(planXMm: number, planYMm: number): number | null {
  const geo = getGeoReference() ?? IDENTITY_GEO_REFERENCE;
  const world: Point2D = localToWorld({ x: planXMm, y: planYMm }, geo);
  return resolveFinishedGradeAtWorldMm(
    // Το τελειωμένο έδαφος πρώτα· το υπάρχον ως εφεδρεία.
    [getTopoSurface('proposed'), getTopoSurface('existing')],
    getActiveVerticalDatumMm(),
    world.x,
    world.y,
  );
}
