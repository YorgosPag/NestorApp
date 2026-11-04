/**
 * @fileoverview **Ποσότητα ↔ χιλιοστά της μονάδας** — ο ΕΝΑΣ μετατροπέας (ADR-928 §5.4 · Φ3γ-2).
 * @module lib/uom/milli-quantity
 *
 * Οι ποσότητες της υπεργολαβίας αποθηκεύονται **ακέραιες** σε χιλιοστά της μονάδας (`estimatedMilliQuantity` ·
 * `insuredDaysCap.milliUnitsPerInsuredDay` · `minimumOutputs.milliUnitsPerDay`): 12,5 τ.μ. = 12.500. Η ακέραια μορφή
 * κρατά την αριθμητική ακριβή· η ανθρώπινη μορφή ζει μόνο στη φόρμα.
 *
 * 🔑 Τέταρτο δεκαδικό ⇒ `null`, όχι στρογγύλευση (ίδιος κανόνας με `basisPointsFromPercent`): η μηχανή δεν αλλάζει
 *    σιωπηλά ό,τι έγραψε ο άνθρωπος.
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { scaledInteger } from '@/lib/pricing/exact-arithmetic';

/** Χιλιοστά ανά μονάδα. */
export const MILLI_PER_UNIT = 1000;

/** Ποσότητα (π.χ. `12.5`) → χιλιοστά (`12500`). `null` για μη πεπερασμένο, αρνητικό, ή με τέταρτο δεκαδικό. */
export function milliFromQuantity(quantity: number): number | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  return scaledInteger(quantity, MILLI_PER_UNIT);
}

/** Χιλιοστά → ποσότητα για φόρμα ή μορφοποίηση. Ποτέ για αριθμητική. */
export function quantityFromMilli(milli: number): number {
  return milli / MILLI_PER_UNIT;
}
