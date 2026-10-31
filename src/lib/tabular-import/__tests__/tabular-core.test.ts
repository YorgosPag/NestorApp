/**
 * Ο γενικός πυρήνας (ADR-923 §5.5): ο ρόλος είναι του καταναλωτή, ο πυρήνας δεν ξέρει τίποτα για τοπογραφία ή κατάλογο.
 * Η αμετάβλητη συμπεριφορά της τοπογραφίας φυλάσσεται από τις δικές της σουίτες (`terrain/survey-import/__tests__`).
 */

import { cellForRole, claimsExactlyOnce, matchesHeaderHint, suggestRolesFromHeaders } from '../column-mapping';
import { readDelimitedText } from '../delimited-reader';
import { readExcelToTable } from '../excel-reader';
import { parseTabularField } from '../tabular-field';

type Role = 'code' | 'price' | 'ignore';

describe('tabular core — mapping generic in the role', () => {
  it('suggests catalog roles with the same engine the survey uses', () => {
    const hints = [['code', ['κωδικός']], ['price', ['τιμή']]] as const;
    expect(suggestRolesFromHeaders<Role>(['Κωδικός είδους', 'Τιμή (€)', 'Σημειώσεις'], hints, 'ignore')).toEqual(['code', 'price', 'ignore']);
  });

  it('never claims a role twice', () => {
    const hints = [['code', ['κωδικός']]] as const;
    expect(suggestRolesFromHeaders<Role>(['Κωδικός', 'Κωδικός 2'], hints, 'ignore')).toEqual(['code', 'ignore']);
  });

  it('short hints match the whole label, long hints a substring', () => {
    expect(matchesHeaderHint('υψόμετρο', 'ψ')).toBe(false);
    expect(matchesHeaderHint('northing (m)', 'northing')).toBe(true);
  });

  it('reads cells by role and judges completeness', () => {
    const mapping: readonly Role[] = ['code', 'ignore', 'price'];
    expect(cellForRole(['A', 'x', '12'], mapping, 'price')).toBe('12');
    expect(cellForRole(['A'], mapping, 'price')).toBeUndefined();
    expect(claimsExactlyOnce(mapping, ['code', 'price'])).toBe(true);
    expect(claimsExactlyOnce<Role>(['code', 'code'], ['code'])).toBe(false);
  });
});

describe('tabular core — readers', () => {
  it('drops a supplier title above the header only when asked', () => {
    const text = 'ΤΙΜΟΚΑΤΑΛΟΓΟΣ 2026\nΚωδικός;Τιμή\n016-15-001;12,50';
    expect(readDelimitedText(text, { skipRows: 1, delimiter: ';' }).headers).toEqual(['Κωδικός', 'Τιμή']);
    expect(readDelimitedText(text, { delimiter: ';' }).headers).toEqual(['ΤΙΜΟΚΑΤΑΛΟΓΟΣ 2026']);
  });

  it('judges a Greek-locale number the same as a dot-decimal', () => {
    expect(parseTabularField('384512,345')).toBeCloseTo(384512.345);
    expect(parseTabularField('TREE1')).toBeNull();
  });

  it('reads a chosen sheet of a real workbook, with the title rows skipped', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Εξώφυλλο').addRow(['τίποτα']);
    const sheet = workbook.addWorksheet('Τιμές');
    sheet.addRow(['Τιμοκατάλογος']);
    sheet.addRow(['Κωδικός', 'Τιμή']);
    sheet.addRow(['016-15-001', 12.5]);
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    const table = await readExcelToTable(buffer, { sheetIndex: 1, skipRows: 1 });
    expect(table.headers).toEqual(['Κωδικός', 'Τιμή']);
    expect(table.rows).toEqual([['016-15-001', '12.5']]);
  });
});
