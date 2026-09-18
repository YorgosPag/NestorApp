/**
 * @fileoverview **«ΠΟΙΑ ΕΝΑΛΛΑΚΤΙΚΗ ΜΙΛΑ ΣΕ ΑΥΤΗ ΤΗ ΜΟΝΑΔΑ;»** — ρόλος τιμής → εναλλακτική της ζήτησης.
 * @related ADR-777 §8.60.15 · lib/criteria/listing-criterion-reading.ts (`priceRoleOfSeek`)
 * @module lib/demand/demand-seek-roles
 *
 * 🔑 Δύο καταναλωτές κάνουν την **ίδια** ερώτηση από την πλευρά της **μονάδας**: οι υποχωρήσεις
 * («+100 €/μήνα — πάνω σε ποιο όριο;») και οι ειδοποιήσεις μείωσης τιμής («μείωση **ενοικίου** —
 * μπήκε στο όριο **ενοικίου**;»). Γραμμένη δύο φορές θα ήταν ο μικρός κλώνος του N.0.2.
 *
 * ⛔ Η αντιστοίχιση είδους ↔ ρόλου **δεν** γράφεται εδώ — ρωτιέται το `priceRoleOfSeek`.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { priceRoleOfSeek } from '@/lib/criteria/listing-criterion-reading';
import type { PriceRole } from '@/lib/properties/price-resolver';
import { isPricedSeek, type DemandAmountRange, type DemandSeek } from '@/types/property-demand';

/**
 * **Το εύρος ποσού της εναλλακτικής που μιλά σε αυτή τη μονάδα** — `null` όταν η ζήτηση δεν ζητά
 * συναλλαγή αυτού του ρόλου.
 */
export function amountRangeOfRole(
  seeks: readonly DemandSeek[],
  role: PriceRole,
): DemandAmountRange | null {
  const seek = seeks.filter(isPricedSeek).find((candidate) => priceRoleOfSeek(candidate) === role);
  return seek === undefined ? null : seek.price;
}
