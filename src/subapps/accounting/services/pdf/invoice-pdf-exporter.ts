/**
 * @fileoverview Invoice PDF Exporter — Public API
 * @description Export, print, or get Blob of invoice PDF.
 *   Orchestrates template rendering + logo loading + settings fallback.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-018 Invoice PDF Generation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

import type { Invoice } from '../../types';
import { invoicePdfFilename, renderInvoicePdfDocument } from './invoice-pdf-document';
import { openBlobInNewTab } from '@/lib/exports/trigger-export-download';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Ρυθμίσεις σχεδίασης που ΔΕΝ ζουν στο τιμολόγιο (ΚΑΔ, παρακράτηση). Οι λογαριασμοί πληρωμής **δεν** είναι εδώ:
 * τυπώνεται μόνο το snapshot του τιμολογίου (ADR-ACC-018 §15) — ποτέ «εφεδρεία» από το σημερινό μητρώο.
 */
export interface InvoicePDFSettings {
  /** Primary KAD code for myDATA section */
  kadCode?: string | null;
  /** Withholding tax amount (default: 0) */
  withholdingAmount?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Ο κύριος ΚΑΔ: ζει στο `invoice-pdf-document.ts` (ένας ορισμός για browser και διακομιστή). */
export { extractKadFromProfile } from './invoice-pdf-document';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Export invoice as PDF download.
 *
 * @param invoice - The invoice to export
 * @param settings - Optional settings (KAD, withholding)
 */
export async function exportInvoicePDF(
  invoice: Invoice,
  settings?: InvoicePDFSettings
): Promise<void> {
  const pdf = await renderInvoicePdfDocument({
    invoice,
    kadCode: settings?.kadCode ?? null,
    withholdingAmount: settings?.withholdingAmount ?? 0,
  });

  pdf.save(invoicePdfFilename(invoice));
}

/**
 * Get invoice PDF as Blob (for email attachments or preview).
 *
 * @param invoice - The invoice to render
 * @param settings - Optional fallback settings
 * @returns PDF Blob
 */
export async function getInvoicePDFBlob(
  invoice: Invoice,
  settings?: InvoicePDFSettings
): Promise<Blob> {
  const pdf = await renderInvoicePdfDocument({
    invoice,
    kadCode: settings?.kadCode ?? null,
    withholdingAmount: settings?.withholdingAmount ?? 0,
  });

  return pdf.output('blob');
}

/**
 * Print invoice PDF via browser print dialog.
 *
 * @param invoice - The invoice to print
 * @param settings - Optional fallback settings
 */
export async function printInvoicePDF(
  invoice: Invoice,
  settings?: InvoicePDFSettings
): Promise<void> {
  const blob = await getInvoicePDFBlob(invoice, settings);
  const tab = openBlobInNewTab(blob, { onLoad: (w) => w.print() });

  // Fallback: download if popup blocked
  if (!tab) {
    await exportInvoicePDF(invoice, settings);
  }
}
