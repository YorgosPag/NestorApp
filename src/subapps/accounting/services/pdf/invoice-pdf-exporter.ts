/**
 * @fileoverview Invoice PDF Exporter — Public API
 * @description Export, print, or get Blob of invoice PDF.
 *   Orchestrates template rendering + logo loading + settings fallback.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-018 Invoice PDF Generation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

import type { Invoice, CompanyProfile } from '../../types';
import { renderInvoicePDF } from './invoice-pdf-template';
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

/**
 * Lazy-load the logo base64 data.
 * Returns null if loading fails (PDF renders without logo).
 */
async function loadLogo(): Promise<string | null> {
  try {
    const { PAGONIS_LOGO_BASE64 } = await import('./logo-data');
    return PAGONIS_LOGO_BASE64;
  } catch {
    return null;
  }
}

/**
 * Build filename: {Series}-{Number}_{CustomerName}_{IssueDate}.pdf
 * Sanitizes customer name for filesystem safety.
 */
function buildFilename(invoice: Invoice): string {
  const sanitized = invoice.customer.name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  const date = invoice.issueDate.replace(/-/g, '');
  return `${invoice.series}-${invoice.number}_${sanitized}_${date}.pdf`;
}

/**
 * Extract KAD code from company profile (primary KAD).
 */
export function extractKadFromProfile(profile: CompanyProfile | null): string | null {
  if (!profile) return null;
  return profile.mainKad?.code ?? null;
}

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
  const logoBase64 = await loadLogo();

  const pdf = await renderInvoicePDF({
    invoice,
    logoBase64,
    kadCode: settings?.kadCode ?? null,
    withholdingAmount: settings?.withholdingAmount ?? 0,
  });

  pdf.save(buildFilename(invoice));
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
  const logoBase64 = await loadLogo();

  const pdf = await renderInvoicePDF({
    invoice,
    logoBase64,
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
