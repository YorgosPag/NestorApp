/**
 * ADR-833 Φάση 6 — **άγκυρες της ΕΞΑΓΩΓΗΣ**: ό,τι φεύγει, ξαναδιαβάζεται και ελέγχεται.
 *
 * 🔑 Ο έλεγχος γίνεται με **round-trip μέσα από τον ίδιο τον `exceljs`**, όχι με έλεγχο των
 * αντικειμένων που φτιάχνουμε: ένα test που διαβάζει το `sheet.getCell(...).font` **πριν** τη
 * σειριοποίηση επιβεβαιώνει μόνο ότι θέσαμε μια ιδιότητα — όχι ότι το γραμμένο αρχείο την
 * περιέχει. Η διαφορά είναι μετρημένη στην ίδια τη φάση (§5.7.4): υπάρχουν πεδία που ο
 * `exceljs` δέχεται και **δεν** τα βρίσκει πίσω.
 *
 * @see bim/table/export/table-to-xlsx.ts
 */

import ExcelJS from 'exceljs';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import { tableWorksheetsToXlsxBlob } from '../export/table-to-xlsx';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableWorksheet } from '../../../types/table-worksheet';
import type { PersistedTableModel, TableCell, TableColumn, TableRow } from '../../../types/table';

const STYLE: TableStyle = (() => {
  const found = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!found) throw new Error('missing STANDARD preset');
  return found;
})();

function col(id: string, extra?: Partial<TableColumn>): TableColumn {
  return { id, sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left', ...extra };
}

function row(id: string, rowClass: TableRow['rowClass'] = 'data', extra?: Partial<TableRow>): TableRow {
  return { id, rowClass, ...extra };
}

function model(input: {
  columns: TableColumn[];
  rows: TableRow[];
  cells?: readonly (readonly [string, string, TableCell])[];
  merges?: PersistedTableModel['merges'];
}): PersistedTableModel {
  return toPersistedTableModel(
    createTableModel({
      columns: input.columns,
      rows: input.rows,
      cells: input.cells ?? [],
      merges: input.merges ?? [],
    }),
  );
}

function worksheet(name: string | undefined, m: PersistedTableModel, id = 'ws0'): TableWorksheet {
  return name === undefined
    ? { id: tableWorksheetId(id), model: m }
    : { id: tableWorksheetId(id), name, model: m };
}

/** Το εξαγόμενο βιβλίο, **ξαναδιαβασμένο** — δες την κεφαλίδα για το γιατί. */
async function roundTrip(sheets: readonly TableWorksheet[]): Promise<ExcelJS.Workbook> {
  const blob = await tableWorksheetsToXlsxBlob(sheets, STYLE);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return workbook;
}

const SIMPLE = model({
  columns: [col('c0'), col('c1')],
  rows: [row('r0', 'title'), row('r1', 'header'), row('r2')],
  cells: [
    ['r0', 'c0', { kind: 'text', value: 'Πίνακας Δοκών' }],
    ['r2', 'c0', { kind: 'text', value: 'Δοκός Δ1' }],
    ['r2', 'c1', { kind: 'text', value: 1234.5 }],
  ],
});

describe('ADR-833 Φ6 — εξαγωγή: ΟΛΑ τα φύλλα, στη σειρά τους', () => {
  it('κάθε φύλλο εργασίας γίνεται φύλλο του βιβλίου', async () => {
    const workbook = await roundTrip([
      worksheet('Δοκοί', SIMPLE, 'ws0'),
      worksheet('Υποστυλώματα', SIMPLE, 'ws1'),
      worksheet('Πέδιλα', SIMPLE, 'ws2'),
    ]);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Δοκοί', 'Υποστυλώματα', 'Πέδιλα']);
  });

  it('🔴 δύο φύλλα με ΤΟ ΙΔΙΟ όνομα δεν ρίχνουν την εξαγωγή — παίρνουν τη σύμβαση (2)', async () => {
    const workbook = await roundTrip([
      worksheet('Δοκοί', SIMPLE, 'ws0'),
      worksheet('Δοκοί', SIMPLE, 'ws1'),
      worksheet('Δοκοί', SIMPLE, 'ws2'),
    ]);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Δοκοί', 'Δοκοί (2)', 'Δοκοί (3)']);
  });

  it('🔴 η σύγκρουση είναι case-insensitive, όπως στο Excel — αυστηρότερα από τον exceljs', async () => {
    const workbook = await roundTrip([
      worksheet('Φύλλο', SIMPLE, 'ws0'),
      worksheet('φύλλο', SIMPLE, 'ws1'),
    ]);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['Φύλλο', 'φύλλο (2)']);
  });

  it('απαγορευμένοι χαρακτήρες του Excel δεν φτάνουν στο αρχείο', async () => {
    const workbook = await roundTrip([worksheet('Α/Β:Γ[Δ]', SIMPLE)]);
    expect(workbook.worksheets[0].name).toBe('Α Β Γ Δ');
  });

  it('ανώνυμο φύλλο παίρνει το προεπιλεγμένο όνομα της ΘΕΣΗΣ του', async () => {
    const workbook = await roundTrip([worksheet(undefined, SIMPLE)]);
    expect(workbook.worksheets[0].name.length).toBeGreaterThan(0);
  });
});

describe('ADR-833 Φ6 — εξαγωγή: ΤΙΜΗ, όχι κείμενο', () => {
  it('🔴 ο αριθμός φεύγει ως αριθμός — το Excel μπορεί να τον αθροίσει', async () => {
    const workbook = await roundTrip([worksheet('Φ', SIMPLE)]);
    const cell = workbook.worksheets[0].getCell(3, 2);
    expect(typeof cell.value).toBe('number');
    expect(cell.value).toBe(1234.5);
  });

  it('το ελληνικό κείμενο ταξιδεύει ακέραιο', async () => {
    const workbook = await roundTrip([worksheet('Φ', SIMPLE)]);
    expect(workbook.worksheets[0].getCell(3, 1).value).toBe('Δοκός Δ1');
  });

  it('🔴 η μορφή φεύγει ως numFmt, ΧΩΡΙΣ να αγγίξει την τιμή', async () => {
    const withFormat = model({
      columns: [col('c0')],
      rows: [row('r0')],
      cells: [
        [
          'r0',
          'c0',
          {
            kind: 'text',
            value: 1234.5678,
            styleOverride: { numberFormat: { kind: 'decimal', decimals: 2, grouping: true } },
          },
        ],
      ],
    });
    const cell = (await roundTrip([worksheet('Φ', withFormat)])).worksheets[0].getCell(1, 1);
    expect(cell.value).toBe(1234.5678);
    expect(cell.numFmt).toBe('#,##0.00');
  });
});

describe('ADR-833 Φ6 — εξαγωγή: γεωμετρία και συγχωνεύσεις', () => {
  it('τα πλάτη στηλών φεύγουν σε χαρακτήρες Excel, από τη ΔΙΑΤΑΞΗ', async () => {
    const workbook = await roundTrip([worksheet('Φ', SIMPLE)]);
    // 40 mm ⇒ 151,2 px ⇒ (151,2 − 5) / 7 ≈ 20,9 χαρακτήρες
    expect(workbook.worksheets[0].getColumn(1).width).toBeCloseTo(20.9, 1);
  });

  it('🔴 οι συγχωνεύσεις επιβιώνουν — και η εγγραφή τους ΔΕΝ ρίχνει τον γραφέα', async () => {
    const merged = model({
      columns: [col('c0'), col('c1'), col('c2')],
      rows: [row('r0', 'title'), row('r1', 'header'), row('r2')],
      cells: [['r0', 'c0', { kind: 'text', value: 'Τίτλος' }]],
      merges: [{ anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 3 }],
    });
    const sheet = (await roundTrip([worksheet('Φ', merged)])).worksheets[0];
    expect(sheet.model.merges).toEqual(['A1:C1']);
    expect(sheet.getCell('A1').value).toBe('Τίτλος');
  });
});

describe('ADR-833 Φ6 — εξαγωγή: το ΠΛΕΓΜΑ, ακόμη και σε κενά κελιά', () => {
  it('🔴 κελί χωρίς τιμή φεύγει ΜΕ το περίγραμμά του — αλλιώς ο πίνακας παύει να είναι πίνακας', async () => {
    const sheet = (await roundTrip([worksheet('Φ', SIMPLE)])).worksheets[0];
    const empty = sheet.getCell(3, 2 + 0);
    expect(empty.border.top?.style).toBeDefined();
    const alsoEmpty = sheet.getCell(2, 2);
    expect(alsoEmpty.border.left?.style).toBeDefined();
  });

  it('🔴 το ύψος κειμένου (mm) φεύγει ως ΜΕΓΕΘΟΣ ΓΡΑΜΜΑΤΟΣΕΙΡΑΣ — στρογγυλεμένο, ΟΧΙ κομμένο', () => {
    // 2,8 mm ⇒ 7,94 pt. Ο `exceljs` γράφει το `sz` ως ΑΚΕΡΑΙΟ (IntegerXform): αφημένο στην
    // αποκοπή δίνει 7 pt (−12%), στρογγυλεμένο 8 pt (+0,75%). Η άγκυρα κοιτά **τη διαφορά**.
    expect(Math.round((2.8 * 72) / 25.4)).toBe(8);
    expect(Math.trunc((2.8 * 72) / 25.4)).toBe(7);
  });

  it('🔴 …και αυτό είναι ό,τι πράγματι φτάνει στο αρχείο', async () => {
    const sheet = (await roundTrip([worksheet('Φ', SIMPLE)])).worksheets[0];
    expect(sheet.getCell(3, 1).font.size).toBe(8);
  });

  it('🔴 η παράκαμψη στυλ κελιού φτάνει στο αρχείο — έντονα, πλάγια, χρώμα, γέμισμα', async () => {
    const styled = model({
      columns: [col('c0')],
      rows: [row('r0')],
      cells: [
        [
          'r0',
          'c0',
          {
            kind: 'text',
            value: 'Δ1',
            styleOverride: {
              bold: true,
              italic: true,
              textColorHex: '#FF0000',
              fillColorHex: '#00FF00',
              align: 'BR',
            },
          },
        ],
      ],
    });
    const cell = (await roundTrip([worksheet('Φ', styled)])).worksheets[0].getCell(1, 1);
    expect(cell.font.bold).toBe(true);
    expect(cell.font.italic).toBe(true);
    expect(cell.font.color?.argb).toBe('FFFF0000');
    expect(cell.fill).toMatchObject({ type: 'pattern', fgColor: { argb: 'FF00FF00' } });
    expect(cell.alignment).toMatchObject({ vertical: 'bottom', horizontal: 'right' });
  });
});
