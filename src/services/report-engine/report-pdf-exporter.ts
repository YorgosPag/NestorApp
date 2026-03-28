/**
 * Report PDF Exporter — Generic Enterprise PDF Generation
 *
 * Accepts pre-prepared config (titles, KPI cards, chart images, tables)
 * and produces a branded A4 PDF with Greek Roboto font support.
 *
 * Pattern: milestone-pdf-exporter.ts (jsPDF + autoTable + registerGreekFont)
 *
 * @module services/report-engine/report-pdf-exporter
 * @see ADR-265 §8.16 (Export Best Practices), §12.7 (PDF Branding)
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateShort } from '@/lib/intl-utils';
import type { TrafficLight } from './evm-calculator';

// ============================================================================
// TYPES
// ============================================================================

export interface ReportPdfKpiCard {
  label: string;
  value: string;
  color: [number, number, number];
  health?: TrafficLight;
}

export interface ReportPdfChartImage {
  title: string;
  /** Pre-captured PNG data URL via html-to-image toPng() */
  dataUrl: string;
  /** Width in mm (default: full content width) */
  width?: number;
  /** Height in mm (default: proportional) */
  height?: number;
}

export interface ReportPdfTable {
  title: string;
  headers: string[];
  rows: string[][];
  /** Optional column widths (mm). If omitted, auto-sized */
  columnWidths?: number[];
}

export interface ReportPdfConfig {
  title: string;
  subtitle?: string;
  orientation: 'portrait' | 'landscape';
  companyName?: string;
  projectName?: string;
  /** Header logo data URL (pagonis-energo-logo) */
  headerLogoDataUrl?: string;
  /** Footer logo data URL (nestor-app-logo) */
  footerLogoDataUrl?: string;
  kpiCards?: ReportPdfKpiCard[];
  chartImages?: ReportPdfChartImage[];
  tables?: ReportPdfTable[];
  filename: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MARGIN = 14;
const PRIMARY_COLOR: [number, number, number] = [59, 130, 246]; // blue-500
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_500: [number, number, number] = [71, 85, 105];
const SLATE_400: [number, number, number] = [148, 163, 184];
const SLATE_200: [number, number, number] = [226, 232, 240];

const HEALTH_COLORS: Record<TrafficLight, [number, number, number]> = {
  green: [34, 197, 94],
  amber: [245, 158, 11],
  red: [239, 68, 68],
};

// Greek font registration — SSOT: src/services/pdf/greek-font-loader.ts
import { registerGreekFont } from '@/services/pdf/greek-font-loader';

// ============================================================================
// DRAW FUNCTIONS
// ============================================================================

function drawReportHeader(
  pdf: jsPDF,
  config: ReportPdfConfig,
  pageWidth: number,
): number {
  let y = 20;

  // Header logo (optional)
  if (config.headerLogoDataUrl) {
    try {
      pdf.addImage(config.headerLogoDataUrl, 'PNG', MARGIN, y - 6, 30, 10);
      y += 8;
    } catch {
      // Logo failed to load — continue without it
    }
  }

  // Report title
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(...SLATE_800);
  pdf.text(config.title, MARGIN, y);

  // Report date (right-aligned)
  pdf.setFont('Roboto', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...SLATE_500);
  pdf.text(
    `Ημ. Αναφοράς: ${formatDateShort(new Date())}`,
    pageWidth - MARGIN,
    y,
    { align: 'right' },
  );

  // Subtitle
  if (config.subtitle) {
    y += 7;
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(...SLATE_500);
    pdf.text(config.subtitle, MARGIN, y);
  }

  // Company name
  if (config.companyName) {
    y += 7;
    pdf.setFont('Roboto', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...SLATE_800);
    pdf.text(`Εταιρεία: ${config.companyName}`, MARGIN, y);
  }

  // Project name
  if (config.projectName) {
    y += 7;
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(...SLATE_500);
    pdf.text(`Έργο: ${config.projectName}`, MARGIN, y);
  }

  // Separator line
  y += 5;
  pdf.setDrawColor(...PRIMARY_COLOR);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, pageWidth - MARGIN, y);

  return y + 6;
}

function drawKPICards(
  pdf: jsPDF,
  cards: ReportPdfKpiCard[],
  y: number,
  pageWidth: number,
): number {
  if (cards.length === 0) return y;

  const contentWidth = pageWidth - 2 * MARGIN;
  const gap = 5;
  const maxCols = Math.min(cards.length, 4);
  const boxWidth = (contentWidth - (maxCols - 1) * gap) / maxCols;
  const boxHeight = 22;

  const rows = Math.ceil(cards.length / maxCols);

  for (let row = 0; row < rows; row++) {
    const rowCards = cards.slice(row * maxCols, (row + 1) * maxCols);

    for (let col = 0; col < rowCards.length; col++) {
      const card = rowCards[col];
      const x = MARGIN + col * (boxWidth + gap);
      const boxY = y + row * (boxHeight + gap);

      // Box background (light tint)
      pdf.setFillColor(card.color[0], card.color[1], card.color[2]);
      pdf.setGState(pdf.GState({ opacity: 0.1 }));
      pdf.roundedRect(x, boxY, boxWidth, boxHeight, 2, 2, 'F');
      pdf.setGState(pdf.GState({ opacity: 1 }));

      // Box border
      pdf.setDrawColor(card.color[0], card.color[1], card.color[2]);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, boxY, boxWidth, boxHeight, 2, 2, 'S');

      // Value
      pdf.setFont('Roboto', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(card.color[0], card.color[1], card.color[2]);
      pdf.text(card.value, x + boxWidth / 2, boxY + 10, { align: 'center' });

      // Label
      pdf.setFont('Roboto', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...SLATE_500);
      pdf.text(card.label, x + boxWidth / 2, boxY + 17, { align: 'center' });

      // Health indicator dot
      if (card.health) {
        const dotColor = HEALTH_COLORS[card.health];
        pdf.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
        pdf.circle(x + boxWidth - 5, boxY + 5, 2, 'F');
      }
    }
  }

  return y + rows * (boxHeight + gap) + 4;
}

function drawChartImage(
  pdf: jsPDF,
  image: ReportPdfChartImage,
  y: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const contentWidth = pageWidth - 2 * MARGIN;

  // Check page break
  const imgHeight = image.height ?? 80;
  if (y + imgHeight + 12 > pageHeight - 25) {
    pdf.addPage();
    pdf.setFont('Roboto', 'normal');
    y = 20;
  }

  // Chart title
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...SLATE_800);
  pdf.text(image.title, MARGIN, y);
  y += 5;

  // Chart image
  const imgWidth = image.width ?? contentWidth;
  try {
    pdf.addImage(image.dataUrl, 'PNG', MARGIN, y, imgWidth, imgHeight);
  } catch {
    // Chart capture failed — render placeholder
    pdf.setFillColor(...SLATE_200);
    pdf.roundedRect(MARGIN, y, imgWidth, imgHeight, 2, 2, 'F');
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...SLATE_400);
    pdf.text('Γράφημα μη διαθέσιμο', MARGIN + imgWidth / 2, y + imgHeight / 2, { align: 'center' });
  }

  return y + imgHeight + 8;
}

function drawTable(
  pdf: jsPDF,
  table: ReportPdfTable,
  y: number,
  pageHeight: number,
): number {
  // Check page break
  if (y + 30 > pageHeight - 25) {
    pdf.addPage();
    pdf.setFont('Roboto', 'normal');
    y = 20;
  }

  // Table title
  pdf.setFont('Roboto', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...SLATE_800);
  pdf.text(table.title, MARGIN, y);
  y += 4;

  const columnStyles: Record<number, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }> = {};
  if (table.columnWidths) {
    table.columnWidths.forEach((w, i) => {
      columnStyles[i] = { cellWidth: w };
    });
  }

  autoTable(pdf, {
    head: [table.headers],
    body: table.rows,
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 9, font: 'Roboto', cellPadding: 3 },
    headStyles: { fillColor: PRIMARY_COLOR, fontStyle: 'bold' },
    columnStyles,
    didParseCell: (data) => {
      data.cell.styles.font = 'Roboto';
    },
  });

  const finalY = (pdf as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 50;
  return finalY + 8;
}

function addPageFooters(
  pdf: jsPDF,
  pageWidth: number,
  pageHeight: number,
): void {
  const totalPages = pdf.getNumberOfPages();
  const timestamp = new Date().toLocaleString('el-GR');

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...SLATE_400);

    // Left: page number
    pdf.text(`Σελίδα ${i}/${totalPages}`, MARGIN, pageHeight - 8);

    // Center: branding
    pdf.text('Nestor App', pageWidth / 2, pageHeight - 8, { align: 'center' });

    // Right: timestamp
    pdf.text(timestamp, pageWidth - MARGIN, pageHeight - 8, { align: 'right' });

    // Separator line above footer
    pdf.setDrawColor(...SLATE_200);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);
  }
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Export a report to PDF.
 *
 * Chart images must be pre-captured on the client side via:
 * ```ts
 * import { toPng } from 'html-to-image';
 * const dataUrl = await toPng(element, { backgroundColor: '#fff', quality: 1.0, pixelRatio: 2 });
 * ```
 */
export async function exportReportToPdf(config: ReportPdfConfig): Promise<void> {
  const pdf = new jsPDF({
    orientation: config.orientation,
    unit: 'mm',
    format: 'a4',
  });

  await registerGreekFont(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // 1. Header
  let y = drawReportHeader(pdf, config, pageWidth);

  // 2. KPI Cards
  if (config.kpiCards && config.kpiCards.length > 0) {
    y = drawKPICards(pdf, config.kpiCards, y, pageWidth);
  }

  // 3. Chart Images
  if (config.chartImages) {
    for (const image of config.chartImages) {
      y = drawChartImage(pdf, image, y, pageWidth, pageHeight);
    }
  }

  // 4. Tables
  if (config.tables) {
    for (const table of config.tables) {
      y = drawTable(pdf, table, y, pageHeight);
    }
  }

  // 5. Footers on all pages
  addPageFooters(pdf, pageWidth, pageHeight);

  // 6. Download
  pdf.save(config.filename);
}
