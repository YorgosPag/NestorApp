/**
 * @fileoverview **ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΕΙΔΩΝ ΕΝΤΟΛΗΣ** — ένας πίνακας, δύο ακροατήρια.
 * @related ADR-827 §9.17 ε · types/listing-agreement.ts · CHECK 3.8 · Π3
 * @module components/mandate/listing-agreement-labels
 *
 * 🔴 **ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΠΑΡΕΜΒΟΛΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΑΙΤΗΣΗ ΤΟΥ ΤΕΜΑΧΙΣΤΗ.** Το
 * `BrokeredMandateFields.tsx` γράφει `t(\`${K}.agreementOptions.${agreement}\`)` —
 * **δυναμικό κλειδί**, που ο τεμαχιστής δεν επιλύει και η **CHECK 3.8** δεν βλέπει.
 * Επιλύεται **μόνο** `t(TABLE[x])` με `TABLE` **σταθερά module στο ίδιο αρχείο**.
 *
 * 🔑 **ΚΑΙ ΤΑ ΚΕΙΜΕΝΑ ΔΕΝ ΞΑΝΑΓΡΑΦΟΝΤΑΙ**: δείχνει στα **υπάρχοντα**
 * `mandate.office.agreementOptions.*`. Το είδος εντολής είναι η **ίδια νομική έννοια**
 * όποιος κι αν τη διαλέγει — δεύτερο σύνολο λέξεων θα σήμαινε ότι ο ιδιοκτήτης και ο
 * μεσίτης συμφωνούν σε πράγματα με **διαφορετικά ονόματα**.
 *
 * ⚠️ Ο τύπος `Record<ListingAgreement, string>` ⇒ **νέο είδος εντολής δεν
 * μεταγλωττίζεται** χωρίς όνομα. Το κλειστό σύνολο μένει κλειστό.
 *
 * 🔶 **Εκκρεμότητα, γραμμένη**: το `BrokeredMandateFields.tsx` οφείλει να μεταναστεύσει
 * σε αυτόν τον πίνακα — και τα **16** κλειδιά του χτίζονται με παρεμβολή.
 *
 * ⚠️ **ΔΙΟΡΘΩΣΗ 2026-08-29 — Ο ΛΟΓΟΣ ΠΟΥ ΕΓΡΑΦΕ ΕΔΩ ΗΤΑΝ ΨΕΥΔΗΣ.** Έλεγε *«τότε φεύγει
 * και η δήλωσή του στο `dynamicKeyPolicy`»*. **Δεν υπάρχει τέτοια δήλωση**: ο τεμαχιστής
 * (ADR-744) **επιλύει** τη σταθερά module `K` και τον πίνακα `VIA_KEY` μέσω του
 * `constant-resolution.js`, το per-route slice της `/o/…/listings/mandates/new` περιέχει
 * και τους **21** κλάδους του `mandate.office`, και **καμία** από τις 10 εγγραφές policy
 * του `.i18n-shell-slice.json` δεν αφορά αυτό το αρχείο.
 *
 * 🔴 **Το πραγματικό χρέος είναι σοβαρότερο**: η **CHECK 3.8** ψάχνει **κυριολεκτικά**
 * `t('key')` ⇒ είναι **δομικά τυφλή** στα παρεμβαλλόμενα. Διαγραφή κλειδιού από τα
 * locales **δεν κοκκινίζει τίποτα** και η οθόνη της εντολής βάφει **ωμό κλειδί**.
 *
 * Δεν γίνεται εδώ: άλλη οθόνη, άλλη διαδρομή, άλλο slice ⇒ δικό του βήμα, γραμμένο στο
 * `.claude-rules/pending-ratchet-work.md` (N.0.2) — δες και ADR-827 §9.19 ε #4.
 */

import { LISTING_AGREEMENTS, type ListingAgreement } from '@/types/listing-agreement';

const K = 'property-market:mandate.office.agreementOptions';

/** Είδος εντολής → κλειδί i18n. **Σταθερά module** — δες την κεφαλίδα. */
export const LISTING_AGREEMENT_I18N_KEYS: Record<ListingAgreement, string> = {
  'exclusive-agency': `${K}.exclusive-agency`,
  'exclusive-right-to-sell': `${K}.exclusive-right-to-sell`,
  'exclusive-right-to-lease': `${K}.exclusive-right-to-lease`,
  open: `${K}.open`,
};

/**
 * **Ο παρονομαστής**: κάθε είδος του κλειστού συνόλου έχει όνομα.
 *
 * 🔑 Ο τύπος το εγγυάται ήδη· αυτό υπάρχει για την **άγκυρα**, ώστε η εγγύηση να
 * μπορεί να **κοκκινίσει** και όχι μόνο να μη χτίζει (CHECK 3.54).
 */
export function everyAgreementNamed(): boolean {
  return LISTING_AGREEMENTS.every(
    (agreement) => (LISTING_AGREEMENT_I18N_KEYS[agreement] ?? '').startsWith(K),
  );
}
