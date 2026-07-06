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
 * 2ο κλικ / hover — προβάλλει το `point` πάνω στον κλειδωμένο κάθετο άξονα (`lock.base` + t·`lock.dir`),
 * όπου `t` = προσημασμένη προβολή (dot-product). Κρατά τη γραμμή ΠΑΝΤΑ κάθετη· το πρόσημο του `t`
 * δίνει την πλευρά, το μέτρο το μήκος. Pure.
 */
export function projectOntoPerpendicularAxis(
  point: Readonly<Point2D>,
  lock: PerpendicularAxisLock,
): Point2D {
  const t = (point.x - lock.base.x) * lock.dir.x + (point.y - lock.base.y) * lock.dir.y;
  return { x: lock.base.x + t * lock.dir.x, y: lock.base.y + t * lock.dir.y };
}
