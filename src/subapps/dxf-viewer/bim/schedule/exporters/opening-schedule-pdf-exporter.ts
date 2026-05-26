/**
 * ADR-376 Phase C.3 — Opening Schedule PDF Exporter (Πίνακας Κουφωμάτων).
 *
 * Generates a combined A4-landscape PDF with two sections:
 *   1. Door Schedule   (Πίνακας Θυρών)
 *   2. Window Schedule (Πίνακας Παραθύρων)
 *
 * Mirrors the single-schedule pattern from `pdf-exporter.ts` (ADR-363 Phase 8):
 *   - jsPDF + jspdf-autotable
 *   - `registerGreekFont` SSoT for Roboto-Identity-H
 *   - `triggerExportDownload` SSoT for browser download
 *
 * Pure module — no React, no Firestore, no canvas coupling. Caller
 * (OpeningSchedulePdfHost) owns data fetch + label resolution.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §7 C.3
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { nowISO } from '@/lib/date-local';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import type { Schedule } from '../types';
import type { HeaderTranslator } from './csv-exporter';
import { formatCellForDisplay } from './value-formatters';

// ─── Layout constants ─────────────────────────────────────────────────────────

const MARGIN_MM = 12;
const MAIN_HEADER_H = 16;
const SECTION_LABEL_H = 8;
const SECTION_GAP_MM = 6;

const BLUE: [number, number, number] = [30, 64, 175];
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_500: [number, number, number] = [71, 85, 105];
const SLATE_100: [number, number, number] = [241, 245, 249];
const WHITE: [number, number, number] = [255, 255, 255];

// ─── Build helpers ────────────────────────────────────────────────────────────

function buildBody(schedule: Schedule): string[][] {
  return schedule.rows.map((row) =>
    schedule.columns.map((col) =>
      formatCellForDisplay(row.cells[col.key] ?? null, col.valueType),
    ),
  );
}

function buildHead(schedule: Schedule, translateHeader: HeaderTranslator): string[][] {
  return [schedule.columns.map((c) => translateHeader(c.i18nKey))];
}

function columnStylesFor(
  columns: readonly { align: 'left' | 'center' | 'right' }[],
): Record<number, { halign: 'left' | 'center' | 'right' }> {
  const styles: Record<number, { halign: 'left' | 'center' | 'right' }> = {};
  columns.forEach((col, i) => { styles[i] = { halign: col.align }; });
  return styles;
}

function getLastTableY(pdf: jsPDF): number {
  const doc = pdf as unknown as { lastAutoTable?: { finalY?: number } };
  return doc.lastAutoTable?.finalY ?? MAIN_HEADER_H + 6;
}

// ─── Draw primitives ─────────────────────────────────────────────────────────

function drawMainHeader(pdf: jsPDF, title: string, projectName: string): void {
  const pw = pdf.internal.pageSize.getWidth();
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...SLATE_800);
  pdf.text(title, MARGIN_MM, MAIN_HEADER_H);

  if (projectName) {
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...SLATE_500);
    pdf.text(projectName, MARGIN_MM + 90, MAIN_HEADER_H);
  }

  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE_500);
  pdf.text(nowISO().slice(0, 10), pw - MARGIN_MM, MAIN_HEADER_H, { align: 'right' });

  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN_MM, MAIN_HEADER_H + 3, pw - MARGIN_MM, MAIN_HEADER_H + 3);
}

function drawSectionLabel(pdf: jsPDF, label: string, y: number): void {
  const pw = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(...SLATE_100);
  pdf.rect(MARGIN_MM, y - 1, pw - MARGIN_MM * 2, SECTION_LABEL_H - 1, 'F');
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE_800);
  pdf.text(label, MARGIN_MM + 2, y + SECTION_LABEL_H - 3);
}

function drawFooters(pdf: jsPDF, footerLabel: string): void {
  const totalPages = pdf.getNumberOfPages();
  const pw = pdf.internal.pageSize.getWidth();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    const ph = pdf.internal.pageSize.getHeight();
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE_500);
    pdf.text(footerLabel, MARGIN_MM, ph - 6);
    pdf.text(`${i} / ${totalPages}`, pw - MARGIN_MM, ph - 6, { align: 'right' });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface OpeningSchedulePdfOptions {
  /** PDF main title — e.g. "Πίνακας Κουφωμάτων" */
  readonly scheduleTitle: string;
  /** Project name shown next to title */
  readonly projectName: string;
  /** Section label for door table — e.g. "Πόρτες" */
  readonly doorLabel: string;
  /** Section label for window table — e.g. "Παράθυρα" */
  readonly windowLabel: string;
  /** Filename without extension */
  readonly filename: string;
}

/**
 * Generate and trigger browser download of a combined door + window
 * opening schedule PDF. Empty sections are skipped (no blank table rendered).
 */
export async function downloadOpeningScheduleAsPdf(
  doorSchedule: Schedule,
  windowSchedule: Schedule,
  options: OpeningSchedulePdfOptions,
  translateHeader: HeaderTranslator,
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await registerGreekFont(pdf);

  drawMainHeader(pdf, options.scheduleTitle, options.projectName);

  let nextY = MAIN_HEADER_H + 6;

  if (doorSchedule.rows.length > 0) {
    drawSectionLabel(pdf, options.doorLabel, nextY);
    nextY += SECTION_LABEL_H;
    autoTable(pdf, {
      startY: nextY,
      margin: { left: MARGIN_MM, right: MARGIN_MM },
      styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      head: buildHead(doorSchedule, translateHeader),
      body: buildBody(doorSchedule),
      columnStyles: columnStylesFor(doorSchedule.columns),
    });
    nextY = getLastTableY(pdf) + SECTION_GAP_MM;
  }

  if (windowSchedule.rows.length > 0) {
    drawSectionLabel(pdf, options.windowLabel, nextY);
    nextY += SECTION_LABEL_H;
    autoTable(pdf, {
      startY: nextY,
      margin: { left: MARGIN_MM, right: MARGIN_MM },
      styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      head: buildHead(windowSchedule, translateHeader),
      body: buildBody(windowSchedule),
      columnStyles: columnStylesFor(windowSchedule.columns),
    });
  }

  drawFooters(pdf, options.scheduleTitle);

  const blob = pdf.output('blob');
  triggerExportDownload({ blob, filename: `${options.filename}.pdf` });
}
