/**
 * @fileoverview APY Certificate Email Template — Content Block
 * @description Builds the HTML content block for APY certificate reminder email body.
 *   Bilingual: GR (default) or EN based on customer location.
 *   Wrapped by wrapInBrandedTemplate() from base-email-template.ts.
 *   Ίδιο pattern με invoice-email-template.ts (ADR-ACC-019).
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 * @note HTML emails require inline styles — N.3 exception applies here
 */

/**
 * NOTE: This module intentionally does NOT use 'server-only'.
 * It only builds HTML strings — no secrets, no server APIs.
 * It is safe to import in both server and client contexts.
 * The API route (send-email/route.ts) is server-only.
 */

import type { APYCertificate } from '../../types';

// ============================================================================
// SHARED UTILITIES (ίδιο pattern με invoice-email-template)
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('el', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const BRAND = {
  navy: '#1E3A5F',
  gray: '#4A4A4A',
  grayLight: '#6B7280',
  green: '#1a7f37',
} as const;

// ============================================================================
// TYPES
// ============================================================================

export type APYEmailLanguage = 'el' | 'en';

// ============================================================================
// CONSTANTS — Bilingual Labels
// ============================================================================

const LABELS = {
  el: {
    greeting: 'Αγαπητέ/ή',
    intro: 'Σας αποστέλλουμε υπενθύμιση σχετικά με τη Βεβαίωση Παρακράτησης Φόρου για το φορολογικό έτος',
    invoicesTitle: 'Τιμολόγια που περιλαμβάνονται',
    invoiceNumber: 'Αρ. ΤΠΥ',
    issueDate: 'Ημερομηνία',
    netAmount: 'Καθαρό Ποσό',
    withholdingRate: 'Συντ. %',
    withholdingAmount: 'Παρακράτηση',
    totalWithholding: 'Σύνολο Παρακράτησης',
    request: 'Παρακαλούμε να μας αποστείλετε τη σχετική Βεβαίωση Παρακράτησης Φόρου το συντομότερο δυνατό.',
    signature: 'Με εκτίμηση',
    legalNote: 'Νομική Βάση: Ν. 4172/2013, άρθρο 64',
  },
  en: {
    greeting: 'Dear',
    intro: 'We are sending you a reminder regarding the Withholding Tax Certificate for fiscal year',
    invoicesTitle: 'Invoices included',
    invoiceNumber: 'Invoice No',
    issueDate: 'Date',
    netAmount: 'Net Amount',
    withholdingRate: 'Rate %',
    withholdingAmount: 'Withholding',
    totalWithholding: 'Total Withholding',
    request: 'Please send us the relevant Withholding Tax Certificate at your earliest convenience.',
    signature: 'Kind regards',
    legalNote: 'Legal Basis: Art. 64, Law 4172/2013 (Greece)',
  },
} as const;

// ============================================================================
// CONTENT BUILDER
// ============================================================================

/**
 * Build the HTML content block for the APY certificate reminder email.
 * Wrapped externally by wrapInBrandedTemplate() from base-email-template.ts.
 *
 * @param cert - The APY certificate
 * @param lang - Email language (default: 'el')
 */
export function buildAPYEmailContent(cert: APYCertificate, lang: APYEmailLanguage = 'el'): string {
  const L = LABELS[lang];
  const customerName = escapeHtml(cert.customer.name);
  const providerName = escapeHtml(cert.provider.name);

  const lineItemsRows = cert.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; color:${BRAND.gray}; font-size:13px;">
          ${escapeHtml(item.invoiceNumber)}
        </td>
        <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; color:${BRAND.gray}; font-size:13px; text-align:center;">
          ${escapeHtml(item.issueDate.substring(0, 10).split('-').reverse().join('/'))}
        </td>
        <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; color:${BRAND.gray}; font-size:13px; text-align:right;">
          ${formatEuro(item.netAmount)}
        </td>
        <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; color:${BRAND.gray}; font-size:13px; text-align:center;">
          ${item.withholdingRate}%
        </td>
        <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; color:${BRAND.navy}; font-size:13px; text-align:right; font-weight:600;">
          ${formatEuro(item.withholdingAmount)}
        </td>
      </tr>`
    )
    .join('');

  return `
    <p style="margin:0 0 16px; color:${BRAND.gray}; font-size:15px;">
      ${L.greeting} <strong>${customerName}</strong>,
    </p>

    <p style="margin:0 0 20px; color:${BRAND.gray}; font-size:15px; line-height:1.6;">
      ${L.intro} <strong style="color:${BRAND.navy};">${cert.fiscalYear}</strong>.
    </p>

    <p style="margin:0 0 10px; color:${BRAND.navy}; font-size:14px; font-weight:600;">
      ${L.invoicesTitle}
    </p>

    <table style="width:100%; border-collapse:collapse; margin-bottom:20px; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden;">
      <thead>
        <tr style="background-color:${BRAND.navy};">
          <th style="padding:8px; color:#fff; font-size:12px; text-align:left;">${L.invoiceNumber}</th>
          <th style="padding:8px; color:#fff; font-size:12px; text-align:center;">${L.issueDate}</th>
          <th style="padding:8px; color:#fff; font-size:12px; text-align:right;">${L.netAmount}</th>
          <th style="padding:8px; color:#fff; font-size:12px; text-align:center;">${L.withholdingRate}</th>
          <th style="padding:8px; color:#fff; font-size:12px; text-align:right;">${L.withholdingAmount}</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsRows}
        <tr style="background-color:#f8fafc;">
          <td colspan="4" style="padding:8px; color:${BRAND.navy}; font-size:13px; font-weight:700; text-align:right;">
            ${L.totalWithholding}
          </td>
          <td style="padding:8px; color:${BRAND.navy}; font-size:14px; font-weight:700; text-align:right;">
            ${formatEuro(cert.totalWithholdingAmount)}
          </td>
        </tr>
      </tbody>
    </table>

    <p style="margin:0 0 20px; color:${BRAND.gray}; font-size:15px; line-height:1.6;">
      ${L.request}
    </p>

    <p style="margin:0 0 4px; color:${BRAND.gray}; font-size:14px;">
      ${L.signature},
    </p>
    <p style="margin:0 0 20px; color:${BRAND.navy}; font-size:14px; font-weight:600;">
      ${providerName}
    </p>

    <p style="margin:0; color:${BRAND.grayLight}; font-size:11px; font-style:italic;">
      ${L.legalNote}
    </p>
  `.trim();
}

// ============================================================================
// SUBJECT BUILDER
// ============================================================================

/**
 * Build the email subject line for the APY certificate reminder.
 */
export function buildAPYEmailSubject(cert: APYCertificate, lang: APYEmailLanguage = 'el'): string {
  if (lang === 'el') {
    return `Υπενθύμιση: Βεβαίωση Παρακράτησης Φόρου ${cert.fiscalYear} | ${cert.provider.name}`;
  }
  return `Reminder: Withholding Tax Certificate ${cert.fiscalYear} | ${cert.provider.name}`;
}

// ============================================================================
// PLAIN TEXT FALLBACK
// ============================================================================

/**
 * Build plain text fallback for email clients that don't support HTML.
 */
export function buildAPYEmailPlainText(cert: APYCertificate, lang: APYEmailLanguage = 'el'): string {
  const L = LABELS[lang];
  const lines: string[] = [
    `${L.greeting} ${cert.customer.name},`,
    '',
    `${L.intro} ${cert.fiscalYear}.`,
    '',
    `${L.invoicesTitle}:`,
    '-'.repeat(50),
  ];

  cert.lineItems.forEach((item, idx) => {
    lines.push(
      `${idx + 1}. ${item.invoiceNumber} | ${item.issueDate.substring(0, 10)} | ${formatEuro(item.netAmount)} | ${item.withholdingRate}% | ${formatEuro(item.withholdingAmount)}`
    );
  });

  lines.push('-'.repeat(50));
  lines.push(`${L.totalWithholding}: ${formatEuro(cert.totalWithholdingAmount)}`);
  lines.push('');
  lines.push(L.request);
  lines.push('');
  lines.push(`${L.signature},`);
  lines.push(cert.provider.name);
  lines.push('');
  lines.push(L.legalNote);

  return lines.join('\n');
}
