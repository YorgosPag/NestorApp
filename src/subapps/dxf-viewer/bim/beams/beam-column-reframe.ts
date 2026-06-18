/**
 * ADR-492 — Associative beam **re-frame** στις παρειές των κολωνών (on column move).
 *
 * Το πρόβλημα: όταν ο χρήστης μετακινεί **μεμονωμένα** μια κολώνα (όχι τον κάναβο),
 * το stored `BeamParams.startPoint`/`endPoint` της δοκού που πλαισιώνει (frame-into)
 * αυτή την κολώνα **δεν ακολουθεί** → το δοκάρι περνά ΜΕΣΑ από την κολώνα και
 * προεξέχει από την άλλη πλευρά (stub). Ο ADR-458 cutback αφαιρεί τον όγκο της
 * κολώνας στο render, αλλά το stored άκρο εξακολουθεί να εκτείνεται ως εκεί → το
 * αναλυτικό μήκος μέλους (FEM ADR-481 / οπλισμός ADR-471/472 / φορτία ADR-467) είναι
 * λάθος.
 *
 * Η λύση (Revit-canonical, **stored re-frame**): το δοκάρι είναι associatively
 * attached στις κολώνες που frame-into. Όταν μετακινείται μια κολώνα, το αντίστοιχο
 * άκρο **επανα-υπολογίζεται στην κοντινή παρειά** της — το stored endpoint ακολουθεί.
 *
 * **Idempotent — υπολογισμός από τη ΘΕΣΗ της κολώνας, ΟΧΙ από το τρέχον endpoint:**
 * το νέο άκρο = προβολή του κέντρου της κολώνας στην ευθεία του άξονα, τραβηγμένη
 * πίσω κατά `columnSupportAlong` (μισό πλάτος κολώνας προς το άνοιγμα). Επειδή τα νέα
 * άκρα μένουν ΠΑΝΩ στην αρχική ευθεία του άξονα, η μοναδιαία διεύθυνση `u` δεν αλλάζει
 * → re-run δίνει το ίδιο αποτέλεσμα (δεν «μαζεύεται» σε επαναλαμβανόμενες κινήσεις,
 * επιμηκύνεται όταν η κολώνα γυρίζει πίσω). Διατηρεί την perpendicular justification
 * (edge-beam flush) γιατί κινεί μόνο κατά μήκος του άξονα.
 *
 * **Face-offset SSoT reuse (N.0.2):** το πόσο τραβιέται πίσω το άκρο = `columnSupportAlong`
 * (το ίδιο μισό-πλάτος που χρησιμοποιεί το placement `trimSegmentEndpointsToColumns` ΚΑΙ
 * το graph framing `beamFramesColumn`). Η συγγραμμικότητα (perp ≤ μισό πλάτος δοκαριού)
 * είναι το ίδιο κριτήριο με το `beamFramesColumn`.
 *
 * **Γιατί ΟΧΙ `findColumnsFramedByBeamForGraph`:** εκείνο είναι span-clamped (t εντός
 * [−support, L+support]) — σωστό για τον στατικό graph, αλλά χάνει την κολώνα μόλις
 * αυτή ξεφύγει έξω από το (ήδη κομμένο) άκρο → το δοκάρι δεν θα **επιμηκυνόταν πίσω**
 * όταν η κολώνα γυρίζει προς τα έξω. Εδώ η συσχέτιση γίνεται **ανά άκρο** (πλησιέστερη
 * συγγραμμική κολώνα σε κάθε άκρο), ώστε το άκρο να ακολουθεί ΚΑΙ μέσα ΚΑΙ έξω. Η
 * perp-guard (συγγραμμικότητα) καλύπτει το «η κολώνα φεύγει πλάγια → άκρο σταματά».
 *
 * Scope v1: straight / cantilever (2-σημείων άξονας). Curved/split → identity
 * (parity με ADR-458 DEFER).
 *
 * Pure + unit-testable· καμία γνώση σκηνής/React/three.js. Ο orchestration hook
 * (`useBeamReframeEffect`) εφαρμόζει το patch + persist (mirror `useWallRetrimEffect`).
 *
 * @see bim/columns/column-face-trim.ts — columnSupportAlong (face-offset SSoT)
 * @see bim/columns/column-structural-attach-coordinator.ts — findColumnsFramedByBeamForGraph (association SSoT)
 * @see bim/geometry/beam-column-cutback.ts — ADR-458 display cutback (DERIVED, complementary)
 * @see hooks/tools/useSpecialTools-beam-reframe.ts — orchestration (mirror wall-retrim)
 * @see docs/centralized-systems/reference/adrs/ADR-492-associative-beam-reframe-on-column-move.md
 */

import type { Point3D } from '../types/bim-base';
import type { BeamEntity } from '../types/beam-types';
import { MIN_BEAM_LENGTH_MM } from '../types/beam-types';
import type { ColumnEntity } from '../types/column-types';
import { columnSupportAlong } from '../columns/column-face-trim';
import { mmToSceneUnits } from '../../utils/scene-units';

/**
 * Κατώφλι (mm) μετατόπισης άκρου πάνω από το οποίο θεωρούμε ότι το δοκάρι όντως
 * άλλαξε — κάτω από αυτό = identity (no-op, μηδέν persist churn).
 */
const REFRAME_EPS_MM = 1;

/**
 * Ανοχή συγγραμμικότητας (mm) — κολώνα θεωρείται «πάνω στον άξονα» όταν το κέντρο της
 * απέχει ≤ (μισό πλάτος δοκαριού + αυτό) από την ευθεία του άξονα. Ίδιο κριτήριο με το
 * `beamFramesColumn` (FRAMING_TOL_MM).
 */
const COLLINEAR_TOL_MM = 5;

/** Νέα stored άκρα μετά το re-frame (scene units, ίδια σύμβαση με startPoint/endPoint). */
export interface BeamReframeResult {
  readonly startPoint: Point3D;
  readonly endPoint: Point3D;
}

/** Συγγραμμική κολώνα με τη longitudinal προβολή του κέντρου της πάνω στον άξονα. */
interface AxisColumn {
  readonly col: ColumnEntity;
  /** `(center − a)·u` — scene-unit θέση κατά μήκος του άξονα από το `start`. */
  readonly proj: number;
}

/**
 * Επανα-υπολογίζει τα άκρα μιας straight/cantilever δοκού ώστε όποιο πλαισιώνεται από
 * κολώνα να κάθεται ΑΚΡΙΒΩΣ στην κοντινή παρειά της. Επιστρέφει `null` όταν δεν υπάρχει
 * ουσιαστική αλλαγή (καμία συγγραμμική κολώνα, curved, εκφυλισμένο, ή delta <
 * `REFRAME_EPS_MM`) → ο caller κρατά το δοκάρι αυτούσιο (zero persist churn).
 *
 * Συσχέτιση ανά άκρο: κάθε συγγραμμική κολώνα (perp ≤ μισό πλάτος δοκαριού) ανατίθεται
 * στο **πλησιέστερο** άκρο (proj vs len)· στήριξη κάθε άκρου = η πλησιέστερη σε αυτό
 * κολώνα της ομάδας του. Έτσι το άκρο ακολουθεί ΚΑΙ μέσα ΚΑΙ έξω (δεν είναι span-clamped).
 * Άκρο χωρίς συγγραμμική κολώνα → ελεύθερο (πρόβολος / διαγραμμένη στήριξη). Μεσαίο
 * column (split) → ανατίθεται στο εγγύτερο άκρο, δεν χωρίζει το δοκάρι (DEFER, parity 458).
 */
export function reframeBeamEndpointsToColumns(
  beam: BeamEntity,
  columns: readonly ColumnEntity[],
): BeamReframeResult | null {
  if (beam.params.kind === 'curved') return null;
  const a = beam.params.startPoint;
  const b = beam.params.endPoint;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;

  const perScene = mmToSceneUnits(beam.params.sceneUnits ?? 'mm');
  const halfWidth = (beam.params.width / 2) * perScene;
  const collinearTol = COLLINEAR_TOL_MM * perScene;

  // Συγγραμμικές κολώνες (κέντρο εντός μισού πλάτους δοκαριού από την ευθεία του άξονα).
  const axisColumns: AxisColumn[] = [];
  for (const col of columns) {
    const rx = col.params.position.x - a.x;
    const ry = col.params.position.y - a.y;
    const perp = Math.abs(rx * uy - ry * ux);
    if (perp > halfWidth + collinearTol) continue;
    axisColumns.push({ col, proj: rx * ux + ry * uy });
  }
  if (axisColumns.length === 0) return null;

  // Ανάθεση στο πλησιέστερο άκρο· στήριξη = η πλησιέστερη κολώνα του άκρου της.
  let startSup: AxisColumn | null = null;
  let endSup: AxisColumn | null = null;
  for (const ac of axisColumns) {
    const toStart = Math.abs(ac.proj);
    const toEnd = Math.abs(ac.proj - len);
    if (toStart <= toEnd) {
      if (!startSup || toStart < Math.abs(startSup.proj)) startSup = ac;
    } else if (!endSup || toEnd < Math.abs(endSup.proj - len)) {
      endSup = ac;
    }
  }
  if (!startSup && !endSup) return null;

  // Νέα longitudinal θέση κάθε άκρου = παρειά κολώνας προς το άνοιγμα (idempotent,
  // από τη θέση της κολώνας). Άκρο χωρίς στήριξη → κρατά την αρχική.
  const sProj = startSup ? startSup.proj + columnSupportAlong(startSup.col, ux, uy) : 0;
  const eProj = endSup ? endSup.proj - columnSupportAlong(endSup.col, -ux, -uy) : len;

  // Degenerate guard: οι παρειές δεν αφήνουν έγκυρο άνοιγμα (κολώνες αλληλεπικαλύπτονται
  // ή το δοκάρι θα γινόταν εκφυλισμένο) → μην το αλλάξεις (identity).
  const minLenScene = MIN_BEAM_LENGTH_MM * perScene;
  if (eProj - sProj < minLenScene) return null;

  const nextStart: Point3D = startSup ? { x: a.x + ux * sProj, y: a.y + uy * sProj, z: a.z } : a;
  const nextEnd: Point3D = endSup ? { x: a.x + ux * eProj, y: a.y + uy * eProj, z: b.z } : b;

  // No-op όταν τίποτα δεν μετακινήθηκε αισθητά (μηδέν persist churn).
  const epsScene = REFRAME_EPS_MM * perScene;
  const movedStart = Math.hypot(nextStart.x - a.x, nextStart.y - a.y) > epsScene;
  const movedEnd = Math.hypot(nextEnd.x - b.x, nextEnd.y - b.y) > epsScene;
  if (!movedStart && !movedEnd) return null;

  return { startPoint: nextStart, endPoint: nextEnd };
}
