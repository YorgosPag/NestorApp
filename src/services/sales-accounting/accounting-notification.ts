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
import { buildReservationConfirmationEmail } from '@/services/email-templates';
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

function buildDepositNotification(
  event: SalesAccountingEvent & { eventType: 'deposit_invoice' },
  result: SalesAccountingResult
): { subject: string; body: string } {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const appUrl = getAppBaseUrl();
  const netAmount = event.depositAmount / VAT_DIVISOR;
  const vatAmount = event.depositAmount - netAmount;

  return {
    subject: `🧾 Νέα κράτηση — ${event.unitName} (${formatEuro(event.depositAmount)})`,
    body: [
      `═══════════════════════════════════════`,
      `  ΚΡΑΤΗΣΗ ΜΟΝΑΔΑΣ — ΤΙΜΟΛΟΓΙΟ ΠΡΟΚΑΤΑΒΟΛΗΣ`,
      `═══════════════════════════════════════`,
      ``,
      `Ημερομηνία: ${formatDate(new Date())}`,
      `Τιμολόγιο: ${invoiceRef}`,
      ``,
      `── Ιεραρχία Ακινήτου ──`,
      ...(event.companyName ? [`Εταιρεία: ${event.companyName}`] : []),
      ...(event.projectName ? [`Έργο: ${event.projectName}`] : []),
      ...(event.permitTitle ? [`Τίτλος Αδείας: ${event.permitTitle}`] : []),
      ...(event.buildingName ? [`Κτίριο: ${event.buildingName}`] : []),
      `Μονάδα: ${event.unitName}${event.unitFloor !== null && event.unitFloor !== undefined ? ` — ${event.unitFloor}ος όροφος` : ''}`,
      ...(event.projectAddress ? [`Διεύθυνση: ${event.projectAddress}`] : []),
      ``,
      `── Στοιχεία Αγοραστή ──`,
      `Αγοραστής: ${event.buyerName ?? 'Μη καταχωρημένος'}`,
      ``,
      `── Οικονομικά Στοιχεία ──`,
      `Καθαρό ποσό: ${formatEuro(netAmount)}`,
      `ΦΠΑ 24%: ${formatEuro(vatAmount)}`,
      `Σύνολο (με ΦΠΑ): ${formatEuro(event.depositAmount)}`,
      `Τρόπος πληρωμής: ${formatPaymentMethod(event.paymentMethod)}`,
      ``,
      `── Σύνδεσμοι ──`,
      `Προβολή τιμολογίου: ${appUrl}/accounting/invoices${result.invoiceId ? `?view=${result.invoiceId}` : ''}`,
      `Όλα τα τιμολόγια: ${appUrl}/accounting/invoices`,
      ``,
      `═══════════════════════════════════════`,
      `  Nestor App — Αυτόματη ειδοποίηση`,
      `═══════════════════════════════════════`,
    ].join('\n'),
  };
}

function buildFinalSaleNotification(
  event: SalesAccountingEvent & { eventType: 'final_sale_invoice' },
  result: SalesAccountingResult
): { subject: string; body: string } {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const remaining = event.finalPrice - event.depositAlreadyInvoiced;
  const netRemaining = remaining / VAT_DIVISOR;
  const vatRemaining = remaining - netRemaining;
  const appUrl = getAppBaseUrl();

  return {
    subject: `🏠 Πώληση — ${event.unitName} (${formatEuro(event.finalPrice)})`,
    body: [
      `═══════════════════════════════════════`,
      `  ΠΩΛΗΣΗ ΜΟΝΑΔΑΣ — ΤΙΜΟΛΟΓΙΟ ΥΠΟΛΟΙΠΟΥ`,
      `═══════════════════════════════════════`,
      ``,
      `Ημερομηνία: ${formatDate(new Date())}`,
      `Τιμολόγιο: ${invoiceRef}`,
      ``,
      `── Ιεραρχία Ακινήτου ──`,
      ...(event.companyName ? [`Εταιρεία: ${event.companyName}`] : []),
      ...(event.projectName ? [`Έργο: ${event.projectName}`] : []),
      ...(event.permitTitle ? [`Τίτλος Αδείας: ${event.permitTitle}`] : []),
      ...(event.buildingName ? [`Κτίριο: ${event.buildingName}`] : []),
      `Μονάδα: ${event.unitName}${event.unitFloor !== null && event.unitFloor !== undefined ? ` — ${event.unitFloor}ος όροφος` : ''}`,
      ...(event.projectAddress ? [`Διεύθυνση: ${event.projectAddress}`] : []),
      ``,
      `── Στοιχεία Αγοραστή ──`,
      `Αγοραστής: ${event.buyerName ?? 'Μη καταχωρημένος'}`,
      ``,
      `── Οικονομικά Στοιχεία ──`,
      `Τελική τιμή πώλησης: ${formatEuro(event.finalPrice)}`,
      `Ήδη τιμολογημένο (προκαταβολή): ${formatEuro(event.depositAlreadyInvoiced)}`,
      ``,
      `Υπόλοιπο (καθαρό): ${formatEuro(netRemaining)}`,
      `ΦΠΑ 24%: ${formatEuro(vatRemaining)}`,
      `Υπόλοιπο (με ΦΠΑ): ${formatEuro(remaining)}`,
      `Τρόπος πληρωμής: ${formatPaymentMethod(event.paymentMethod)}`,
      ``,
      `── Σύνδεσμοι ──`,
      `Προβολή τιμολογίου: ${appUrl}/accounting/invoices${result.invoiceId ? `?view=${result.invoiceId}` : ''}`,
      `Όλα τα τιμολόγια: ${appUrl}/accounting/invoices`,
      ``,
      `═══════════════════════════════════════`,
      `  Nestor App — Αυτόματη ειδοποίηση`,
      `═══════════════════════════════════════`,
    ].join('\n'),
  };
}

function buildCreditNotification(
  event: SalesAccountingEvent & { eventType: 'credit_invoice' },
  result: SalesAccountingResult
): { subject: string; body: string } {
  const invoiceRef = result.invoiceNumber ? `A-${result.invoiceNumber}` : '—';
  const appUrl = getAppBaseUrl();
  const netAmount = event.creditAmount / VAT_DIVISOR;
  const vatAmount = event.creditAmount - netAmount;

  return {
    subject: `❌ ${event.reason} — ${event.unitName} (${formatEuro(event.creditAmount)})`,
    body: [
      `═══════════════════════════════════════`,
      `  ${event.reason.toUpperCase()} — ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ`,
      `═══════════════════════════════════════`,
      ``,
      `Ημερομηνία: ${formatDate(new Date())}`,
      `Πιστωτικό: ${invoiceRef}`,
      ``,
      `── Ιεραρχία Ακινήτου ──`,
      ...(event.companyName ? [`Εταιρεία: ${event.companyName}`] : []),
      ...(event.projectName ? [`Έργο: ${event.projectName}`] : []),
      ...(event.permitTitle ? [`Τίτλος Αδείας: ${event.permitTitle}`] : []),
      ...(event.buildingName ? [`Κτίριο: ${event.buildingName}`] : []),
      `Μονάδα: ${event.unitName}${event.unitFloor !== null && event.unitFloor !== undefined ? ` — ${event.unitFloor}ος όροφος` : ''}`,
      ...(event.projectAddress ? [`Διεύθυνση: ${event.projectAddress}`] : []),
      ``,
      `── Στοιχεία Αγοραστή ──`,
      `Αγοραστής: ${event.buyerName ?? 'Μη καταχωρημένος'}`,
      ``,
      `── Οικονομικά Στοιχεία ──`,
      `Καθαρό ποσό επιστροφής: ${formatEuro(netAmount)}`,
      `ΦΠΑ 24%: ${formatEuro(vatAmount)}`,
      `Σύνολο επιστροφής (με ΦΠΑ): ${formatEuro(event.creditAmount)}`,
      ``,
      `── Αιτιολογία ──`,
      `${event.reason}`,
      ``,
      `── Σύνδεσμοι ──`,
      `Προβολή πιστωτικού: ${appUrl}/accounting/invoices${result.invoiceId ? `?view=${result.invoiceId}` : ''}`,
      `Όλα τα τιμολόγια: ${appUrl}/accounting/invoices`,
      ``,
      `═══════════════════════════════════════`,
      `  Nestor App — Αυτόματη ειδοποίηση`,
      `═══════════════════════════════════════`,
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
  event: SalesAccountingEvent & { eventType: 'deposit_invoice' },
  result: SalesAccountingResult,
  buyerEmail: string,
  buyerName: string
): Promise<void> {
  // Skip αν δεν πέτυχε η δημιουργία τιμολογίου
  if (!result.success) {
    console.log('[Buyer Notify] Skipping — invoice creation failed');
    return;
  }

  console.log(`[Buyer Notify] Sending branded reservation confirmation to ${buyerEmail}`);

  try {
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
      invoiceRef: result.invoiceNumber ? `A-${result.invoiceNumber}` : null,
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
