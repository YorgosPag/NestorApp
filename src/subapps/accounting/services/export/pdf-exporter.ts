/**
 * @fileoverview PDF Serializer — Financial Reports (Phase 2e)
 * @description jsPDF + autoTable with Greek font support. Pure document → Blob: the pipeline
 *   (`report-export.ts`) owns flattening, filename and download.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q8 — export formats) · ADR-584 §9
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { UserOptions } from 'jspdf-autotable';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import { cellFormatOf } from './report-table-adapter';
import type { FlatTableData, ReportTranslate } from './report-table-adapter';
import { formatReportCell, formatReportNumber } from './report-cell-format';
import { reportPageFooter } from './report-document-text';
import type { ReportDocument, ReportSerializer } from './report-export';

// ============================================================================
// CONSTANTS
// ============================================================================

const PAGE_MARGIN = 14;
const TITLE_FONT_SIZE = 16;
const SUBTITLE_FONT_SIZE = 10;
const TABLE_FONT_SIZE = 9;
const SUMMARY_START_Y = 35;

/** Κοινό στυλ των δύο πινάκων (σύνοψη · κύριος) — ΕΝΑ σημείο. */
const TABLE_STYLE: Pick<UserOptions, 'styles' | 'headStyles' | 'margin' | 'theme'> = {
  styles: { fontSize: TABLE_FONT_SIZE, cellPadding: 2 },
  headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255] },
  margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
  theme: 'striped',
};

type PdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

// ============================================================================
// HELPERS
// ============================================================================

function writeHeading(pdf: jsPDF, title: string, periodLine: string): void {
  pdf.setFontSize(TITLE_FONT_SIZE);
  pdf.text(title, PAGE_MARGIN, 20);
  pdf.setFontSize(SUBTITLE_FONT_SIZE);
  pdf.setTextColor(100, 100, 100);
  pdf.text(periodLine, PAGE_MARGIN, 28);
  pdf.setTextColor(0, 0, 0);
}

/** Ο πίνακας σύνοψης (αν υπάρχει) · επιστρέφει το Y όπου ξεκινά ο κύριος πίνακας. */
function writeSummary(pdf: jsPDF, table: FlatTableData, t: ReportTranslate): number {
  if (table.summaryMetrics.length === 0) return SUMMARY_START_Y;
  autoTable(pdf, {
    ...TABLE_STYLE,
    startY: SUMMARY_START_Y,
    head: [[t('reports.table.metric'), t('reports.table.value'), t('reports.table.changePercent')]],
    body: table.summaryMetrics.map((m) => [
      m.label,
      formatReportNumber(m.value, m.format, 'document'),
      formatReportCell(m.change?.percentage ?? null, 'percent', 'document'),
    ]),
  });
  return ((pdf as PdfWithAutoTable).lastAutoTable?.finalY ?? SUMMARY_START_Y) + 8;
}

function writeMainTable(pdf: jsPDF, { columns, rows }: FlatTableData, startY: number): void {
  autoTable(pdf, {
    ...TABLE_STYLE,
    startY,
    head: [columns.map((column) => column.header)],
    body: rows.map((row) =>
      row.cells.map((cell, i) => formatReportCell(cell, cellFormatOf(columns[i], row), 'document'))),
    alternateRowStyles: { fillColor: [249, 250, 251] },
    // Αριθμητικές στήλες δεξιά — κατά ΡΟΛΟ στήλης, όχι «όλες εκτός της πρώτης» (η ηλικίωση/ισοζύγιο έχουν κείμενο).
    columnStyles: columns.reduce<Record<number, { halign: 'left' | 'right' }>>(
      (acc, column, i) => {
        acc[i] = { halign: column.kind === 'label' || column.kind === 'text' ? 'left' : 'right' };
        return acc;
      },
      {}
    ),
  });
}

function writeFooters(pdf: jsPDF, t: ReportTranslate): void {
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.text(reportPageFooter(i, pageCount, t), PAGE_MARGIN, pageHeight - 8);
  }
}

// ============================================================================
// SERIALIZER
// ============================================================================

async function serializePdf({ table, title, periodLine, t }: ReportDocument): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: table.columns.length > 4 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  await registerGreekFont(pdf);

  writeHeading(pdf, title, periodLine);
  writeMainTable(pdf, table, writeSummary(pdf, table, t));
  writeFooters(pdf, t);
  return pdf.output('blob');
}

export const pdfReportSerializer: ReportSerializer = { extension: 'pdf', serialize: serializePdf };
