/**
 * @fileoverview Sales-Accounting Email Notification (ADR-198)
 * @description Στέλνει email ειδοποίηση στο λογιστήριο όταν δημιουργείται
 *              τιμολόγιο από sales event (κράτηση, πώληση, ακύρωση)
 * @pattern Fire-and-forget — δεν μπλοκάρει τη ροή πώλησης
 */

import 'server-only';

import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { GREEK_VAT_RATES } from '@/subapps/accounting/services/config/vat-config';
// Server-safe: avoids @/lib/intl-utils → react-i18next → createContext
// formatEuro/formatDate kept local intentionally (server-only + 2-decimal financial formatting)
import {
  buildReservationConfirmationEmail,
  buildCancellationConfirmationEmail,
  wrapInBrandedTemplate,
  BRAND,
  escapeHtml,
} from '@/services/email-templates';
import type { SalesAccountingEvent, SalesAccountingResult } from './types';

// ============================================================================
// VAT — derived from centralized vat-config (SSoT)
// ============================================================================

/** Standard Greek VAT rate, derived from GREEK_VAT_RATES (vat-config.ts SSoT) */
const STANDARD_VAT_RATE = GREEK_VAT_RATES.find(r => r.code === 'standard_24')!.rate;
/** Divisor for extracting net amount from gross: grossAmount / VAT_DIVISOR = netAmount */
const VAT_DIVISOR = 1 + STANDARD_VAT_RATE / 100;

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

// ── Shared HTML helpers for accounting emails ──────────────────────────────

/** Single info row: label + value */
function htmlInfoRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td width="45%" style="font-size:13px;color:${BRAND.grayLight};vertical-align:top;">${label}</td>
        <td style="font-size:13px;color:${BRAND.navyDark};font-weight:500;">${value}</td>
      </tr>
    </table>`;
}

/** Total / highlighted row */
function htmlTotalRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;background-color:${BRAND.bgLight};border-radius:4px;">
      <tr>
        <td width="45%" style="padding:8px 12px;font-size:14px;color:${BRAND.navyDark};font-weight:600;">${label}</td>
        <td style="padding:8px 12px;font-size:14px;color:${BRAND.navy};font-weight:700;">${value}</td>
      </tr>
    </table>`;
}

/** Info card — navy header + rows */
function htmlCard(title: string, rows: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${BRAND.border};border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background-color:${BRAND.navy};padding:10px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.white};letter-spacing:0.5px;">${title}</p>
        </td>
      </tr>
      <tr><td style="padding:16px;">${rows}</td></tr>
    </table>`;
}

/** Property hierarchy rows — shared across all 3 notification types */
function buildPropertyRows(event: SalesAccountingEvent): string {
  const floorText = event.unitFloor !== null && event.unitFloor !== undefined
    ? ` — ${event.unitFloor}ος όροφος` : '';
  return [
    htmlInfoRow('Μονάδα', `${escapeHtml(event.unitName)}${floorText}`),
    event.buildingName ? htmlInfoRow('Κτίριο', escapeHtml(event.buildingName)) : '',
    event.projectName ? htmlInfoRow('Έργο', escapeHtml(event.projectName)) : '',
    event.permitTitle ? htmlInfoRow('Τίτλος Αδείας', escapeHtml(event.permitTitle)) : '',
    event.projectAddress ? htmlInfoRow('Διεύθυνση', escapeHtml(event.projectAddress)) : '',
    event.companyName ? htmlInfoRow('Κατασκευαστική', escapeHtml(event.companyName)) : '',
  ].filter(Boolean).join('');
}

/** CTA button — link to invoice/invoices list */
function htmlButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="background-color:${BRAND.navy};border-radius:6px;padding:12px 24px;">
          <a href="${url}" style="color:${BRAND.white};text-decoration:none;font-size:14px;font-weight:600;">${label}</a>
        </td>
      </tr>
    </table>`;
}

// ── Branded HTML + plain-text builders ──────────────────────────────────────

interface AccountingNotification {
  subject: string;
  html: string;
  text: string;
}

function buildDepositNotification(
  event: SalesAccountingEvent & { eventType: 'deposit_invoice' },
  result: SalesAccountingResult
): AccountingNotification {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const appUrl = getAppBaseUrl();
  const netAmount = event.depositAmount / VAT_DIVISOR;
  const vatAmount = event.depositAmount - netAmount;
  const invoiceUrl = `${appUrl}/accounting/invoices${result.invoiceId ? `?view=${result.invoiceId}` : ''}`;

  const subject = `Νέα κράτηση — ${event.unitName} (${formatEuro(event.depositAmount)})`;

  // HTML
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

  // Plain-text fallback
  const text = [
    `ΚΡΑΤΗΣΗ ΜΟΝΑΔΑΣ — ΤΙΜΟΛΟΓΙΟ ΠΡΟΚΑΤΑΒΟΛΗΣ`,
    `Ημερομηνία: ${formatDate(new Date())}  |  Τιμολόγιο: ${invoiceRef}`,
    ``,
    `Μονάδα: ${event.unitName}`,
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

  const subject = `Πώληση — ${event.unitName} (${formatEuro(event.finalPrice)})`;

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
    `Μονάδα: ${event.unitName}`,
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

  const subject = `Ακύρωση — ${event.unitName} (${formatEuro(event.creditAmount)})`;

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
    `Μονάδα: ${event.unitName}`,
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
    let notification: AccountingNotification;

    switch (event.eventType) {
      case 'deposit_invoice':
        notification = buildDepositNotification(event, result);
        break;
      case 'final_sale_invoice':
        notification = buildFinalSaleNotification(event, result);
        break;
      case 'credit_invoice':
        notification = buildCreditNotification(event, result);
        break;
      case 'reservation_notify':
        // Reservation notify δεν στέλνει email στο λογιστήριο — μόνο buyer email
        console.log('[ADR-198 Notify] Skipping accounting email for reservation_notify');
        return;
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
    // Fire-and-forget — η πώληση και το τιμολόγιο πέτυχαν ήδη
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ADR-198 Notify] Failed to send email: ${msg}`);
  }
}

// ============================================================================
// BUYER NOTIFICATION — Branded HTML Reservation Confirmation
// ============================================================================

/**
 * Στέλνει branded HTML email επιβεβαίωσης κράτησης στον αγοραστή.
 *
 * Fire-and-forget: αν αποτύχει, δεν επηρεάζει τη ροή πώλησης.
 * Στέλνεται ΜΟΝΟ αν ο αγοραστής έχει email.
 * Χρησιμοποιεί το κεντρικοποιημένο email template system (Pagonis Energo branding).
 */
export async function notifyBuyerReservation(
  event: SalesAccountingEvent & { eventType: 'deposit_invoice' | 'reservation_notify' },
  result: SalesAccountingResult | null,
  buyerEmail: string,
  buyerName: string
): Promise<void> {
  // Skip αν result υπάρχει αλλά δεν πέτυχε
  if (result !== null && !result.success) {
    console.log('[Buyer Notify] Skipping — invoice creation failed');
    return;
  }

  console.log(`[Buyer Notify] Sending branded reservation confirmation to ${buyerEmail}`);

  try {
    const invoiceRef = result?.invoiceNumber ? `A-${result.invoiceNumber}` : null;
    const { subject, html, text } = buildReservationConfirmationEmail({
      buyerName,
      unitName: event.unitName,
      unitFloor: event.unitFloor,
      buildingName: event.buildingName,
      projectName: event.projectName,
      projectAddress: event.projectAddress,
      companyName: event.companyName,
      depositAmount: event.depositAmount,
      paymentMethod: event.paymentMethod,
      invoiceRef,
    });

    const mailResult = await sendReplyViaMailgun({
      to: buyerEmail,
      subject,
      textBody: text,
      htmlBody: html,
    });

    if (mailResult.success) {
      console.log(`[Buyer Notify] Branded email sent — messageId: ${mailResult.messageId}`);
    } else {
      console.warn(`[Buyer Notify] Mailgun error: ${mailResult.error}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Buyer Notify] Failed to send buyer email: ${msg}`);
  }
}

// ============================================================================
// BUYER NOTIFICATION — Branded HTML Cancellation Confirmation
// ============================================================================

/**
 * Στέλνει branded HTML email ειδοποίησης ακύρωσης στον αγοραστή.
 *
 * Fire-and-forget: αν αποτύχει, δεν επηρεάζει τη ροή ακύρωσης.
 * Στέλνεται ΜΟΝΟ αν ο αγοραστής έχει email.
 */
export async function notifyBuyerCancellation(
  event: SalesAccountingEvent & { eventType: 'credit_invoice' },
  result: SalesAccountingResult,
  buyerEmail: string,
  buyerName: string
): Promise<void> {
  if (!result.success) {
    console.log('[Buyer Notify] Skipping cancellation — credit invoice creation failed');
    return;
  }

  console.log(`[Buyer Notify] Sending branded cancellation confirmation to ${buyerEmail}`);

  try {
    const creditNoteRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : null;
    const { subject, html, text } = buildCancellationConfirmationEmail({
      buyerName,
      unitName: event.unitName,
      unitFloor: event.unitFloor,
      buildingName: event.buildingName,
      projectName: event.projectName,
      projectAddress: event.projectAddress,
      companyName: event.companyName,
      creditAmount: event.creditAmount,
      paymentMethod: event.paymentMethod,
      reason: event.reason,
      creditNoteRef,
    });

    const mailResult = await sendReplyViaMailgun({
      to: buyerEmail,
      subject,
      textBody: text,
      htmlBody: html,
    });

    if (mailResult.success) {
      console.log(`[Buyer Notify] Cancellation email sent — messageId: ${mailResult.messageId}`);
    } else {
      console.warn(`[Buyer Notify] Mailgun cancellation error: ${mailResult.error}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Buyer Notify] Failed to send cancellation email: ${msg}`);
  }
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Server-safe currency formatter — kept local intentionally.
 * Cannot import @/lib/intl-utils (pulls react-i18next → createContext in server-only context).
 * Uses minimumFractionDigits: 2 (financial emails always show cents), unlike formatCurrency(0-2).
 * @see @/lib/intl-utils formatCurrency — client-side equivalent
 */
function formatEuro(amount: number): string {
  return new Intl.NumberFormat('el', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

/**
 * Server-safe date formatter — kept local for same server-only constraint as formatEuro.
 * @see @/lib/intl-utils formatDateTime — client-side equivalent
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Τραπεζική κατάθεση',
  cash: 'Μετρητά',
  check: 'Επιταγή',
  credit_card: 'Πιστωτική κάρτα',
  debit_card: 'Χρεωστική κάρτα',
};

function formatPaymentMethod(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}
