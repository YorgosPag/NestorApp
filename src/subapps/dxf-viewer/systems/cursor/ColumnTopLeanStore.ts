/**
 * COLUMN TOP-LEAN STORE — zero-React singleton (ADR-404 Phase 5, «Slanted Column» placement).
 *
 * Καθρέφτης του `ColumnRotationStore` για την **κεκλιμένη** κολώνα. Όταν είναι ενεργό το
 * slant mode, το 1ο κλικ ΚΛΕΙΔΩΝΕΙ τη βάση (+ anchor + την rotation της διατομής από το ribbon)·
 * μπαίνουμε σε «awaitingTopLean». Όσο ο χρήστης κινεί τον κέρσορα, το `column-preview-helpers`
 * διαβάζει εδώ imperatively (zero React, ADR-040) και ζωγραφίζει την κολώνα στη ΣΤΑΘΕΡΗ βάση,
 * **γερμένη** προς τον κέρσορα (η οριζόντια απόσταση βάση→κέρσορας → `tilt.angle/direction`,
 * `tiltFromBaseTop`). Το 2ο κλικ commit-άρει με αυτή την κλίση. `null` = εκτός slant phase.
 *
 * Ξεχωριστό από το `ColumnRotationStore` (όχι reuse) ΓΙΑΤΙ: (1) χρειάζεται επιπλέον
 * `rotationDeg` της διατομής, (2) ο reader πρέπει να διακρίνει tilt-phase από rotation-phase
 * μέσω ανεξάρτητου sentinel.
 *
 * @see ./ColumnRotationStore.ts — το αδελφό store (rotation phase)
 * @see ../../bim/columns/column-tilt-from-points.ts — `tiltFromBaseTop` (βάση→κορυφή → tilt)
 * @see ../../hooks/drawing/useColumnTool.ts — writer (1ο/2ο κλικ)
 * @see ../../hooks/drawing/column-preview-helpers.ts — reader (tilt preview)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnAnchor } from '../../bim/types/column-types';

/** Κλειδωμένη βάση + λαβή + rotation διατομής του 1ου κλικ, γύρω από την οποία γέρνει η κολώνα. */
export interface ColumnTopLeanLock {
  readonly basePoint: Point2D;
  readonly anchor: ColumnAnchor;
  readonly rotationDeg: number;
}

let lock: ColumnTopLeanLock | null = null;

/** Write — 1ο κλικ (slant mode): κλείδωσε βάση + λαβή + rotation, μπες σε top-lean phase. */
export function setColumnTopLeanLock(
  basePoint: Readonly<Point2D>,
  anchor: ColumnAnchor,
  rotationDeg: number,
): void {
  lock = { basePoint: { x: basePoint.x, y: basePoint.y }, anchor, rotationDeg };
}

/** Read — imperatively στο preview draw (tilt ghost) + στο 2ο κλικ commit. */
export function getColumnTopLeanLock(): ColumnTopLeanLock | null {
  return lock;
}

/** Clear — μετά το 2ο κλικ / ESC / αλλαγή εργαλείου. */
export function clearColumnTopLeanLock(): void {
  lock = null;
}
