/**
 * ADR-507 — pure helper: το κορυφαίο `HatchEntity` κάτω από ένα world point.
 *
 * Reuse του even-odd hatch hit-test SSoT (`performDetailedHitTest` → `case 'hatch'`,
 * mirror του `HatchRenderer.hitTest`) — μηδέν νέα γεωμετρία. Topmost-first (τα
 * τελευταία entities ζωγραφίζονται από πάνω). Hatch-only ώστε το «Επιλογή
 * γραμμοσκίασης» να μην «κλέβεται» από υπερκείμενες γραμμές/τοίχους.
 *
 * Είναι ο **world-coords** entry-point (κοινός για click-select ΚΑΙ hover-highlight,
 * όπου δεν υπάρχει transform/viewport για το screen-coords `HitTestingService`).
 * Linear scan over hatches (δεκάδες ανά όροφο) — bulletproof, χωρίς εξάρτηση από
 * το spatial-index sync.
 *
 * @see ../../rendering/hitTesting/hit-test-entity-tests — performDetailedHitTest (SSoT)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isHatchEntity } from '../../types/entities';
import { performDetailedHitTest } from '../../rendering/hitTesting/hit-test-entity-tests';

/** Id του κορυφαίου hatch που περιέχει το `worldPoint` (even-odd), ή `null`. */
export function pickTopHatchAt(
  worldPoint: Point2D,
  entities: readonly Entity[],
  tolerance = 0,
): string | null {
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    if (!isHatchEntity(e)) continue;
    if (performDetailedHitTest(e, worldPoint, tolerance)) return e.id;
  }
  return null;
}
