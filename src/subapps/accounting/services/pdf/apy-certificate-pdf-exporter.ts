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
import { openBlobInNewTab } from '@/lib/exports/trigger-export-download';

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

