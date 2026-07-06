/**
 * @module line-perpendicular-preview-helpers
 * @description ADR-060 (Revit-grade 2-click) — pure helpers για το εργαλείο «κάθετη γραμμή», που
 * ξαναχρησιμοποιούν **αυτούσιο** τον εγκέφαλο έλξης της γραμμής (`resolveLineFaceSnapAt`, ADR-508
 * §line-cyan) αντί να ξαναγράφουν γεωμετρία.
 *
 * Δύο καθαρές συναρτήσεις, κοινές σε **preview ΚΑΙ commit** → preview ≡ commit by construction:
 *   · `resolvePerpendicularAxisLock` — 1ο κλικ: flush foot πάνω στην παρειά + ο έτοιμος μοναδιαίος
 *     κάθετος άξονας (`faceFrame.perpDir`). Μηδέν νέα τριγωνομετρία.
 *   · `projectOntoPerpendicularAxis` — 2ο κλικ / hover: καθαρή προβολή dot-product του cursor πάνω
 *     στον κλειδωμένο κάθετο άξονα → η γραμμή μένει ΠΑΝΤΑ κάθετη, μήκος/πλευρά ακολουθούν τον κέρσορα.
 *
 * @see ./line-preview-helpers.ts — `resolveLineFaceSnapAt` (ο κοινός εγκέφαλος έλξης, zero-width)
 * @see ../../bim/placement/perpendicular-axis-lock-store.ts — το zero-React lock store
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { resolveLineFaceSnapAt } from './line-preview-helpers';
// SSoT foot-of-perpendicular / project-point-onto-line (ADR-065) — ΤΟ ΙΔΙΟ που χρησιμοποιεί ο
// `PerpendicularSnapEngine`. ΜΗΝ ξαναγράψεις dot-product προβολή εδώ (N.0.2).
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
import type { PerpendicularAxisLock } from '../../bim/placement/perpendicular-axis-lock-store';

/**
 * 1ο κλικ — καταγράφει τον κάθετο άξονα από τον ΙΔΙΟ face-snap εγκέφαλο που ήδη χρησιμοποιεί η γραμμή.
 * Επιστρέφει `{ base, dir }` ΜΟΝΟ όταν ο cursor είναι flush πάνω σε παρειά μέλους (🟢 Τ-framing → υπάρχει
 * `faceFrame`)· `null` σε ελεύθερη κίνηση (→ ο caller αφήνει ελεύθερη γραμμή, χωρίς κάθετο κλείδωμα).
 */
export function resolvePerpendicularAxisLock(
  point: Readonly<Point2D>,
  sceneUnits: SceneUnits,
): PerpendicularAxisLock | null {
  const snap = resolveLineFaceSnapAt(point, sceneUnits);
  if (!snap) return null;
  return { base: { x: snap.start.x, y: snap.start.y }, dir: snap.faceFrame.perpDir };
}

/**
 * 2ο κλικ / hover — προβάλλει το `point` πάνω στον **άπειρο** κλειδωμένο κάθετο άξονα (foot of
 * perpendicular). Κρατά τη γραμμή ΠΑΝΤΑ κάθετη· η θέση κατά μήκος του άξονα δίνει πλευρά + μήκος.
 * Delegates στο SSoT `getNearestPointOnLine` (`clampToSegment=false` → άπειρη ευθεία) — ΚΑΝΕΝΑ νέο
 * projection math (το `dir` είναι μοναδιαίο, οπότε `base → base+dir` ορίζει τον ίδιο άξονα). Pure.
 */
export function projectOntoPerpendicularAxis(
  point: Readonly<Point2D>,
  lock: PerpendicularAxisLock,
): Point2D {
  const axisEnd: Point2D = { x: lock.base.x + lock.dir.x, y: lock.base.y + lock.dir.y };
  return getNearestPointOnLine(point, lock.base, axisEnd, false);
}
