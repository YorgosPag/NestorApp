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

// ============================================================================
// TYPES
// ============================================================================

/** Optional company settings for fallback data (bankAccounts, KAD, etc.) */
export interface InvoicePDFSettings {
  /** Fallback bank accounts (used if invoice.issuer.bankAccounts is empty) */
  bankAccounts?: Array<{ bankName: string; iban: string }>;
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
 * Resolve bank accounts: prefer invoice snapshot, fallback to settings.
 */
function resolveBankAccounts(
  invoice: Invoice,
  settings?: InvoicePDFSettings
): Array<{ bankName: string; iban: string }> {
  // Invoice issuer snapshot (ADR-ACC-018)
  if (invoice.issuer.bankAccounts && invoice.issuer.bankAccounts.length > 0) {
    return invoice.issuer.bankAccounts;
  }
  // Fallback from settings
  return settings?.bankAccounts ?? [];
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
 * @param settings - Optional fallback settings (bankAccounts, KAD, withholding)
 */
export async function exportInvoicePDF(
  invoice: Invoice,
  settings?: InvoicePDFSettings
): Promise<void> {
  const logoBase64 = await loadLogo();
  const bankAccounts = resolveBankAccounts(invoice, settings);

  const pdf = await renderInvoicePDF({
    invoice,
    logoBase64,
    bankAccounts,
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
  const bankAccounts = resolveBankAccounts(invoice, settings);

  const pdf = await renderInvoicePDF({
    invoice,
    logoBase64,
    bankAccounts,
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
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      printWindow.print();
    });
    // Clean up URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else {
    // Fallback: download if popup blocked
    URL.revokeObjectURL(url);
    await exportInvoicePDF(invoice, settings);
  }
}
