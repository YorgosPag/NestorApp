/**
 * ADR-441 / ADR-529 — Canonical justification point-shift SSoT (Revit Location Line).
 *
 * **Μία και μόνη πηγή** για τη μετατροπή ανάμεσα στη **location line** (ο αποθηκευμένος άξονας
 * αναφοράς — Revit Location Line) και τον **body axis** (justified centerline, γύρω από τον οποίο
 * χτίζεται η διατομή) ενός γραμμικού μέλους (δοκάρι / τοίχος / πεδιλοδοκός).
 *
 * Το μαθηματικό είναι `canonicalAxisNormal × JUSTIFICATION_NORMAL_SIGN × (width/2)` — ήταν
 * **τριπλο-γραμμένο** (`stripJustifiedAxis` & `unjustifyStripAxis` στο foundation-geometry,
 * `justifyGridSegment` στο grid-segment-justification). Όλα delegate-άρουν πλέον εδώ ώστε
 * δοκάρι+τοίχος+πεδιλοδοκός να μοιράζονται **την ίδια** orientation-invariant γεωμετρία.
 *
 * Γιατί associative (Revit): επειδή η location line μένει σταθερή και το σώμα μετατοπίζεται κατά
 * `sign·hw`, όταν αλλάζει το `width` (π.χ. ο στατικός οργανισμός ξανα-διαστασιολογεί) η **flush
 * παρειά πάνω στη location line ΜΕΝΕΙ** — χωρίς listener, by construction.
 *
 * Pure· canvas/scene units in/out (start/end), width σε mm (μετατρέπεται με `sceneUnits`).
 *
 * @see ./axis-normal.ts — canonicalAxisNormal (orientation-invariant CCW normal)
 * @see ../types/foundation-types.ts — JUSTIFICATION_NORMAL_SIGN (center=0/left=+1/right=−1)
 * @see ../geometry/foundation-geometry.ts — stripJustifiedAxis/unjustifyStripAxis (delegate)
 * @see ./grid-segment-justification.ts — justifyGridSegment (delegate, +bindings extend)
 * @see ../geometry/beam-geometry.ts — pickAxisVertices (consumer: location → body)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  JUSTIFICATION_NORMAL_SIGN,
  type StripJustification,
} from '../types/foundation-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { canonicalAxisNormal } from './axis-normal';

/** Μετατόπισε start/end κάθετα κατά `dir·sign·(width/2)` (scene units). dir=+1 forward, −1 inverse. */
function shiftPerp(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  widthMm: number,
  justification: StripJustification | undefined,
  sceneUnits: SceneUnits | undefined,
  dir: 1 | -1,
): { start: Point2D; end: Point2D } {
  const sign = JUSTIFICATION_NORMAL_SIGN[justification ?? 'center'] * dir;
  const n = canonicalAxisNormal(start, end);
  if (sign === 0 || !n) {
    return { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } };
  }
  const s = mmToSceneUnits(sceneUnits ?? 'mm');
  const j = sign * ((widthMm * s) / 2); // signed offset κατά τον canonical normal (scene units)
  return {
    start: { x: start.x + n.nx * j, y: start.y + n.ny * j },
    end: { x: end.x + n.nx * j, y: end.y + n.ny * j },
  };
}

/**
 * **Forward** (location line → body axis): μετατόπισε τον άξονα αναφοράς κατά `sign·width/2` κατά
 * τον canonical normal ώστε να προκύψει ο justified centerline (όπου κάθεται η διατομή). `center`/
 * absent ή degenerate (μηδενικού μήκους) άξονας → identity.
 */
export function justifyAxisPoints(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  widthMm: number,
  justification: StripJustification | undefined,
  sceneUnits: SceneUnits | undefined,
): { start: Point2D; end: Point2D } {
  return shiftPerp(start, end, widthMm, justification, sceneUnits, 1);
}

/**
 * **Inverse** (body axis → location line): από έναν justified centerline (π.χ. μετά από grip resize
 * ή auto-span body) + το νέο `width`, ανάκτησε τη location line ώστε η οντότητα να αποθηκεύει
 * `start`/`end` = location line + `justification` χωριστά. `center` → identity. Pure.
 */
export function unjustifyAxisPoints(
  effStart: Readonly<Point2D>,
  effEnd: Readonly<Point2D>,
  widthMm: number,
  justification: StripJustification | undefined,
  sceneUnits: SceneUnits | undefined,
): { start: Point2D; end: Point2D } {
  return shiftPerp(effStart, effEnd, widthMm, justification, sceneUnits, -1);
}
