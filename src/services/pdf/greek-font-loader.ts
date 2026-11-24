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
 * - Lazy-loads the base64 data (Regular ~687KB · Bold ~228KB) only when needed, in parallel
 * - 'normal' = Roboto Regular · 'bold' = **real** Roboto Bold (ADR-947 §11, 2026-11-24). Until then
 *   'bold' was registered on the SAME Regular TTF (so jspdf-autotable would not fall back to
 *   Helvetica without Identity-H) — every `setFont('Roboto', 'bold')` printed regular weight.
 *   'bold' stays registered for the same autotable reason; it now just has its own glyphs.
 * - jsPDF subsets each font to the glyphs used ⇒ the PDF grows only by what is printed bold.
 * - ⚠️ The Bold (v2.137) covers Latin · Greek (monotonic) · Cyrillic · `€` `·`, but NOT polytonic
 *   Greek or U+202F (narrow no-break space) — those exist only in the Regular.
 * - Sets Roboto as the active font
 */
export async function registerGreekFont(pdf: jsPDF): Promise<void> {
  const [{ ROBOTO_REGULAR_BASE64 }, { ROBOTO_BOLD_BASE64 }] = await Promise.all([
    import('@/services/gantt-export/roboto-font-data'),
    import('@/services/gantt-export/roboto-bold-font-data'),
  ]);
  pdf.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  pdf.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_BASE64);
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', undefined, 'Identity-H');
  pdf.addFont('Roboto-Bold.ttf', 'Roboto', 'bold', undefined, 'Identity-H');
  pdf.setFont('Roboto', 'normal');
}
