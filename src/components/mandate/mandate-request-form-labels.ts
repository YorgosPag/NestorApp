'use client';

/**
 * @fileoverview **ΤΑ ΚΕΙΜΕΝΑ ΤΗΣ ΦΟΡΜΑΣ ΑΙΤΗΜΑΤΟΣ** — ΕΝΑΣ πίνακας, ΜΙΑ γραμμή κώδικα.
 * @related lib/forms/draft-form-labels.ts (όλο το γιατί) · ADR-827 §9.14 · §9.17
 * @module components/mandate/mandate-request-form-labels
 *
 * 🔴 **ΓΙΑΤΙ ΑΡΧΕΙΟ ΑΝΑ ΒΑΣΗ**: η `dynamicKeyPolicy` του τεμαχιστή ζει **ανά ΑΡΧΕΙΟ**.
 * Κοινό αρχείο με όρισμα `base` θα δήλωνε **όλες** τις ρίζες, και **κάθε** διαδρομή με
 * φόρμα θα κουβαλούσε **όλα** τα λεξιλόγια.
 *
 * 🔑 **ΕΝΑΣ ΚΥΡΙΟΛΕΚΤΙΚΟΣ ΠΙΝΑΚΑΣ, ΟΧΙ SPREAD**: ο εξαγωγέας διαβάζει **τιμές σταθεράς
 * module**· ένα `{...A, ...B}` **δεν διαβάζεται** και βγαίνει *«unresolved dynamic
 * t()»* (Π3). ⛔ **ΜΗΝ** το λύσεις με `dynamicKeyPolicy` — θα έκρυβε τα κλειδιά από τη
 * **CHECK 3.8**.
 *
 * ⚠️ Ο τύπος `Record<…>` πάνω στην **ΕΝΩΣΗ** των λεξιλογίων ⇒ νέα θέση κελύφους ή νέος
 * κωδικός έλλειψης **δεν μεταγλωττίζεται** χωρίς κλειδί. Το `keyBase` **ΔΕΝ ΥΠΑΡΧΕΙ
 * ΠΙΑ** (Π4, §9.14).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DraftFormSlot, DraftFormText } from '@/lib/forms/draft-form-labels';
import type { MandateRequestFormBlocker } from '@/lib/mandate/mandate-request-form-values';
import type { MandateRequestRejection } from '@/services/mandate/mandate-request.service';

export const MANDATE_REQUEST_NS = 'property-market';

/**
 * Το **ΕΝΩΜΕΝΟ** λεξιλόγιο αυτής της βάσης — θέσεις κελύφους + εμπόδια φόρμας.
 *
 * ⚠️ **Το τρίτο γενικό του `DraftFormText` είναι `never`** (δες
 * `mandate-request-form-values.ts`): αυτή η φόρμα δεν έχει σκέλος `violations`, γιατί
 * **καμία** τιμή της δεν μπορεί να το γεμίσει.
 */
export const TEXT_KEYS: Record<DraftFormSlot | MandateRequestFormBlocker, string> = {
  title: 'property-market:mandate.request.title',
  editTitle: 'property-market:mandate.request.editTitle',
  lead: 'property-market:mandate.request.lead',
  failed: 'property-market:mandate.request.failed',
  saving: 'property-market:mandate.request.saving',
  save: 'property-market:mandate.request.save',
  submit: 'property-market:mandate.request.submit',
  cancel: 'property-market:mandate.request.cancel',
  issuesHeading: 'property-market:mandate.request.issuesHeading',

  'request-listing-unset': 'property-market:mandate.request.request-listing-unset',
  'request-expiry-unset': 'property-market:mandate.request.request-expiry-unset',
  'request-expiry-past': 'property-market:mandate.request.request-expiry-past',
  'request-term-illegal': 'property-market:mandate.request.request-term-illegal',
  'request-compensation-invalid': 'property-market:mandate.request.request-compensation-invalid',
};

/**
 * **Οι αρνήσεις του διακομιστή** — δεύτερος πίνακας, και είναι σκόπιμο.
 *
 * 🔑 Δεν μπαίνουν στο {@link TEXT_KEYS} επειδή **δεν είναι εμπόδια της φόρμας**: ο
 * άνθρωπος δεν μπορεί να τα προβλέψει πληκτρολογώντας — τα μαθαίνει **μετά** την
 * υποβολή. Το `DraftFormShell` δείχνει τα πρώτα· τα δεύτερα ζουν στο μήνυμα
 * αποτυχίας. Ίδιο λεξιλόγιο, **άλλη στιγμή**.
 */
export const REJECTION_KEYS: Record<MandateRequestRejection, string> = {
  'listing-absent': 'property-market:mandate.request.listing-absent',
  'listing-not-live': 'property-market:mandate.request.listing-not-live',
  'listing-already-brokered': 'property-market:mandate.request.listing-already-brokered',
  'agency-absent': 'property-market:mandate.request.agency-absent',
  'request-already-pending': 'property-market:mandate.request.request-already-pending',
  'request-terms-unchanged': 'property-market:mandate.request.request-terms-unchanged',
};

/** Τα υπόλοιπα κείμενα της οθόνης — πεδία, υποδείξεις, εκβάσεις. */
export const SCREEN_KEYS = {
  agencyLabel: 'property-market:mandate.request.agencyLabel',
  listingLabel: 'property-market:mandate.request.listingLabel',
  listingPlaceholder: 'property-market:mandate.request.listingPlaceholder',
  listingHint: 'property-market:mandate.request.listingHint',
  listingsEmpty: 'property-market:mandate.request.listingsEmpty',
  listingsEmptyAction: 'property-market:mandate.request.listingsEmptyAction',
  agreementLabel: 'property-market:mandate.request.agreementLabel',
  agreementHint: 'property-market:mandate.request.agreementHint',
  compensationLabel: 'property-market:mandate.request.compensationLabel',
  compensationPercentage: 'property-market:mandate.request.compensationPercentage',
  compensationFixed: 'property-market:mandate.request.compensationFixed',
  percentageLabel: 'property-market:mandate.request.percentageLabel',
  amountLabel: 'property-market:mandate.request.amountLabel',
  vatLabel: 'property-market:mandate.request.vatLabel',
  compensationHint: 'property-market:mandate.request.compensationHint',
  expiresLabel: 'property-market:mandate.request.expiresLabel',
  expiresHint: 'property-market:mandate.request.expiresHint',
  unverified: 'property-market:mandate.request.unverified',
  sentTitle: 'property-market:mandate.request.sentTitle',
  sentLead: 'property-market:mandate.request.sentLead',
  alreadySentTitle: 'property-market:mandate.request.alreadySentTitle',
  alreadySentLead: 'property-market:mandate.request.alreadySentLead',
  backToListings: 'property-market:mandate.request.backToListings',
} as const;

/** Ο **ΕΝΑΣ** μεταφραστής αυτής της βάσης. */
export function useMandateRequestFormText(): DraftFormText<MandateRequestFormBlocker, never> {
  const { t } = useTranslation([MANDATE_REQUEST_NS]);
  return (id) => t(TEXT_KEYS[id]);
}
