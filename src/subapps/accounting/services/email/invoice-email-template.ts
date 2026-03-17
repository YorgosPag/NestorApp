/**
 * @fileoverview Invoice Email Template — Content Block
 * @description Builds the HTML content block for invoice email body.
 *   Bilingual: GR (default) or EN based on customer.country.
 *   Wrapped by wrapInBrandedTemplate() from base-email-template.ts.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-019 Invoice Email Sending
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, server-only
 * @note HTML emails require inline styles — N.3 exception applies here
 */

/**
 * NOTE: This module intentionally does NOT use 'server-only'.
 * It only builds HTML strings — no secrets, no server APIs.
 * It is safe to import in both server and client contexts.
 * The API route (send-email/route.ts) is server-only.
 */

import type { Invoice, InvoiceType } from '../../types';

// ============================================================================
// SHARED UTILITIES (inlined — avoid server-only base-email-template import)
// ============================================================================

/** Escape HTML special chars to prevent XSS in dynamic content */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Server/client-safe Euro formatter — 2 decimal places, Greek locale */
function formatEuro(amount: number): string {
  return new Intl.NumberFormat('el', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Date formatter — DD/MM/YYYY */
function formatDateGreek(date: Date): string {
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Pagonis brand colors (subset needed for email content block) */
const BRAND = {
  navy: '#1E3A5F',
  gray: '#4A4A4A',
  grayLight: '#6B7280',
} as const;

// ============================================================================
// TYPES
// ============================================================================

/** Supported email languages */
export type InvoiceEmailLanguage = 'el' | 'en';

// ============================================================================
// CONSTANTS — Bilingual Labels
// ============================================================================

const LABELS = {
  el: {
    greeting: 'Αγαπητέ/ή',
    intro: 'Επισυνάπτεται το παρακάτω παραστατικό.',
    type: 'Τύπος',
    number: 'Αριθμός',
    issueDate: 'Ημερομηνία Έκδοσης',
    dueDate: 'Ημερομηνία Λήξης',
    amount: 'Συνολικό Ποσό',
    noDueDate: 'Άμεση Εξόφληση',
    closing: 'Με εκτίμηση,',
    pdfAttached: 'Το τιμολόγιο επισυνάπτεται ως PDF.',
  },
  en: {
    greeting: 'Dear',
    intro: 'Please find the attached invoice.',
    type: 'Type',
    number: 'Number',
    issueDate: 'Issue Date',
    dueDate: 'Due Date',
    amount: 'Total Amount',
    noDueDate: 'Due Immediately',
    closing: 'Kind regards,',
    pdfAttached: 'The invoice is attached as a PDF file.',
  },
} as const;

/** Invoice type display labels — bilingual */
const INVOICE_TYPE_LABELS: Record<InvoiceType, { el: string; en: string }> = {
  service_invoice: { el: 'Τιμολόγιο Παροχής Υπηρεσιών', en: 'Service Invoice' },
  sales_invoice: { el: 'Τιμολόγιο Πώλησης', en: 'Sales Invoice' },
  retail_receipt: { el: 'Απόδειξη Λιανικής Πώλησης', en: 'Retail Receipt' },
  service_receipt: { el: 'Απόδειξη Παροχής Υπηρεσιών', en: 'Service Receipt' },
  credit_invoice: { el: 'Πιστωτικό Τιμολόγιο', en: 'Credit Invoice' },
  service_invoice_eu: { el: 'ΤΠΥ Ενδοκοινοτικό', en: 'EU Service Invoice' },
  service_invoice_3rd: { el: 'ΤΠΥ Τρίτες Χώρες', en: 'Third-Country Service Invoice' },
};

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detect email language from customer country.
 * GR (or absent) → Greek. Any other ISO 3166-1 alpha-2 → English.
 */
export function detectInvoiceEmailLanguage(
  customerCountry: string | undefined
): InvoiceEmailLanguage {
  const country = (customerCountry ?? 'GR').toUpperCase();
  return country === 'GR' ? 'el' : 'en';
}

// ============================================================================
// SUBJECT
// ============================================================================

/**
 * Build email subject line for invoice.
 *
 * @example (el) "Τιμολόγιο Α-42 | Pagonis Energeiaki"
 * @example (en) "Invoice A-42 | Pagonis Energeiaki"
 */
export function buildInvoiceEmailSubject(
  invoice: Invoice,
  language: InvoiceEmailLanguage
): string {
  const invoiceRef = `${invoice.series}-${invoice.number}`;
  const companyName = escapeHtml(invoice.issuer.name);

  if (language === 'el') {
    return `Τιμολόγιο ${invoiceRef} | ${companyName}`;
  }
  return `Invoice ${invoiceRef} | ${companyName}`;
}

// ============================================================================
// PLAIN TEXT BODY
// ============================================================================

/**
 * Build plain-text fallback for the invoice email.
 * Required by Mailgun for multipart/alternative emails.
 */
export function buildInvoiceEmailPlainText(
  invoice: Invoice,
  language: InvoiceEmailLanguage
): string {
  const L = LABELS[language];
  const invoiceRef = `${invoice.series}-${invoice.number}`;
  const typeLabel = INVOICE_TYPE_LABELS[invoice.type][language];
  const dueDateText = invoice.dueDate
    ? formatDateGreek(new Date(invoice.dueDate))
    : L.noDueDate;

  return [
    `${L.greeting} ${invoice.customer.name},`,
    '',
    L.intro,
    '',
    `${L.number}: ${invoiceRef}`,
    `${L.type}: ${typeLabel}`,
    `${L.issueDate}: ${formatDateGreek(new Date(invoice.issueDate))}`,
    `${L.dueDate}: ${dueDateText}`,
    `${L.amount}: ${formatEuro(invoice.totalGrossAmount)}`,
    '',
    L.pdfAttached,
    '',
    L.closing,
    invoice.issuer.name,
  ].join('\n');
}

// ============================================================================
// HTML CONTENT BLOCK
// ============================================================================

/**
 * Build the HTML content block for the invoice email.
 * Designed to be injected into wrapInBrandedTemplate() as `contentHtml`.
 *
 * Uses inline styles (required for email client compatibility).
 * XSS prevention: all dynamic content passes through escapeHtml().
 */
export function buildInvoiceEmailContent(
  invoice: Invoice,
  language: InvoiceEmailLanguage
): string {
  const L = LABELS[language];
  const invoiceRef = `${invoice.series}-${invoice.number}`;
  const typeLabel = INVOICE_TYPE_LABELS[invoice.type][language];
  const dueDateText = invoice.dueDate
    ? formatDateGreek(new Date(invoice.dueDate))
    : L.noDueDate;
  const issueDateText = formatDateGreek(new Date(invoice.issueDate));
  const amountText = formatEuro(invoice.totalGrossAmount);

  const rowStyle = `font-size:14px;color:${BRAND.gray};line-height:1.8;`;
  const labelStyle = `padding:6px 16px 6px 0;font-size:13px;color:${BRAND.grayLight};white-space:nowrap;`;
  const valueStyle = `padding:6px 0;font-size:14px;color:${BRAND.gray};font-weight:600;`;
  const amountValueStyle = `padding:6px 0;font-size:15px;color:${BRAND.navy};font-weight:700;`;

  return `
    <!-- Greeting -->
    <p style="margin:0 0 16px;${rowStyle}">
      ${escapeHtml(L.greeting)} ${escapeHtml(invoice.customer.name)},
    </p>

    <!-- Intro -->
    <p style="margin:0 0 24px;${rowStyle}">
      ${escapeHtml(L.intro)}
    </p>

    <!-- Invoice summary table -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;">
      <tbody>
        <tr style="background-color:#F9FAFB;">
          <td style="${labelStyle}padding-left:16px;">${escapeHtml(L.number)}</td>
          <td style="${valueStyle}">${escapeHtml(invoiceRef)}</td>
        </tr>
        <tr>
          <td style="${labelStyle}padding-left:16px;">${escapeHtml(L.type)}</td>
          <td style="${valueStyle}">${escapeHtml(typeLabel)}</td>
        </tr>
        <tr style="background-color:#F9FAFB;">
          <td style="${labelStyle}padding-left:16px;">${escapeHtml(L.issueDate)}</td>
          <td style="${valueStyle}">${escapeHtml(issueDateText)}</td>
        </tr>
        <tr>
          <td style="${labelStyle}padding-left:16px;">${escapeHtml(L.dueDate)}</td>
          <td style="${valueStyle}">${escapeHtml(dueDateText)}</td>
        </tr>
        <tr style="background-color:#EEF2FF;">
          <td style="${labelStyle}padding-left:16px;font-weight:600;color:${BRAND.navy};">${escapeHtml(L.amount)}</td>
          <td style="${amountValueStyle}">${escapeHtml(amountText)}</td>
        </tr>
      </tbody>
    </table>

    <!-- PDF note -->
    <p style="margin:0 0 24px;font-size:13px;color:${BRAND.grayLight};">
      📎 ${escapeHtml(L.pdfAttached)}
    </p>

    <!-- Closing -->
    <p style="margin:0 0 4px;${rowStyle}">
      ${escapeHtml(L.closing)}
    </p>
    <p style="margin:0;font-size:14px;color:${BRAND.navy};font-weight:600;">
      ${escapeHtml(invoice.issuer.name)}
    </p>
  `.trim();
}
