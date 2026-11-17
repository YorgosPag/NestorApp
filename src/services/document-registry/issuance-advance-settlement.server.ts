import 'server-only';

/**
 * @fileoverview ADR-943 Φ5α — **ο διακανονισμός της προκαταβολής** από την πλευρά της ανάθεσης: κρίση πριν από τα
 *   χρήματα, καταγραφή της αποδέσμευσης (ο προγραμματισμός ζει στην πράξη που τον γεννά — `issuance-advance-start.service.ts`). Ο εκτελεστής είναι ένας (`payment-settlement.ts`)·
 *   εδώ ζει **μόνο** ό,τι ξέρει η ανάθεση.
 * @related server/payments/payment-settlement.ts (ο εκτελεστής) · server/payments/payable-subject-registry.ts (η δρομολόγηση) ·
 *   issuance-advance-payment.server.ts (ο ΕΝΑΣ γραφέας `system`) · lib/document-validity/issuance-advance.ts (η κρίση)
 * @module services/document-registry/issuance-advance-settlement.server
 *
 * 🔑 **Η εντολή είναι πρόθεση, ο τομέας η αλήθεια** (Ζ-7): η αυτόματη αποδέσμευση γράφεται στην αυτοψία με `dueAt` = το
 *    τέλος του παραθύρου· όταν έρθει η ώρα, ο τομέας ρωτιέται **ξανά** (`isAdvanceReleaseDue`). Αντίρρηση στο μεταξύ ⇒ η
 *    εντολή σβήνει χωρίς κίνηση — κανένα δεύτερο σημείο που πρέπει να «θυμηθεί» να την ακυρώσει.
 * 🔑 **Ποσό από τα γεγονότα**: αποδεσμεύεται ό,τι εισπράχθηκε (`advanceCollectedMinor`), ποτέ το εγκεκριμένο.
 */

import type { Firestore } from 'firebase-admin/firestore';

import {
  advanceCollectedMinor, advanceStateOf, isAdvanceReleaseDue, type AdvanceState,
} from '@/lib/document-validity/issuance-advance';
import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import type { IssuanceAdvancePayableSubject } from '@/server/payments/payable-subject';
import type { SettlementJudgement } from '@/server/payments/payable-subject-registry';
import type { CheckoutSettlementOrder, PaymentCheckoutRecord } from '@/server/payments/payment-checkout-store';
import type { PaymentProvider } from '@/server/payments/payment-provider';
import { announceAdvanceMilestone, latestAdvanceMilestone } from '@/server/issuance-invitations/issuance-advance-notifier';

import { readHostedIssuanceContext, writeAdvanceEvent } from './issuance-advance-payment.server';
import { issuanceRecordOf } from './issuance-assignment-schema';

const logger = createModuleLogger('IssuanceAdvanceSettlement');

/** Η πληρωμή που κράτησε τα χρήματα — από το (τελευταίο) γεγονός `funded`. */
export function fundedPaymentReferenceOf(record: IssuanceAssignmentRecord): string | null {
  return latestAdvanceMilestone(record, 'funded')?.paymentReference ?? null;
}

/** Η κρίση της αυτόματης αποδέσμευσης πάνω στην **τρέχουσα** κατάσταση. */
function judgeAutoRelease(state: AdvanceState, order: CheckoutSettlementOrder, nowIso: string): SettlementJudgement {
  if (state.kind !== 'release-pending') return 'void';
  if (!isAdvanceReleaseDue(state, nowIso)) return 'hold';
  return order.releaseMinor === advanceCollectedMinor(state) && order.refundMinor === 0 ? 'proceed' : 'hold';
}

/** **Η κρίση πριν από τα χρήματα** (βλ. κεφαλίδα). Σφάλμα ανάγνωσης ⇒ ρίχνει (το cron ξαναδοκιμάζει). */
export async function judgeIssuanceAdvanceSettlement(
  checkout: PaymentCheckoutRecord, subject: IssuanceAdvancePayableSubject, order: CheckoutSettlementOrder, now: Date,
): Promise<SettlementJudgement> {
  const context = await readHostedIssuanceContext(getAdminFirestore(), subject.companyId, subject.assignmentId, now);
  if (context === 'unknown') throw new Error('Document registry unavailable — retry');
  if (context === null) {
    logger.error('Held advance money for an assignment that cannot be found — needs a human', { checkoutId: checkout.checkoutId });
    return 'hold';
  }
  const record = issuanceRecordOf(context.assignment);
  if (fundedPaymentReferenceOf(record) !== checkout.paymentReference) return 'hold';
  switch (order.basis) {
    case 'window-elapsed': return judgeAutoRelease(advanceStateOf(record), order, now.toISOString());
  }
}

export interface AdvanceSettlementRecordInput {
  readonly checkout: PaymentCheckoutRecord;
  readonly subject: IssuanceAdvancePayableSubject;
  readonly order: CheckoutSettlementOrder;
  readonly provider: PaymentProvider;
  readonly transferReference: string;
}

/**
 * **Η καταγραφή της αποδέσμευσης** — γεγονός `advance-released` από τον ΕΝΑ γραφέα (`system`, ιδεμποτικό στην αναφορά της
 * μεταφοράς) + ειδοποίηση. Άρνηση του μειωτή (τα χρήματα κινήθηκαν ήδη) ⇒ σφάλμα προς άνθρωπο, ποτέ σιωπηλά.
 */
export async function recordIssuanceAdvanceSettlement(input: AdvanceSettlementRecordInput): Promise<void> {
  const { checkout, subject, order } = input;
  if (order.releaseMinor === 0) return;
  const db = getAdminFirestore();
  const now = new Date();
  const context = await readHostedIssuanceContext(db, subject.companyId, subject.assignmentId, now);
  if (context === 'unknown') throw new Error('Document registry unavailable — retry');
  if (context === null) throw new Error('Released advance for an assignment that cannot be found — needs a human');
  const outcome = await writeAdvanceEvent(db, context, {
    kind: 'advance-released', amountMinor: order.releaseMinor, transferReference: input.transferReference, basis: order.basis,
  }, input.provider.id);
  if (!outcome.ok) {
    logger.error('Provider released money the advance writer refused — needs a human', { checkoutId: checkout.checkoutId, refusal: outcome.refusal });
    return;
  }
  const milestone = latestAdvanceMilestone(outcome.record, 'released');
  if (outcome.outcome === 'changed' && milestone !== null) await announceAdvanceMilestone(db, { context, record: outcome.record, milestone, now });
}
