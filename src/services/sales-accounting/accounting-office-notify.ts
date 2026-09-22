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
import type { SalesAccountingEvent, SalesAccountingResult, SalesAccountingEventType } from './types';
import { NOTIFICATION_EVENTS, type NotificationEventCode } from '@/config/notification-events';
import {
  type AccountingNotification,
  VAT_DIVISOR,
  resolveAccountingEmail,
  accountingInvoiceUrl,
  htmlInfoRow,
  htmlTotalRow,
  htmlCard,
  htmlDepositCard,
  htmlNotificationHeader,
  htmlPartyCards,
  htmlInvoiceLink,
  textNotificationHeader,
  textInvoiceLink,
  type NotificationDocumentRef,
  formatEuro,
  formatPaymentMethod,
} from './notification-helpers';

// ============================================================================
// EVENT CODE MAPPING (ADR-326 Phase 3)
// ============================================================================

const SALES_EVENT_TO_NOTIFICATION_CODE = {
  deposit_invoice:    NOTIFICATION_EVENTS.SALE_DEPOSIT_INVOICE,
  final_sale_invoice: NOTIFICATION_EVENTS.SALE_FINAL_INVOICE,
  credit_invoice:     NOTIFICATION_EVENTS.SALE_CREDIT_INVOICE,
  reservation_notify: NOTIFICATION_EVENTS.RESERVATION_CREATED,
} as const satisfies Record<SalesAccountingEventType, NotificationEventCode>;

// ============================================================================
// NOTIFICATION BUILDERS
// ============================================================================

function buildDepositNotification(
  event: SalesAccountingEvent & { eventType: 'deposit_invoice' },
  result: SalesAccountingResult
): AccountingNotification {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const netAmount = event.depositAmount / VAT_DIVISOR;
  const vatAmount = event.depositAmount - netAmount;
  const invoiceUrl = accountingInvoiceUrl(result.invoiceId);

  const subject = `Νέα κράτηση — ${event.propertyName} (${formatEuro(event.depositAmount)})`;
  const doc: NotificationDocumentRef = { label: 'Τιμολόγιο', value: invoiceRef };

  const contentHtml = `
    ${htmlNotificationHeader('Κράτηση Μονάδας — Τιμολόγιο Προκαταβολής', doc)}

    ${htmlPartyCards(event)}

    ${htmlDepositCard({ net: netAmount, vat: vatAmount, total: event.depositAmount, paymentMethod: event.paymentMethod })}

    ${htmlInvoiceLink('Προβολή τιμολογίου', invoiceUrl)}
  `;

  const html = wrapInBrandedTemplate({ contentHtml });

  const text = [
    ...textNotificationHeader('ΚΡΑΤΗΣΗ ΜΟΝΑΔΑΣ — ΤΙΜΟΛΟΓΙΟ ΠΡΟΚΑΤΑΒΟΛΗΣ', doc, event),
    ``,
    `Καθαρό ποσό: ${formatEuro(netAmount)}`,
    `ΦΠΑ 24%: ${formatEuro(vatAmount)}`,
    `Σύνολο: ${formatEuro(event.depositAmount)}`,
    `Τρόπος πληρωμής: ${formatPaymentMethod(event.paymentMethod)}`,
    ``,
    ...textInvoiceLink(invoiceUrl),
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
  const invoiceUrl = accountingInvoiceUrl(result.invoiceId);

  const subject = `Πώληση — ${event.propertyName} (${formatEuro(event.finalPrice)})`;
  const doc: NotificationDocumentRef = { label: 'Τιμολόγιο', value: invoiceRef };

  const contentHtml = `
    ${htmlNotificationHeader('Πώληση Μονάδας — Τιμολόγιο Υπολοίπου', doc)}

    ${htmlPartyCards(event)}

    ${htmlCard('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ', [
      htmlInfoRow('Τελική τιμή πώλησης', formatEuro(event.finalPrice)),
      htmlInfoRow('Ήδη τιμολογημένο (προκαταβολή)', formatEuro(event.depositAlreadyInvoiced)),
      htmlInfoRow('Υπόλοιπο (καθαρό)', formatEuro(netRemaining)),
      htmlInfoRow('ΦΠΑ 24%', formatEuro(vatRemaining)),
      htmlTotalRow('Υπόλοιπο (με ΦΠΑ)', formatEuro(remaining)),
      htmlInfoRow('Τρόπος πληρωμής', formatPaymentMethod(event.paymentMethod)),
    ].join(''))}

    ${htmlInvoiceLink('Προβολή τιμολογίου', invoiceUrl)}
  `;

  const html = wrapInBrandedTemplate({ contentHtml });

  const text = [
    ...textNotificationHeader('ΠΩΛΗΣΗ ΜΟΝΑΔΑΣ — ΤΙΜΟΛΟΓΙΟ ΥΠΟΛΟΙΠΟΥ', doc, event),
    ``,
    `Τελική τιμή: ${formatEuro(event.finalPrice)}`,
    `Προκαταβολή: ${formatEuro(event.depositAlreadyInvoiced)}`,
    `Υπόλοιπο (καθαρό): ${formatEuro(netRemaining)}`,
    `ΦΠΑ 24%: ${formatEuro(vatRemaining)}`,
    `Υπόλοιπο (με ΦΠΑ): ${formatEuro(remaining)}`,
    ``,
    ...textInvoiceLink(invoiceUrl),
  ].join('\n');

  return { subject, html, text };
}

function buildCreditNotification(
  event: SalesAccountingEvent & { eventType: 'credit_invoice' },
  result: SalesAccountingResult
): AccountingNotification {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const netAmount = event.creditAmount / VAT_DIVISOR;
  const vatAmount = event.creditAmount - netAmount;
  const invoiceUrl = accountingInvoiceUrl(result.invoiceId);

  const subject = `Ακύρωση — ${event.propertyName} (${formatEuro(event.creditAmount)})`;
  const doc: NotificationDocumentRef = { label: 'Πιστωτικό', value: invoiceRef };

  const contentHtml = `
    ${htmlNotificationHeader(`${escapeHtml(event.reason)} — Πιστωτικό Τιμολόγιο`, doc)}

    ${htmlPartyCards(event)}

    ${htmlCard('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ', [
      htmlInfoRow('Καθαρό ποσό επιστροφής', formatEuro(netAmount)),
      htmlInfoRow('ΦΠΑ 24%', formatEuro(vatAmount)),
      htmlTotalRow('Σύνολο επιστροφής (με ΦΠΑ)', formatEuro(event.creditAmount)),
    ].join(''))}

    ${htmlCard('ΑΙΤΙΟΛΟΓΙΑ', `<p style="margin:0;font-size:14px;color:${BRAND.navyDark};">${escapeHtml(event.reason)}</p>`)}

    ${htmlInvoiceLink('Προβολή πιστωτικού', invoiceUrl)}
  `;

  const html = wrapInBrandedTemplate({ contentHtml });

  const text = [
    ...textNotificationHeader(`${event.reason.toUpperCase()} — ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ`, doc, event),
    ``,
    `Καθαρό ποσό: ${formatEuro(netAmount)}`,
    `ΦΠΑ 24%: ${formatEuro(vatAmount)}`,
    `Σύνολο: ${formatEuro(event.creditAmount)}`,
    `Αιτιολογία: ${event.reason}`,
    ``,
    ...textInvoiceLink(invoiceUrl),
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
    ? htmlDepositCard({ net: netAmount, vat: vatAmount, total: event.depositAmount, paymentMethod: event.paymentMethod })
    : `<p style="margin:0 0 20px;font-size:14px;color:${BRAND.gray};padding:12px 16px;background-color:${BRAND.bgLight};border-radius:6px;border:1px solid ${BRAND.border};">
        Η κράτηση δεν συνοδεύεται από προκαταβολή.
      </p>`;

  const contentHtml = `
    ${htmlNotificationHeader('Νέα Κράτηση Μονάδας', null)}

    ${htmlPartyCards(event)}

    ${financialSection}
  `;

  const html = wrapInBrandedTemplate({ contentHtml });

  const textLines = [...textNotificationHeader('ΝΕΑ ΚΡΑΤΗΣΗ ΜΟΝΑΔΑΣ', null, event)];

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
 * Recipient resolved via OrgStructure (ADR-326 Phase 3). No env var fallback (G1).
 */
export async function notifyAccountingOffice(
  event: SalesAccountingEvent,
  result: SalesAccountingResult | null,
  companyId: string,
): Promise<void> {
  if (result !== null && !result.success) {
    console.log('[ADR-326 Notify] Skipping — invoice creation failed');
    return;
  }

  const eventCode = SALES_EVENT_TO_NOTIFICATION_CODE[event.eventType];
  const resolved = await resolveAccountingEmail(companyId, eventCode);
  if (!resolved) {
    console.warn('[ADR-326 Notify] Skipping — no email resolved from orgStructure', { companyId, eventCode });
    return;
  }

  console.log('[ADR-326 Notify] Sending', { to: resolved.email, source: resolved.source, eventCode });

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
      to: resolved.email,
      subject: notification.subject,
      textBody: notification.text,
      htmlBody: notification.html,
    });

    if (mailResult.success) {
      console.log('[ADR-326 Notify] Email sent', { messageId: mailResult.messageId, source: resolved.source });
    } else {
      console.warn('[ADR-326 Notify] Mailgun error', { error: mailResult.error, source: resolved.source });
    }
  } catch (err) {
    const msg = getErrorMessage(err);
    console.warn('[ADR-326 Notify] Failed to send email', { error: msg, companyId, eventCode });
  }
}
