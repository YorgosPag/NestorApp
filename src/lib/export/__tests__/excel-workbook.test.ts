/**
 * `lib/export/excel-workbook` — το φύλλο-πίνακας (ADR-898 Φ4β): όνομα που δέχεται το Excel, κεφαλίδα που μένει ορατή,
 * αριθμοί ως αριθμοί, σύνολο ως τύπος `SUM`. Πάνω στο ΠΡΑΓΜΑΤΙΚΟ ExcelJS.
 */

import ExcelJS from 'exceljs';

import { PRODUCT_NAME } from '@/constants/product-identity';

import { addKeyValueSheet, addScheduleSheet, excelSheetName, exportWorkbook } from '../excel-workbook';

const downloads: { blob: Blob; filename: string }[] = [];
jest.mock('@/lib/exports/trigger-export-download', () => ({
  triggerExportDownload: (opts: { blob: Blob; filename: string }) => downloads.push(opts),
}));

describe('excelSheetName', () => {
  it('αφαιρεί ό,τι αρνείται το Excel και κόβει στους 31 χαρακτήρες', () => {
    expect(excelSheetName('ns:key/a[b]')).toBe('ns-key-a-b-');
    expect(excelSheetName("'Μονάδες'")).toBe('Μονάδες');
    expect(excelSheetName('x'.repeat(40))).toHaveLength(31);
    expect(excelSheetName('  ')).toBe('Sheet');
  });

  it('δύο τίτλοι που η περικοπή κάνει ΙΔΙΟΥΣ ⇒ δεύτερο φύλλο « (2)», όχι εξαίρεση', () => {
    const workbook = new ExcelJS.Workbook();
    const spec = (name: string) => ({ name, columns: [{ header: 'A', format: 'text' as const }], rows: [] });
    addScheduleSheet(workbook, spec(`${'x'.repeat(31)}-α`));
    const second = addScheduleSheet(workbook, spec(`${'x'.repeat(31)}-β`));
    expect(second.name).toBe(`${'x'.repeat(27)} (2)`);
  });

  it('ένα όνομα από μετάφραση με «:» ΔΕΝ ρίχνει την εξαγωγή', () => {
    const workbook = new ExcelJS.Workbook();
    expect(() => addScheduleSheet(workbook, { name: 'objective-value:sheet', columns: [{ header: 'A', format: 'text' }], rows: [] })).not.toThrow();
  });
});

describe('addScheduleSheet', () => {
  it('κεφαλίδα παγωμένη · φίλτρο · μορφή νομίσματος · `SUM` με το γνωστό αποτέλεσμα', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = addScheduleSheet(workbook, {
      name: 'Μονάδες',
      columns: [{ header: 'Μονάδα', format: 'text' }, { header: 'Αξία', format: 'currency' }],
      rows: [['A1', 100], ['A2', 50.5]],
      footer: ['Σύνολο', { sum: 150.5 }],
    });
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet.autoFilter).toEqual({ from: { row: 1, column: 1 }, to: { row: 3, column: 2 } });
    expect(sheet.getColumn(2).numFmt).toBe('#,##0.00 "€"');
    expect(sheet.getRow(5).getCell(2).value).toEqual({ formula: 'SUM(B2:B3)', result: 150.5 });
  });
});

describe('addKeyValueSheet', () => {
  it('δύο στήλες κειμένου «Στοιχείο → Τιμή», με το ντύσιμο του schedule', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = addKeyValueSheet(workbook, { name: 'Παραδοχές', keyHeader: 'Στοιχείο', valueHeader: 'Τιμή', rows: [['Κτίριο', 'Α'], ['Γραμμές', 3]] });
    expect(sheet.getRow(1).values).toEqual([undefined, 'Στοιχείο', 'Τιμή']);
    expect(sheet.getRow(3).values).toEqual([undefined, 'Γραμμές', 3]);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });
});

describe('exportWorkbook', () => {
  it('γεμίζει ΕΝΑ βιβλίο με τις ιδιότητές του και το κατεβάζει ως `.xlsx` με το MIME του μητρώου', async () => {
    const built: ExcelJS.Workbook[] = [];
    await exportWorkbook({ title: 'Θέσεις', fileBaseName: 'Θέσεις_Α', build: (workbook) => { built.push(workbook); workbook.addWorksheet('x'); } });
    expect(built).toHaveLength(1);
    const [workbook] = built;
    expect(workbook.creator).toBe(PRODUCT_NAME);
    expect(workbook.title).toBe('Θέσεις');
    const download = downloads[downloads.length - 1];
    expect(download.filename).toBe('Θέσεις_Α.xlsx');
    expect(download.blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});
