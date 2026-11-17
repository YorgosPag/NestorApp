import 'server-only';

/**
 * @fileoverview ADR-943 Φ5γ (Θ-1 · Θ-3) — **ο ΕΝΑΣ παραγωγός της εντολής χρημάτων** της προκαταβολής: ρωτά τον τομέα «ποια
 *   κίνηση οφείλεται;» και τη γράφει στη συνεδρία που κράτησε τα χρήματα· και (όπου η κίνηση οφείλεται ήδη) την εκτελεί
 *   αμέσως. Αυτοψία, ακύρωση, απόφαση διαφοράς — όλες περνούν από εδώ· κανείς δεν συνθέτει εντολή με το χέρι.
 * @related lib/document-validity/issuance-advance-settlement.ts (η κρίση) · server/payments/payment-settlement.ts (ο εκτελεστής) ·
 *   issuance-advance-settlement.server.ts (η κρίση πριν από τα χρήματα — ίδια μετάφραση `orderOf`)
 * @module services/document-registry/issuance-advance-settlement-order.server
 *
 * 🔑 **Πρώτα η εντολή, μετά το γεγονός** (Θ-3): ο καλών δίνει την εγγραφή **όπως θα είναι** μετά την πράξη· αν η εντολή δεν
 *    γραφτεί (`busy`), το γεγονός **δεν** γράφεται. Βλάβη ανάμεσα ⇒ ο εκτελεστής ρωτά τον τομέα και σβήνει/ξαναγράφει.
 * 🔑 Η άμεση εκτέλεση **ποτέ** δεν πετά: η εντολή είναι ήδη γραμμένη και το cron την ολοκληρώνει.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { advanceSettlementDueOf } from '@/lib/document-validity/issuance-advance-settlement';
import { createModuleLogger } from '@/lib/telemetry';
import { findFundedAdvanceCheckout, type PaymentCheckoutRecord } from '@/server/payments/payment-checkout-store';
import { paymentProviderById } from '@/server/payments/payment-provider-registry';
import { executeSettlement } from '@/server/payments/payment-settlement';
import { scheduleSettlement } from '@/server/payments/payment-settlement-order';

import { fundedPaymentReferenceOf, orderOf } from './issuance-advance-settlement.server';

const logger = createModuleLogger('IssuanceAdvanceSettlementOrder');

export interface EnsureSettlementInput {
  readonly companyId: string;
  readonly assignmentId: string;
  /** Η εγγραφή **όπως θα είναι** (Θ-3) ή όπως είναι. */
  readonly record: IssuanceAssignmentRecord;
  readonly nowMs: number;
}

export type EnsureSettlementResult =
  /** Ο τομέας δεν θέλει καμία κίνηση (ή τα χρήματα παγώνουν σε διαφορά). */
  | { readonly kind: 'nothing' }
  /** Η εντολή γράφτηκε (ή υπήρχε ήδη ίδια). */
  | { readonly kind: 'ordered'; readonly checkout: PaymentCheckoutRecord; readonly dueAt: string }
  /** Κίνηση σε εξέλιξη — ο καλών **δεν** γράφει το γεγονός· ο άνθρωπος ξαναδοκιμάζει σε λίγο. */
  | { readonly kind: 'busy' }
  /** Η συνεδρία που κράτησε τα χρήματα δεν βρέθηκε / τα ποσά δεν την καλύπτουν — θέλει άνθρωπο. */
  | { readonly kind: 'unavailable' };

/** **Γράφει την εντολή που λέει ο τομέας** για αυτή την εγγραφή. Ιδεμποτικό. Σφάλμα βάσης ⇒ ρίχνει. */
export async function ensureAdvanceSettlement(db: Firestore, input: EnsureSettlementInput): Promise<EnsureSettlementResult> {
  const due = advanceSettlementDueOf(input.record);
  if (due === null) return { kind: 'nothing' };
  const paymentReference = fundedPaymentReferenceOf(input.record);
  const checkout = paymentReference === null ? null : await findFundedAdvanceCheckout(db, input.companyId, input.assignmentId, paymentReference);
  if (checkout === null) {
    logger.error('Advance money owes a movement without its funded checkout — needs a human', { assignmentId: input.assignmentId, basis: due.basis });
    return { kind: 'unavailable' };
  }
  const outcome = await scheduleSettlement(db, checkout.checkoutId, orderOf(due), input.nowMs);
  if (outcome === 'busy') return { kind: 'busy' };
  if (outcome === 'refused') return { kind: 'unavailable' };
  return { kind: 'ordered', checkout, dueAt: due.dueAt };
}

/**
 * Εκτελεί **τώρα** μια εντολή που οφείλεται ήδη (ακύρωση · απόφαση). Ποτέ δεν πετά: βλάβη ⇒ η εντολή μένει γραμμένη και
 * το cron την ολοκληρώνει. Εντολή του μέλλοντος (αυτόματη αποδέσμευση) ⇒ τίποτα — τη φέρνει το cron στην ώρα της.
 */
export async function settleAdvanceNow(db: Firestore, ensured: EnsureSettlementResult, nowMs: number): Promise<void> {
  if (ensured.kind !== 'ordered' || Date.parse(ensured.dueAt) > nowMs) return;
  const provider = paymentProviderById(ensured.checkout.provider);
  if (provider === null) return;
  try {
    await executeSettlement(db, provider, ensured.checkout.checkoutId, nowMs);
  } catch (error) {
    logger.warn('Immediate settlement failed — the cron retries', {
      checkoutId: ensured.checkout.checkoutId, error: error instanceof Error ? error.message : String(error),
    });
  }
}
