/**
 * @jest-environment node
 *
 * Άγκυρα — Σωλήνωση εξαγωγής αναφοράς (ADR-584 §9 · ADR-ACC-010 §2.1.1)
 *
 * Φυλά ότι ΕΝΑ σημείο κάνει ό,τι ως 2026-10-30 ξανάγραφε κάθε εξαγωγέας:
 *   1. όνομα αρχείου ΕΝΑΣ κανόνας, επέκταση από τον σειριοποιητή (όχι τρία `buildFilename`)·
 *   2. ο πίνακας ισοπεδώνεται ΜΙΑ φορά και ο σειριοποιητής παίρνει το ΙΔΙΟ έγγραφο·
 *   3. ο CSV σειριοποιητής είναι καθαρός: BOM · escaping · ωμοί αριθμοί · μεταφρασμένες κεφαλίδες.
 * Οι PDF/Excel αντικαθίστανται με ψεύτικους — εδώ ελέγχεται η ΣΩΛΗΝΩΣΗ, όχι το jsPDF/ExcelJS.
 */

import el from '@/i18n/locales/el/accounting.json';

import type { ComparativeColumn, ResolvedPeriods, TrialBalanceData } from '../../../types/reports';
import type { ReportTranslate } from '../report-table-adapter';
import { flattenReportForExport } from '../report-table-adapter';
import { buildReportDocument, exportReport, reportFilename } from '../report-export';
import type { ReportDocument, ReportExportRequest } from '../report-export';
import { csvReportSerializer } from '../csv-exporter';

const mockDownload = jest.fn();
jest.mock('@/services/gantt-export/gantt-export-utils', () => ({
  triggerBlobDownload: (...args: unknown[]) => mockDownload(...args),
}));

const mockExcelSerialize = jest.fn((_doc: ReportDocument) => new Blob(['xlsx']));
jest.mock('../excel-exporter', () => ({
  excelReportSerializer: { extension: 'xlsx', serialize: (doc: ReportDocument) => mockExcelSerialize(doc) },
}));
jest.mock('../pdf-exporter', () => ({
  pdfReportSerializer: { extension: 'pdf', serialize: () => new Blob(['pdf']) },
}));

const t: ReportTranslate = (key, options) => {
  const value = key.split('.').reduce<unknown>(
    (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    el,
  );
  if (typeof value !== 'string') throw new Error(`missing i18n key: accounting:${key}`);
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(options?.[name] ?? `{${name}}`));
};

function only<T>(current: T): ComparativeColumn<T> {
  return { current, previousPeriod: null, yearOverYear: null, changeFromPrevious: null, changeFromYoY: null };
}

const period: ResolvedPeriods = {
  current: { from: '2026-01-01', to: '2026-12-31' },
  previousPeriod: { from: '2025-01-01', to: '2025-12-31' },
  yearOverYear: { from: '2025-01-01', to: '2025-12-31' },
};

const trialBalance: TrialBalanceData = {
  rows: only([{ category: 'custom_rent', label: 'Ενοίκια, "Α"', debit: 0, credit: 1234.5, balance: -1234.5 }]),
  totalDebits: only(0),
  totalCredits: only(1234.5),
  netBalance: only(-1234.5),
};

const request: ReportExportRequest = { reportType: 'trial_balance', data: trialBalance, period, title: 'Ισοζύγιο', t };

beforeEach(() => {
  mockDownload.mockClear();
  mockExcelSerialize.mockClear();
});

describe('reportFilename — ΕΝΑΣ κανόνας για όλες τις μορφές', () => {
  it('<τύπος>_<ΕΕΕΕΜΜΗΗ αρχής>.<επέκταση>', () => {
    expect(reportFilename('trial_balance', period, 'pdf')).toBe('trial_balance_20260101.pdf');
    expect(reportFilename('cash_flow', period, 'xlsx')).toBe('cash_flow_20260101.xlsx');
  });
});

describe('buildReportDocument', () => {
  it('ο πίνακας είναι ΑΚΡΙΒΩΣ η ισοπέδωση, και η περίοδος μεταφρασμένη', () => {
    const doc = buildReportDocument(request);
    expect(doc.table).toEqual(flattenReportForExport('trial_balance', trialBalance, t));
    expect(doc.title).toBe('Ισοζύγιο');
    expect(doc.periodLine).not.toMatch(/2026-01-01/);   // ημερομηνία ημερολογίου, όχι ωμό ISO
  });
});

describe('csvReportSerializer — καθαρή σειριοποίηση', () => {
  it('BOM · τίτλος · περίοδος · κενή · κεφαλίδες · γραμμές με escaping και ωμούς αριθμούς', async () => {
    const doc = buildReportDocument(request);
    const blob = csvReportSerializer.serialize(doc) as Blob;
    // ⚠️ Τα BYTES, όχι `blob.text()`: η αποκωδικοποίηση UTF-8 αφαιρεί το BOM (κατά την προδιαγραφή) και θα το έκρυβε.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = (await blob.text()).split('\n');
    expect(lines[0]).toBe('Ισοζύγιο');
    expect(lines[1]).toBe(doc.periodLine.includes(',') ? `"${doc.periodLine}"` : doc.periodLine);
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe(doc.table.columns.map((c) => c.header).join(','));
    expect(lines[4]).toBe('custom_rent,"Ενοίκια, ""Α""",0,1234.5,-1234.5');
  });
});

describe('exportReport — η σωλήνωση', () => {
  it('ο σειριοποιητής της μορφής παίρνει το ΙΔΙΟ έγγραφο, και η λήψη την επέκτασή ΤΟΥ', async () => {
    await exportReport('excel', request);
    expect(mockExcelSerialize).toHaveBeenCalledWith(buildReportDocument(request));
    expect(mockDownload).toHaveBeenCalledWith(expect.any(Blob), 'trial_balance_20260101.xlsx');
  });

  it.each([
    ['pdf', 'trial_balance_20260101.pdf'],
    ['csv', 'trial_balance_20260101.csv'],
  ] as const)('%s ⇒ %s', async (format, filename) => {
    await exportReport(format, request);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(mockDownload).toHaveBeenCalledWith(expect.any(Blob), filename);
  });
});
