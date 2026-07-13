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
  ExportableTable,
  ExportableTableSection,
  ScheduleColumnDef,
  ScheduleExportOptions,
} from '../types';
import type { HeaderTranslator } from './csv-exporter';
import { formatCellForDisplay } from './value-formatters';

// ─── Layout constants ────────────────────────────────────────────────────────

const MARGIN_MM = 12;
const HEADER_HEIGHT_MM = 16;
const SECTION_TITLE_MM = 6;
const SECTION_GAP_MM = 10;
const DEFAULT_FOOTER_LABEL = 'BIM Schedule';

const BLUE: [number, number, number] = [30, 64, 175];     // blue-800
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_500: [number, number, number] = [71, 85, 105];
const WHITE: [number, number, number] = [255, 255, 255];

// ─── Body row build ──────────────────────────────────────────────────────────

function buildBody(schedule: ExportableTable): string[][] {
  return schedule.rows.map((row) =>
    schedule.columns.map((col) =>
      formatCellForDisplay(row.cells[col.key] ?? null, col.valueType),
    ),
  );
}

function buildHead(
  schedule: ExportableTable,
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

function drawFooters(pdf: jsPDF, title: string, footerLabel: string): void {
  const totalPages = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE_500);
    pdf.text(`${footerLabel} — ${title}`, MARGIN_MM, pageH - 6);
    pdf.text(`${i} / ${totalPages}`, pageWidth - MARGIN_MM, pageH - 6, { align: 'right' });
  }
}

/** Where the last autoTable finished — jspdf-autotable stashes it on the doc. */
function lastTableBottom(pdf: jsPDF, fallback: number): number {
  const y = (pdf as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  return typeof y === 'number' ? y : fallback;
}

/**
 * One section: its heading, then its table. Returns the y to continue from. An empty title
 * draws no heading and consumes no vertical space — that is what keeps the single-table
 * `scheduleToPdfBlob` layout identical to what it produced before the generalisation.
 */
function drawSection(
  pdf: jsPDF,
  section: ExportableTableSection,
  startY: number,
  translateHeader: HeaderTranslator,
): number {
  const titled = section.title.length > 0;
  if (titled) {
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...SLATE_800);
    pdf.text(section.title, MARGIN_MM, startY);
  }

  autoTable(pdf, {
    startY: titled ? startY + SECTION_TITLE_MM : startY,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: BLUE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    head: buildHead(section.table, translateHeader),
    body: buildBody(section.table),
    columnStyles: columnStylesFor(section.table.columns),
  });

  return lastTableBottom(pdf, startY) + SECTION_GAP_MM;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate ONE PDF holding several titled tables, in order (ADR-650 M7: a survey folder is
 * a single document — coordinates, plot, volumes, tolerance check — not four loose PDFs).
 * `autoTable` handles page breaks; each section prints its heading above its table.
 */
export async function tablesToPdfBlob(
  sections: readonly ExportableTableSection[],
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await registerGreekFont(pdf);

  drawHeader(pdf, options.title);

  let y = HEADER_HEIGHT_MM + 6;
  for (const section of sections) {
    y = drawSection(pdf, section, y, translateHeader);
  }

  drawFooters(pdf, options.title, options.footerLabel ?? DEFAULT_FOOTER_LABEL);

  return pdf.output('blob');
}

/**
 * Generate a PDF Blob από schedule. Pure helper (modulo jsPDF state) —
 * each call creates a fresh `jsPDF` instance. Thin wrapper over the
 * multi-section engine with a single, untitled section.
 */
export async function scheduleToPdfBlob(
  schedule: ExportableTable,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<Blob> {
  return tablesToPdfBlob([{ title: '', table: schedule }], options, translateHeader);
}

/**
 * Trigger browser download as .pdf. Filename gets `.pdf` extension.
 */
export async function downloadScheduleAsPdf(
  schedule: ExportableTable,
  options: ScheduleExportOptions,
  translateHeader: HeaderTranslator,
): Promise<void> {
  const blob = await scheduleToPdfBlob(schedule, options, translateHeader);
  triggerExportDownload({ blob, filename: `${options.filename}.pdf` });
}
