/**
 * @fileoverview **«ΠΟΣΟ ΚΟΣΤΙΖΕΙ ΑΥΤΟ ΣΕ ΑΥΤΗ ΤΗ ΜΟΝΑΔΑ;»** — ένα ποσό ανά ρόλο, όχι «η» τιμή.
 * @related ADR-777 §8.60.15 · lib/properties/price-resolver.ts · lib/criteria/listing-criterion-reading.ts
 * @module lib/properties/price-by-role
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ (2026-09-18)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι τρεις άξονες τιμής της αναζήτησης (`priceSale` · `priceRent` · `priceNightly`) διάβαζαν
 * **όλοι** το `getEffectivePrice` — δηλαδή την **κύρια** τιμή — και ρωτούσαν «είναι η κύρια τιμή
 * αυτού του ρόλου;». Μια αγγελία **«πώληση και ενοικίαση»** έχει κύρια την **πώληση** και το
 * ενοίκιο στο `secondary` (`resolveDisplayPrice`, `for-sale-and-rent`) ⇒ **δεν απαντούσε ποτέ**
 * σε αναζήτηση ενοικίου. Ο άνθρωπος που ψάχνει «έως 900 €/μήνα» δεν έβλεπε σπίτι που
 * **νοικιάζεται** 800 €, επειδή **επίσης** πωλείται.
 *
 * Το ίδιο και η διανυκτέρευση: *«nightly is a headline, never a secondary»* (επιλυτής) ⇒ ακίνητο
 * προς πώληση **και** βραχυχρόνια μίσθωση δεν απαντούσε στο `priceNightly`.
 *
 * 🔑 **Η ερώτηση είναι άλλη, όχι η ίδια με άλλα λόγια.** «Ποια είναι η τιμή;» (ένα ποσό για την
 * οθόνη) ⇄ «πόσο κοστίζει **σε αυτή τη μονάδα**;» (ένα ποσό ανά ρόλο, για κρίση). Η πρώτη
 * απάντηση **δεν αλλάζει** — 41 καταναλωτές τη διαβάζουν.
 *
 * ⛔ **ΚΑΝΕΝΑ ΑΝΤΙΓΡΑΦΟ ΤΟΥ ΕΠΙΛΥΤΗ.** Διαβάζει **μόνο** ό,τι ήδη αποφάσισε το `resolveDisplayPrice`
 * (κύρια + δεύτερη) και το `resolveNightlyPrice`. Κανένα πεδίο `commercial.*` δεν διαβάζεται εδώ.
 *
 * ⚠️ **Χωριστό αρχείο** (N.7.1): ο `price-resolver.ts` είναι στο όριο των 500 γραμμών.
 */

import {
  resolveDisplayPrice,
  resolveNightlyPrice,
  type PricedPropertyLike,
  type PriceRole,
  type ResolvedPrice,
} from '@/lib/properties/price-resolver';
import type { OfferKind } from '@/types/property-offers';

/**
 * Η διάθεση που **αποδεικνύει** ότι η τιμή ανά νύχτα είναι ζωντανή.
 *
 * 🔑 Ένα `nightlyRate` πάνω σε ακίνητο που **δεν** προσφέρεται για βραχυχρόνια μίσθωση είναι
 * **υπόλειμμα**, όχι τιμή: δεν επιτρέπεται να απαντήσει σε αναζήτηση. Ο επιλυτής κάνει το ίδιο
 * στο `answerFromOfferKinds` — η νύχτα μιλά **μόνο** όταν το `offerKinds` τη δηλώνει.
 */
const NIGHTLY_OFFER_KIND: OfferKind = 'leaseShort';

/**
 * **Το ποσό αυτού του ακινήτου στον ρόλο `role`** — ή `null` όταν δεν το προσφέρει σε αυτή τη μονάδα.
 *
 * | Ρόλος | Από πού |
 * |---|---|
 * | ίδιος με την κύρια τιμή | η **κύρια** (ταυτόσημο με τη σημερινή απάντηση) |
 * | ίδιος με τη δεύτερη | η **δεύτερη** (`for-sale-and-rent` ⇒ ενοίκιο) |
 * | `nightly`, με `leaseShort` στις διαθέσεις | `resolveNightlyPrice` |
 *
 * ⚠️ **Υπερσύνολο, ποτέ αλλαγή**: όπου η κύρια τιμή ήταν ήδη του ρόλου, η απάντηση είναι **η ίδια**.
 * Προστίθενται μόνο οι δύο περιπτώσεις που χάνονταν.
 */
export function resolvePriceForRole(
  input: PricedPropertyLike,
  role: PriceRole,
): ResolvedPrice | null {
  const display = resolveDisplayPrice(input);
  if (display.kind === 'priced') {
    if (display.headline.role === role) return display.headline;
    if (display.secondary?.role === role) return display.secondary;
  }
  if (role === 'nightly' && (input.offerKinds ?? []).includes(NIGHTLY_OFFER_KIND)) {
    return resolveNightlyPrice(input);
  }
  return null;
}
