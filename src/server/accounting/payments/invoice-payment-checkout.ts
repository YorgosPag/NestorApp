import 'server-only';

/**
 * @fileoverview Έναρξη online πληρωμής από τον σύνδεσμο τιμολογίου (ADR-ACC-030 §5)
 * @description Σειρά — κάθε βήμα πριν από το επόμενο:
 *
 *   1. **Σύνδεσμος → τιμολόγιο** από την ΙΔΙΑ είσοδο με την όψη (`readSharedInvoice`): ενεργός, του μισθωτή του.
 *   2. **Η διαδρομή επιστροφής** (`/shared/<token>`) λύνεται στον **ίδιο** σύνδεσμο — αλλιώς άρνηση (καμία ανοιχτή
 *      ανακατεύθυνση).
 *   3. **Ποσό από τον διακομιστή** (`invoiceAmountDueNow`), σε λεπτά. Ο πελάτης δεν στέλνει ποτέ ποσό.
 *   4. **Οι ανοιχτές συνεδρίες του ίδιου συνδέσμου κλείνουν**: ξεχασμένη καρτέλα κάρτας δεν πληρώνεται δεύτερη φορά
 *      αφού ο πελάτης πλήρωσε με IRIS.
 *   5. **Η συνεδρία γράφεται ΠΡΙΝ** μιλήσουμε με τον πάροχο: κάθε webhook βρίσκει πάντα συνεδρία να ταιριάξει.
 *   6. Ο πάροχος ⇒ αναγνωριστικό + τρόπος εκκίνησης. Αποτυχία ⇒ η συνεδρία `failed`, ο πελάτης βλέπει «ξαναδοκιμάστε».
 *   7. Ίχνος `INVOICE_PAYMENT_CHECKOUT_STARTED` με δράστη τον κάτοχο του συνδέσμου.
 *
 * @see ADR-ACC-030 · `invoice-public-session.ts` (`readSharedInvoice`)
 */

import type { Firestore } from 'firebase-admin/firestore';

import { isPlausibleShareToken } from '@/lib/sharing/share-token';
import { linkHolderActor } from '@/server/accounting/public-invoice/invoice-link-opened';
import { readSharedInvoice } from '@/server/accounting/public-invoice/invoice-public-session';
import type { PaymentProvider } from '@/server/payments/payment-provider';
import { CHECKOUT_LIFETIME_MS, launchCheckoutAtProvider } from '@/server/payments/payment-checkout-launch';
import { paymentProviderForCompany } from '@/server/payments/payment-provider-registry';
import { findActiveShareByToken } from '@/server/sharing/share-token-lookup';
import { generatePaymentCheckoutId } from '@/services/enterprise-id.service';
import { logAccountingEvent } from '@/subapps/accounting/services/accounting-audit-service';
import { invoiceAmountDueNow } from '@/subapps/accounting/services/payments/invoice-payment-link';
import type { Invoice } from '@/subapps/accounting/types';
import type { InvoiceCheckoutRequestBody, InvoiceCheckoutResponse } from '@/subapps/accounting/types/online-payment';
import type { IAccountingRepository } from '@/subapps/accounting/types/interfaces';

import type { InvoicePayableSubject } from '@/server/payments/payable-subject';
import { closePendingCheckoutsOf } from '@/server/payments/payment-checkout-closing';
import { createPaymentCheckout, type PaymentCheckoutRecord } from '@/server/payments/payment-checkout-store';

export interface StartInvoiceCheckoutInput extends InvoiceCheckoutRequestBody {
  readonly shareId: string;
  /** Η δημόσια αρχή της εφαρμογής (`publicOrigin()`), για τις διευθύνσεις επιστροφής / webhook. */
  readonly origin: string;
  readonly nowMs: number;
}

/** Η διαδρομή επιστροφής δείχνει τον ΙΔΙΟ σύνδεσμο; (`/shared/<token>` με token που λύνεται στο `shareId`) */
async function returnPathBelongsToShare(db: Firestore, returnPath: string, shareId: string): Promise<boolean> {
  const match = /^\/shared\/([^/?#]+)$/.exec(returnPath);
  if (match === null) return false;
  const token = decodeURIComponent(match[1]);
  if (!isPlausibleShareToken(token)) return false;
  const share = await findActiveShareByToken(db, token);
  return share?.id === shareId;
}

function minorUnitsOf(amount: number): number {
  return Math.round(amount * 100);
}

function newCheckoutRecord(
  input: StartInvoiceCheckoutInput, subject: InvoicePayableSubject, companyId: string, provider: PaymentProvider, amountMinor: number,
): PaymentCheckoutRecord {
  const createdAt = new Date(input.nowMs).toISOString();
  return {
    checkoutId: generatePaymentCheckoutId(), companyId, subject,
    provider: provider.id, method: input.method, amountMinor, currency: 'EUR', status: 'pending',
    providerReference: null, paymentReference: null, lastFailure: null, marketplace: null, createdAt,
    expiresAt: new Date(input.nowMs + CHECKOUT_LIFETIME_MS).toISOString(), updatedAt: createdAt,
  };
}

async function recordCheckoutStarted(
  repository: IAccountingRepository, record: PaymentCheckoutRecord, subject: InvoicePayableSubject,
): Promise<void> {
  await logAccountingEvent(repository, {
    eventType: 'INVOICE_PAYMENT_CHECKOUT_STARTED',
    entityType: 'invoice',
    entityId: subject.invoiceId,
    userId: linkHolderActor(subject.shareId),
    details: `Online payment started (${record.method}, €${(record.amountMinor / 100).toFixed(2)})`,
    metadata: { checkoutId: record.checkoutId, provider: record.provider, method: record.method, amountMinor: record.amountMinor },
  });
}

/** Ξεκινά τη συνεδρία στον πάροχο — ο ΕΝΑΣ δρόμος (`launchCheckoutAtProvider`). Αποτυχία ⇒ ονομασμένη άρνηση. */
function launchAtProvider(
  db: Firestore, provider: PaymentProvider, record: PaymentCheckoutRecord, input: StartInvoiceCheckoutInput, invoice: Invoice,
): Promise<InvoiceCheckoutResponse> {
  return launchCheckoutAtProvider(db, provider, record, {
    description: `${invoice.series}-${invoice.number}`, locale: input.locale, origin: input.origin,
  });
}

export async function startInvoicePaymentCheckout(
  db: Firestore, input: StartInvoiceCheckoutInput,
): Promise<InvoiceCheckoutResponse> {
  const shared = await readSharedInvoice(db, { shareId: input.shareId, nowMs: input.nowMs });
  if (shared.kind === 'refused') return { status: 'refused', reason: shared.reason };
  if (!(await returnPathBelongsToShare(db, input.returnPath, input.shareId))) return { status: 'refused', reason: 'link-inactive' };

  const provider = paymentProviderForCompany(shared.share.companyId);
  if (provider === null || !provider.methods.includes(input.method)) return { status: 'refused', reason: 'method-unavailable' };
  const amountMinor = minorUnitsOf(invoiceAmountDueNow(shared.invoice));
  if (shared.invoice.currency !== 'EUR' || amountMinor <= 0) return { status: 'refused', reason: 'not-payable' };

  const subject: InvoicePayableSubject = { kind: 'invoice', invoiceId: shared.invoice.invoiceId, shareId: input.shareId };
  await closePendingCheckoutsOf(db, provider, subject);
  const record = newCheckoutRecord(input, subject, shared.share.companyId, provider, amountMinor);
  await createPaymentCheckout(db, record);
  await recordCheckoutStarted(shared.repository, record, subject);
  return launchAtProvider(db, provider, record, input, shared.invoice);
}
