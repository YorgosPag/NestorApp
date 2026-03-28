/**
 * ============================================================================
 * 🔤 GREEK FONT LOADER — SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * Centralized Roboto font registration for all jsPDF exporters.
 * Eliminates 5+ duplicate registerGreekFont() implementations.
 *
 * Uses lazy dynamic import for the ~687KB base64 font data.
 * "Identity-H" encoding is CRITICAL for Unicode/Greek support —
 * without it, jsPDF defaults to WinAnsiEncoding (Latin-only).
 *
 * @module services/pdf/greek-font-loader
 * @enterprise ADR-267 Phase B — SSOT Consolidation
 */

import type jsPDF from 'jspdf';

/**
 * Registers Roboto font with jsPDF for Greek character support.
 *
 * - Lazy-loads the ~687KB base64 data only when needed
 * - Registers both 'normal' and 'bold' styles (same TTF — required
 *   by jspdf-autotable for header cells, otherwise falls back to
 *   Helvetica with no Identity-H → garbled Greek)
 * - Sets Roboto as the active font
 */
export async function registerGreekFont(pdf: jsPDF): Promise<void> {
  const { ROBOTO_REGULAR_BASE64 } = await import(
    '@/services/gantt-export/roboto-font-data'
  );
  pdf.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', undefined, 'Identity-H');
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'bold', undefined, 'Identity-H');
  pdf.setFont('Roboto', 'normal');
}
