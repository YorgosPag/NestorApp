/**
 * ADR-507 — pure helper: το κορυφαίο `HatchEntity` κάτω από ένα world point.
 *
 * ADR-650 M2-Β: **delegate** στον κοινό `pickTopEntityAt` (world-coords topmost-pick
 * SSoT). Εδώ μένει ΜΟΝΟ το «τι κυνηγάμε» (hatch-only, ώστε το «Επιλογή γραμμοσκίασης»
 * να μην «κλέβεται» από υπερκείμενες γραμμές/τοίχους) — η σάρωση/z-order/hit-test ζουν
 * σε ένα σημείο (N.18: μηδέν sibling clone του loop).
 *
 * @see ../../rendering/hitTesting/pick-top-entity-at — topmost-pick SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isHatchEntity } from '../../types/entities';
import { pickTopEntityAt } from '../../rendering/hitTesting/pick-top-entity-at';

/** Id του κορυφαίου hatch που περιέχει το `worldPoint` (even-odd), ή `null`. */
export function pickTopHatchAt(
  worldPoint: Point2D,
  entities: readonly Entity[],
  tolerance = 0,
): string | null {
  return pickTopEntityAt(worldPoint, entities, isHatchEntity, tolerance);
}
