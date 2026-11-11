import 'server-only';

/**
 * @fileoverview Ο σύνδεσμος πληρωμής που φεύγει **μέσα στο email** του τιμολογίου (ADR-ACC-018 §16)
 * @description Ο σύνδεσμος γεννιέται **από τον ίδιο γραφέα** με το email (`send-email`): ένα αίτημα, ένας σύνδεσμος,
 *   που μπαίνει και στο σώμα (κουμπί) και στο συνημμένο PDF. Πρότυπο Stripe: hosted invoice URL στο email **και**
 *   στο υποσέλιδο του PDF.
 *
 *   - Περνά από τον ΕΝΑ γραφέα συνδέσμων (`createShareOnServer`): ίδιος κριτής (`invoicePaymentAuthority`), ίδια
 *     πολιτική είδους (λήξη 30 ημερών), ίδιο ίχνος. Η «ετικέτα» είναι ο παραλήπτης, ώστε η λίστα ενεργών
 *     συνδέσμων να λέει ποιος σύνδεσμος πήγε σε ποιον.
 *   - **Καμία αποτυχία εδώ δεν σταματά το email.** Χωρίς δημόσια διεύθυνση (`publicOrigin() === null`) ή αν ο
 *     γραφέας αρνηθεί, φεύγει το email όπως πριν, χωρίς σύνδεσμο. Ποτέ σχετικός ή μαντεμένος σύνδεσμος.
 *   - Αν αποτύχει η **αποστολή**, ο σύνδεσμος ανακαλείται (`revokeInvoiceEmailPaymentLink`): κανείς δεν τον έλαβε.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { joinOrigin, publicOrigin } from '@/lib/http/public-origin';
import { shareLinkPath } from '@/lib/sharing/share-token';
import { createModuleLogger } from '@/lib/telemetry';
import { createShareOnServer, type ShareCreator } from '@/server/sharing/share-create';
import { revokeShareOnServer } from '@/server/sharing/share-revoke';
import { SHARE_LABEL_MAX_LENGTH } from '@/services/sharing/share-resolve-contract';
import { invoiceAmountDueNow, isPayableByLink } from '@/subapps/accounting/services/payments/invoice-payment-link';
import type { Invoice } from '@/subapps/accounting/types';

const logger = createModuleLogger('InvoiceEmailPaymentLink');

export interface InvoiceEmailPaymentLink {
  readonly shareId: string;
  readonly url: string;
}

/** Ο σύνδεσμος για το email, ή `null` όταν δεν έχει νόημα (δεν οφείλεται ποσό) ή δεν μπορεί να γίνει. */
export async function mintInvoiceEmailPaymentLink(
  db: Firestore, creator: ShareCreator, invoice: Invoice, recipientEmail: string,
): Promise<InvoiceEmailPaymentLink | null> {
  if (!isPayableByLink(invoice) || invoiceAmountDueNow(invoice) <= 0) return null;
  const origin = publicOrigin();
  if (origin === null) {
    logger.warn('NEXT_PUBLIC_APP_URL not configured — invoice email sent without a payment link', { invoiceId: invoice.invoiceId });
    return null;
  }
  const outcome = await createShareOnServer(db, creator, {
    entityType: 'invoice_payment',
    entityId: invoice.invoiceId,
    label: recipientEmail.slice(0, SHARE_LABEL_MAX_LENGTH),
  });
  if (!outcome.ok) {
    logger.warn('Payment link refused — invoice email sent without it', {
      invoiceId: invoice.invoiceId, refusal: outcome.refusal, reason: outcome.reason ?? null,
    });
    return null;
  }
  return { shareId: outcome.result.shareId, url: joinOrigin(origin, shareLinkPath(outcome.result.token)) };
}

/** Το email δεν έφυγε ⇒ κανείς δεν έλαβε τον σύνδεσμο ⇒ ανάκληση. Αποτυχία ανάκλησης καταγράφεται, δεν πετά. */
export async function revokeInvoiceEmailPaymentLink(db: Firestore, actor: ShareCreator, shareId: string): Promise<void> {
  try {
    await revokeShareOnServer(db, actor, shareId);
  } catch (error) {
    logger.error('Could not revoke the payment link of an unsent invoice email', {
      shareId, error: error instanceof Error ? error.message : String(error),
    });
  }
}
