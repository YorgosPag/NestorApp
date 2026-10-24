/**
 * @fileoverview **«ΠΟΙΟΣ ΟΦΕΙΛΕΙ ΤΗΝ ΕΠΟΜΕΝΗ ΚΙΝΗΣΗ, ΚΑΙ ΓΙΑΤΙ;»** — η κρίση της καρτέλας «Παράδοση» του γραφείου (ADR-916 §5.15 Φ-Δ).
 * @related handover-protocol-plan.ts (η κρίση του Πρωτοκόλλου — **συντίθεται**, δεν ξαναγράφεται) ·
 *          handover-withdrawal-plan.ts (Ο4 `sale-reverted` + η προσφορά ανάκλησης — η ΙΔΙΑ κρίση με την πόρτα, Φ-Δ.5) ·
 *          config/property-handover-invitation-policy.ts (λήξη · «λήγει σύντομα» · όριο αποστολών)
 * @module lib/property-handover/handover-office-status
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΡΙΣΗ, ΟΧΙ ΦΙΛΤΡΟ
 * ────────────────────────────────────────────────────────────────────────────
 * Οι λίστες κατάστασης (DocuSign Manage · ACC Transmittals) δείχνουν **τι είναι** κάτι και αφήνουν τον άνθρωπο να συμπεράνει
 * **ποιος** κινείται. Εδώ η απάντηση είναι **μία** συνάρτηση: ένας λόγος ανά παράδοση, με σειρά προτεραιότητας, και ο
 * κάτοχος της επόμενης κίνησης παράγεται **από τον λόγο** (`HANDOVER_OFFICE_MOVE_OF`) — δεν μπορεί να διαφωνήσει μαζί του.
 * Τα ίδια ερωτήματα που κάνει η μηχανή (`planHandoverProtocol` · πολιτική πρόσκλησης) ⇒ η οθόνη δεν μπορεί να διαφωνήσει
 * με την πράξη (ίδια αρχή με την άγκυρα Γ13).
 *
 * ⚖️ **Σειρά** (η πρώτη αλήθεια νικά): ακυρωμένη · ανακλημένη (Φ-Δ.5) · ακυρωμένη-μετά-την-ολοκλήρωση (Ο4) · πρόσκληση · ολοκλήρωση · αρχεία ·
 *    Πρωτόκολλο. Μια πώληση που έπεσε κρύβει κάθε τεχνική πρόοδο από κάτω — είναι η απόφαση που μετρά.
 *
 * 🔒 **Ποτέ «Επαληθευμένο»** εδώ: το `sealed` λέει «σφραγίστηκε»· επαλήθευση κάνει **μόνο** η δημόσια πόρτα (Σ6).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις· ο χρόνος **δίνεται**, δεν διαβάζεται.
 */

import {
  HANDOVER_INVITATION_DELIVERY_CAP,
  isHandoverInvitationExpired,
  isHandoverInvitationExpiringSoon,
} from '@/config/property-handover-invitation-policy';
import {
  HANDOVER_OFFICE_STEPS,
  type HandoverOfficeMove,
  type HandoverOfficeReason,
  type HandoverOfficeSignal,
  type HandoverOfficeStatus,
  type HandoverOfficeStep,
  type HandoverOfficeStepState,
  type PropertyHandover,
} from '@/types/property-handover';

import { handoverInvitationRenewalOfferOf } from './handover-invitation-plan';
import { isClosedHandoverLifecycle } from './handover-plan';
import { planHandoverProtocol, type HandoverProtocolPlan } from './handover-protocol-plan';
import {
  buyerAgainAfterWithdrawal,
  handoverWithdrawalOfferOf,
  saleRevertedAfterCompletion,
  withdrawalNoticeUndelivered,
  type HandoverSaleTruth,
} from './handover-withdrawal-plan';

/** **Ο κάτοχος της επόμενης κίνησης ανά λόγο** — η μία αντιστοίχιση· η κρίση και κάθε όψη τη διαβάζουν από εδώ. */
export const HANDOVER_OFFICE_MOVE_OF: Readonly<Record<HandoverOfficeReason, HandoverOfficeMove>> = {
  cancelled: 'none',
  withdrawn: 'none',
  'sale-reverted': 'office',
  'invitation-not-issued': 'system',
  'no-address': 'office',
  'invitation-undeliverable': 'office',
  'invitation-retrying': 'system',
  declined: 'office',
  'invitation-expired': 'office',
  'awaiting-buyer': 'buyer',
  'awaiting-completion': 'sale',
  'delivery-queued': 'system',
  delivering: 'system',
  'unverifiable-rows': 'office',
  'digest-pending': 'system',
  'awaiting-seal-configuration': 'system',
  'protocol-due': 'system',
  sealed: 'none',
};

/** Ό,τι χρειάζεται η κρίση πέρα από την ίδια την παράδοση. */
export interface HandoverOfficeContext {
  /** Η πώληση **τώρα** — `null` ⇒ το ακίνητο δεν διαβάζεται (καμία υπόθεση για Ο4). */
  readonly snapshot: HandoverSaleTruth;
  /** Έχει ρυθμιστεί ο πάροχος σφραγίδας (ADR-918); */
  readonly sealConfigured: boolean;
  readonly nowValue: string;
}

/** Ο αγοραστής **δεν** έχει αποδεχτεί ακόμη — τι λέει το κάτοπτρο της πρόσκλησης. */
function invitationReasonOf(handover: PropertyHandover, nowValue: string): HandoverOfficeReason {
  const link = handover.invitation;
  if (link === null) return 'invitation-not-issued';
  if (link.status === 'no-address') return 'no-address';
  if (link.declinedAt !== null) return 'declined';
  if (isHandoverInvitationExpired(link.expiresAt, nowValue)) return 'invitation-expired';
  if (link.delivery === 'unaddressable') return 'invitation-undeliverable';
  if (link.delivery === 'failed') {
    return link.deliveryAttempts >= HANDOVER_INVITATION_DELIVERY_CAP ? 'invitation-undeliverable' : 'invitation-retrying';
  }
  return 'awaiting-buyer';
}

/** Αποδέχτηκε **και** ολοκληρώθηκε — η τεχνική πρόοδος, όπως την κρίνει η **ίδια** συνάρτηση με τη μηχανή. */
function deliveryReasonOf(plan: HandoverProtocolPlan, sealConfigured: boolean, hasDelivery: boolean): HandoverOfficeReason {
  if (plan.kind === 'current') return 'sealed';
  if (plan.kind === 'due') return sealConfigured ? 'protocol-due' : 'awaiting-seal-configuration';
  if (plan.reason === 'unverifiable-rows') return 'unverifiable-rows';
  if (plan.reason === 'digest-pending') return 'digest-pending';
  return hasDelivery ? 'delivering' : 'delivery-queued';
}

/** **Ο λόγος** — η πρώτη αλήθεια κατά σειρά προτεραιότητας. */
function handoverOfficeReasonOf(handover: PropertyHandover, context: HandoverOfficeContext): HandoverOfficeReason {
  if (handover.lifecycle === 'cancelled') return 'cancelled';
  if (handover.lifecycle === 'withdrawn') return 'withdrawn';
  if (saleRevertedAfterCompletion(handover, context.snapshot)) return 'sale-reverted';
  if (handover.recipient === null) return invitationReasonOf(handover, context.nowValue);
  if (handover.lifecycle !== 'ready') return 'awaiting-completion';
  return deliveryReasonOf(planHandoverProtocol(handover), context.sealConfigured, handover.fileDelivery !== null);
}

/** Σήματα που **συνυπάρχουν** με τον λόγο. */
function signalsOf(handover: PropertyHandover, reason: HandoverOfficeReason, context: HandoverOfficeContext): readonly HandoverOfficeSignal[] {
  const signals: HandoverOfficeSignal[] = [];
  const link = handover.invitation;
  if (reason === 'awaiting-buyer' && link?.status === 'issued' && isHandoverInvitationExpiringSoon(link.expiresAt, context.nowValue)) {
    signals.push('invitation-expiring');
  }
  // Κλειστή παράδοση ⇒ κανένα αρχείο δεν φεύγει πια, άρα καμία απόφαση δεν περιμένει.
  if (!isClosedHandoverLifecycle(handover.lifecycle) && (handover.fileDelivery?.awaitingReview ?? 0) > 0) signals.push('files-awaiting-review');
  if (withdrawalNoticeUndelivered(handover)) signals.push('withdrawal-notice-undelivered');
  if (buyerAgainAfterWithdrawal(handover, context.snapshot)) signals.push('buyer-again');
  return signals;
}

const INVITATION_BLOCKERS: ReadonlySet<HandoverOfficeReason> = new Set([
  'no-address', 'invitation-undeliverable', 'declined', 'invitation-expired',
]);

function invitationStep(handover: PropertyHandover, reason: HandoverOfficeReason): HandoverOfficeStepState {
  if (handover.recipient !== null) return 'done';
  if (INVITATION_BLOCKERS.has(reason)) return 'blocked';
  return handover.invitation?.status === 'issued' ? 'done' : 'current';
}

function filesStep(handover: PropertyHandover): HandoverOfficeStepState {
  const delivery = handover.fileDelivery;
  if (delivery !== null && delivery.unverifiable > 0) return 'blocked';
  if (delivery?.state === 'delivered') return 'done';
  return delivery !== null || (handover.lifecycle === 'ready' && handover.recipient !== null) ? 'current' : 'pending';
}

function protocolStep(reason: HandoverOfficeReason): HandoverOfficeStepState {
  if (reason === 'sealed') return 'done';
  if (reason === 'awaiting-seal-configuration') return 'blocked';
  return reason === 'protocol-due' || reason === 'digest-pending' ? 'current' : 'pending';
}

/** Τα βήματα — ανεξάρτητα μεταξύ τους· μια ακυρωμένη ή ανακλημένη παράδοση δεν έχει «τρέχον» βήμα. */
function stepsOf(handover: PropertyHandover, reason: HandoverOfficeReason): HandoverOfficeStatus['steps'] {
  const steps: Record<HandoverOfficeStep, HandoverOfficeStepState> = {
    invitation: invitationStep(handover, reason),
    acceptance: handover.recipient !== null ? 'done' : reason === 'awaiting-buyer' ? 'current' : 'pending',
    completion: handover.lifecycle === 'ready' ? 'done' : 'current',
    files: filesStep(handover),
    protocol: protocolStep(reason),
  };
  if (!isClosedHandoverLifecycle(handover.lifecycle)) return steps;
  const settle = (state: HandoverOfficeStepState): HandoverOfficeStepState => (state === 'done' ? 'done' : 'pending');
  for (const step of HANDOVER_OFFICE_STEPS) steps[step] = settle(steps[step]);
  return steps;
}

/** **Η κρίση** για μία παράδοση: ποιος κινείται, γιατί, τι άλλο πρέπει να δει ο άνθρωπος, πού βρίσκεται κάθε βήμα. */
export function handoverOfficeStatusOf(handover: PropertyHandover, context: HandoverOfficeContext): HandoverOfficeStatus {
  const reason = handoverOfficeReasonOf(handover, context);
  return {
    move: HANDOVER_OFFICE_MOVE_OF[reason],
    reason,
    signals: signalsOf(handover, reason, context),
    steps: stepsOf(handover, reason),
    // Φ-Δ.3 — η ΙΔΙΑ συνάρτηση με την πόρτα: το κουμπί δεν υπόσχεται πράξη που ο διακομιστής θα αρνηθεί (Ζ17).
    renewal: handoverInvitationRenewalOfferOf(handover, context.nowValue),
    // Φ-Δ.5 — ΙΔΙΑ συνάρτηση με την πόρτα: το κουμπί εμφανίζεται μόνο όταν ο διακομιστής θα δεχτεί.
    withdrawal: handoverWithdrawalOfferOf(handover, context.snapshot),
  };
}
