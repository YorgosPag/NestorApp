/**
 * ADR-422 L5 — Μηχανολογική Μελέτη Θέρμανσης: PDF exporter (printout).
 *
 * Πολυσέλιδο A4-landscape PDF report (σύνοψη + 4 πίνακες) από το `ThermalStudyReport`.
 * Κλωνοποιεί το multi-section pattern του `opening-schedule-pdf-exporter.ts` (drawMainHeader
 * → drawSectionLabel → autoTable με `startY` από `lastAutoTable.finalY` → drawFooters) και
 * REUSE-άρει τα SSoT: `registerGreekFont` (MANDATORY πριν Ελληνικά) · `triggerExportDownload` ·
 * `formatCellForDisplay` · `nowISO`. Pure module — no React/Firestore/canvas. Ο caller (widget)
 * παρέχει τον translator (i18n SSoT).
 *
 * @see ../schedule/exporters/opening-schedule-pdf-exporter (pattern) · ./thermal-study-report
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L5)
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { nowISO } from '@/lib/date-local';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import { formatCellForDisplay } from '../../schedule/exporters/value-formatters';
import type { ReportSection, ThermalStudyReport } from './thermal-study-report-types';

// ─── Layout constants ──────────────────────────────────────────────────────────

const MARGIN_MM = 12;
const MAIN_HEADER_H = 16;
const SUBTITLE_H = 6;
const SECTION_LABEL_H = 8;
const SECTION_GAP_MM = 6;

const BLUE: [number, number, number] = [30, 64, 175];
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_500: [number, number, number] = [71, 85, 105];
const SLATE_100: [number, number, number] = [241, 245, 249];
const WHITE: [number, number, number] = [255, 255, 255];

/** Translator i18nKey → localized string (injected — i18n SSoT στον caller). */
export type ReportTranslate = (i18nKey: string) => string;

export interface ThermalStudyPdfOptions {
  /** Already-translated PDF title (Μηχανολογική Μελέτη Θέρμανσης). */
  readonly title: string;
  /** Κανονισμοί (codes) — already resolved. */
  readonly regulations: string;
  /** Filename χωρίς επέκταση. */
  readonly filename: string;
}

// ─── Build helpers (reuse value-formatters SSoT) ───────────────────────────────

function buildBody(section: ReportSection): string[][] {
  return section.rows.map((row) =>
    section.columns.map((c) => formatCellForDisplay(row[c.key] ?? null, c.valueType)),
  );
}

function buildHead(section: ReportSection, translate: ReportTranslate): string[][] {
  return [section.columns.map((c) => translate(c.i18nKey))];
}

function columnStylesFor(
  section: ReportSection,
): Record<number, { halign: 'left' | 'center' | 'right' }> {
  const styles: Record<number, { halign: 'left' | 'center' | 'right' }> = {};
  section.columns.forEach((c, i) => { styles[i] = { halign: c.align }; });
  return styles;
}

function getLastTableY(pdf: jsPDF): number {
  const doc = pdf as unknown as { lastAutoTable?: { finalY?: number } };
  return doc.lastAutoTable?.finalY ?? MAIN_HEADER_H + 6;
}

// ─── Draw primitives ───────────────────────────────────────────────────────────

function drawMainHeader(pdf: jsPDF, report: ThermalStudyReport, options: ThermalStudyPdfOptions): void {
  const pw = pdf.internal.pageSize.getWidth();
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...SLATE_800);
  pdf.text(options.title, MARGIN_MM, MAIN_HEADER_H);

  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...SLATE_500);
  pdf.text(nowISO().slice(0, 10), pw - MARGIN_MM, MAIN_HEADER_H, { align: 'right' });

  const context = [report.header.buildingLabel, report.header.floorLabel]
    .filter((s) => s.length > 0)
    .join(' · ');
  const subtitle = context ? `${context}  —  ${options.regulations}` : options.regulations;
  pdf.text(subtitle, MARGIN_MM, MAIN_HEADER_H + SUBTITLE_H);

  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN_MM, MAIN_HEADER_H + SUBTITLE_H + 2, pw - MARGIN_MM, MAIN_HEADER_H + SUBTITLE_H + 2);
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

function drawSection(
  pdf: jsPDF,
  section: ReportSection,
  startY: number,
  translate: ReportTranslate,
): number {
  drawSectionLabel(pdf, translate(section.titleKey), startY);
  autoTable(pdf, {
    startY: startY + SECTION_LABEL_H,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    head: buildHead(section, translate),
    body: buildBody(section),
    columnStyles: columnStylesFor(section),
  });
  return getLastTableY(pdf) + SECTION_GAP_MM;
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

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Δημιουργεί το report PDF Blob. Πάντα ζωγραφίζει τη σύνοψη (sections[0])· οι κενοί
 * πίνακες παραλείπονται (κανένας άδειος πίνακας — mirror opening exporter).
 */
export async function thermalStudyToPdfBlob(
  report: ThermalStudyReport,
  options: ThermalStudyPdfOptions,
  translate: ReportTranslate,
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await registerGreekFont(pdf);

  drawMainHeader(pdf, report, options);
  let nextY = MAIN_HEADER_H + SUBTITLE_H + 6;

  report.sections.forEach((section, i) => {
    if (i > 0 && section.rows.length === 0) return; // skip empty data tables
    nextY = drawSection(pdf, section, nextY, translate);
  });

  drawFooters(pdf, options.title);
  return pdf.output('blob');
}

/** Δημιουργεί + κατεβάζει το report PDF (`.pdf`). */
export async function downloadThermalStudyAsPdf(
  report: ThermalStudyReport,
  options: ThermalStudyPdfOptions,
  translate: ReportTranslate,
): Promise<void> {
  const blob = await thermalStudyToPdfBlob(report, options, translate);
  triggerExportDownload({ blob, filename: `${options.filename}.pdf` });
}
