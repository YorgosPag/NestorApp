/**
 * BIM Schedule Export — PDF Exporter (ADR-363 §6 Phase 8).
 *
 * jsPDF + jspdf-autotable backed A4 landscape PDF. Pattern mirror από
 * `services/gantt-export/gantt-table-pdf-exporter.ts`:
 *   - `registerGreekFont` SSoT για Roboto-Identity-H (Greek chars)
 *   - jspdf-autotable για column layout + per-cell styling
 *   - Page footer με page numbers
 *
 * Layout:
 *   Header strip — title + ISO date
 *   Table       — autoTable με headers + alignment από column.align
 *   Footer      — "BIM Schedule — <title>" + page x/y
 *
 * SSoT:
 *   - Greek font registration mandatory PRIN τη χρήση οποιουδήποτε
 *     `pdf.text()` με Ελληνικά
 *   - Output Blob via `pdf.output('blob')` (όχι `pdf.save()`) ώστε ο
 *     καλών να το περάσει στο `triggerExportDownload` SSoT
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { nowISO } from '@/lib/date-local';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import type {
  Schedule,
  ScheduleColumnDef,
  ScheduleExportOptions,
} from '../types';
import type { HeaderTranslator } from './csv-exporter';
import { formatCellForDisplay } from './value-formatters';

// ─── Layout constants ────────────────────────────────────────────────────────

const MARGIN_MM = 12;
const HEADER_HEIGHT_MM = 16;

const BLUE: [number, number, number] = [30, 64, 175];     // blue-800
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_500: [number, number, number] = [71, 85, 105];
const WHITE: [number, number, number] = [255, 255, 255];

// ─── Body row build ──────────────────────────────────────────────────────────

function buildBody(schedule: Schedule): string[][] {
  return schedule.rows.map((row) =>
    schedule.columns.map((col) =>
      formatCellForDisplay(row.cells[col.key] ?? null, col.valueType),
    ),
  );
}

function buildHead(
  schedule: Schedule,
  translateHeader: HeaderTranslator,
): string[][] {
  return [schedule.columns.map((c) => translateHeader(c.i18nKey))];
}

// jspdf-autotable accepts 'left' | 'center' | 'right' — matches our enum
function columnStylesFor(
  columns: readonly ScheduleColumnDef[],
): Record<number, { halign: 'left' | 'center' | 'right' }> {
  const styles: Record<number, { halign: 'left' | 'center' | 'right' }> = {};
  columns.forEach((col, i) => {
    styles[i] = { halign: col.align };
  });
  return styles;
}

// ─── Header + footer ────────────────────────────────────────────────────────

function drawHeader(pdf: jsPDF, title: string): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = HEADER_HEIGHT_MM;

  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...SLATE_800);
  pdf.text(title, MARGIN_MM, y);

  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE_500);
  pdf.text(nowISO().slice(0, 10), pageWidth - MARGIN_MM, y, { align: 'right' });

  // Separator
  y += 3;
  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN_MM, y, pageWidth - MARGIN_MM, y);
}

function drawFooters(pdf: jsPDF, title: string): void {
  const totalPages = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE_500);
    pdf.text(`BIM Schedule — ${title}`, MARGIN_MM, pageH - 6);
    pdf.text(`${i} / ${totalPages}`, pageWidth - MARGIN_MM, pageH - 6, { align: 'right' });
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a PDF Blob από schedule. Pure helper (modulo jsPDF state) —
 * each call creates a fresh `jsPDF` instance.
 */
export async function scheduleToPdfBlob(
  schedule: Schedule,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await registerGreekFont(pdf);

  drawHeader(pdf, options.title);

  autoTable(pdf, {
    startY: HEADER_HEIGHT_MM + 6,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: BLUE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    head: buildHead(schedule, translateHeader),
    body: buildBody(schedule),
    columnStyles: columnStylesFor(schedule.columns),
  });

  drawFooters(pdf, options.title);

  return pdf.output('blob');
}

/**
 * Trigger browser download as .pdf. Filename gets `.pdf` extension.
 */
export async function downloadScheduleAsPdf(
  schedule: Schedule,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<void> {
  const blob = await scheduleToPdfBlob(schedule, options, translateHeader);
  triggerExportDownload({ blob, filename: `${options.filename}.pdf` });
}
