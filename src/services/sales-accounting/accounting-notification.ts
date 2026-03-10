/**
 * @fileoverview Sales-Accounting Email Notification (ADR-198)
 * @description Στέλνει email ειδοποίηση στο λογιστήριο όταν δημιουργείται
 *              τιμολόγιο από sales event (κράτηση, πώληση, ακύρωση)
 * @pattern Fire-and-forget — δεν μπλοκάρει τη ροή πώλησης
 */

import 'server-only';

import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import type { SalesAccountingEvent, SalesAccountingResult } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Email λογιστηρίου — διαβάζεται από env var ή fallback σε null
 * Αν δεν υπάρχει, η ειδοποίηση δεν στέλνεται (graceful skip)
 */
function getAccountingEmail(): string | null {
  return process.env.ACCOUNTING_NOTIFY_EMAIL?.trim() || null;
}

/** Base URL της εφαρμογής */
function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://nestor-app.vercel.app';
}

// ============================================================================
// EMAIL BUILDERS
// ============================================================================

function buildDepositNotification(
  event: SalesAccountingEvent & { eventType: 'deposit_invoice' },
  result: SalesAccountingResult
): { subject: string; body: string } {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const appUrl = getAppBaseUrl();

  return {
    subject: `🧾 Νέα κράτηση — ${event.unitName} (${formatEuro(event.depositAmount)})`,
    body: [
      `ΚΡΑΤΗΣΗ ΜΟΝΑΔΑΣ — ΤΙΜΟΛΟΓΙΟ ΠΡΟΚΑΤΑΒΟΛΗΣ`,
      ``,
      `Μονάδα: ${event.unitName}`,
      `Ποσό προκαταβολής: ${formatEuro(event.depositAmount)} (με ΦΠΑ 24%)`,
      `Τρόπος πληρωμής: Τραπεζική κατάθεση`,
      `Τιμολόγιο: ${invoiceRef}`,
      ``,
      `Δείτε τα τιμολόγια:`,
      `${appUrl}/accounting/invoices`,
      ``,
      `— Nestor App (αυτόματη ειδοποίηση)`,
    ].join('\n'),
  };
}

function buildFinalSaleNotification(
  event: SalesAccountingEvent & { eventType: 'final_sale_invoice' },
  result: SalesAccountingResult
): { subject: string; body: string } {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const remaining = event.finalPrice - event.depositAlreadyInvoiced;
  const appUrl = getAppBaseUrl();

  return {
    subject: `🏠 Πώληση — ${event.unitName} (${formatEuro(event.finalPrice)})`,
    body: [
      `ΠΩΛΗΣΗ ΜΟΝΑΔΑΣ — ΤΙΜΟΛΟΓΙΟ ΥΠΟΛΟΙΠΟΥ`,
      ``,
      `Μονάδα: ${event.unitName}`,
      `Τελική τιμή: ${formatEuro(event.finalPrice)}`,
      `Ήδη τιμολογημένο (προκαταβολή): ${formatEuro(event.depositAlreadyInvoiced)}`,
      `Υπόλοιπο τιμολογίου: ${formatEuro(remaining)} (με ΦΠΑ 24%)`,
      `Τιμολόγιο: ${invoiceRef}`,
      ``,
      `Δείτε τα τιμολόγια:`,
      `${appUrl}/accounting/invoices`,
      ``,
      `— Nestor App (αυτόματη ειδοποίηση)`,
    ].join('\n'),
  };
}

function buildCreditNotification(
  event: SalesAccountingEvent & { eventType: 'credit_invoice' },
  result: SalesAccountingResult
): { subject: string; body: string } {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const appUrl = getAppBaseUrl();

  return {
    subject: `❌ Ακύρωση — ${event.unitName} (${formatEuro(event.creditAmount)})`,
    body: [
      `ΑΚΥΡΩΣΗ ΚΡΑΤΗΣΗΣ — ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ`,
      ``,
      `Μονάδα: ${event.unitName}`,
      `Ποσό επιστροφής: ${formatEuro(event.creditAmount)} (με ΦΠΑ 24%)`,
      `Αιτία: ${event.reason}`,
      `Πιστωτικό: ${invoiceRef}`,
      ``,
      `Δείτε τα τιμολόγια:`,
      `${appUrl}/accounting/invoices`,
      ``,
      `— Nestor App (αυτόματη ειδοποίηση)`,
    ].join('\n'),
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Στέλνει email ειδοποίηση στο λογιστήριο μετά από επιτυχή δημιουργία τιμολογίου.
 *
 * Fire-and-forget: αν αποτύχει, δεν επηρεάζει τη ροή πώλησης.
 * Αν δεν υπάρχει ACCOUNTING_NOTIFY_EMAIL, δεν στέλνεται τίποτα.
 */
export async function notifyAccountingOffice(
  event: SalesAccountingEvent,
  result: SalesAccountingResult
): Promise<void> {
  // Skip αν δεν πέτυχε η δημιουργία τιμολογίου
  if (!result.success) {
    console.log('[ADR-198 Notify] Skipping — invoice creation failed');
    return;
  }

  // Skip αν δεν υπάρχει email λογιστηρίου
  const accountingEmail = getAccountingEmail();
  if (!accountingEmail) {
    console.log('[ADR-198 Notify] Skipping — ACCOUNTING_NOTIFY_EMAIL not set');
    return;
  }

  console.log(`[ADR-198 Notify] Sending to ${accountingEmail} for ${event.eventType}`);

  try {
    let subject: string;
    let body: string;

    switch (event.eventType) {
      case 'deposit_invoice': {
        const notification = buildDepositNotification(event, result);
        subject = notification.subject;
        body = notification.body;
        break;
      }
      case 'final_sale_invoice': {
        const notification = buildFinalSaleNotification(event, result);
        subject = notification.subject;
        body = notification.body;
        break;
      }
      case 'credit_invoice': {
        const notification = buildCreditNotification(event, result);
        subject = notification.subject;
        body = notification.body;
        break;
      }
    }

    const mailResult = await sendReplyViaMailgun({
      to: accountingEmail,
      subject,
      textBody: body,
    });

    if (mailResult.success) {
      console.log(`[ADR-198 Notify] Email sent successfully — messageId: ${mailResult.messageId}`);
    } else {
      console.warn(`[ADR-198 Notify] Mailgun returned error: ${mailResult.error}`);
    }
  } catch (err) {
    // Fire-and-forget — η πώληση και το τιμολόγιο πέτυχαν ήδη
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ADR-198 Notify] Failed to send email: ${msg}`);
  }
}

// ============================================================================
// UTILITY
// ============================================================================

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount);
}
