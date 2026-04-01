/**
 * @fileoverview Accounting-office email notifications (ADR-198)
 * @description Builds and sends branded HTML email notifications to the
 *              accounting department for deposit, sale, credit, and reservation events.
 * @pattern Fire-and-forget — does not block the sales flow
 */

import 'server-only';

import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { wrapInBrandedTemplate, escapeHtml } from '@/services/email-templates';
import { BRAND } from '@/services/email-templates';
import { getErrorMessage } from '@/lib/error-utils';
import type { SalesAccountingEvent, SalesAccountingResult } from './types';
import {
  type AccountingNotification,
  VAT_DIVISOR,
  getAccountingEmail,
  getAppBaseUrl,
  htmlInfoRow,
  htmlTotalRow,
  htmlCard,
  htmlButton,
  buildPropertyRows,
  formatEuro,
  formatDate,
  formatPaymentMethod,
} from './notification-helpers';

// ============================================================================
// NOTIFICATION BUILDERS
// ============================================================================

function buildDepositNotification(
  event: SalesAccountingEvent & { eventType: 'deposit_invoice' },
  result: SalesAccountingResult
): AccountingNotification {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const appUrl = getAppBaseUrl();
  const netAmount = event.depositAmount / VAT_DIVISOR;
  const vatAmount = event.depositAmount - netAmount;
  const invoiceUrl = `${appUrl}/accounting/invoices${result.invoiceId ? `?view=${result.invoiceId}` : ''}`;

  const subject = `Νέα κράτηση — ${event.propertyName} (${formatEuro(event.depositAmount)})`;

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.navyDark};">
      <strong>Κράτηση Μονάδας — Τιμολόγιο Προκαταβολής</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.gray};">
      Ημερομηνία: ${formatDate(new Date())} &nbsp;|&nbsp; Τιμολόγιο: <strong>${invoiceRef}</strong>
    </p>

    ${htmlCard('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ', buildPropertyRows(event))}

    ${htmlCard('ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ', htmlInfoRow('Αγοραστής', escapeHtml(event.buyerName ?? 'Μη καταχωρημένος')))}

    ${htmlCard('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ', [
      htmlInfoRow('Καθαρό ποσό', formatEuro(netAmount)),
      htmlInfoRow('ΦΠΑ 24%', formatEuro(vatAmount)),
      htmlTotalRow('Σύνολο (με ΦΠΑ)', formatEuro(event.depositAmount)),
      htmlInfoRow('Τρόπος πληρωμής', formatPaymentMethod(event.paymentMethod)),
    ].join(''))}

    ${htmlButton('Προβολή τιμολογίου', invoiceUrl)}
  `;

  const html = wrapInBrandedTemplate({ contentHtml });

  const text = [
    `ΚΡΑΤΗΣΗ ΜΟΝΑΔΑΣ — ΤΙΜΟΛΟΓΙΟ ΠΡΟΚΑΤΑΒΟΛΗΣ`,
    `Ημερομηνία: ${formatDate(new Date())}  |  Τιμολόγιο: ${invoiceRef}`,
    ``,
    `Μονάδα: ${event.propertyName}`,
    ...(event.companyName ? [`Εταιρεία: ${event.companyName}`] : []),
    ...(event.projectName ? [`Έργο: ${event.projectName}`] : []),
    `Αγοραστής: ${event.buyerName ?? 'Μη καταχωρημένος'}`,
    ``,
    `Καθαρό ποσό: ${formatEuro(netAmount)}`,
    `ΦΠΑ 24%: ${formatEuro(vatAmount)}`,
    `Σύνολο: ${formatEuro(event.depositAmount)}`,
    `Τρόπος πληρωμής: ${formatPaymentMethod(event.paymentMethod)}`,
    ``,
    `Προβολή: ${invoiceUrl}`,
  ].join('\n');

  return { subject, html, text };
}

function buildFinalSaleNotification(
  event: SalesAccountingEvent & { eventType: 'final_sale_invoice' },
  result: SalesAccountingResult
): AccountingNotification {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const remaining = event.finalPrice - event.depositAlreadyInvoiced;
  const netRemaining = remaining / VAT_DIVISOR;
  const vatRemaining = remaining - netRemaining;
  const appUrl = getAppBaseUrl();
  const invoiceUrl = `${appUrl}/accounting/invoices${result.invoiceId ? `?view=${result.invoiceId}` : ''}`;

  const subject = `Πώληση — ${event.propertyName} (${formatEuro(event.finalPrice)})`;

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.navyDark};">
      <strong>Πώληση Μονάδας — Τιμολόγιο Υπολοίπου</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.gray};">
      Ημερομηνία: ${formatDate(new Date())} &nbsp;|&nbsp; Τιμολόγιο: <strong>${invoiceRef}</strong>
    </p>

    ${htmlCard('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ', buildPropertyRows(event))}

    ${htmlCard('ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ', htmlInfoRow('Αγοραστής', escapeHtml(event.buyerName ?? 'Μη καταχωρημένος')))}

    ${htmlCard('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ', [
      htmlInfoRow('Τελική τιμή πώλησης', formatEuro(event.finalPrice)),
      htmlInfoRow('Ήδη τιμολογημένο (προκαταβολή)', formatEuro(event.depositAlreadyInvoiced)),
      htmlInfoRow('Υπόλοιπο (καθαρό)', formatEuro(netRemaining)),
      htmlInfoRow('ΦΠΑ 24%', formatEuro(vatRemaining)),
      htmlTotalRow('Υπόλοιπο (με ΦΠΑ)', formatEuro(remaining)),
      htmlInfoRow('Τρόπος πληρωμής', formatPaymentMethod(event.paymentMethod)),
    ].join(''))}

    ${htmlButton('Προβολή τιμολογίου', invoiceUrl)}
  `;

  const html = wrapInBrandedTemplate({ contentHtml });

  const text = [
    `ΠΩΛΗΣΗ ΜΟΝΑΔΑΣ — ΤΙΜΟΛΟΓΙΟ ΥΠΟΛΟΙΠΟΥ`,
    `Ημερομηνία: ${formatDate(new Date())}  |  Τιμολόγιο: ${invoiceRef}`,
    ``,
    `Μονάδα: ${event.propertyName}`,
    ...(event.companyName ? [`Εταιρεία: ${event.companyName}`] : []),
    ...(event.projectName ? [`Έργο: ${event.projectName}`] : []),
    `Αγοραστής: ${event.buyerName ?? 'Μη καταχωρημένος'}`,
    ``,
    `Τελική τιμή: ${formatEuro(event.finalPrice)}`,
    `Προκαταβολή: ${formatEuro(event.depositAlreadyInvoiced)}`,
    `Υπόλοιπο (καθαρό): ${formatEuro(netRemaining)}`,
    `ΦΠΑ 24%: ${formatEuro(vatRemaining)}`,
    `Υπόλοιπο (με ΦΠΑ): ${formatEuro(remaining)}`,
    ``,
    `Προβολή: ${invoiceUrl}`,
  ].join('\n');

  return { subject, html, text };
}

function buildCreditNotification(
  event: SalesAccountingEvent & { eventType: 'credit_invoice' },
  result: SalesAccountingResult
): AccountingNotification {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const appUrl = getAppBaseUrl();
  const netAmount = event.creditAmount / VAT_DIVISOR;
  const vatAmount = event.creditAmount - netAmount;
  const invoiceUrl = `${appUrl}/accounting/invoices${result.invoiceId ? `?view=${result.invoiceId}` : ''}`;

  const subject = `Ακύρωση — ${event.propertyName} (${formatEuro(event.creditAmount)})`;

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.navyDark};">
      <strong>${escapeHtml(event.reason)} — Πιστωτικό Τιμολόγιο</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.gray};">
      Ημερομηνία: ${formatDate(new Date())} &nbsp;|&nbsp; Πιστωτικό: <strong>${invoiceRef}</strong>
    </p>

    ${htmlCard('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ', buildPropertyRows(event))}

    ${htmlCard('ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ', htmlInfoRow('Αγοραστής', escapeHtml(event.buyerName ?? 'Μη καταχωρημένος')))}

    ${htmlCard('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ', [
      htmlInfoRow('Καθαρό ποσό επιστροφής', formatEuro(netAmount)),
      htmlInfoRow('ΦΠΑ 24%', formatEuro(vatAmount)),
      htmlTotalRow('Σύνολο επιστροφής (με ΦΠΑ)', formatEuro(event.creditAmount)),
    ].join(''))}

    ${htmlCard('ΑΙΤΙΟΛΟΓΙΑ', `<p style="margin:0;font-size:14px;color:${BRAND.navyDark};">${escapeHtml(event.reason)}</p>`)}

    ${htmlButton('Προβολή πιστωτικού', invoiceUrl)}
  `;

  const html = wrapInBrandedTemplate({ contentHtml });

  const text = [
    `${event.reason.toUpperCase()} — ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ`,
    `Ημερομηνία: ${formatDate(new Date())}  |  Πιστωτικό: ${invoiceRef}`,
    ``,
    `Μονάδα: ${event.propertyName}`,
    ...(event.companyName ? [`Εταιρεία: ${event.companyName}`] : []),
    `Αγοραστής: ${event.buyerName ?? 'Μη καταχωρημένος'}`,
    ``,
    `Καθαρό ποσό: ${formatEuro(netAmount)}`,
    `ΦΠΑ 24%: ${formatEuro(vatAmount)}`,
    `Σύνολο: ${formatEuro(event.creditAmount)}`,
    `Αιτιολογία: ${event.reason}`,
    ``,
    `Προβολή: ${invoiceUrl}`,
  ].join('\n');

  return { subject, html, text };
}

function buildReservationNotifyNotification(
  event: SalesAccountingEvent & { eventType: 'reservation_notify' }
): AccountingNotification {
  const netAmount = event.depositAmount > 0 ? event.depositAmount / VAT_DIVISOR : 0;
  const vatAmount = event.depositAmount > 0 ? event.depositAmount - netAmount : 0;

  const subject = event.depositAmount > 0
    ? `Νέα κράτηση — ${event.propertyName} (${formatEuro(event.depositAmount)})`
    : `Νέα κράτηση — ${event.propertyName} (χωρίς προκαταβολή)`;

  const financialSection = event.depositAmount > 0
    ? htmlCard('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ', [
        htmlInfoRow('Καθαρό ποσό', formatEuro(netAmount)),
        htmlInfoRow('ΦΠΑ 24%', formatEuro(vatAmount)),
        htmlTotalRow('Σύνολο (με ΦΠΑ)', formatEuro(event.depositAmount)),
        htmlInfoRow('Τρόπος πληρωμής', formatPaymentMethod(event.paymentMethod)),
      ].join(''))
    : `<p style="margin:0 0 20px;font-size:14px;color:${BRAND.gray};padding:12px 16px;background-color:${BRAND.bgLight};border-radius:6px;border:1px solid ${BRAND.border};">
        Η κράτηση δεν συνοδεύεται από προκαταβολή.
      </p>`;

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.navyDark};">
      <strong>Νέα Κράτηση Μονάδας</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.gray};">
      Ημερομηνία: ${formatDate(new Date())}
    </p>

    ${htmlCard('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ', buildPropertyRows(event))}

    ${htmlCard('ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ', htmlInfoRow('Αγοραστής', escapeHtml(event.buyerName ?? 'Μη καταχωρημένος')))}

    ${financialSection}
  `;

  const html = wrapInBrandedTemplate({ contentHtml });

  const textLines = [
    `ΝΕΑ ΚΡΑΤΗΣΗ ΜΟΝΑΔΑΣ`,
    `Ημερομηνία: ${formatDate(new Date())}`,
    ``,
    `Μονάδα: ${event.propertyName}`,
    ...(event.companyName ? [`Εταιρεία: ${event.companyName}`] : []),
    ...(event.projectName ? [`Έργο: ${event.projectName}`] : []),
    `Αγοραστής: ${event.buyerName ?? 'Μη καταχωρημένος'}`,
  ];

  if (event.depositAmount > 0) {
    textLines.push(
      ``,
      `Καθαρό ποσό: ${formatEuro(netAmount)}`,
      `ΦΠΑ 24%: ${formatEuro(vatAmount)}`,
      `Σύνολο: ${formatEuro(event.depositAmount)}`,
    );
  } else {
    textLines.push(``, `Χωρίς προκαταβολή.`);
  }

  return { subject, html, text: textLines.join('\n') };
}

// ============================================================================
// MAIN DISPATCHER
// ============================================================================

/**
 * Στέλνει email ειδοποίηση στο λογιστήριο μετά από επιτυχή δημιουργία τιμολογίου.
 *
 * Fire-and-forget: αν αποτύχει, δεν επηρεάζει τη ροή πώλησης.
 * Αν δεν υπάρχει ACCOUNTING_NOTIFY_EMAIL, δεν στέλνεται τίποτα.
 */
export async function notifyAccountingOffice(
  event: SalesAccountingEvent,
  result: SalesAccountingResult | null
): Promise<void> {
  if (result !== null && !result.success) {
    console.log('[ADR-198 Notify] Skipping — invoice creation failed');
    return;
  }

  const accountingEmail = getAccountingEmail();
  if (!accountingEmail) {
    console.log('[ADR-198 Notify] Skipping — ACCOUNTING_NOTIFY_EMAIL not set');
    return;
  }

  console.log(`[ADR-198 Notify] Sending to ${accountingEmail} for ${event.eventType}`);

  try {
    let notification: AccountingNotification;

    switch (event.eventType) {
      case 'deposit_invoice':
        notification = buildDepositNotification(event, result!);
        break;
      case 'final_sale_invoice':
        notification = buildFinalSaleNotification(event, result!);
        break;
      case 'credit_invoice':
        notification = buildCreditNotification(event, result!);
        break;
      case 'reservation_notify':
        notification = buildReservationNotifyNotification(event);
        break;
    }

    const mailResult = await sendReplyViaMailgun({
      to: accountingEmail,
      subject: notification.subject,
      textBody: notification.text,
      htmlBody: notification.html,
    });

    if (mailResult.success) {
      console.log(`[ADR-198 Notify] Email sent successfully — messageId: ${mailResult.messageId}`);
    } else {
      console.warn(`[ADR-198 Notify] Mailgun returned error: ${mailResult.error}`);
    }
  } catch (err) {
    const msg = getErrorMessage(err);
    console.warn(`[ADR-198 Notify] Failed to send email: ${msg}`);
  }
}
