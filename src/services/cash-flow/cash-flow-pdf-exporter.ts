/**
 * @fileoverview Cash Flow Forecast PDF Exporter — ADR-268 Phase 8
 * @description Branded A4 PDF: KPIs + combo chart + monthly table + PDC summary.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, <500 lines
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import type {
  ScenarioProjection,
  CashFlowMonthRow,
  PDCCalendarDay,
} from './cash-flow.types';

// =============================================================================
// CONSTANTS
// =============================================================================

const MARGIN = 14;
const PRIMARY: [number, number, number] = [59, 130, 246];
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_500: [number, number, number] = [71, 85, 105];
const NAVY: [number, number, number] = [30, 58, 95];
const GREEN_700: [number, number, number] = [21, 128, 61];
const RED_700: [number, number, number] = [185, 28, 28];

// =============================================================================
// EXPORT PARAMS
// =============================================================================

export interface CashFlowPDFParams {
  projection: ScenarioProjection;
  pdcCalendar: PDCCalendarDay[];
  chartImageDataUrl: string | null;
  userName: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtDate(): string {
  return new Date().toLocaleDateString('el-GR');
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

export async function exportCashFlowToPdf(params: CashFlowPDFParams): Promise<void> {
  const { projection, pdcCalendar, chartImageDataUrl, userName } = params;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await registerGreekFont(doc);
  doc.setFont('NotoSans', 'normal');

  // Page 1: Header + KPIs + Chart
  drawHeader(doc, projection);
  drawKPICards(doc, projection);

  if (chartImageDataUrl) {
    drawChart(doc, chartImageDataUrl);
  }

  // Page 2: Monthly table
  doc.addPage();
  drawMonthlyTable(doc, projection.months);

  // Page 3: PDC Calendar summary (if any)
  if (pdcCalendar.length > 0) {
    doc.addPage();
    drawPDCTable(doc, pdcCalendar);
  }

  // Footer on all pages
  addPageFooters(doc, userName);

  // Save
  const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, '');
  const scenario = projection.scenario;
  doc.save(`Nestor_CashFlow_${scenario}_${dateStr}.pdf`);
}

// =============================================================================
// DRAW FUNCTIONS
// =============================================================================

function drawHeader(doc: jsPDF, projection: ScenarioProjection): void {
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text('Cash Flow Forecast', MARGIN, 20);

  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  const scenarioLabel = `${projection.scenario.charAt(0).toUpperCase()}${projection.scenario.slice(1)} (${(projection.collectionRate * 100).toFixed(0)}%)`;
  doc.text(`Scenario: ${scenarioLabel} | Generated: ${fmtDate()}`, MARGIN, 27);

  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 30, 283, 30);
}

function drawKPICards(doc: jsPDF, projection: ScenarioProjection): void {
  const firstMonth = projection.months[0];
  const kpis = [
    { label: 'Current Balance', value: fmtCurrency(firstMonth?.openingBalance ?? 0) },
    { label: 'Forecast Inflow (12M)', value: fmtCurrency(projection.totalInflow) },
    { label: 'Forecast Outflow (12M)', value: fmtCurrency(projection.totalOutflow) },
    { label: 'Lowest Balance', value: fmtCurrency(projection.lowestBalance) },
  ];

  const cardWidth = 63;
  const cardHeight = 18;
  const startX = MARGIN;
  const startY = 34;

  kpis.forEach((kpi, i) => {
    const x = startX + i * (cardWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setTextColor(...SLATE_500);
    doc.text(kpi.label, x + 4, startY + 7);

    doc.setFontSize(12);
    doc.setTextColor(...SLATE_800);
    doc.text(kpi.value, x + 4, startY + 14);
  });
}

function drawChart(doc: jsPDF, chartImage: string): void {
  const imgWidth = 255;
  const imgHeight = 90;
  doc.addImage(chartImage, 'PNG', MARGIN, 58, imgWidth, imgHeight);
}

function drawMonthlyTable(doc: jsPDF, months: CashFlowMonthRow[]): void {
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('Monthly Breakdown', MARGIN, 15);

  const headers = [
    'Month', 'Opening', 'Installments', 'Cheques', 'Total In',
    'POs', 'Invoices', 'EFKA', 'Recurring', 'Total Out',
    'Net', 'Closing',
  ];

  const body = months.map((m) => [
    m.label,
    fmtCurrency(m.openingBalance),
    fmtCurrency(m.installmentsDue),
    fmtCurrency(m.chequesMaturingAmount),
    fmtCurrency(m.totalInflow),
    fmtCurrency(m.purchaseOrders),
    fmtCurrency(m.invoicesDue),
    fmtCurrency(m.efka),
    fmtCurrency(m.recurringPayments),
    fmtCurrency(m.totalOutflow),
    fmtCurrency(m.netCashFlow),
    fmtCurrency(m.closingBalance),
  ]);

  autoTable(doc, {
    startY: 20,
    head: [headers],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: NAVY,
      fontSize: 7,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 2,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      4: { textColor: GREEN_700, fontStyle: 'bold' },
      9: { textColor: RED_700, fontStyle: 'bold' },
      10: { fontStyle: 'bold' },
      11: { fontStyle: 'bold' },
    },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (data) => {
      // Highlight negative closing balance rows
      if (data.section === 'body' && data.column.index === 11) {
        const raw = months[data.row.index]?.closingBalance ?? 0;
        if (raw < 0) {
          data.cell.styles.textColor = RED_700;
        }
      }
    },
  });
}

function drawPDCTable(doc: jsPDF, pdcCalendar: PDCCalendarDay[]): void {
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('PDC Maturity Calendar', MARGIN, 15);

  const headers = ['Date', 'Cheques', 'Total Amount'];
  const body = pdcCalendar.map((day) => [
    day.date,
    String(day.chequeCount),
    fmtCurrency(day.totalAmount),
  ]);

  autoTable(doc, {
    startY: 20,
    head: [headers],
    body,
    theme: 'grid',
    headStyles: { fillColor: NAVY, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: MARGIN, right: MARGIN },
  });
}

function addPageFooters(doc: jsPDF, userName: string): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(7);
    doc.setTextColor(...SLATE_500);
    doc.text(
      `Nestor — Cash Flow Forecast | ${userName} | ${fmtDate()}`,
      MARGIN,
      pageHeight - 8,
    );
    doc.text(
      `${i} / ${pageCount}`,
      pageWidth - MARGIN,
      pageHeight - 8,
      { align: 'right' },
    );
  }
}
