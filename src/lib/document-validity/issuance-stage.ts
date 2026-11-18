/**
 * =============================================================================
 * Μητρώο λήξεων — ΤΟ ΣΤΑΔΙΟ μιας ανάθεσης έκδοσης, παραγόμενο από τα γεγονότα (ADR-915 §27 · §42)
 * =============================================================================
 *
 * | Στάδιο | Μπάλα | Πώς φτάνει εδώ (ροή προσφοράς §42) |
 * |---|---|---|
 * | `proposed` | γραφείο | το γραφείο επέλεξε επαγγελματία |
 * | `sent` | επαγγελματίας | στάλθηκε αίτημα προσφοράς |
 * | `quoted` | ιδιοκτήτης | δόθηκε προσφορά — ή αναθεώρηση που **ακυρώνει** την έγκριση |
 * | `accepted` | επαγγελματίας | ο υπεύθυνος ενέκρινε **αυτή** την αναθεώρηση ⇒ ανάθεση |
 * | `ownerRejected` | — | ο υπεύθυνος απέρριψε την προσφορά |
 * | `declined` | γραφείο | ο επαγγελματίας δεν δίνει προσφορά ή αποσύρθηκε |
 * | `cancelled` | — | το γραφείο ακύρωσε |
 * | `ownerApproved` | γραφείο | **μόνο** παλιές αναθέσεις (§27): έγκριση προσώπου πριν από κάθε τιμή |
 *
 * 🔑 **Καμία σημαία δίπλα στα γεγονότα**: η αναθεώρηση ξαναφέρνει `quoted` επειδή `decision.quoteRevision ≠
 *    quote.revision` — όχι επειδή κάποιος θυμήθηκε να σβήσει την έγκριση.
 * 🔑 **Οι παλιές αναθέσεις** (απόφαση **χωρίς** αναθεώρηση προσφοράς) διαβάζονται με τους παλιούς κανόνες — καμία
 *    μετάπτωση, κανένα έγγραφο δεν ξαναγράφεται.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/issuance-stage
 */

import type { IssuanceAssignmentRecord } from './issuance-assignment';

export const ISSUANCE_STAGES = [
  'proposed', 'ownerApproved', 'ownerRejected', 'sent', 'quoted', 'accepted', 'declined', 'cancelled',
] as const;
export type IssuanceStage = (typeof ISSUANCE_STAGES)[number];

/**
 * ADR-945 §7.2 — **γιατί** έκλεισε μια ανάθεση: ακυρώθηκε (από τον κάτοχο) ή **δεν επιλέχθηκε** (άλλη προσφορά του ίδιου
 * αιτήματος κέρδισε). Ίδιο στάδιο `cancelled`, δύο λόγοι — «Lost ≠ Declined» (Fairmarkit), χωρίς νέο στάδιο.
 */
export const ISSUANCE_CANCELLATION_REASONS = ['cancelled', 'not-awarded'] as const;
export type IssuanceCancellationReason = (typeof ISSUANCE_CANCELLATION_REASONS)[number];

/** Σε ποιον είναι η μπάλα — Procore «Ball in Court», παραγόμενο. */
export const BALL_IN_COURT_PARTIES = ['owner', 'office', 'professional'] as const;
export type BallInCourtParty = (typeof BALL_IN_COURT_PARTIES)[number];

/** Παλιά ανάθεση (§27): ο υπεύθυνος αποφάσισε για το **πρόσωπο**, όχι για μια προσφορά. */
export function isLegacyIssuance(record: IssuanceAssignmentRecord): boolean {
  return record.decision !== null && record.decision.quoteRevision === null;
}

/** Οι κανόνες του §27, αυτούσιοι, για όσες αναθέσεις ξεκίνησαν πριν από τον §42. */
function legacyIssuanceStageOf(record: IssuanceAssignmentRecord): IssuanceStage {
  if (record.decision?.outcome === 'rejected') return 'ownerRejected';
  if (record.response !== null) return record.response.outcome;
  return record.notice === null ? 'ownerApproved' : 'sent';
}

/** Το στάδιο — από τα γεγονότα, με σειρά προτεραιότητας (η ακύρωση νικά τα πάντα). */
export function issuanceStageOf(record: IssuanceAssignmentRecord): IssuanceStage {
  if (record.cancellation !== null) return 'cancelled';
  if (isLegacyIssuance(record)) return legacyIssuanceStageOf(record);
  if (record.response?.outcome === 'declined') return 'declined';
  if (record.quote === null) return record.notice === null ? 'proposed' : 'sent';
  const decision = record.decision;
  if (decision === null || decision.quoteRevision !== record.quote.revision) return 'quoted';
  return decision.outcome === 'approved' ? 'accepted' : 'ownerRejected';
}

const BALL_IN_COURT: Readonly<Record<IssuanceStage, BallInCourtParty | null>> = {
  proposed: 'office',
  ownerApproved: 'office',
  ownerRejected: null,
  sent: 'professional',
  quoted: 'owner',
  accepted: 'professional',
  declined: 'office',
  cancelled: null,
};

export function ballInCourtOf(stage: IssuanceStage): BallInCourtParty | null {
  return BALL_IN_COURT[stage];
}

/**
 * **Από πότε** ισχύει το τρέχον στάδιο (ADR-915 §45 Φ1) — η στιγμή του γεγονότος που το **γέννησε**, όχι μια
 * αποθηκευμένη σφραγίδα δίπλα του. Ίδια διάκριση νέας/παλιάς ροής με το {@link issuanceStageOf}: η επιλογή του
 * γεγονότος περνά **από** το στάδιο, ώστε τα δύο να μη διαφωνούν ποτέ.
 */
export function issuanceStageSinceOf(record: IssuanceAssignmentRecord): string {
  const stage = issuanceStageOf(record);
  switch (stage) {
    case 'cancelled': return record.cancellation?.at ?? record.proposedAt;
    case 'proposed': return record.proposedAt;
    case 'sent': return record.notice?.at ?? record.proposedAt;
    case 'quoted': return record.quote?.at ?? record.proposedAt;
    case 'ownerApproved':
    case 'ownerRejected': return record.decision?.at ?? record.proposedAt;
    case 'declined': return record.response?.at ?? record.proposedAt;
    case 'accepted':
      return (isLegacyIssuance(record) ? record.response?.at : record.decision?.at) ?? record.proposedAt;
  }
}
