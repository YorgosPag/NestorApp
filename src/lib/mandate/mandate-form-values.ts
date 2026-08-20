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
  MANDATE_DEFAULT_DURATION_DAYS,
  OWNER_CONSENT,
  type MandateProofVia,
} from '@/types/owner-property-mandate';

/** Ό,τι πληκτρολογεί ο μεσίτης για την εντολή. */
export interface MandateFormValues {
  readonly clientContactId: string;
  /** `yyyy-mm-dd` — η μορφή του `<input type="date">`, όχι ISO στιγμή. */
  readonly expiresOn: string;
  readonly via: MandateProofVia;
  readonly documentPath: string | null;
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
  const until = new Date(
    Date.parse(todayISO) + MANDATE_DEFAULT_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );
  return {
    clientContactId: '',
    expiresOn: until.toISOString().slice(0, 10),
    via: OWNER_CONSENT,
    documentPath: null,
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
] as const;

export type MandateFormBlocker = (typeof MANDATE_FORM_BLOCKERS)[number];

/** Τι λείπει. **Όλα**, ποτέ το πρώτο. */
export function mandateFormBlockers(values: MandateFormValues): MandateFormBlocker[] {
  const found: MandateFormBlocker[] = [];
  if (values.clientContactId.trim() === '') found.push('mandate-client-unset');
  if (Number.isNaN(Date.parse(values.expiresOn))) found.push('mandate-expiry-unset');
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
} {
  return {
    clientContactId: values.clientContactId.trim(),
    expiresAt: `${values.expiresOn}T23:59:59.999Z`,
    via: values.via,
    documentPath: values.documentPath,
  };
}
