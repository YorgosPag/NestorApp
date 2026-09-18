/**
 * @fileoverview **Ο ΟΡΟΣ ΤΗΣ ΑΝΤΙΠΑΡΟΧΗΣ, ΑΠΟ ΤΗ ΜΙΑ ΑΛΗΘΕΙΑ** — πέμπτη ανάγνωση των διαθέσεων.
 * @related ADR-777 §8.60.17 · lib/offers/derive-stay-terms.ts (το πρότυπο) ·
 *   lib/offers/derive-commercial-status.ts · lib/offers/offer-amount.ts · types/public-listing.ts
 * @module lib/offers/derive-exchange-terms
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΟΣΟΣΤΟ ΗΤΑΝ «ΔΗΛΩΜΕΝΗ ΑΠΩΛΕΙΑ» — ΚΑΙ ΕΠΑΨΕ ΝΑ ΕΙΝΑΙ (2026-09-18)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `deriveCommercialAmounts` **αρνείται** να χαρτογραφήσει το `ExchangeOffer.percentage`, και έχει
 * δίκιο: το παλιό σχήμα έχει μόνο **πεδία ευρώ**, και ένα ποσοστό γραμμένο σε `askingPrice` θα
 * εμφανιζόταν ως «40 €». Όμως η άρνηση είχε κόστος: το ποσοστό **δεν έφτανε ποτέ** στη δημόσια
 * αγγελία, άρα καμία ζήτηση «έως 40% στον οικοπεδούχο» δεν μπορούσε να κριθεί.
 *
 * 🔑 **Η θεραπεία είναι του `stay` (ADR-835 §4.5), όχι νέα**: όρος που **δεν είναι ευρώ** παίρνει
 * **δικό του κουτί** στην προβολή, με δική του ανάγνωση. Ίδιος φρουρός (`isLiveOffer`), ίδιο δόγμα
 * «η τελευταία ζωντανή νικά» (η μοναδικότητα ζει στα invariants, `hasDuplicateLiveOfferKind`).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import { isLiveOffer, type ExchangeOffer, type PropertyOffer } from '@/types/property-offers';

/**
 * **Ο όρος μιας ζωντανής αντιπαροχής**: το ποσοστό του **οικοπεδούχου** επί των νέων τ.μ.
 *
 * ⚠️ **Πάντα του οικοπεδούχου** — ποτέ του κατασκευαστή. Η έκφραση «60-40» διαβάζεται και από τις
 * δύο μεριές· εδώ το όνομα του πεδίου **κλείνει** την ασάφεια. Ίδια έννοια με το
 * `Project.bartexPercentage` (ADR-244) και το `ExchangeOffer.percentage` — **μία**, όχι δεύτερη.
 */
export interface DerivedExchangeTerms {
  /** `null` = ο ιδιοκτήτης δεν το δήλωσε — **«προς συζήτηση»**, όχι 0. */
  readonly landownerShare: number | null;
}

/**
 * Διαθέσεις → **ο όρος της αντιπαροχής**, ή `null` αν δεν υπάρχει ζωντανή αντιπαροχή.
 *
 * 🔴 **`null` ΚΑΙ ΟΧΙ `{ landownerShare: null }`** — ίδια διάκριση με το `deriveStayTerms`: το πρώτο
 * σημαίνει *«δεν διατίθεται για αντιπαροχή»*, το δεύτερο *«διατίθεται, το ποσοστό είναι προς
 * συζήτηση»*. Αντικείμενο με `null` σε ακίνητο προς πώληση θα έλεγε «ποσοστό προς συζήτηση» για
 * συναλλαγή που **δεν προσφέρεται**.
 */
export function deriveExchangeTerms(
  offers: readonly PropertyOffer[] | null | undefined,
): DerivedExchangeTerms | null {
  const live = (offers ?? []).filter(
    (offer): offer is ExchangeOffer => isLiveOffer(offer) && offer.kind === 'exchange',
  );
  const latest = live.at(-1);
  return latest === undefined ? null : { landownerShare: latest.percentage ?? null };
}
