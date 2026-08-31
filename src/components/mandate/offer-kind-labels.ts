/**
 * @fileoverview **ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΠΡΑΞΕΩΝ** — ένας πίνακας, όχι παρεμβολή.
 * @related ADR-832 §3 · types/property-offers.ts · CHECK 3.8 · Π3
 * @module components/mandate/offer-kind-labels
 *
 * 🔴 **ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΠΑΡΕΜΒΟΛΗ, ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ ΜΕ ΤΟ
 * `listing-agreement-labels.ts`.** Το `OwnerPropertyFields.tsx` και το
 * `OwnerPropertyCard.tsx` γράφουν σήμερα `t(\`${K}.offerKind.${kind}\`)` — **δυναμικό
 * κλειδί**, που ο τεμαχιστής (ADR-744) δεν επιλύει και η **CHECK 3.8** δεν βλέπει:
 * διαγραφή κλειδιού από τα locales **δεν κοκκινίζει τίποτα** και η οθόνη βάφει ωμό
 * κλειδί. Επιλύεται **μόνο** `t(TABLE[x])` με `TABLE` **σταθερά module**.
 *
 * 🔑 **ΚΑΙ ΤΑ ΚΕΙΜΕΝΑ ΔΕΝ ΞΑΝΑΓΡΑΦΟΝΤΑΙ**: δείχνει στα **υπάρχοντα**
 * `offer.offerKind.*`. Η πράξη είναι η **ίδια έννοια** όποιος κι αν τη διαλέγει —
 * δεύτερο σύνολο λέξεων θα σήμαινε ότι ο ιδιοκτήτης δηλώνει «Πώληση» στη μία οθόνη
 * και κάτι άλλο στην επόμενη, για το **ίδιο** πράγμα.
 *
 * ⚠️ Ο τύπος `Record<OfferKind, string>` ⇒ **νέα πράξη δεν μεταγλωττίζεται** χωρίς
 * όνομα. Το κλειστό σύνολο μένει κλειστό.
 *
 * 🔶 **Εκκρεμότητα, γραμμένη** (N.0.2): τα δύο σημεία με παρεμβολή οφείλουν να
 * μεταναστεύσουν σε αυτόν τον πίνακα — άλλη οθόνη, άλλο slice, δικό τους βήμα.
 */

import { OFFER_KINDS, type OfferKind } from '@/types/property-offers';

const K = 'property-market:offer.offerKind';

/** Πράξη → κλειδί i18n. **Σταθερά module** — δες την κεφαλίδα. */
export const OFFER_KIND_I18N_KEYS: Record<OfferKind, string> = {
  sell: `${K}.sell`,
  leaseOut: `${K}.leaseOut`,
  exchange: `${K}.exchange`,
  leaseShort: `${K}.leaseShort`,
};

/**
 * **Ο παρονομαστής**: κάθε πράξη του κλειστού συνόλου έχει όνομα.
 *
 * 🔑 Ο τύπος το εγγυάται ήδη· αυτό υπάρχει για την **άγκυρα**, ώστε η εγγύηση να
 * μπορεί να **κοκκινίσει** και όχι μόνο να μη χτίζει (CHECK 3.54).
 */
export function everyOfferKindNamed(): boolean {
  return OFFER_KINDS.every((kind) => (OFFER_KIND_I18N_KEYS[kind] ?? '').startsWith(K));
}
