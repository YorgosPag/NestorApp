/**
 * @fileoverview **Η ΦΟΡΜΑ ΤΟΥ ΙΔΙΩΤΗ** — ό,τι πληκτρολογεί, και τι του λείπει (Σ1).
 * @related ADR-827 §9.17 δ/ε · lib/mandate/mandate-term-window.ts · services/mandate/mandate-request.service.ts
 * @module lib/mandate/mandate-request-form-values
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΟ `mandate-form-values.ts` — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΠΡΕΠΕΙ ΝΑ ΓΙΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Εκείνο είναι η φόρμα **ΤΟΥ ΜΕΣΙΤΗ**: έχει `clientContactId` *(για ποιον πελάτη
 * γράφω)*, `via` *(συγκατάθεση ή βεβαίωση)* και `documentPath` *(το σαρωμένο χαρτί)* —
 * **τρία πεδία που στο Σ1 απαγορεύεται να υπάρχουν** (§8.2). Ένα κοινό σχήμα θα τα
 * έφερνε στη **δημόσια** πλευρά, δηλαδή θα ακύρωνε τον τύπο
 * `MandateRequestForAgencyOpenGaps = never` που υπάρχει ακριβώς για να τα αποκλείσει.
 *
 * ✅ **Κοινό είναι ό,τι ΟΦΕΙΛΕΙ να είναι κοινό, και είναι εξαγμένο**: ο ορίζοντας της
 * λήξης (`mandate-term-window.ts`) και ο κριτής της διάρκειας (`exceedsStatutoryTerm`).
 * ⛔ **ΜΗΝ «ενοποιήσεις» τα δύο αρχεία**: θα ήταν ένα σχήμα για δύο ακροατήρια με
 * αντίθετες απαιτήσεις αποκάλυψης.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ **ΜΟΝΟ** ΕΜΠΟΔΙΑ, ΚΑΙ ΚΑΝΕΝΑ «violation»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `DraftFormValidation` έχει **τρία** σκέλη *(malformed · blockers · violations)*.
 * Εδώ το τρίτο είναι **`never`**, και είναι **μετρημένη** απόφαση, όχι παράλειψη:
 *
 * | Αμετάβλητο του αιτήματος | Ποιος το πιάνει στη φόρμα |
 * |---|---|
 * | `request-listing-missing` | εμπόδιο `request-listing-unset` |
 * | `request-agency-missing` | **δομικά αδύνατο** — το γραφείο έρχεται από τη διεύθυνση, όχι από πεδίο |
 * | `request-expiry-invalid` · `request-expiry-past` | εμπόδια, ονομαστικά |
 * | `request-term-exceeds-statute` | εμπόδιο `request-term-illegal`, **με τον ΙΔΙΟ κριτή** |
 * | `request-contact-inconsistent` | **δομικά αδύνατο** — η φόρμα δεν έχει πεδίο επαφής |
 * | `request-supersedes-self` | **δομικά αδύνατο** — η αλυσίδα γράφεται στον διακομιστή |
 *
 * ⚠️ Ένα σκέλος `violations` που **καμία** φόρμα δεν μπορεί να γεμίσει θα ήταν αδρανής
 * φρουρός (ADR-749 §5) **και** θα απαιτούσε κλειδιά i18n για μηνύματα που κανείς δεν
 * βλέπει ποτέ. Ο διακομιστής **εξακολουθεί** να τρέχει και τα έξι: δεν εμπιστεύεται
 * καμία φόρμα.
 */

import {
  CUSTOMARY_COMMISSION_PERCENTAGE,
  defaultExpiryFor,
  exceedsStatutoryTerm,
  type MandateCompensation,
} from '@/types/owner-property-mandate';
import {
  DEFAULT_LISTING_AGREEMENT,
  type ListingAgreement,
} from '@/types/listing-agreement';
import type { ProposedMandateTerms } from '@/types/mandate-request';
import type { OfferKind } from '@/types/property-offers';

import { endOfDay, startOfDay, toDateInputValue } from './mandate-term-window';

/**
 * Ό,τι πληκτρολογεί ο **ιδιοκτήτης**.
 *
 * ⚠️ **Καμία ταυτότητα, κανένα στοιχείο επικοινωνίας** — και δεν είναι παράλειψη που
 * θα συμπληρωθεί: είναι το §8.2 εκφρασμένο ως **σχήμα**.
 */
export interface MandateRequestFormValues {
  /** Ποιο ακίνητο — ταυτότητα από τον επιλογέα, ποτέ ελεύθερο κείμενο. */
  readonly ownerPropertyId: string;
  /** `yyyy-mm-dd` — η μορφή του `<input type="date">`, όχι ISO στιγμή. */
  readonly expiresOn: string;
  /**
   * `yyyy-mm-dd` — **από πότε** ισχύει (ADR-832).
   *
   * 🏆 **Ρητό πεδίο, επειδή υπάρχει ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΗ εντολή**: *«η αποκλειστική του
   * άλλου γραφείου λήγει 12/03 — κλείσε εντολή που αρχίζει 13/03»*. Χωρίς αυτό ο
   * ιδιοκτήτης θα έπρεπε να **θυμηθεί** να ξαναμπεί τη σωστή μέρα, δηλαδή η πλατφόρμα
   * θα του έλεγε «όχι» σε κάτι απολύτως νόμιμο.
   *
   * ⚠️ **Ο νόμος μετριέται ΑΠΟ ΕΔΩ**, όχι από «σήμερα» — δες τα εμπόδια λήξης.
   */
  readonly startsOn: string;
  /**
   * **Ποιες πράξεις αναθέτει** — το «ίδιο περιεχόμενο» του άρθρου 200 §4 (ADR-832).
   *
   * 🔴 **Γεννιέται ΚΕΝΟ, και δεν παράγεται από τις διαθέσεις του ακινήτου.** Στη
   * διαδρομή του **γραφείου** (`/api/owner-properties/brokered`) παράγεται, γιατί εκεί
   * το γραφείο γεννά αγγελία **και** εντολή στην ίδια πράξη· εδώ το δικαίωμα το δίνει
   * **ο ιδιοκτήτης**, και μια σιωπηλή προεπιλογή θα του έπαιρνε δικαίωμα που δεν έδωσε
   * — ακριβώς η μετάλλαξη που το `mandate-scope-empty` υπάρχει για να αποκλείσει.
   */
  readonly scope: readonly OfferKind[];
  readonly agreement: ListingAgreement;
  readonly compensation: MandateCompensation;
}

/**
 * Η **προεπιλεγμένη** πρόταση του ιδιοκτήτη.
 *
 * 🔴 **Η ΛΗΞΗ ΕΙΝΑΙ ΤΟ ΝΟΜΙΜΟ ΑΝΩΤΑΤΟ ΤΟΥ ΕΙΔΟΥΣ, ΠΟΤΕ ΣΤΑΘΕΡΑ.** Και **επειδή**
 * είναι το ανώτατο, η προεπιλογή στέκει **ακριβώς** στο όριο — γι' αυτό το §9.18
 * (όπου το όριο κουβαλούσε την ώρα της αφετηρίας) την έκανε **παράνομη από τον ίδιο
 * της τον κριτή**. Η άγκυρα εκείνου του ελαττώματος φυλά **και** αυτή τη γραμμή.
 *
 * @param todayISO — η **περασμένη** στιγμή· κανένα ρολόι εδώ μέσα.
 */
export function emptyMandateRequestForm(todayISO: string): MandateRequestFormValues {
  return {
    ownerPropertyId: '',
    expiresOn: toDateInputValue(defaultExpiryFor(DEFAULT_LISTING_AGREEMENT, todayISO)),
    // ⚠️ **Σήμερα, και ΔΕΝ είναι σιωπηλή μαντεψιά**: «ισχύει από τώρα» ήταν η **μόνη**
    //    συμπεριφορά που υπήρξε ποτέ, άρα η προεπιλογή δεν αφαιρεί τίποτα από κανέναν.
    //    Το `scope` είναι το αντίθετο — εκεί η προεπιλογή θα **έδινε** δικαίωμα.
    startsOn: toDateInputValue(todayISO),
    scope: [],
    agreement: DEFAULT_LISTING_AGREEMENT,
    compensation: {
      type: 'percentage',
      percentage: CUSTOMARY_COMMISSION_PERCENTAGE,
      vatIncluded: false,
    },
  };
}

// =============================================================================
// ΤΙ ΛΕΙΠΕΙ ΑΠΟ ΤΗ ΦΟΡΜΑ
// =============================================================================

/** Κωδικοί — το μήνυμα ζει στα locale (N.11). */
export const MANDATE_REQUEST_FORM_BLOCKERS = [
  /** Δεν διαλέχτηκε ακίνητο — το αίτημα δεν λέει **τι** ζητά. */
  'request-listing-unset',
  /** Δεν δηλώθηκε λήξη, ή δεν διαβάζεται ως ημερομηνία. */
  'request-expiry-unset',
  /**
   * Η λήξη είναι **στο παρελθόν**.
   *
   * ⚠️ **Δικός του κωδικός, όχι μαζί με το παραπάνω** — ίδιο δόγμα με τα δύο
   * ξεχωριστά αμετάβλητα του διακομιστή: *«δεν έβαλες ημερομηνία»* και *«έβαλες
   * περασμένη»* στέλνουν τον άνθρωπο σε **διαφορετική** πράξη.
   */
  'request-expiry-past',
  /** Η διάρκεια ξεπερνά το **νόμιμο ανώτατο** του επιλεγμένου είδους. */
  'request-term-illegal',
  /** Αμοιβή μηδέν ή αρνητική — όρος που δεν είναι όρος. */
  'request-compensation-invalid',
  /**
   * 🔴 **Καμία πράξη δεν επιλέχθηκε** (ADR-832). Εντολή που δεν λέει **για τι**
   * δίνεται δεν καταλαμβάνει τίποτα — και δεν ισοπεδώνεται σε «όλες»: δες το
   * `scope` της {@link MandateRequestFormValues}.
   */
  'request-scope-unset',
  /** Δεν δηλώθηκε έναρξη, ή δεν διαβάζεται ως ημερομηνία (ADR-832). */
  'request-start-unset',
  /**
   * 🔴 **Λήγει πριν αρχίσει** — ανάποδο διάστημα.
   *
   * ⚠️ **Δικός του κωδικός**, όχι μαζί με το `request-expiry-past`: εκεί ο άνθρωπος
   * διορθώνει τη **λήξη**· εδώ μπορεί κάλλιστα να θέλει να διορθώσει την **έναρξη**.
   * Ένα κοινό μήνυμα θα τον έστελνε στο λάθος πεδίο.
   */
  'request-start-after-expiry',
] as const;

export type MandateRequestFormBlocker = (typeof MANDATE_REQUEST_FORM_BLOCKERS)[number];

/**
 * **Τι λείπει. Όλα, ποτέ το πρώτο.**
 *
 * @param todayISO — η **περασμένη** στιγμή· η νομιμότητα μετριέται από αυτήν.
 */
export function mandateRequestFormBlockers(
  values: MandateRequestFormValues,
  todayISO: string,
): MandateRequestFormBlocker[] {
  const found: MandateRequestFormBlocker[] = [];

  if (values.ownerPropertyId.trim() === '') found.push('request-listing-unset');
  // ⚠️ **Κενό σύνολο πράξεων δεν είναι «όλες»** — δες τον κωδικό.
  if (values.scope.length === 0) found.push('request-scope-unset');
  found.push(...expiryBlockers(values, todayISO));
  if (!isPositiveCompensation(values.compensation)) {
    found.push('request-compensation-invalid');
  }

  return found;
}

/**
 * Το σκέλος του χρόνου, χωριστά — ώστε ο έλεγχος να μένει κάτω από τις 40 γραμμές και
 * η **σειρά** να είναι ορατή: ημερομηνία που δεν διαβάζεται **δεν** ελέγχεται
 * περαιτέρω, γιατί κάθε σύγκριση με `NaN` απαντά `false` και θα σιωπούσε.
 * *(Ίδιο σχήμα με το `expiryViolations` του διακομιστή — και είναι σκόπιμο: όποιος
 * διαβάσει το ένα, αναγνωρίζει το άλλο.)*
 */
function expiryBlockers(
  values: MandateRequestFormValues,
  todayISO: string,
): readonly MandateRequestFormBlocker[] {
  if (Number.isNaN(Date.parse(values.expiresOn))) return ['request-expiry-unset'];
  if (Number.isNaN(Date.parse(values.startsOn))) return ['request-start-unset'];

  // ⚠️ **Τέλος της ημέρας**, ίδια σύμβαση με ό,τι στέλνεται. Αλλιώς η φόρμα θα έκρινε
  //    **άλλη** στιγμή από αυτήν που υποβάλλει.
  const expiresAt = endOfDay(values.expiresOn);
  const startsAt = startOfDay(values.startsOn);
  const found: MandateRequestFormBlocker[] = [];

  if (Date.parse(expiresAt) <= Date.parse(todayISO)) found.push('request-expiry-past');
  if (Date.parse(expiresAt) < Date.parse(startsAt)) {
    // ⚠️ **Και σταματά**: με ανάποδο διάστημα ο έλεγχος διάρκειας θα μετρούσε
    //    **αρνητικό** χρόνο και θα απαντούσε «νόμιμο» — αδρανής φρουρός.
    found.push('request-start-after-expiry');
    return found;
  }

  // 🔴 **Ο ΝΟΜΟΣ ΜΕΤΡΙΕΤΑΙ ΑΠΟ ΤΗΝ ΕΝΑΡΞΗ** (ADR-832 §5.8), όχι από «σήμερα». Ως τις
  //    2026-08-30 περνούσε το `todayISO` — σωστό όσο κάθε εντολή γεννιόταν ενεργή.
  //    Με **προγραμματισμένη** εντολή, οκτάμηνη αποκλειστική που αρχίζει σε έξι μήνες
  //    μετριόταν ως δεκατετράμηνη: η φόρμα θα εμπόδιζε **νόμιμη** συμφωνία.
  //
  // ⚠️ **Ο ίδιος κριτής με τον διακομιστή** (`exceedsStatutoryTerm` →
  //    `statutoryTermLimitFor`). Δεύτερο όριο εδώ θα ήταν ο τρίτος αριθμός για το ίδιο
  //    ερώτημα (ADR-749).
  if (exceedsStatutoryTerm(values.agreement, startsAt, expiresAt)) {
    found.push('request-term-illegal');
  }

  return found;
}

/**
 * **Είναι αυτή αμοιβή;** — ανά σκέλος της ένωσης, χωρίς `any`.
 *
 * 🔑 Ο μεταγλωττιστής φυλά την πληρότητα: τρίτο σκέλος στη {@link MandateCompensation}
 * δεν μεταγλωττίζεται μέχρι κάποιος να πει πότε είναι θετικό.
 */
function isPositiveCompensation(compensation: MandateCompensation): boolean {
  return compensation.type === 'percentage'
    ? compensation.percentage > 0
    : compensation.amountEUR > 0;
}

// =============================================================================
// ΦΟΡΜΑ → ΟΡΟΙ
// =============================================================================

/**
 * Οι τιμές της φόρμας → οι **όροι** που ταξιδεύουν στην πόρτα.
 *
 * ⚠️ **Η ημερομηνία γίνεται ΤΕΛΟΣ ΤΗΣ ΗΜΕΡΑΣ** — η ίδια γραφή που χρησιμοποιεί ο
 * κριτής παραπάνω, από το **ίδιο** module. Δύο γραφές θα απέκλιναν κατά ένα ολόκληρο
 * εικοσιτετράωρο στο όριο (§9.17 ζ).
 */
export function proposedTermsFrom(values: MandateRequestFormValues): ProposedMandateTerms {
  return {
    agreement: values.agreement,
    compensation: values.compensation,
    expiresAt: endOfDay(values.expiresOn),
    // ⚠️ **ΑΡΧΗ της ημέρας**, συμμετρικά με το `endOfDay` της λήξης — και από το
    //    **ίδιο** module. Ένα `endOfDay` και εδώ θα έκανε την εντολή να αρχίζει στις
    //    23:59, δηλαδή θα έχανε σχεδόν ολόκληρη την πρώτη της μέρα.
    startsAt: startOfDay(values.startsOn),
    scope: values.scope,
  };
}
