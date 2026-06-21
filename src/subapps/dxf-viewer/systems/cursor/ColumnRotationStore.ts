/**
 * COLUMN ROTATION STORE — zero-React singleton (ADR-508 §column place+rotate).
 *
 * Κατά το 2-click flow της κολώνας (πλήρης παριότητα με τοίχο/δοκάρι): το 1ο κλικ ΚΛΕΙΔΩΝΕΙ τη
 * θέση (+ auto anchor από το face-snap)· μπαίνουμε σε «awaitingRotation». Όσο ο χρήστης κινεί τον
 * κέρσορα, το `column-preview-helpers` διαβάζει εδώ imperatively (zero React, ADR-040) και
 * ζωγραφίζει την κολώνα στη ΣΤΑΘΕΡΗ θέση, **περιστρεφόμενη** προς τον κέρσορα. Το 2ο κλικ
 * commit-άρει με αυτή τη γωνία. `null` = κανονική τοποθέτηση (εκτός rotation phase).
 *
 * @see ./ColumnPlacementGhostStatusStore.ts — ίδιο pattern (zero-React placement store)
 * @see ../../hooks/drawing/useColumnTool.ts — writer (1ο/2ο κλικ)
 * @see ../../hooks/drawing/column-preview-helpers.ts — reader (rotation preview)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnAnchor } from '../../bim/types/column-types';

/** Κλειδωμένη θέση + λαβή του 1ου κλικ, γύρω από την οποία περιστρέφεται η κολώνα. */
export interface ColumnRotationLock {
  readonly origin: Point2D;
  readonly anchor: ColumnAnchor;
}

let lock: ColumnRotationLock | null = null;

/** Write — 1ο κλικ: κλείδωσε θέση + λαβή, μπες σε rotation phase. */
export function setColumnRotationLock(origin: Readonly<Point2D>, anchor: ColumnAnchor): void {
  lock = { origin: { x: origin.x, y: origin.y }, anchor };
}

/** Read — imperatively στο preview draw (rotation ghost) + στο 2ο κλικ commit. */
export function getColumnRotationLock(): ColumnRotationLock | null {
  return lock;
}

/** Clear — μετά το 2ο κλικ / ESC / αλλαγή εργαλείου. */
export function clearColumnRotationLock(): void {
  lock = null;
}
