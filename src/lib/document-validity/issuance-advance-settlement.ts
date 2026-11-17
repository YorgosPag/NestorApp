/**
 * =============================================================================
 * Μητρώο λήξεων — ΠΟΙΑ ΚΙΝΗΣΗ ΚΡΑΤΗΜΕΝΩΝ ΧΡΗΜΑΤΩΝ ΟΦΕΙΛΕΤΑΙ ΤΩΡΑ (ADR-943 Φ5γ · Θ-1)
 * =============================================================================
 *
 * **«Τι λέει ο τομέας ότι πρέπει να γίνει με τα κρατημένα χρήματα — και γιατί;»** Η ΜΙΑ κρίση που ρωτούν **και** ο
 * παραγωγός της εντολής (αυτοψία · ακύρωση · απόφαση διαφοράς) **και** η κρίση πριν από τα χρήματα (cron/εκτελεστής).
 * Η εντολή στη συνεδρία πληρωμής είναι **πρόθεση**· αυτή η συνάρτηση είναι η **αλήθεια** — μια εντολή που δεν της μοιάζει
 * ξαναγράφεται (Θ-2), ποτέ δεν εκτελείται «επειδή γράφτηκε».
 *
 * 🔑 **Σύνολα πάνω σε ό,τι εισπράχθηκε**: «συνολικά επιστραμμένα Χ · συνολικά αποδεσμευμένα Υ», Χ + Υ = εισπραχθέν — ίδια
 *    απάντηση πριν και μετά από μια μερική κίνηση (η εντολή του παρόχου είναι δηλωτική).
 * 🔑 **Προτεραιότητα**: απόφαση γραφείου (Ζ-5) > διαφορά χωρίς απόφαση (τα χρήματα παγώνουν, Θ-4) > ακύρωση (Ζ-4, η πολιτική
 *    τη στιγμή της ακύρωσης) > αυτόματη αποδέσμευση στο τέλος του παραθύρου (Κ-4).
 * 🔑 Ό,τι ο πάροχος έχει ήδη βεβαιώσει (γεγονότα `refunded`/`released`) ⇒ τίποτα δεν οφείλεται.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/issuance-advance-settlement
 */

import type { MinorAmount } from '@/lib/money/money';

import {
  advanceFundedMinor, advanceMovedMinor, advanceResolutionOf, advanceStateOf, cancellationRefundTotalOf,
  type AdvanceReleaseBasis, type CancellationFacts,
} from './issuance-advance';

/**
 * Γιατί οφείλεται η κίνηση — ο **ίδιος** λόγος γράφεται στην εντολή και (στην αποδέσμευση) στο γεγονός: ένα λεξιλόγιο,
 * το `ADVANCE_RELEASE_BASES` του τομέα.
 */
export type AdvanceSettlementBasis = AdvanceReleaseBasis;

/** Η κίνηση που οφείλεται — δηλωτικά σύνολα, και από πότε. */
export interface AdvanceSettlementDue {
  readonly basis: AdvanceSettlementBasis;
  /** Συνολικά επιστραμμένα στον πληρωτή (λεπτά). */
  readonly refundMinor: MinorAmount;
  /** Συνολικά αποδεσμευμένα στον μηχανικό (λεπτά). Μαζί = ό,τι εισπράχθηκε. */
  readonly releaseMinor: MinorAmount;
  /** Από πότε (ISO): τέλος παραθύρου · στιγμή ακύρωσης · στιγμή απόφασης. */
  readonly dueAt: string;
}

/** Τα γεγονότα + η ακύρωση της ανάθεσης (η `IssuanceAssignmentRecord` τα έχει ήδη). */
export interface AdvanceSettlementFacts extends CancellationFacts {
  readonly cancellation: { readonly at: string } | null;
}

/** Ό,τι ο πάροχος έχει ήδη βεβαιώσει καλύπτει την κίνηση ⇒ τίποτα δεν οφείλεται. */
function unlessSettled(facts: AdvanceSettlementFacts, due: AdvanceSettlementDue): AdvanceSettlementDue | null {
  const moved = advanceMovedMinor(facts);
  return moved.refundedMinor >= due.refundMinor && moved.releasedMinor >= due.releaseMinor ? null : due;
}

/** **Η ΜΙΑ κρίση** «ποια κίνηση οφείλεται;» — βλ. κεφαλίδα. `null` ⇒ καμία (ή τα χρήματα παγώνουν σε διαφορά). */
export function advanceSettlementDueOf(facts: AdvanceSettlementFacts): AdvanceSettlementDue | null {
  const fundedMinor = advanceFundedMinor(facts);
  if (fundedMinor === 0) return null;
  const resolution = advanceResolutionOf(facts);
  if (resolution !== null) {
    return unlessSettled(facts, { basis: 'office-resolution', refundMinor: resolution.refundMinor, releaseMinor: resolution.releaseMinor, dueAt: resolution.at });
  }
  const state = advanceStateOf(facts);
  if (state.kind === 'disputed') return null;
  if (facts.cancellation !== null) {
    const refundMinor = cancellationRefundTotalOf(facts, facts.cancellation.at);
    return unlessSettled(facts, { basis: 'cancellation', refundMinor, releaseMinor: fundedMinor - refundMinor, dueAt: facts.cancellation.at });
  }
  if (state.kind !== 'release-pending') return null;
  return { basis: 'window-elapsed', refundMinor: 0, releaseMinor: fundedMinor, dueAt: state.objectionUntil };
}

/** Τι θα γίνει με τα χρήματα **αν ακυρωθεί τώρα** — ό,τι βλέπει το γραφείο πριν επιβεβαιώσει (Ζ-4). */
export type CancellationPreview =
  /** Δεν υπάρχουν κρατημένα χρήματα (ή έχουν ήδη κινηθεί όλα). */
  | { readonly kind: 'none' }
  /** Διαφορά χωρίς απόφαση: τα χρήματα μένουν κρατημένα ως την απόφαση του γραφείου (Θ-4). */
  | { readonly kind: 'frozen' }
  /** Συνολικά πίσω στον ιδιοκτήτη / στον μηχανικό — από την ΙΔΙΑ κρίση με την πραγματική κίνηση. */
  | { readonly kind: 'settle'; readonly basis: AdvanceSettlementBasis; readonly refundMinor: MinorAmount; readonly retainedMinor: MinorAmount };

export function cancellationPreviewOf(facts: CancellationFacts, nowIso: string): CancellationPreview {
  if (advanceFundedMinor(facts) === 0) return { kind: 'none' };
  const due = advanceSettlementDueOf({ ...facts, cancellation: { at: nowIso } });
  if (due !== null) return { kind: 'settle', basis: due.basis, refundMinor: due.refundMinor, retainedMinor: due.releaseMinor };
  return advanceStateOf(facts).kind === 'disputed' ? { kind: 'frozen' } : { kind: 'none' };
}

/**
 * Φ5γ — **ζουν ακόμη χρήματα** σε αυτή την ανάθεση; (κρατημένα · εκκρεμής κίνηση · διαφορά χωρίς απόφαση). Μια νέα πρόταση
 * γράφει πάνω στο ίδιο έγγραφο — όσο ζουν χρήματα, θα έσβηνε το ίχνος τους· γι' αυτό η πρόταση περιμένει.
 */
export function hasLiveAdvanceMoney(facts: AdvanceSettlementFacts): boolean {
  if (advanceFundedMinor(facts) === 0) return false;
  const kind = advanceStateOf(facts).kind;
  return (kind !== 'released' && kind !== 'refunded') || advanceSettlementDueOf(facts) !== null;
}
