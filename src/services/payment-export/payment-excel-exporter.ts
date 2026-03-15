/**
 * 🏢 Payment Excel Exporter — ADR-234 Phase 5
 *
 * Exports PaymentReportData to a styled Excel workbook with 2 sheets:
 * - Sheet 1: "Κατάσταση Πληρωμών" — per-unit detail rows
 * - Sheet 2: "Σύνοψη" — project-level aggregates
 *
 * Reuses ExcelJS patterns from gantt-excel-exporter.
 *
 * @module services/payment-export/payment-excel-exporter
 */

import ExcelJS from 'exceljs';
import { designTokens } from '@/styles/design-tokens';
import { triggerBlobDownload } from '@/services/gantt-export/gantt-export-utils';
import { formatDateShort } from '@/lib/intl-utils';
import type { PaymentReportData } from '@/services/payment-export/types';

// =============================================================================
// STYLE HELPERS
// =============================================================================

const toExcelArgb = (hexColor: string): string => {
  const normalized = hexColor.replace('#', '').toUpperCase();
  return `FF${normalized}`;
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: toExcelArgb(designTokens.colors.blue['500']) },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: toExcelArgb(designTokens.colors.background.primary) },
  size: 11,
};

const OVERDUE_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: toExcelArgb(designTokens.colors.error['50']) },
};

const SUMMARY_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: toExcelArgb(designTokens.colors.green['500']) },
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};

const STATUS_LABELS: Record<string, string> = {
  negotiation: 'Διαπραγμάτευση',
  draft: 'Σχέδιο',
  active: 'Ενεργό',
  completed: 'Ολοκληρωμένο',
  cancelled: 'Ακυρωμένο',
  not_applicable: 'Δεν απαιτείται',
  pending: 'Αναμένεται',
  applied: 'Κατατέθηκε',
  pre_approved: 'Προέγκριση',
  approved: 'Εγκρίθηκε',
  disbursed: 'Εκταμιεύτηκε',
  rejected: 'Απορρίφθηκε',
  exploring: 'Αναζήτηση',
  fully_disbursed: 'Πλήρης Εκταμίευση',
  partially_disbursed: 'Μερική Εκταμίευση',
};

// =============================================================================
// SHEET 1: DETAIL TABLE
// =============================================================================

function buildDetailSheet(workbook: ExcelJS.Workbook, data: PaymentReportData): void {
  const sheet = workbook.addWorksheet('Κατάσταση Πληρωμών');

  sheet.columns = [
    { header: 'Μονάδα', key: 'unit', width: 12 },
    { header: 'Κτίριο', key: 'building', width: 16 },
    { header: 'Αγοραστής', key: 'buyer', width: 22 },
    { header: 'Κατάσταση', key: 'status', width: 16 },
    { header: 'Σύνολο (€)', key: 'total', width: 14 },
    { header: 'Πληρωμένο (€)', key: 'paid', width: 14 },
    { header: 'Υπόλοιπο (€)', key: 'remaining', width: 14 },
    { header: '%', key: 'pct', width: 8 },
    { header: 'Δόσεις', key: 'installments', width: 10 },
    { header: 'Ληξ/θεσμες', key: 'overdue', width: 12 },
    { header: 'Επόμενη Δόση (€)', key: 'nextAmount', width: 16 },
    { header: 'Ημ/νία', key: 'nextDate', width: 12 },
    { header: 'Δάνειο', key: 'loan', width: 18 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  // Add data rows
  for (const row of data.rows) {
    const loanDisplay = row.primaryLoanBank
      ? `${row.primaryLoanBank} (${STATUS_LABELS[row.primaryLoanStatus ?? ''] ?? row.primaryLoanStatus ?? '-'})`
      : STATUS_LABELS[row.loanStatus] ?? row.loanStatus;

    const excelRow = sheet.addRow({
      unit: row.unitLabel,
      building: row.buildingName,
      buyer: row.buyerName,
      status: STATUS_LABELS[row.planStatus] ?? row.planStatus,
      total: row.totalAmount,
      paid: row.paidAmount,
      remaining: row.remainingAmount,
      pct: row.paidPercentage,
      installments: `${row.paidInstallments}/${row.totalInstallments}`,
      overdue: row.overdueInstallments,
      nextAmount: row.nextInstallmentAmount ?? '-',
      nextDate: row.nextInstallmentDate ? formatDateShort(row.nextInstallmentDate) : '-',
      loan: loanDisplay,
    });

    excelRow.border = BORDER_THIN;

    // Highlight overdue rows
    if (row.overdueInstallments > 0) {
      excelRow.fill = OVERDUE_FILL;
      excelRow.getCell('overdue').font = {
        bold: true,
        color: { argb: toExcelArgb(designTokens.colors.red['600']) },
      };
    }

    // Format currency cells
    for (const cellKey of ['total', 'paid', 'remaining']) {
      const cell = excelRow.getCell(cellKey);
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'right' };
    }

    // Format percentage
    const pctCell = excelRow.getCell('pct');
    pctCell.numFmt = '0.00"%"';
    pctCell.alignment = { horizontal: 'center' };
  }

  // Auto-filter
  const lastRow = data.rows.length + 1;
  sheet.autoFilter = { from: 'A1', to: `M${lastRow}` };
}

// =============================================================================
// SHEET 2: SUMMARY
// =============================================================================

function buildSummarySheet(workbook: ExcelJS.Workbook, data: PaymentReportData): void {
  const sheet = workbook.addWorksheet('Σύνοψη');

  sheet.columns = [
    { header: 'Μετρική', key: 'metric', width: 30 },
    { header: 'Τιμή', key: 'value', width: 25 },
  ];

  // Header style
  const headerRow = sheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = SUMMARY_HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  const summaryRows: Array<{ metric: string; value: string | number }> = [
    { metric: 'Έργο', value: data.projectName },
    { metric: 'Ημερομηνία Αναφοράς', value: formatDateShort(data.generatedAt) },
    { metric: '', value: '' },
    { metric: 'Μονάδες με Πρόγραμμα', value: data.summary.totalUnitsWithPlan },
    { metric: 'Μονάδες χωρίς Πρόγραμμα', value: data.summary.totalUnitsWithoutPlan },
    { metric: '', value: '' },
    { metric: 'Συνολικό Ποσό (€)', value: data.summary.totalAmount },
    { metric: 'Πληρωμένο (€)', value: data.summary.totalPaid },
    { metric: 'Υπόλοιπο (€)', value: data.summary.totalRemaining },
    { metric: 'Ποσοστό Εξόφλησης (%)', value: data.summary.paidPercentage },
    { metric: '', value: '' },
    { metric: 'Ληξιπρόθεσμες Δόσεις', value: data.summary.totalOverdueCount },
  ];

  for (const item of summaryRows) {
    const row = sheet.addRow(item);
    row.border = BORDER_THIN;
    row.getCell('metric').font = { bold: true };

    // Format currency values
    if (typeof item.value === 'number' && item.metric.includes('€')) {
      row.getCell('value').numFmt = '#,##0.00';
      row.getCell('value').alignment = { horizontal: 'right' };
    }
  }

  // Highlight overdue row
  if (data.summary.totalOverdueCount > 0) {
    const lastDataRow = sheet.lastRow;
    if (lastDataRow) {
      lastDataRow.fill = OVERDUE_FILL;
      lastDataRow.getCell('value').font = {
        bold: true,
        color: { argb: toExcelArgb(designTokens.colors.red['600']) },
      };
    }
  }
}

// =============================================================================
// EXPORT FUNCTION
// =============================================================================

export async function exportPaymentReportToExcel(data: PaymentReportData): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nestor Pagonis';
  workbook.created = new Date();

  buildDetailSheet(workbook, data);
  buildSummarySheet(workbook, data);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const safeProjectName = data.projectName.replace(/[^a-zA-Zα-ωΑ-Ω0-9\s-]/g, '').trim();
  const filename = `Πληρωμές_${safeProjectName}_${dateStr}.xlsx`;

  triggerBlobDownload(blob, filename);
}
