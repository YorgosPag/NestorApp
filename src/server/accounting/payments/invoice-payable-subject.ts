import 'server-only';

/**
 * @fileoverview Το **τιμολόγιο** ως πληρωτέο αντικείμενο — ο handler του στο μητρώο (ADR-943 §5.6 · ADR-ACC-030 §3)
 * @description Μια κίνηση του παρόχου (πληρωμή ή επιστροφή) ⇒ **ο ΕΝΑΣ γραφέας** κινήσεων τιμολογίου
 *   (`recordInvoicePayment`), σε συναλλαγή, με **ντετερμινιστικό** `paymentId` (`πάροχος:είδος:αναφορά`): δεύτερη εκτέλεση
 *   = `duplicate`, καμία διπλή εγγραφή. Μεταφέρθηκε αυτούσιο από το `invoice-payment-settlement-sync.ts` — η συμπεριφορά
 *   της πληρωμής τιμολογίου **δεν** άλλαξε.
 */

import { createModuleLogger } from '@/lib/telemetry';
import type { PayableMovementInput, PayableMovementOutcome } from '@/server/payments/payable-subject-registry';
import type { PaymentProvider } from '@/server/payments/payment-provider';
import type { InvoicePayableSubject } from '@/server/payments/payable-subject';
import { generateDeterministicInvoicePaymentId } from '@/services/enterprise-id.service';
import { recordInvoicePayment } from '@/subapps/accounting/services/repository/accounting-repo-invoice-payments';
import type { InvoicePayment } from '@/subapps/accounting/types/invoice';
import { accountingToday } from '@/subapps/accounting/utils/accounting-day';
import { roundToTwo } from '@/subapps/accounting/utils/math';

const logger = createModuleLogger('InvoicePayableSubject');

/** Ο δράστης στο ίχνος: ο πάροχος, όχι ο χρήστης που έφτιαξε τον σύνδεσμο. */
function providerActor(provider: PaymentProvider): string {
  return `provider:${provider.id}`;
}

function invoicePaymentOf(input: PayableMovementInput<InvoicePayableSubject>): InvoicePayment {
  const { provider, checkout, movement } = input;
  return {
    paymentId: generateDeterministicInvoicePaymentId(`${provider.id}:${movement.kind}:${movement.reference}`),
    date: accountingToday(new Date(movement.occurredAt)),
    amount: roundToTwo(movement.amountMinor / 100),
    method: checkout.method,
    notes: null,
    kind: movement.kind,
    provider: provider.id,
    providerReference: movement.reference,
    checkoutId: checkout.checkoutId,
  };
}

/** Καταγράφει μία κίνηση στο τιμολόγιο. Ιδεμποτικό. Σφάλμα βάσης ⇒ ρίχνει (ο καλών ξαναδοκιμάζει). */
export async function recordInvoiceMovement(
  input: PayableMovementInput<InvoicePayableSubject>,
): Promise<PayableMovementOutcome> {
  const { checkout, subject, movement, provider } = input;
  const outcome = await recordInvoicePayment({ companyId: checkout.companyId }, subject.invoiceId, {
    payment: invoicePaymentOf(input),
    actor: providerActor(provider),
  });
  if (outcome.kind === 'invoice-absent') {
    logger.error('Provider money for an invoice that cannot be found — needs a human', {
      checkoutId: checkout.checkoutId, invoiceId: subject.invoiceId, reference: movement.reference,
    });
    return 'subject-absent';
  }
  return outcome.kind;
}
