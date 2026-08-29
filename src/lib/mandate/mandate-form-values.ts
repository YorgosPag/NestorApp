/**
 * @fileoverview **ΦΟΡΜΑ ΕΝΤΟΛΗΣ ⇄ ΑΙΤΗΜΑ** — μία μετάφραση, όπως στην προσφορά.
 * @related ADR-777 §8.33 · lib/owner-property/owner-property-form-values.ts
 * @module lib/mandate/mandate-form-values
 *
 * 🔑 **Ίδιο σχήμα με το `owner-property-form-values.ts`, και είναι σκόπιμο**: η φόρμα
 * κρατά ό,τι πληκτρολογεί ο άνθρωπος (ημερομηνία ως `yyyy-mm-dd`, επαφή ως
 * ταυτότητα), το αίτημα κρατά ό,τι καταλαβαίνει ο διακομιστής. Δύο τόποι που κάνουν
 * αυτή τη μετάφραση θα απέκλιναν στην πρώτη αλλαγή μορφής ημερομηνίας.
 *
 * ⚠️ **Τα εμπόδια ΕΔΩ ΔΕΝ είναι τα invariants της εντολής.** Εκείνα (`mandate-*`)
 * λένε *«αυτή δεν είναι έγκυρη εντολή»* και ζουν στο μοντέλο· αυτά λένε *«η φόρμα
 * δεν έχει ακόμη αρκετά»*. Ίδιος διαχωρισμός με τα `OWNER_PROPERTY_FORM_BLOCKERS`.
 */

import {
  CUSTOMARY_COMMISSION_PERCENTAGE,
  defaultExpiryFor,
  exceedsStatutoryTerm,
  OWNER_CONSENT,
  type MandateCompensation,
  type MandateProofVia,
} from '@/types/owner-property-mandate';
import {
  DEFAULT_LISTING_AGREEMENT,
  type ListingAgreement,
} from '@/types/listing-agreement';

/**
 * Ό,τι πληκτρολογεί ο μεσίτης για την εντολή.
 *
 * 🔴 **ΤΑ `agreement` ΚΑΙ `compensation` ΕΛΕΙΠΑΝ — ΚΑΙ Η ΡΟΗ ΗΤΑΝ ΣΠΑΣΜΕΝΗ**
 * *(ADR-827 §8.9, εντοπίστηκε 2026-08-29)*. Η Φάση Α τα έκανε **υποχρεωτικά** στον
 * τύπο, στο zod σχήμα και στη διαδρομή — αλλά **όχι στη φόρμα**. Το σχόλιο του
 * `brokered-mandate-schema.ts` έγραφε *«η προεπιλογή είναι απόφαση της φόρμας
 * (`DEFAULT_LISTING_AGREEMENT`)»*· **η φόρμα δεν την πήρε ποτέ**, οπότε κάθε
 * καταχώρηση εντολής από τη διεπαφή έπεφτε στο `z.enum` ως `undefined`.
 *
 * ⚠️ **Τα 307 tests ήταν πράσινα**: έλεγχαν τον τύπο και το σχήμα **χωριστά**, ποτέ
 * την **αλυσίδα** φόρμα → αίτημα → σχήμα. Πράσινο που σήμαινε «κανείς δεν κοίταξε».
 */
export interface MandateFormValues {
  readonly clientContactId: string;
  /** `yyyy-mm-dd` — η μορφή του `<input type="date">`, όχι ISO στιγμή. */
  readonly expiresOn: string;
  readonly via: MandateProofVia;
  readonly documentPath: string | null;
  /** Τι είδους εντολή — **καθορίζει το νόμιμο ανώτατο** της διάρκειας. */
  readonly agreement: ListingAgreement;
  readonly compensation: MandateCompensation;
}

/**
 * Η **προεπιλεγμένη** εντολή: κανένας πελάτης, δώδεκα μήνες, δρόμος συγκατάθεσης.
 *
 * 🔑 **Η προεπιλογή του δρόμου είναι η ΑΥΣΤΗΡΗ**: «ρώτα τον πελάτη». Αν προεπέλεγε τη
 * βεβαίωση, ένας μεσίτης που δεν διαβάζει θα δημοσίευε αγγελία **χωρίς** ο ιδιοκτήτης
 * να έχει πει τίποτα — και το σύστημα θα του το είχε προτείνει.
 *
 * @param todayISO — η **περασμένη** στιγμή· ποτέ ρολόι διαβασμένο εδώ μέσα, ώστε η
 *   φόρμα να είναι δοκιμάσιμη χωρίς να ταξιδεύει στον χρόνο.
 */
export function emptyMandateForm(todayISO: string): MandateFormValues {
  // 🔴 **Η προεπιλογή είναι το ΝΟΜΙΜΟ ΑΝΩΤΑΤΟ ΤΟΥ ΕΙΔΟΥΣ, όχι σταθερά.** Η παλιά
  //    γραφή πρόσθετε `365` ημέρες σε **κάθε** εντολή — και η προεπιλεγμένη εντολή
  //    είναι **αποκλειστική**, όπου ο νόμος δίνει **8 μήνες** (ADR-827 §8.9 α).
  const until = defaultExpiryFor(DEFAULT_LISTING_AGREEMENT, todayISO);
  return {
    clientContactId: '',
    // ⚠️ `?? ''` και **όχι** σιωπηλή σημερινή: αν η αφετηρία δεν διαβάζεται, η φόρμα
    //    οφείλει να **σταματήσει** στο `mandate-expiry-unset`, όχι να προτείνει
    //    ημερομηνία που κανείς δεν υπολόγισε.
    expiresOn: until?.slice(0, 10) ?? '',
    via: OWNER_CONSENT,
    documentPath: null,
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

export const MANDATE_FORM_BLOCKERS = [
  /** Δεν διαλέχτηκε πελάτης — η εντολή δεν λέει **για ποιον** είναι. */
  'mandate-client-unset',
  /** Δεν δηλώθηκε λήξη, ή δεν διαβάζεται ως ημερομηνία. */
  'mandate-expiry-unset',
  /**
   * Η διάρκεια ξεπερνά το **νόμιμο ανώτατο** του επιλεγμένου είδους εντολής.
   *
   * 🔑 **Ο ΙΔΙΟΣ κριτής με την πύλη** (`exceedsStatutoryTerm`), όχι δεύτερος έλεγχος:
   * η φόρμα τον τρέχει για να **δείξει**, ο διακομιστής γιατί **δεν εμπιστεύεται
   * καμία φόρμα**. Δύο υλοποιήσεις θα απαντούσαν διαφορετικά στο ίδιο κλειστό σύνολο
   * — το σχήμα του ADR-749, στην πιο ακριβή του μορφή: ο άνθρωπος βλέπει πράσινο και
   * ο διακομιστής λέει όχι.
   */
  'mandate-term-illegal',
] as const;

export type MandateFormBlocker = (typeof MANDATE_FORM_BLOCKERS)[number];

/**
 * Τι λείπει. **Όλα**, ποτέ το πρώτο.
 *
 * @param todayISO — η **περασμένη** στιγμή· η νομιμότητα της διάρκειας μετριέται από
 *   αυτήν, και μια συνάρτηση που διαβάζει ρολόι δεν είναι δοκιμάσιμη στα άκρα.
 */
export function mandateFormBlockers(
  values: MandateFormValues,
  todayISO: string,
): MandateFormBlocker[] {
  const found: MandateFormBlocker[] = [];
  if (values.clientContactId.trim() === '') found.push('mandate-client-unset');

  if (Number.isNaN(Date.parse(values.expiresOn))) {
    found.push('mandate-expiry-unset');
  } else if (
    // ⚠️ **Τέλος της ημέρας**, ίδια σύμβαση με το {@link mandateRequestFrom}: αλλιώς
    //    η φόρμα θα έκρινε **άλλη** στιγμή από αυτήν που στέλνει, και μια οριακά
    //    νόμιμη εντολή θα φαινόταν πράσινη εδώ και κόκκινη εκεί.
    exceedsStatutoryTerm(values.agreement, todayISO, endOfDay(values.expiresOn))
  ) {
    found.push('mandate-term-illegal');
  }

  return found;
}

// =============================================================================
// ΦΟΡΜΑ → ΑΙΤΗΜΑ
// =============================================================================

/**
 * Οι τιμές της φόρμας → το σώμα που περιμένει η πόρτα του γραφείου.
 *
 * ⚠️ **Η ημερομηνία γίνεται ΤΕΛΟΣ ΤΗΣ ΗΜΕΡΑΣ, όχι αρχή.** Ο μεσίτης που γράφει «μέχρι
 * 31 Δεκεμβρίου» εννοεί ότι η 31η **μετράει**. Ένα σκέτο `T00:00:00Z` θα έληγε την
 * εντολή **ένα ολόκληρο εικοσιτετράωρο νωρίτερα** από τη συμφωνία — και η αγγελία θα
 * κατέβαινε μόνη της, με το σύστημα να «λειτουργεί σωστά».
 */
export function mandateRequestFrom(values: MandateFormValues): {
  readonly clientContactId: string;
  readonly expiresAt: string;
  readonly via: MandateProofVia;
  readonly documentPath: string | null;
  readonly agreement: ListingAgreement;
  readonly compensation: MandateCompensation;
} {
  return {
    clientContactId: values.clientContactId.trim(),
    expiresAt: endOfDay(values.expiresOn),
    via: values.via,
    documentPath: values.documentPath,
    // 🔴 Χωρίς αυτά τα δύο το `brokeredMandateSchema` απορρίπτει **κάθε** αίτημα.
    agreement: values.agreement,
    compensation: values.compensation,
  };
}

/**
 * `yyyy-mm-dd` → **τέλος** εκείνης της ημέρας, ως ISO.
 *
 * 🔑 Εξήχθη ώστε ο **κριτής** και ο **αποστολέας** να μιλούν για την ίδια στιγμή. Δύο
 * γραφές του ίδιου `T23:59:59.999Z` είναι ακριβώς το είδος διπλότυπου που αποκλίνει
 * σιωπηλά — και εδώ η απόκλιση θα ήταν **ένα ολόκληρο εικοσιτετράωρο** στο όριο.
 */
function endOfDay(yyyyMmDd: string): string {
  return `${yyyyMmDd}T23:59:59.999Z`;
}
