/**
 * ADR-833 §5.7.5 — άγκυρες της **απαρίθμησης**: ό,τι το αρχείο δηλώνει και ο πίνακας δεν κρατά.
 *
 * 🔴 Ο έλεγχος γίνεται σε **πραγματικό βιβλίο που ξαναδιαβάστηκε**, όχι σε πλαστά αντικείμενα:
 * η όλη αξία της απαρίθμησης είναι ότι μετρά τι πράγματι **βλέπει** ο αναγνώστης, και ένα mock
 * θα μετρούσε τι νομίζουμε ότι βλέπει. Το §5.7.4 έδειξε ότι η διαφορά είναι υπαρκτή.
 *
 * @see bim/table/import/xlsx-unsupported-scan.ts
 */

import ExcelJS from 'exceljs';
import { readXlsxWorksheets } from '../import/xlsx-to-worksheets';
import { xlsxUnsupportedGroups, xlsxUnsupportedSummary } from '../../../ui/table-xlsx/xlsx-unsupported-groups';
import type { XlsxUnsupportedFinding, XlsxUnsupportedKey } from '../import/xlsx-unsupported-scan';

/** Ένα βιβλίο με **ένα από κάθε** πράγμα που ξέρουμε να μετράμε. */
async function richWorkbook(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Φ');
  sheet.getCell('A1').value = 10;
  sheet.getCell('A2').value = { formula: 'A1*2', result: 20 };
  sheet.getCell('B1').value = 5;
  sheet.getCell('B1').numFmt = '0.00E+00'; // επιστημονική — ο αναγνωριστής την ΑΡΝΕΙΤΑΙ
  sheet.addConditionalFormatting({
    ref: 'A1:A9',
    rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['1'], priority: 1, style: {} }],
  });
  sheet.getCell('C1').dataValidation = { type: 'list', allowBlank: true, formulae: ['"α,β"'] };
  sheet.addTable({ name: 'T1', ref: 'E10', headerRow: true, columns: [{ name: 'Χ' }], rows: [['1']] });
  workbook.definedNames.add('Φ!A1', 'ΜουΌνομα');
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

function byKey(findings: readonly XlsxUnsupportedFinding[]): Map<XlsxUnsupportedKey, XlsxUnsupportedFinding> {
  return new Map(findings.map((finding) => [finding.key, finding]));
}

describe('ADR-833 §5.7.5 — τι απαριθμείται, μετρημένο σε πραγματικό βιβλίο', () => {
  it('🔴 μετρά και τα επτά, με το πλήθος τους', async () => {
    const { unsupported } = await readXlsxWorksheets(await richWorkbook(), 'δοκιμή.xlsm');
    const found = byKey(unsupported);
    expect(found.get('formulas')?.count).toBe(1);
    expect(found.get('conditionalFormatting')?.count).toBe(1);
    expect(found.get('dataValidation')?.count).toBe(1);
    expect(found.get('numberFormats')?.count).toBe(1);
    expect(found.get('definedNames')?.count).toBe(1);
    expect(found.get('excelTables')?.count).toBe(1);
    expect(found.get('macros')?.count).toBe(1);
  });

  it('🔴 η βαθμίδα «λειτουργίας» έρχεται ΠΡΩΤΗ — ο χρήστης διαβάζει από πάνω', async () => {
    const { unsupported } = await readXlsxWorksheets(await richWorkbook(), 'δοκιμή.xlsm');
    const tiers = unsupported.map((finding) => finding.tier);
    expect(tiers.indexOf('functionality')).toBe(0);
    expect(tiers.lastIndexOf('functionality')).toBeLessThan(tiers.indexOf('fidelity'));
  });

  it('🔴 οι μακροεντολές έρχονται από την ΚΑΤΑΛΗΞΗ, όχι από αναλυτή', async () => {
    const buffer = await richWorkbook();
    const withMacros = await readXlsxWorksheets(buffer, 'ΕΡΓΟ.XLSM');
    const without = await readXlsxWorksheets(buffer, 'έργο.xlsx');
    expect(byKey(withMacros.unsupported).has('macros')).toBe(true);
    expect(byKey(without.unsupported).has('macros')).toBe(false);
  });

  it('🔴 καθαρό βιβλίο ⇒ ΚΕΝΗ λίστα — καμία προειδοποίηση χωρίς αντικείμενο', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Φ').getCell('A1').value = 'Δοκός Δ1';
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    const { unsupported } = await readXlsxWorksheets(buffer, 'καθαρό.xlsx');
    expect(unsupported).toEqual([]);
  });
});

describe('ADR-833 §5.7.5 — από ευρήματα σε λόγο ανθρώπου', () => {
  const t = (key: string, options?: { readonly count: number }): string =>
    options === undefined ? key : `${key}:${options.count}`;

  it('🔴 δύο ομάδες + η γραμμή του ΟΡΙΟΥ — που δεν επιτρέπεται να λείπει', () => {
    const groups = xlsxUnsupportedGroups(
      [
        { key: 'formulas', tier: 'functionality', count: 3 },
        { key: 'images', tier: 'fidelity', count: 2 },
      ],
      t,
    );
    expect(groups).toHaveLength(3);
    expect(groups[0].items).toEqual(['tableXlsx.unsupported.formulas:3']);
    expect(groups[1].items).toEqual(['tableXlsx.unsupported.images:2']);
    // Η γραμμή που κρατά την απαρίθμηση ειλικρινή: γραφήματα/pivots ΔΕΝ μετριούνται.
    expect(groups[2].items).toEqual(['tableXlsx.unsupported.limit']);
  });

  it('🔴 καμία εύρεση ⇒ ΚΑΜΙΑ ομάδα — ούτε καν η γραμμή του ορίου', () => {
    expect(xlsxUnsupportedGroups([], t)).toEqual([]);
    expect(xlsxUnsupportedSummary([], t)).toBe('');
  });

  it('η μονόγραμμη περίληψη ενώνει τα ευρήματα, για τη διαδρομή που δεν ρωτά', () => {
    const summary = xlsxUnsupportedSummary(
      [
        { key: 'formulas', tier: 'functionality', count: 1 },
        { key: 'images', tier: 'fidelity', count: 4 },
      ],
      t,
    );
    expect(summary).toBe('tableXlsx.unsupported.formulas:1 · tableXlsx.unsupported.images:4');
  });
});

describe('ADR-833 §5.7.5 — τα κλειδιά ΥΠΑΡΧΟΥΝ και στις δύο γλώσσες', () => {
  const KEYS: readonly string[] = [
    'formulas', 'conditionalFormatting', 'dataValidation', 'macros',
    'numberFormats', 'images', 'definedNames', 'excelTables',
    'functionalityTitle', 'fidelityTitle', 'limit',
  ];

  it.each(['el', 'en'])('%s: κάθε κλειδί της απαρίθμησης έχει μετάφραση', (locale) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const bundle = require(`../../../../../i18n/locales/${locale}/dxf-viewer-shell.json`) as {
      tableXlsx: { unsupported: Record<string, string>; unsupportedNotice: string };
      ribbon: { commands: { tableProps: Record<string, string> } };
    };
    for (const key of KEYS) {
      expect(typeof bundle.tableXlsx.unsupported[key]).toBe('string');
    }
    expect(typeof bundle.tableXlsx.unsupportedNotice).toBe('string');
    expect(typeof bundle.ribbon.commands.tableProps.exportXlsx).toBe('string');
    expect(typeof bundle.ribbon.commands.tableProps.exportXlsxTooltip).toBe('string');
  });
});
