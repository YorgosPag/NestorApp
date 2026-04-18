/**
 * Purchase Order Email Template — Bilingual (EL/EN)
 *
 * Builds HTML content block for PO email body.
 * Pure HTML string builder — no server-only dependency.
 * Inline styles required for email rendering (N.3 exception).
 *
 * @module services/procurement/po-email-template
 * @enterprise ADR-267 Phase B — Email PO to Supplier
 */

import type { PurchaseOrder, PurchaseOrderItem } from '@/types/procurement';

// ============================================================================
// TYPES
// ============================================================================

export interface POEmailTemplateConfig {
  po: PurchaseOrder;
  recipientName: string;
  companyName: string;
  language: 'el' | 'en';
}

// ============================================================================
// HELPERS
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
  }).format(amount);
}

function formatPoDate(isoDate: string | null, lang: 'el' | 'en'): string {
  if (!isoDate) return '—';
  const locale = lang === 'el' ? 'el-GR' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(isoDate));
}

// ============================================================================
// LABELS
// ============================================================================

const LABELS = {
  el: {
    subject: 'Παραγγελία Αγοράς',
    greeting: 'Αγαπητέ/ή',
    body: 'Σας αποστέλλουμε τη συνημμένη παραγγελία αγοράς. Παρακαλούμε επιβεβαιώστε τη λήψη.',
    poNumber: 'Αρ. Παραγγελίας',
    date: 'Ημερομηνία',
    dateNeeded: 'Ημ. Παράδοσης',
    items: 'Είδη',
    description: 'Περιγραφή',
    qty: 'Ποσ.',
    unitPrice: 'Τιμή',
    lineTotal: 'Σύνολο',
    total: 'Γενικό Σύνολο',
    notes: 'Σημειώσεις',
    footer: 'Με εκτίμηση',
  },
  en: {
    subject: 'Purchase Order',
    greeting: 'Dear',
    body: 'Please find attached the purchase order. Kindly confirm receipt.',
    poNumber: 'PO Number',
    date: 'Date',
    dateNeeded: 'Date Needed',
    items: 'Items',
    description: 'Description',
    qty: 'Qty',
    unitPrice: 'Price',
    lineTotal: 'Total',
    total: 'Grand Total',
    notes: 'Notes',
    footer: 'Best regards',
  },
} as const;

// ============================================================================
// BRAND
// ============================================================================

const BRAND = {
  navy: '#1E3A5F',
  gray: '#4A4A4A',
  grayLight: '#6B7280',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  border: '#E5E7EB',
} as const;

// ============================================================================
// TEMPLATE
// ============================================================================

function buildItemsTable(
  items: PurchaseOrderItem[],
  lang: 'el' | 'en'
): string {
  const L = LABELS[lang];
  const rows = items
    .map(
      (item, idx) => `
      <tr style="border-bottom:1px solid ${BRAND.border};">
        <td style="padding:6px 8px;text-align:center;color:${BRAND.grayLight}">${idx + 1}</td>
        <td style="padding:6px 8px;">${escapeHtml(item.description)}</td>
        <td style="padding:6px 8px;text-align:right;">${item.quantity}</td>
        <td style="padding:6px 8px;text-align:right;">${formatEuro(item.unitPrice)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:600;">${formatEuro(item.total)}</td>
      </tr>`
    )
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background-color:${BRAND.navy};color:${BRAND.white};">
          <th style="padding:8px;text-align:center;width:30px;">#</th>
          <th style="padding:8px;text-align:left;">${L.description}</th>
          <th style="padding:8px;text-align:right;width:50px;">${L.qty}</th>
          <th style="padding:8px;text-align:right;width:70px;">${L.unitPrice}</th>
          <th style="padding:8px;text-align:right;width:80px;">${L.lineTotal}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildPOEmailHtml(config: POEmailTemplateConfig): string {
  const { po, recipientName, companyName, language } = config;
  const L = LABELS[language];

  const dateNeededRow = po.dateNeeded
    ? `<tr><td style="padding:4px 0;color:${BRAND.grayLight};">${L.dateNeeded}</td><td style="padding:4px 0;font-weight:600;">${formatPoDate(po.dateNeeded, language)}</td></tr>`
    : '';

  const notesSection = po.supplierNotes
    ? `<div style="margin-top:16px;padding:12px;background:${BRAND.bg};border-radius:6px;">
         <strong style="color:${BRAND.navy};">${L.notes}</strong>
         <p style="margin:8px 0 0;color:${BRAND.gray};">${escapeHtml(po.supplierNotes)}</p>
       </div>`
    : '';

  return `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:${BRAND.gray};line-height:1.6;">
      <!-- Header -->
      <div style="background:${BRAND.navy};padding:20px 24px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;color:${BRAND.white};font-size:20px;">${L.subject} — ${escapeHtml(po.poNumber)}</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${escapeHtml(companyName)}</p>
      </div>

      <!-- Body -->
      <div style="padding:24px;background:${BRAND.white};border:1px solid ${BRAND.border};border-top:none;">
        <p style="margin:0 0 16px;">${L.greeting} ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 20px;">${L.body}</p>

        <!-- PO Meta -->
        <table style="font-size:13px;margin-bottom:20px;">
          <tr>
            <td style="padding:4px 16px 4px 0;color:${BRAND.grayLight};">${L.poNumber}</td>
            <td style="padding:4px 0;font-weight:600;">${escapeHtml(po.poNumber)}</td>
          </tr>
          <tr>
            <td style="padding:4px 16px 4px 0;color:${BRAND.grayLight};">${L.date}</td>
            <td style="padding:4px 0;">${formatPoDate(po.dateCreated, language)}</td>
          </tr>
          ${dateNeededRow}
        </table>

        <!-- Items Table -->
        ${buildItemsTable(po.items, language)}

        <!-- Total -->
        <div style="text-align:right;margin-top:12px;padding:12px 8px;background:${BRAND.bg};border-radius:4px;">
          <span style="font-size:15px;font-weight:700;color:${BRAND.navy};">${L.total}: ${formatEuro(po.total)}</span>
        </div>

        ${notesSection}

        <p style="margin:24px 0 0;color:${BRAND.grayLight};font-size:13px;">${L.footer},<br/>${escapeHtml(companyName)}</p>
      </div>

      <!-- Footer -->
      <div style="padding:12px 24px;background:${BRAND.bg};border:1px solid ${BRAND.border};border-top:none;border-radius:0 0 8px 8px;text-align:center;">
        <p style="margin:0;font-size:11px;color:${BRAND.grayLight};">Powered by Nestor Construct</p>
      </div>
    </div>`;
}

export function buildPOEmailSubject(
  poNumber: string,
  language: 'el' | 'en'
): string {
  return `${LABELS[language].subject} — ${poNumber}`;
}
