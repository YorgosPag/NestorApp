/**
 * @fileoverview Ο ΕΝΑΣ γραφέας κινήσεων πληρωμής τιμολογίου (ADR-ACC-030 §4)
 * @description Κάθε πληρωμή ή επιστροφή — από webhook παρόχου, από τη συμφιλίωση cron ή (αργότερα) από χειροκίνητη
 *   καταχώριση — περνά **μόνο** από εδώ. Σε **μία** συναλλαγή Firestore:
 *
 *   1. διαβάζει το τιμολόγιο (ξένο μισθωτή = ανύπαρκτο, σιωπηλή πολιτική του `ownedOrNull`),
 *   2. αν το `paymentId` υπάρχει ήδη ⇒ `duplicate`, **καμία** εγγραφή (ιδεμποτία: το ίδιο webhook δύο φορές, ή
 *      webhook + cron για την ίδια πληρωμή, δίνουν μία κίνηση),
 *   3. προσθέτει την κίνηση και ξαναβγάζει τα παράγωγα από το `settleInvoicePayments`,
 *   4. γράφει το ίχνος λογιστικής (`PAYMENT_RECORDED` / `PAYMENT_REFUNDED`) στην **ίδια** συναλλαγή — ποτέ
 *      πληρωμή χωρίς ίχνος (πρότυπο `DEPRECIATION_POSTED`).
 *
 *   Γράφει **μόνο** τα πεδία πληρωμής: το στιγμιότυπο εκδομένου παραστατικού (εκδότης, γραμμές, σύνολα) δεν
 *   αγγίζεται ποτέ.
 *
 * @see ADR-ACC-030 · `services/payments/invoice-payment-settlement.ts` (παράγωγα)
 */

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { COLLECTIONS } from '@/config/firestore-collections';

import type { Invoice, InvoicePayment } from '../../types/invoice';
import type { TenantContext } from '../../types/common';
import { accountingAuditEntryOf } from '../accounting-audit-service';
import {
  hasInvoicePayment,
  isRefundMovement,
  settleInvoicePayments,
  type InvoicePaymentState,
} from '../payments/invoice-payment-settlement';
import { appendAuditEntryInTransaction } from './accounting-repo-audit';
import { isoNow, sanitizeForFirestore } from './firestore-helpers';

/** Η κίνηση προς καταγραφή + ποιος τη δηλώνει (π.χ. `provider:everypay`). */
export interface InvoicePaymentEntry {
  readonly payment: InvoicePayment;
  /** Ο δράστης στο ίχνος — ποτέ ο χρήστης που έφτιαξε τον σύνδεσμο όταν πλήρωσε ο πελάτης. */
  readonly actor: string;
}

export type InvoicePaymentRecordOutcome =
  | { readonly kind: 'recorded'; readonly state: InvoicePaymentState }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'invoice-absent' };

type InvoiceTenant = Pick<TenantContext, 'companyId'>;

function ownedInvoiceOf(data: unknown, tenant: InvoiceTenant, invoiceId: string): Invoice | null {
  return ownedOrNull((data ?? null) as Invoice | null, tenant.companyId, { resource: 'invoice', resourceId: invoiceId });
}

function paymentAuditEntry(invoiceId: string, entry: InvoicePaymentEntry, state: InvoicePaymentState) {
  const { payment } = entry;
  const refund = isRefundMovement(payment);
  return accountingAuditEntryOf({
    eventType: refund ? 'PAYMENT_REFUNDED' : 'PAYMENT_RECORDED',
    entityType: 'invoice',
    entityId: invoiceId,
    userId: entry.actor,
    details: refund
      ? `Refund €${payment.amount.toFixed(2)} (${payment.method})`
      : `Payment €${payment.amount.toFixed(2)} (${payment.method})`,
    metadata: {
      paymentId: payment.paymentId,
      amount: payment.amount,
      method: payment.method,
      provider: payment.provider ?? null,
      providerReference: payment.providerReference ?? null,
      checkoutId: payment.checkoutId ?? null,
      totalPaid: state.totalPaid,
      totalRefunded: state.totalRefunded,
      balanceDue: state.balanceDue,
      paymentStatus: state.paymentStatus,
    },
  });
}

/** Ανοίγει συναλλαγή πάνω στο τιμολόγιο του μισθωτή· ξένο/ανύπαρκτο ⇒ `absent` χωρίς εγγραφή. */
function inOwnedInvoiceTransaction<T>(
  tenant: InvoiceTenant,
  invoiceId: string,
  absent: T,
  work: (invoice: Invoice, transaction: Transaction, ref: DocumentReference, db: Firestore) => T,
): Promise<T> {
  return safeFirestoreOperation((db) => db.runTransaction(async (transaction) => {
    const ref = db.collection(COLLECTIONS.ACCOUNTING_INVOICES).doc(invoiceId);
    const snap = await transaction.get(ref);
    const invoice = ownedInvoiceOf(snap.exists ? snap.data() : null, tenant, invoiceId);
    return invoice === null ? absent : work(invoice, transaction, ref, db);
  }));
}

/** Καταγράφει ΜΙΑ κίνηση πληρωμής — ιδεμποτικά, με ίχνος, σε μία συναλλαγή. Σφάλμα βάσης ⇒ ρίχνει (retry). */
export function recordInvoicePayment(
  tenant: InvoiceTenant,
  invoiceId: string,
  entry: InvoicePaymentEntry,
): Promise<InvoicePaymentRecordOutcome> {
  return inOwnedInvoiceTransaction<InvoicePaymentRecordOutcome>(
    tenant, invoiceId, { kind: 'invoice-absent' },
    (invoice, transaction, ref, db) => {
      if (hasInvoicePayment(invoice, entry.payment.paymentId)) return { kind: 'duplicate' };
      const state = settleInvoicePayments(invoice.totalGrossAmount, [...(invoice.payments ?? []), entry.payment]);
      transaction.update(ref, sanitizeForFirestore({ ...state, updatedAt: isoNow() }));
      appendAuditEntryInTransaction(db, transaction, tenant, paymentAuditEntry(invoiceId, entry, state));
      return { kind: 'recorded', state };
    },
  );
}

/**
 * Ξαναβγάζει τα παράγωγα από το **τρέχον** σύνολο και τις **τρέχουσες** κινήσεις — μετά από αλλαγή γραμμών
 * πρόχειρου. Σε συναλλαγή: ποτέ υπόλοιπο πάνω σε παλιό αντίγραφο του `payments[]` (το webhook μπορεί να έγραψε
 * στο μεταξύ). Ξένο/ανύπαρκτο ⇒ τίποτα.
 */
export async function resettleInvoicePayments(tenant: InvoiceTenant, invoiceId: string): Promise<void> {
  await inOwnedInvoiceTransaction(tenant, invoiceId, undefined, (invoice, transaction, ref) => {
    const state = settleInvoicePayments(invoice.totalGrossAmount, invoice.payments ?? []);
    transaction.update(ref, sanitizeForFirestore({ ...state, updatedAt: isoNow() }));
  });
}
