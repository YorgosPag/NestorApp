'use client';

/**
 * @fileoverview **ΤΑ ΚΕΙΜΕΝΑ ΤΗΣ ΦΟΡΜΑΣ ΠΡΟΣΦΟΡΑΣ** — ΕΝΑΣ πίνακας, ΜΙΑ γραμμή κώδικα.
 * @related lib/forms/draft-form-labels.ts (όλο το γιατί) · ADR-827 §9.14 · CHECK 3.34
 * @module components/owner-property/offer-form-labels
 *
 * 🔴 **ΓΙΑΤΙ ΑΡΧΕΙΟ ΑΝΑ ΒΑΣΗ**: η `dynamicKeyPolicy` του τεμαχιστή ζει **ανά ΑΡΧΕΙΟ**.
 * Κοινό αρχείο με όρισμα `base` θα δήλωνε **και τις δύο** ρίζες, και **κάθε** διαδρομή
 * με φόρμα θα κουβαλούσε **και τα δύο** λεξιλόγια *(μετρημένο: 6.072 bytes `demand.*`
 * σε σελίδα προσφοράς)*.
 *
 * 🔑 **ΓΙΑΤΙ ΕΝΑΣ ΚΥΡΙΟΛΕΚΤΙΚΟΣ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΤΡΕΙΣ ΜΕ SPREAD**: ο εξαγωγέας
 * διαβάζει **τιμές σταθεράς module**. Ένα `{...A, ...B, ...C}` **δεν διαβάζεται** — και
 * το μέτρησε ο ίδιος ο γεννήτορας (*«1 unresolved dynamic t()»*). Ο ένας πίνακας είναι
 * ταυτόχρονα η **μόνη** μορφή που ο τεμαχιστής επιλύει **και** η μόνη που κρατά τον
 * μεταφραστή σε **μία γραμμή** (CHECK 3.28: τα τρία σώματα ήταν δίδυμα).
 *
 * ⚠️ **Ο τύπος `Record<…>` πάνω στην ΕΝΩΣΗ των τριών λεξιλογίων** ⇒ νέα θέση κελύφους
 * **ή** νέος κωδικός έλλειψης **δεν μεταγλωττίζεται** χωρίς κλειδί. Ότι το κλειδί
 * **έχει λέξεις σε δύο γλώσσες** το φυλά το `form-issue-keys.test.ts`.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DraftFormSlot, DraftFormText } from '@/lib/forms/draft-form-labels';
import type { OwnerPropertyFormBlocker } from '@/lib/owner-property/owner-property-form-values';
import type { MandateFormBlocker } from '@/lib/mandate/mandate-form-values';
import type { DraftIdentityBlocker } from '@/lib/forms/draft-identity';
import type { OwnerPropertyInvariant } from '@/types/owner-property-invariants';
import type { MandateInvariant } from '@/types/owner-property-mandate';

/**
 * 🔴 **ΤΡΕΙΣ πηγές εμποδίων, ΜΙΑ ένωση** — και η τρίτη έλειπε από κάθε προηγούμενη
 * περιγραφή: ο καλών συγχωνεύει `mandate?.blockers` **και** `draftIdentityBlockers(uid)`.
 * Το `account-required` ζούσε στο locale χωρίς να αναφέρεται πουθενά ως κωδικός.
 */
export type OfferBlocker = OwnerPropertyFormBlocker | MandateFormBlocker | DraftIdentityBlocker;
export type OfferViolation = OwnerPropertyInvariant | MandateInvariant;

const NS = 'property-market';

/** Το **ΕΝΩΜΕΝΟ** λεξιλόγιο αυτής της βάσης — θέσεις κελύφους + κωδικοί ελλείψεων. */
export const TEXT_KEYS: Record<DraftFormSlot | OfferBlocker | OfferViolation, string> = {
  title: 'property-market:offer.form.title',
  editTitle: 'property-market:offer.form.editTitle',
  lead: 'property-market:offer.form.lead',
  failed: 'property-market:offer.form.failed',
  saving: 'property-market:offer.form.saving',
  save: 'property-market:offer.form.save',
  submit: 'property-market:offer.form.submit',
  cancel: 'property-market:offer.form.cancel',
  issuesHeading: 'property-market:offer.invariant.heading',

  'place-unresolved': 'property-market:offer.formBlocker.place-unresolved',
  'mandate-client-unset': 'property-market:offer.formBlocker.mandate-client-unset',
  'mandate-expiry-unset': 'property-market:offer.formBlocker.mandate-expiry-unset',
  'mandate-term-illegal': 'property-market:offer.formBlocker.mandate-term-illegal',
  'account-required': 'property-market:offer.formBlocker.account-required',

  'no-live-offer': 'property-market:offer.invariant.no-live-offer',
  'duplicate-offer-kind': 'property-market:offer.invariant.duplicate-offer-kind',
  'offer-amount-missing': 'property-market:offer.invariant.offer-amount-missing',
  'exchange-percentage-out-of-range': 'property-market:offer.invariant.exchange-percentage-out-of-range',
  'exchange-requires-land': 'property-market:offer.invariant.exchange-requires-land',
  'type-missing': 'property-market:offer.invariant.type-missing',
  'area-not-positive': 'property-market:offer.invariant.area-not-positive',
  'title-missing': 'property-market:offer.invariant.title-missing',
  'bedrooms-negative': 'property-market:offer.invariant.bedrooms-negative',
  'mandate-client-missing': 'property-market:offer.invariant.mandate-client-missing',
  'mandate-expiry-invalid': 'property-market:offer.invariant.mandate-expiry-invalid',
  'mandate-expiry-past': 'property-market:offer.invariant.mandate-expiry-past',
  'mandate-attestation-not-confirmed': 'property-market:offer.invariant.mandate-attestation-not-confirmed',
  'mandate-term-exceeds-statute': 'property-market:offer.invariant.mandate-term-exceeds-statute',
  'mandate-agreement-invalid': 'property-market:offer.invariant.mandate-agreement-invalid',
  // ── ADR-832: η εντολή ως κατάληψη πόρου ─────────────────────────────────────
  'mandate-scope-empty': 'property-market:offer.invariant.mandate-scope-empty',
  'mandate-start-invalid': 'property-market:offer.invariant.mandate-start-invalid',
  // ⚠️ Το κείμενο λέει **ότι** υπάρχει σύγκρουση, όχι **με ποιον**: το «ποιος» είναι
  //    δεδομένο (`MandateConflict`) και ταξιδεύει χωριστά — αλλιώς κάθε γραφείο θα
  //    ήθελε δικό του κλειδί.
  'mandate-conflicts-existing': 'property-market:offer.invariant.mandate-conflicts-existing',
  'mandate-conflict-undetermined': 'property-market:offer.invariant.mandate-conflict-undetermined',
};

/** Ο **ΕΝΑΣ** μεταφραστής αυτής της βάσης. */
export function useOfferFormText(): DraftFormText<OfferBlocker, OfferViolation> {
  const { t } = useTranslation([NS]);
  return (id) => t(TEXT_KEYS[id]);
}
