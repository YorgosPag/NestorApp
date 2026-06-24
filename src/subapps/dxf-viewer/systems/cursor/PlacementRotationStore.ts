/**
 * PLACEMENT ROTATION STORE — zero-React singleton (ADR-514 Φ6d, generalised place+rotate lock).
 *
 * **Κοινό SSoT** για το 2-click «place → rotate» flow ΟΛΩΝ των point-based placement εργαλείων που
 * περιστρέφουν προς τον κέρσορα (κολώνα ΚΑΙ πέδιλο, beyond AutoCAD/Revit dynamic input): το 1ο κλικ
 * ΚΛΕΙΔΩΝΕΙ τη θέση (+ auto anchor από το face-snap)· μπαίνουμε σε «awaitingRotation». Όσο ο χρήστης
 * κινεί τον κέρσορα, το `*-preview-helpers` διαβάζει εδώ imperatively (zero React, ADR-040) και
 * ζωγραφίζει την οντότητα στη ΣΤΑΘΕΡΗ θέση, **περιστρεφόμενη** προς τον κέρσορα (`assemblePlacementRotationGhost`).
 * Το 2ο κλικ commit-άρει με αυτή τη γωνία. `null` = κανονική τοποθέτηση (εκτός rotation phase).
 *
 * Εξήχθη από το `ColumnRotationStore` (ήταν column-only) ώστε το πέδιλο να το μοιράζεται αυτούσιο —
 * μηδέν παράλληλο store. Το `ColumnRotationStore.ts` κρατά byte-for-byte aliases (`setColumnRotationLock`
 * κ.λπ.) → οι column consumers (`useColumnTool`, `column-preview-helpers`, `drawing-hover-handler`)
 * δεν αλλάζουν· γράφουν/διαβάζουν το ΙΔΙΟ lock με το πέδιλο.
 *
 * @see ./ColumnRotationStore.ts — column-named aliases (backward-compat)
 * @see ../../bim/placement/placement-ghost-assembly.ts — reader (rotation preview)
 * @see ../../hooks/drawing/useColumnTool.ts · ../../hooks/drawing/useFoundationTool.ts — writers (1ο/2ο κλικ)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnAnchor } from '../../bim/types/column-types';

/**
 * Κλειδωμένη θέση + λαβή του 1ου κλικ, γύρω από την οποία περιστρέφεται η οντότητα. `anchor` είναι
 * το κοινό 9-position placement anchor (`ColumnAnchor` ≡ `FoundationAnchor` — ταυτόσημο string union).
 */
export interface PlacementRotationLock {
  readonly origin: Point2D;
  readonly anchor: ColumnAnchor;
}

let lock: PlacementRotationLock | null = null;

/** Write — 1ο κλικ: κλείδωσε θέση + λαβή, μπες σε rotation phase. */
export function setPlacementRotationLock(origin: Readonly<Point2D>, anchor: ColumnAnchor): void {
  lock = { origin: { x: origin.x, y: origin.y }, anchor };
}

/** Read — imperatively στο preview draw (rotation ghost) + στο 2ο κλικ commit. */
export function getPlacementRotationLock(): PlacementRotationLock | null {
  return lock;
}

/** Clear — μετά το 2ο κλικ / ESC / αλλαγή εργαλείου. */
export function clearPlacementRotationLock(): void {
  lock = null;
}
