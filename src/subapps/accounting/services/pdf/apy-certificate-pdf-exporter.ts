/**
 * @fileoverview APY Certificate PDF Exporter — Public API
 * @description Export, print, or get Blob of APY Certificate PDF.
 *   Orchestrates template rendering + logo loading.
 *   Ίδιο pattern με invoice-pdf-exporter.ts (ADR-ACC-018).
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

import type { APYCertificate } from '../../types';
import { renderAPYCertificatePDF } from './apy-certificate-pdf-template';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Lazy-load the logo base64 data.
 * Returns null if loading fails (PDF renders without logo).
 * Ίδιο pattern με invoice-pdf-exporter.ts.
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
 * Build filename for APY certificate PDF.
 * Format: APY_{fiscalYear}_{customerVatNumber}_{createdDate}.pdf
 */
function buildAPYFilename(cert: APYCertificate): string {
  const sanitizedName = cert.customer.name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 40);
  const date = cert.createdAt.substring(0, 10).replace(/-/g, '');
  return `APY_${cert.fiscalYear}_${sanitizedName}_${date}.pdf`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Export APY Certificate as PDF download.
 *
 * @param cert - The APY certificate to export
 */
export async function exportAPYCertificatePDF(cert: APYCertificate): Promise<void> {
  const logoBase64 = await loadLogo();

  const pdf = await renderAPYCertificatePDF({ cert, logoBase64 });
  pdf.save(buildAPYFilename(cert));
}

/**
 * Get APY Certificate PDF as Blob (for email attachments).
 *
 * @param cert - The APY certificate to render
 * @returns PDF Blob
 */
export async function getAPYCertificatePDFBlob(cert: APYCertificate): Promise<Blob> {
  const logoBase64 = await loadLogo();

  const pdf = await renderAPYCertificatePDF({ cert, logoBase64 });
  return pdf.output('blob');
}

/**
 * Print APY Certificate PDF via browser print dialog.
 *
 * @param cert - The APY certificate to print
 */
export async function printAPYCertificatePDF(cert: APYCertificate): Promise<void> {
  const blob = await getAPYCertificatePDFBlob(cert);
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
    await exportAPYCertificatePDF(cert);
  }
}
