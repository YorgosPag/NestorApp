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
import type { TaxIdentityBlocker } from '@/lib/forms/draft-identity';
import type { MandateRequestFormBlocker } from '@/lib/mandate/mandate-request-form-values';
import { PRIVATE_PROFILE_ROUTE } from '@/lib/routes/accountRoutes';
import type { MandateRequestRejection } from '@/services/mandate/mandate-request-vocabulary';

export const MANDATE_REQUEST_NS = 'property-market';

/**
 * **Τα εμπόδια αυτής της οθόνης — ΔΥΟ πηγές, μία ένωση** (ADR-827 §9.21 ι #1).
 *
 * 🔑 Ίδιο σχήμα με το `OfferBlocker` της φόρμας προσφοράς
 * (`offer-form-labels.ts:37`), και είναι **σκόπιμο**: όποιος διαβάσει το ένα,
 * αναγνωρίζει το άλλο.
 *
 * | Πηγή | Τι βλέπει | Πού κρίνεται |
 * |---|---|---|
 * | `MandateRequestFormBlocker` | ό,τι **πληκτρολόγησε** ο άνθρωπος | `mandate-request-form-values.ts` |
 * | `TaxIdentityBlocker` | το **περιβάλλον** — έχει δηλώσει ΑΦΜ; | `lib/forms/draft-identity.ts` |
 *
 * ⚠️ Το δεύτερο **δεν μπορούσε** να ζει στο `mandateRequestFormBlockers(values)`:
 * εκείνο βλέπει **μόνο** `values`, και το ΑΦΜ δεν είναι πεδίο του αιτήματος — είναι
 * **ταυτότητα**, και το §8.2 απαγορεύει ρητά στοιχεία ταυτότητας μέσα στο σχήμα που
 * ταξιδεύει προς το γραφείο. Η συγχώνευση γίνεται στο SSoT (`withExtraBlockers`).
 */
export type MandateRequestBlocker = MandateRequestFormBlocker | TaxIdentityBlocker;

/**
 * Το **ΕΝΩΜΕΝΟ** λεξιλόγιο αυτής της βάσης — θέσεις κελύφους + εμπόδια φόρμας.
 *
 * ⚠️ **Το τρίτο γενικό του `DraftFormText` είναι `never`** (δες
 * `mandate-request-form-values.ts`): αυτή η φόρμα δεν έχει σκέλος `violations`, γιατί
 * **καμία** τιμή της δεν μπορεί να το γεμίσει.
 */
export const TEXT_KEYS: Record<DraftFormSlot | MandateRequestBlocker, string> = {
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

  // ── ADR-832 — η κατάληψη ως όρος της φόρμας ────────────────────────────────
  'request-scope-unset': 'property-market:mandate.request.request-scope-unset',
  'request-start-unset': 'property-market:mandate.request.request-start-unset',
  'request-start-after-expiry': 'property-market:mandate.request.request-start-after-expiry',

  /**
   * 🔑 **Η ΔΕΥΤΕΡΗ ΠΗΓΗ, ΣΤΗΝ ΙΔΙΑ ΛΙΣΤΑ** — και το κλειδί ζει σε **αυτή** τη βάση,
   * όχι στο `common-account`, παρότι ο **κριτής** είναι κοινός.
   *
   * ⚠️ Και είναι απόφαση: το μήνυμα πρέπει να πει *γιατί εδώ και τώρα* — *«ο νόμος
   * το απαιτεί για τη σύμβαση ανάθεσης»*. Το ίδιο εμπόδιο σε άλλη οθόνη θα ήθελε
   * **άλλη** δικαιολόγηση, και ένα κοινό κείμενο θα ήταν σωστό σε καμία από τις δύο.
   */
  'tax-identity-required': 'property-market:mandate.request.tax-identity-required',

  /**
   * ⚠️ **Δεν λέει «λάθος ΑΦΜ»** — αυτό το λέει ήδη το **ίδιο το πεδίο**, ονομαστικά
   * (`vat-check-digit-invalid`). Εδώ λέει τη **συνέπεια για την υποβολή**: ο αριθμός
   * που βλέπεις δεν είναι αυτός που θα σταλεί. Δύο μηνύματα, δύο διαφορετικές
   * πληροφορίες — ίδιο σχήμα με το «error summary + inline detail» του GOV.UK.
   */
  'tax-identity-unsaved': 'property-market:mandate.request.tax-identity-unsaved',
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
  'request-declined-final': 'property-market:mandate.request.request-declined-final',
  /**
   * 🔴 **ΕΛΕΙΠΕ, ΚΑΙ Ο ΤΥΠΟΣ ΤΟ ΕΔΕΙΞΕ** (ADR-832). Ο κωδικός γεννήθηκε στον γραφέα
   * του Σ1 και ταξίδευε ως τα σύνορα — αλλά **καμία οθόνη δεν τον ονόμαζε**, οπότε η
   * φόρμα τον διάβαζε ως «δεν μάθαμε» και έλεγε στον άνθρωπο *«δοκιμάστε ξανά χωρίς
   * να αλλάξετε τίποτα»*. Δηλαδή ακριβώς το **λάθος**: εδώ πρέπει να αλλάξει κάτι.
   *
   * ⚠️ **Δεν είναι το `listing-already-brokered`.** Εκείνο λέει *«το ζεύγος έκλεισε»*
   * και δεν έχει διέξοδο· αυτό λέει *«άλλος κρατά δικαίωμα ως τότε»* — και το
   * μήνυμα **στέλνει στη διέξοδο** (μεταγενέστερη έναρξη ή απλή εντολή), που το
   * `MandateOccupancyNotice` έχει ήδη δείξει στην οθόνη.
   */
  'listing-conflicting-mandate': 'property-market:mandate.request.listing-conflicting-mandate',
  /**
   * 🔴 **ADR-834 §6.2** — η μόνη άρνηση αυτού του πίνακα που αφορά **τον ίδιο** τον
   * άνθρωπο που πάτησε, και η μόνη με **διέξοδο μέσα στην οθόνη** ({@link REJECTION_REMEDY}).
   */
  'identity-incomplete': 'property-market:mandate.request.identity-incomplete',
};

/**
 * **Η ΔΙΕΞΟΔΟΣ ΚΑΘΕ ΑΡΝΗΣΗΣ** — λόγος **και** δυνατότητα διόρθωσης (σχήμα P2B άρθρο 4).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΛΗΡΗΣ `Record` ΜΕ `null`, ΚΑΙ ΟΧΙ `Partial`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα `Partial<…>` θα σήμαινε *«όποιος έχει, έχει»* — δηλαδή ο **ένατος** κωδικός θα
 * γεννιόταν **σιωπηλά χωρίς διέξοδο**, και κανείς δεν θα το παρατηρούσε ποτέ. Ο
 * πλήρης πίνακας κάνει την ερώτηση **υποχρεωτική**: *«μπορεί ο άνθρωπος να κάνει κάτι
 * γι' αυτό, εδώ και τώρα;»*. Το `null` είναι **απάντηση**, όχι παράλειψη.
 *
 * ⚠️ **Τα οκτώ `null` ΔΕΝ είναι αδιαφορία.** `listing-absent` ⇒ ο σύνδεσμος είναι
 * μπαγιάτικος· `listing-conflicting-mandate` ⇒ η διέξοδος είναι **αλλαγή όρων μέσα
 * στην ίδια φόρμα**, που ο άνθρωπος ήδη βλέπει. Ένας σύνδεσμος εκεί θα τον έβγαζε από
 * τη δουλειά του για να τον ξαναφέρει πίσω.
 *
 * 🔑 **Ο σύνδεσμος είναι σταθερά, όχι κείμενο**: το `/profile` δηλώνεται **μία** φορά
 * (`PRIVATE_PROFILE_ROUTE`) και είναι δηλωμένο **εκτός χώρου** στο `OUTSIDE_WORKSPACE`
 * (CHECK 3.60) — γι' αυτό ο `Link` του συνόρου **δεν** το προθεματοποιεί με
 * `/o/<ψευδώνυμο>`, που θα ήταν διεύθυνση **χωρίς σελίδα**.
 */
export interface RejectionRemedy {
  readonly href: string;
  readonly labelKey: string;
}

export const REJECTION_REMEDY: Record<MandateRequestRejection, RejectionRemedy | null> = {
  'listing-absent': null,
  'listing-not-live': null,
  'listing-already-brokered': null,
  'agency-absent': null,
  'request-already-pending': null,
  'request-declined-final': null,
  'listing-conflicting-mandate': null,
  'identity-incomplete': {
    href: PRIVATE_PROFILE_ROUTE,
    labelKey: 'property-market:mandate.request.identity-incomplete-action',
  },
};

/** Τα υπόλοιπα κείμενα της οθόνης — πεδία, υποδείξεις, εκβάσεις. */
export const SCREEN_KEYS = {
  agencyLabel: 'property-market:mandate.request.agencyLabel',

  // ── ADR-832 — τα δύο νέα πεδία ────────────────────────────────────────────
  scopeLabel: 'property-market:mandate.request.scopeLabel',
  scopeHint: 'property-market:mandate.request.scopeHint',
  startsLabel: 'property-market:mandate.request.startsLabel',
  startsHint: 'property-market:mandate.request.startsHint',

  // ── ADR-832 — το πάνελ της κατάληψης (Φ5) ─────────────────────────────────
  occupancyTitle: 'property-market:mandate.request.occupancyTitle',
  occupancyHeld: 'property-market:mandate.request.occupancyHeld',
  occupancyBlocked: 'property-market:mandate.request.occupancyBlocked',
  occupancyUndetermined: 'property-market:mandate.request.occupancyUndetermined',
  occupancyHolderOther: 'property-market:mandate.request.occupancyHolderOther',
  occupancyEntry: 'property-market:mandate.request.occupancyEntry',
  occupancyEntryOpen: 'property-market:mandate.request.occupancyEntryOpen',
  /**
   * 🔴 **Η ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΓΡΑΜΜΗΣ ΚΑΤΑΛΗΨΗΣ** (ADR-834 §5.2) — *«ξέρω ποιος, ξέρω
   * ως πότε, **δεν** ξέρω για ποιες πράξεις»*. Το κληροδοτημένο έγγραφο (προ-ADR-832)
   * έχει `scope: []` και η οθόνη τύπωνε **κενό** στη θέση της λίστας, δηλαδή
   * παρουσίαζε την άγνοια ως έγκυρη απάντηση. Δίδυμο του {@link occupancyHolderOther},
   * που κάνει ήδη ακριβώς αυτό για το άγνωστο **όνομα**.
   */
  occupancyScopeUnknown: 'property-market:mandate.request.occupancyScopeUnknown',
  occupancyReasonExisting: 'property-market:mandate.request.occupancyReasonExisting',
  occupancyReasonCandidate: 'property-market:mandate.request.occupancyReasonCandidate',
  occupancyAvailableFrom: 'property-market:mandate.request.occupancyAvailableFrom',
  occupancyAvailableAction: 'property-market:mandate.request.occupancyAvailableAction',
  occupancyNoWait: 'property-market:mandate.request.occupancyNoWait',

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

/** Ο **ΕΝΑΣ** μεταφραστής αυτής της βάσης — **και των δύο** πηγών εμποδίων. */
export function useMandateRequestFormText(): DraftFormText<MandateRequestBlocker, never> {
  const { t } = useTranslation([MANDATE_REQUEST_NS]);
  return (id) => t(TEXT_KEYS[id]);
}
