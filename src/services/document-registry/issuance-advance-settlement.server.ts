import 'server-only';

/**
 * @fileoverview ADR-943 Φ5α/Φ5γ — **ο διακανονισμός της προκαταβολής** από την πλευρά της ανάθεσης: η κρίση πριν από τα
 *   χρήματα και η καταγραφή της αποδέσμευσης. Ο εκτελεστής είναι ένας (`payment-settlement.ts`)· ο παραγωγός της εντολής
 *   ζει χωριστά (`issuance-advance-settlement-order.server.ts`) — αυτό το αρχείο το καλεί ο εκτελεστής μέσω του μητρώου, και
 *   δεν εισάγει ποτέ τον εκτελεστή (κανένας κύκλος).
 * @related server/payments/payment-settlement.ts (ο εκτελεστής) · server/payments/payable-subject-registry.ts (η δρομολόγηση) ·
 *   issuance-advance-payment.server.ts (ο ΕΝΑΣ γραφέας `system`) · lib/document-validity/issuance-advance-settlement.ts (η κρίση)
 * @module services/document-registry/issuance-advance-settlement.server
 *
 * 🔑 **Η εντολή είναι πρόθεση, ο τομέας η αλήθεια** (Ζ-7 · Θ-1 · Θ-2): παραγωγός και κρίση ρωτούν την **ίδια** συνάρτηση
 *    (`advanceSettlementDueOf`). Ο τομέας δεν θέλει πια κίνηση ⇒ η εντολή σβήνει· θέλει **άλλη** ⇒ ξαναγράφεται.
 * 🔑 **Ποσά από τα γεγονότα**: σύνολα πάνω σε ό,τι εισπράχθηκε, ποτέ το εγκεκριμένο.
 * 🔑 Θ-6 — **άρνηση είσπραξης**: η εντολή `refused-payment` προχωρά μόνο για πληρωμή που ο τομέας **δεν** δέχτηκε.
 */

import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { advanceSettlementDueOf, type AdvanceSettlementDue } from '@/lib/document-validity/issuance-advance-settlement';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import type { IssuanceAdvancePayableSubject } from '@/server/payments/payable-subject';
import type { SettlementJudgement } from '@/server/payments/payable-subject-registry';
import { sameSettlementOrder, type CheckoutSettlementOrder, type PaymentCheckoutRecord } from '@/server/payments/payment-checkout-store';
import type { PaymentProvider } from '@/server/payments/payment-provider';
import { announceAdvanceMilestone, latestAdvanceMilestone } from '@/server/issuance-invitations/issuance-advance-notifier';

import { readHostedIssuanceContext, writeAdvanceEvent } from './issuance-advance-payment.server';
import { issuanceRecordOf } from './issuance-assignment-schema';

const logger = createModuleLogger('IssuanceAdvanceSettlement');

/** Η πληρωμή που κράτησε τα χρήματα — από το (τελευταίο) γεγονός `funded`. */
export function fundedPaymentReferenceOf(record: IssuanceAssignmentRecord): string | null {
  return latestAdvanceMilestone(record, 'funded')?.paymentReference ?? null;
}

/** Η κίνηση του τομέα ως εντολή του εκτελεστή — η ΜΙΑ μετάφραση (παραγωγός και κρίση). */
export function orderOf(due: AdvanceSettlementDue): CheckoutSettlementOrder {
  return { refundMinor: due.refundMinor, releaseMinor: due.releaseMinor, basis: due.basis, dueAt: due.dueAt };
}

// ---------------------------------------------------------------------------
// Η κρίση πριν από τα χρήματα
// ---------------------------------------------------------------------------

/** Θ-6 — επιστροφή χρημάτων που ο τομέας **δεν** δέχτηκε: μόνο ολόκληρη, και μόνο αν η πληρωμή δεν έγινε ποτέ δεκτή. */
function judgeRefusedPayment(record: IssuanceAssignmentRecord | null, checkout: PaymentCheckoutRecord, order: CheckoutSettlementOrder): SettlementJudgement {
  const accepted = record?.advanceEvents.some((event) => event.kind === 'funded' && event.paymentReference === checkout.paymentReference) ?? false;
  if (accepted) return 'void';
  return order.refundMinor === checkout.amountMinor && order.releaseMinor === 0 ? 'proceed' : 'hold';
}

/** Θ-1/Θ-2 — η εντολή συγκρίνεται με ό,τι λέει **τώρα** ο τομέας. */
function judgeAgainstDomain(record: IssuanceAssignmentRecord, checkout: PaymentCheckoutRecord, order: CheckoutSettlementOrder): SettlementJudgement {
  if (fundedPaymentReferenceOf(record) !== checkout.paymentReference) return 'hold';
  const due = advanceSettlementDueOf(record);
  if (due === null) return 'void';
  const wanted = orderOf(due);
  return sameSettlementOrder(wanted, order) ? 'proceed' : { reschedule: wanted };
}

/** **Η κρίση πριν από τα χρήματα** (βλ. κεφαλίδα). Σφάλμα ανάγνωσης ⇒ ρίχνει (το cron ξαναδοκιμάζει). */
export async function judgeIssuanceAdvanceSettlement(
  checkout: PaymentCheckoutRecord, subject: IssuanceAdvancePayableSubject, order: CheckoutSettlementOrder, now: Date,
): Promise<SettlementJudgement> {
  const context = await readHostedIssuanceContext(getAdminFirestore(), subject.companyId, subject.assignmentId, now);
  if (context === 'unknown') throw new Error('Document registry unavailable — retry');
  const record = context === null ? null : issuanceRecordOf(context.assignment);
  if (order.basis === 'refused-payment') return judgeRefusedPayment(record, checkout, order);
  if (record === null) {
    logger.error('Held advance money for an assignment that cannot be found — needs a human', { checkoutId: checkout.checkoutId });
    return 'hold';
  }
  return judgeAgainstDomain(record, checkout, order);
}

// ---------------------------------------------------------------------------
// Η καταγραφή
// ---------------------------------------------------------------------------

export interface AdvanceSettlementRecordInput {
  readonly checkout: PaymentCheckoutRecord;
  readonly subject: IssuanceAdvancePayableSubject;
  readonly order: CheckoutSettlementOrder;
  readonly provider: PaymentProvider;
  readonly transferReference: string | null;
}

/**
 * **Η καταγραφή της αποδέσμευσης** — γεγονός `advance-released` από τον ΕΝΑ γραφέα (`system`, ιδεμποτικό στην αναφορά της
 * μεταφοράς) + ειδοποίηση. Η επιστροφή καταγράφεται από τον συγχρονισμό (Κ-8). Άρνηση του μειωτή (τα χρήματα κινήθηκαν
 * ήδη) ⇒ σφάλμα προς άνθρωπο, ποτέ σιωπηλά.
 */
export async function recordIssuanceAdvanceSettlement(input: AdvanceSettlementRecordInput): Promise<void> {
  const { checkout, subject, order, transferReference } = input;
  if (order.releaseMinor === 0 || order.basis === 'refused-payment') return;
  if (transferReference === null) throw new Error('Released advance without a transfer — needs a human');
  const db = getAdminFirestore();
  const now = new Date();
  const context = await readHostedIssuanceContext(db, subject.companyId, subject.assignmentId, now);
  if (context === 'unknown') throw new Error('Document registry unavailable — retry');
  if (context === null) throw new Error('Released advance for an assignment that cannot be found — needs a human');
  const outcome = await writeAdvanceEvent(db, context, {
    kind: 'advance-released', amountMinor: order.releaseMinor, transferReference, basis: order.basis,
  }, input.provider.id);
  if (!outcome.ok) {
    logger.error('Provider released money the advance writer refused — needs a human', { checkoutId: checkout.checkoutId, refusal: outcome.refusal });
    return;
  }
  const milestone = latestAdvanceMilestone(outcome.record, 'released');
  if (outcome.outcome === 'changed' && milestone !== null) await announceAdvanceMilestone(db, { context, record: outcome.record, milestone, now });
}
