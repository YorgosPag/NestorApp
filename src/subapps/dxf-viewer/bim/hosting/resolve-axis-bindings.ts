/**
 * Associative Grid Hosting — Host-on-snap binding resolver (ADR-441, Slice COL/WALL).
 *
 * Revit «host to grid»: όταν σχεδιάζεται τοίχος/κολώνα και ένα coordinate πέφτει **πάνω**
 * σε άξονα κανάβου, η entity «κρεμιέται» αυτόματα σε εκείνον τον άξονα. Μοντέλο =
 * **γεωμετρική σύμπτωση με άξονα** (όχι «snap event fired») → SSoT-correct: δουλεύει είτε
 * το σημείο ήρθε με snap είτε με typed coordinate. Pure — μηδέν store/DOM access (ο reader
 * περνιέται απ' έξω, ίδιο pattern με `AxisGuideReader` της εσχάρας θεμελίωσης).
 *
 * @see bim/hosting/guide-binding-types.ts — GuideBinding / slot model
 * @see bim/foundations/foundation-from-grid.ts — AxisGuideReader (SSoT reader)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 */

import type { GuideBinding, GuideBindingSlot } from './guide-binding-types';
import type { AxisGuideReader } from '../foundations/foundation-from-grid';
import type { Guide } from '../../systems/guides/guide-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/** Tolerance (mm) κάτω από την οποία ένα coordinate θεωρείται «πάνω» σε άξονα. */
export const AXIS_HOST_TOL_MM = 1;

/** Κάτω από αυτό το |extend| (mm) → omit (το coordinate κάθεται ΠΑΝΩ στον άξονα). */
const EXTEND_EPS_MM = 0.01;

/** Το `AXIS_HOST_TOL_MM` σε scene units του τρέχοντος σχεδίου (scale-aware). */
export function axisHostTolScene(sceneUnits: SceneUnits): number {
  return AXIS_HOST_TOL_MM * mmToSceneUnits(sceneUnits);
}

/** Ένα coordinate της entity που μπορεί να «δεθεί» σε άξονα του δηλωμένου axis. */
export interface AxisCoord {
  /** 'X' = κατακόρυφος άξονας (x = offset)· 'Y' = οριζόντιος (y = offset). */
  readonly axis: Guide['axis'];
  /**
   * Η τιμή του coordinate για ΑΝΑΖΗΤΗΣΗ άξονα (scene units) — π.χ. το location-line
   * σημείο του τοίχου (παρειά) ή το `position` της κολώνας.
   */
  readonly value: number;
  /** Ποιο slot της entity ελέγχει αυτός ο άξονας αν βρεθεί σύμπτωση. */
  readonly slot: GuideBindingSlot;
  /**
   * Η ΠΡΑΓΜΑΤΙΚΗ τιμή του coordinate που γράφεται στις params (scene units), αν διαφέρει
   * από το `value`. Χρήση: τοίχος με Location Line = Finish Face — η παρειά (`value`)
   * κάθεται στον άξονα αλλά ο άξονας του τοίχου (`axisValue`) απέχει ±t/2. Η διαφορά
   * αποθηκεύεται ως σταθερό `extend` (mm) ώστε το follow-on-move να κρατά την παρειά στον
   * άξονα. Απών → `value` (καμία μετατόπιση, π.χ. κολώνα/centerline).
   */
  readonly axisValue?: number;
}

/** Ο πλησιέστερος ορατός άξονας του `axis` εντός `tol`, αλλιώς `undefined`. */
function findAxisGuide(
  reader: AxisGuideReader,
  axis: Guide['axis'],
  value: number,
  tol: number,
): { readonly id: string; readonly offset: number } | undefined {
  let best: { id: string; offset: number; dist: number } | undefined;
  for (const g of reader.getGuidesByAxis(axis)) {
    if (!g.visible) continue;
    const dist = Math.abs(g.offset - value);
    if (dist <= tol && (!best || dist < best.dist)) best = { id: g.id, offset: g.offset, dist };
  }
  return best ? { id: best.id, offset: best.offset } : undefined;
}

/**
 * Resolve τα grid bindings ενός συνόλου coordinates. Κάθε coord που πέφτει πάνω σε άξονα →
 * ένα `GuideBinding`, με σταθερό `extend` (mm) αν η πραγματική params-τιμή (`axisValue`)
 * απέχει από τον άξονα (Finish-Face τοίχος). `canvasToMm` = 1/scale για τη μετατροπή του
 * residual σε mm. Coordinates μακριά από κάθε άξονα αγνοούνται (ελεύθερα).
 */
export function resolveAxisBindings(
  coords: readonly AxisCoord[],
  reader: AxisGuideReader,
  tol: number,
  canvasToMm = 1,
): GuideBinding[] {
  const out: GuideBinding[] = [];
  for (const c of coords) {
    const guide = findAxisGuide(reader, c.axis, c.value, tol);
    if (!guide) continue;
    const extendMm = ((c.axisValue ?? c.value) - guide.offset) * canvasToMm;
    out.push(
      Math.abs(extendMm) > EXTEND_EPS_MM
        ? { guideId: guide.id, slot: c.slot, extend: extendMm }
        : { guideId: guide.id, slot: c.slot },
    );
  }
  return out;
}
