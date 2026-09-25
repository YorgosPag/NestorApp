/**
 * @fileoverview **ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΣΥΝΑΛΛΑΓΩΝ ΑΠΟ ΤΗ ΜΕΡΙΑ ΤΟΥ ΖΗΤΟΥΝΤΟΣ** — ένας πίνακας, όχι παρεμβολή.
 * @related ADR-777 §8.60.15 · §8.60.16 · components/mandate/offer-kind-labels.ts (το πρότυπο) · CHECK 3.8
 * @module lib/demand/seek-kind-labels
 *
 * 🔴 **ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΠΑΡΕΜΒΟΛΗ, ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ ΜΕ ΤΟ `offer-kind-labels.ts`.** Το
 * `t(\`${K}.seekKind.${kind}\`)` είναι **δυναμικό κλειδί**: η **CHECK 3.8** δεν το βλέπει, άρα διαγραφή
 * κλειδιού από τα locales **δεν κοκκινίζει τίποτα** και η οθόνη βάφει ωμό κλειδί. Επιλύεται **μόνο**
 * `t(TABLE[x])` με `TABLE` **σταθερά module**.
 *
 * 🔑 **Γιατί ΧΩΡΙΣΤΟ λεξιλόγιο από το `offer.offerKind.*`**: η **ίδια** συναλλαγή λέγεται αλλιώς από την
 * άλλη μεριά — ο ιδιοκτήτης κάνει «Πώληση», ο ζητών «Αγορά»· ο ιδιοκτήτης «Βραχυχρόνια μίσθωση», ο
 * ζητών «Διαμονή». Δύο οπτικές, **ένα** κλειστό σύνολο (`OfferKind`).
 *
 * ⚠️ Ο τύπος `Record<OfferKind, string>` ⇒ **νέα συναλλαγή δεν μεταγλωττίζεται** χωρίς όνομα.
 */

import type { OfferKind } from '@/types/property-offers';

const K = 'property-market:demand.summary.seekKind';

/** Συναλλαγή → κλειδί i18n από τη μεριά του ζητούντος. **Σταθερά module** — δες την κεφαλίδα. */
export const SEEK_KIND_I18N_KEYS: Readonly<Record<OfferKind, string>> = {
  sell: `${K}.sell`,
  leaseOut: `${K}.leaseOut`,
  exchange: `${K}.exchange`,
  leaseShort: `${K}.leaseShort`,
};
