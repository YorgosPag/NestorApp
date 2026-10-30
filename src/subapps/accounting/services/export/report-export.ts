/**
 * @fileoverview Εξαγωγή οικονομικής αναφοράς — ΜΙΑ σωλήνωση, ένας σειριοποιητής ανά μορφή
 * @description «Download as» των Google Sheets: ο πίνακας ισοπεδώνεται ΜΙΑ φορά, κάθε μορφή είναι καθαρή συνάρτηση
 *   έγγραφο → Blob, και όνομα αρχείου + λήψη ζουν ΕΔΩ. Ως 2026-10-30 κάθε εξαγωγέας (PDF/Excel/CSV) ξανάγραφε την
 *   υπογραφή πέντε θέσεων, την ισοπέδωση, το `buildFilename` και τη λήψη — το CHECK 3.28 μέτρησε το δίδυμο.
 * @see ADR-584 §9 · DECISIONS-PHASE-2.md §2e (Q8 — export formats)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { ReportType, ReportDataMap, ResolvedPeriods } from '../../types/reports';
import { flattenReportForExport } from './report-table-adapter';
import type { FlatTableData, ReportTranslate } from './report-table-adapter';
import { reportPeriodLine } from './report-document-text';
import { triggerBlobDownload } from '@/services/gantt-export/gantt-export-utils';

export type ReportExportFormat = 'pdf' | 'excel' | 'csv';

/** Τι ζητά η διεπαφή. Ο `t` περνά ΡΗΤΑ: το αρχείο γράφεται στη γλώσσα της διεπαφής, όχι του καθολικού i18next. */
export interface ReportExportRequest {
  readonly reportType: ReportType;
  readonly data: ReportDataMap[ReportType];
  readonly period: ResolvedPeriods;
  readonly title: string;
  readonly t: ReportTranslate;
}

/** Ό,τι διαβάζει κάθε σειριοποιητής — ο πίνακας ΗΔΗ ισοπεδωμένος, μία φορά για όλες τις μορφές. */
export interface ReportDocument {
  readonly table: FlatTableData;
  readonly title: string;
  readonly periodLine: string;
  readonly t: ReportTranslate;
}

/** Μία μορφή: επέκταση + καθαρή σειριοποίηση. Καμία λήψη, κανένα όνομα αρχείου — αυτά ανήκουν στη σωλήνωση. */
export interface ReportSerializer {
  readonly extension: string;
  serialize(doc: ReportDocument): Blob | Promise<Blob>;
}

/** Φόρτωση κατ' απαίτηση: jsPDF / ExcelJS μπαίνουν στο bundle ΜΟΝΟ όταν ζητηθεί η μορφή τους. */
const SERIALIZERS: Record<ReportExportFormat, () => Promise<ReportSerializer>> = {
  pdf: () => import('./pdf-exporter').then((module) => module.pdfReportSerializer),
  excel: () => import('./excel-exporter').then((module) => module.excelReportSerializer),
  csv: () => import('./csv-exporter').then((module) => module.csvReportSerializer),
};

/** `<τύπος>_<ΕΕΕΕΜΜΗΗ αρχής περιόδου>.<επέκταση>` — ΕΝΑΣ κανόνας ονομασίας για όλες τις μορφές. */
export function reportFilename(reportType: ReportType, period: ResolvedPeriods, extension: string): string {
  return `${reportType}_${period.current.from.replace(/-/g, '')}.${extension}`;
}

export function buildReportDocument(request: ReportExportRequest): ReportDocument {
  return {
    table: flattenReportForExport(request.reportType, request.data, request.t),
    title: request.title,
    periodLine: reportPeriodLine(request.period, request.t),
    t: request.t,
  };
}

export async function exportReport(format: ReportExportFormat, request: ReportExportRequest): Promise<void> {
  const serializer = await SERIALIZERS[format]();
  const blob = await serializer.serialize(buildReportDocument(request));
  triggerBlobDownload(blob, reportFilename(request.reportType, request.period, serializer.extension));
}
