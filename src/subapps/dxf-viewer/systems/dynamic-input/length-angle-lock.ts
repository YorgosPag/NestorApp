/**
 * ADR-513 / ADR-357 Phase 13 G14 — Length/Angle lock geometry constraint (SSoT).
 *
 * Όταν ο χρήστης κλειδώνει μήκος ή γωνία (γραμμικό Dynamic Input Ctrl+L/Ctrl+A ή το
 * «Δαχτυλίδι Εντολών» / Radial Command Ring), το ghost ΚΑΙ το commit πρέπει να σέβονται
 * την ίδια ακριβώς τιμή — αλλιώς σπάει το WYSIWYG (preview ≠ committed). Αυτή η pure
 * συνάρτηση είναι η **μοναδική** εφαρμογή του περιορισμού:
 *   · `drawing-hover-handler` την καλεί στο preview (rubber-band),
 *   · `useWallTool` την καλεί στο click-commit (awaitingEnd).
 *
 * Διαβάζει το `DynamicInputLockStore` (zero-React singleton). Όταν δεν υπάρχει
 * ενεργό lock → επιστρέφει το σημείο **αυτούσιο** (no-op), οπότε η ένταξή της σε
 * οποιοδήποτε path είναι ασφαλής (μηδέν regression όταν το ring δεν χρησιμοποιείται).
 *
 * Zero React / DOM dependencies — fully unit-testable.
 *
 * @see ./DynamicInputLockStore.ts — η πηγή του locked field/value
 */

import type { Point2D } from '../../rendering/types/Types';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';
import { DynamicInputLockStore } from './DynamicInputLockStore';

/** Ελάχιστη απόσταση (world) κάτω από την οποία ο length-scale είναι αριθμητικά ασταθής. */
const MIN_LOCK_DIST = 0.001;

/**
 * Περιόρισε το `point` ώστε να σέβεται το ενεργό length/angle lock, σχετικά με το `ref`
 * (η αρχή του γραμμικού μέλους — last drawing point / wall start). Επιστρέφει νέο σημείο
 * μόνο όταν υπάρχει lock· αλλιώς το ίδιο `point` (no-op).
 *
 * - **length lock**: κρατά την κατεύθυνση `ref → point`, σταθεροποιεί την απόσταση = locked.
 * - **angle lock**: κρατά την απόσταση `ref → point`, σταθεροποιεί τη γωνία = locked (μοίρες).
 */
export function applyLengthAngleLock(
  point: Readonly<Point2D>,
  ref: Readonly<Point2D> | null | undefined,
): Point2D {
  if (!ref) return { x: point.x, y: point.y };
  // ADR-513 — dual independent locks: εφαρμόζονται ΚΑΙ τα δύο αν είναι ενεργά.
  const { length, angle } = DynamicInputLockStore.getLocked();
  if (length === null && angle === null) return { x: point.x, y: point.y };

  const dx = point.x - ref.x;
  const dy = point.y - ref.y;
  const dist = Math.hypot(dx, dy);

  // Μήκος-μόνο: κράτα την κατεύθυνση, κλείδωσε την απόσταση.
  if (length !== null && angle === null) {
    if (dist <= MIN_LOCK_DIST) return { x: point.x, y: point.y };
    const scale = length / dist;
    return { x: ref.x + dx * scale, y: ref.y + dy * scale };
  }

  // Γωνία εμπλέκεται (μόνη της ή μαζί με μήκος): target γωνία = locked· target απόσταση = locked ή τρέχουσα.
  const rad = degToRad(angle ?? 0);
  const r = length !== null ? length : dist;
  return { x: ref.x + r * Math.cos(rad), y: ref.y + r * Math.sin(rad) };
}

/**
 * ADR-508 / ADR-513 — `true` όταν υπάρχει ενεργό length Ή angle lock (ρητή αριθμητική είσοδος από το
 * «Δαχτυλίδι Εντολών» / linear Dynamic Input). Χρησιμοποιείται για precedence: η ρητή είσοδος του
 * χρήστη **νικά** το αυτόματο face-snap του endpoint. Διαβάζει το ΙΔΙΟ `DynamicInputLockStore` SSoT.
 */
export function isLengthAngleLockActive(): boolean {
  const { length, angle } = DynamicInputLockStore.getLocked();
  return length !== null || angle !== null;
}
