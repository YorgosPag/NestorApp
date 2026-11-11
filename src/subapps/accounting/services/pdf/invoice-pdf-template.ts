/**
 * @fileoverview Invoice PDF Template — Main render orchestrator
 * @description Composes all section renderers into a complete invoice PDF.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-018 Invoice PDF Generation
 *
 * Split structure (ADR-065 SRP):
 * - invoice-pdf-constants.ts  — Colors, layout, labels, helpers (EXEMPT)
 * - invoice-pdf-parties.ts    — §1 κεφαλίδα + §2 πελάτης (προϋπολογισμός στηλών, ADR-ACC-018 §14)
 * - invoice-pdf-sections.ts   — Section renderers §3-§10
 * - invoice-pdf-template.ts   — This file: main render function
 */

import type jsPDF from 'jspdf';
import type { Invoice } from '../../types';
import { LAYOUT } from './invoice-pdf-constants';
import { drawHeader, drawCustomerSection } from './invoice-pdf-parties';
import {
  drawCreditNoteReference,
  drawLineItemsTable,
  drawTotalsSection,
  drawPaymentSection,
  drawBankAccountsSection,
  drawMyDataSection,
  drawNotesSection,
  addPageFooters,
} from './invoice-pdf-sections';
import { invoicePayableAmount } from '../payments/invoice-payment-instructions';
import { drawVatExemptionSection } from './invoice-pdf-vat-exemption';

// Re-export section renderers for direct use
export { drawHeader, drawCustomerSection } from './invoice-pdf-parties';
export {
  drawCreditNoteReference,
  drawLineItemsTable,
  drawTotalsSection,
  drawPaymentSection,
  drawBankAccountsSection,
  drawMyDataSection,
  drawNotesSection,
  addPageFooters
} from './invoice-pdf-sections';

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

export interface InvoicePDFRenderOptions {
  /** The invoice to render */
  invoice: Invoice;
  /** Logo as base64 PNG string (null = skip) */
  logoBase64: string | null;
  /** KAD code for myDATA section (null = skip) */
  kadCode: string | null;
  /** Withholding tax amount (default: 0) */
  withholdingAmount: number;
  /**
   * ADR-ACC-018 §16: ο σύνδεσμος της δημόσιας σελίδας πληρωμής, κάτω από τις οδηγίες πληρωμής (Stripe: στο PDF).
   * Μόνο στο PDF που **συνοδεύει** τον σύνδεσμο (email). Η λήψη από την εφαρμογή δεν έχει σύνδεσμο.
   */
  paymentPageUrl?: string | null;
}

/**
 * Render a complete invoice PDF document.
 *
 * @returns The jsPDF instance (caller decides: save, blob, or print)
 */
export async function renderInvoicePDF(options: InvoicePDFRenderOptions): Promise<jsPDF> {
  const { invoice, logoBase64, kadCode, withholdingAmount, paymentPageUrl = null } = options;

  // Dynamic imports for code-splitting
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Register Roboto font for Greek character support
  const { ROBOTO_REGULAR_BASE64 } = await import('@/services/gantt-export/roboto-font-data');
  pdf.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', undefined, 'Identity-H');
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'bold', undefined, 'Identity-H');
  pdf.setFont('Roboto', 'normal');

  // Render sections sequentially
  let y = LAYOUT.marginTop;

  y = drawHeader(pdf, invoice, logoBase64, y);
  y = drawCustomerSection(pdf, invoice, y);
  y = drawCreditNoteReference(pdf, invoice, y);
  y = drawLineItemsTable(pdf, invoice, y);
  y = drawTotalsSection(pdf, invoice, y, withholdingAmount);
  y = drawVatExemptionSection(pdf, invoice, y); // ν. 4308/2014 άρθρο 9 §1 ιγ/ιβ — αντίστροφη επιβάρυνση + απαλλαγή ΦΠΑ
  y = drawPaymentSection(pdf, invoice, y);
  // ADR-ACC-018 §15: οι οδηγίες πληρωμής είναι το snapshot του τιμολογίου (`issuer.bankAccounts`) — ποτέ σημερινή
  // τιμή του μητρώου, ώστε ένα παλιό τιμολόγιο να μην τυπώσει ποτέ IBAN που δεν έγραφε όταν εκδόθηκε.
  y = drawBankAccountsSection(pdf, invoice, invoicePayableAmount(invoice, withholdingAmount), y, paymentPageUrl);
  y = drawMyDataSection(pdf, invoice, kadCode, y);
  y = drawNotesSection(pdf, invoice, y);

  // Page footers on ALL pages
  addPageFooters(pdf, invoice);

  return pdf;
}
