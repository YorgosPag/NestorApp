/**
 * 🔴 ADR-833 Φάση 6 — **Η ΑΓΚΥΡΑ ΤΗΣ ΦΑΣΗΣ**: πίνακας → `.xlsx` → **πίσω σε πίνακα**.
 *
 * Οι δύο κατευθύνσεις ελέγχονται **μαζί**, γιατί χωριστά καμία δεν απαντά στο ερώτημα που
 * έχει σημασία. Ένας γραφέας που γράφει λάθος και ένας αναγνώστης που διαβάζει το ίδιο λάθος
 * περνούν και οι δύο τα δικά τους tests — και το αρχείο ανοίγει **λάθος στο Excel**. Εδώ το
 * ερώτημα είναι το σωστό: *«αν το σχέδιο φύγει και γυρίσει, είναι το ίδιο σχέδιο;»*
 *
 * ⚠️ Ο κύκλος περνά από **πραγματική σειριοποίηση** (`writeBuffer` → `load`), ποτέ από
 * σύγκριση των ενδιάμεσων αντικειμένων: το §5.7.4 μέτρησε πεδία που ο `exceljs` **δέχεται**
 * και δεν τα βρίσκει πίσω, και μια σύγκριση πριν το `writeBuffer` θα ήταν τυφλή σε ακριβώς
 * αυτά.
 *
 * @see bim/table/export/table-to-xlsx.ts
 * @see bim/table/import/xlsx-worksheet-format.ts
 */

import ExcelJS from 'exceljs';
import { createTableModel, resolveTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import { tableWorksheetsToXlsxBlob } from '../export/table-to-xlsx';
import { readWorksheetFormat, worksheetGeometry } from '../import/xlsx-worksheet-format';
import { readXlsxWorksheets } from '../import/xlsx-to-worksheets';
import { worksheetGridToModel } from '../import/worksheet-to-model';
import { cellValueToNumber } from '../formula/table-formula-value';
import { tableEdgeKey } from '../table-edge-model';
import { buildTableEdgeIndex } from '../table-edge-model';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableWorksheet } from '../../../types/table-worksheet';
import type { PersistedTableModel, TableCell, TableColumn, TableRow } from '../../../types/table';

const STYLE: TableStyle = (() => {
  const found = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!found) throw new Error('missing STANDARD preset');
  return found;
})();

function col(id: string, widthMm = 40): TableColumn {
  return { id, sizing: { kind: 'fixed', widthMm }, valueType: 'text', align: 'left' };
}

function row(id: string, rowClass: TableRow['rowClass'] = 'data', heightMm?: number): TableRow {
  return heightMm === undefined ? { id, rowClass } : { id, rowClass, heightMm };
}

function persist(input: {
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

/**
 * Ο πλήρης κύκλος: μοντέλο → βιβλίο → **bytes** → η ΠΑΡΑΓΩΓΙΚΗ διαδρομή ανάγνωσης → μοντέλο.
 *
 * ⚠️ Περνά από το ίδιο το `readXlsxWorksheets` και όχι από χειροποίητο πλέγμα: ένας κύκλος που
 * ξαναγράφει τον αναγνώστη μέσα στο test ελέγχει **τον εαυτό του**, όχι τον κώδικα που τρέχει.
 */
async function cycle(model: PersistedTableModel): Promise<PersistedTableModel> {
  const sheet: TableWorksheet = { id: tableWorksheetId('ws0'), name: 'Φ', model };
  const blob = await tableWorksheetsToXlsxBlob([sheet], STYLE);
  const { worksheets } = await readXlsxWorksheets(await blob.arrayBuffer());
  const [imported] = worksheets;
  return worksheetGridToModel(imported.grid, imported.format).model;
}

describe('ADR-833 Φ6 — ο κύκλος: πίνακας → .xlsx → πίνακας', () => {
  it('🔴 τα ΠΛΑΤΗ στηλών επιβιώνουν σε χιλιοστά', async () => {
    const back = await cycle(persist({ columns: [col('c0', 40), col('c1', 25)], rows: [row('r0')] }));
    const widths = back.columns.map((c) => (c.sizing.kind === 'fixed' ? c.sizing.widthMm : null));
    expect(widths[0]).toBeCloseTo(40, 1);
    expect(widths[1]).toBeCloseTo(25, 1);
  });

  it('🔴 τα ΥΨΗ γραμμών επιβιώνουν σε χιλιοστά', async () => {
    const back = await cycle(
      persist({ columns: [col('c0')], rows: [row('r0', 'data', 12), row('r1', 'data', 6)] }),
    );
    expect(back.rows[0].heightMm).toBeCloseTo(12, 2);
    expect(back.rows[1].heightMm).toBeCloseTo(6, 2);
  });

  it('🔴 η ΜΟΡΦΗ ΑΡΙΘΜΟΥ επιβιώνει ως πρόθεση, όχι ως μοτίβο', async () => {
    const back = await cycle(
      persist({
        columns: [col('c0')],
        rows: [row('r0')],
        cells: [
          ['r0', 'c0', {
            kind: 'text',
            value: 1234.5678,
            styleOverride: { numberFormat: { kind: 'currency', decimals: 2, currency: 'EUR', grouping: true } },
          }],
        ],
      }),
    );
    expect(back.cells[0][2].styleOverride?.numberFormat).toEqual({
      kind: 'currency',
      decimals: 2,
      currency: 'EUR',
      grouping: true,
    });
  });

  it('🔴 η ΤΙΜΗ δεν αλλοιώνεται από τη μορφή — ούτε ένα ψηφίο', async () => {
    // ⚠️ Ο κριτής είναι το `cellValueToNumber` — **ο ίδιος** που χρησιμοποιεί η `SUM` (ADR-576).
    // Το κελί μπορεί να κρατά τον αριθμό ως κείμενο (έτσι δουλεύει ΟΛΗ η διαδρομή επικόλλησης
    // από τη Φάση 1)· εκείνο που δεν επιτρέπεται να αλλάξει είναι **ο αριθμός που διαβάζεται**.
    const back = await cycle(
      persist({
        columns: [col('c0')],
        rows: [row('r0')],
        cells: [
          ['r0', 'c0', {
            kind: 'text',
            value: 1234.5678,
            styleOverride: { numberFormat: { kind: 'decimal', decimals: 2, grouping: true } },
          }],
        ],
      }),
    );
    expect(cellValueToNumber(back.cells[0][2].value)).toBe(1234.5678);
  });

  it('🔴 οι ΣΥΓΧΩΝΕΥΣΕΙΣ επιβιώνουν με το εύρος τους', async () => {
    const back = await cycle(
      persist({
        columns: [col('c0'), col('c1'), col('c2')],
        rows: [row('r0'), row('r1')],
        cells: [['r0', 'c0', { kind: 'text', value: 'Τίτλος' }]],
        merges: [{ anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 2, colSpan: 3 }],
      }),
    );
    expect(back.merges).toHaveLength(1);
    expect(back.merges[0]).toMatchObject({ rowSpan: 2, colSpan: 3 });
  });

  it('🔴 το ΠΕΡΙΓΡΑΜΜΑ επιβιώνει, και προσγειώνεται στην ΙΔΙΑ ακμή', async () => {
    const back = await cycle(persist({ columns: [col('c0'), col('c1')], rows: [row('r0'), row('r1')] }));
    const edges = buildTableEdgeIndex(back.edges);
    // Η πάνω ακμή του δεύτερου κελιού της δεύτερης γραμμής — μία ακμή, ένα όνομα (ADR-750).
    const key = tableEdgeKey('H', back.rows[1].id, back.columns[1].id);
    expect(edges.get(key)?.visible).toBe(true);
    expect(edges.get(key)?.widthMm).toBeGreaterThan(0);
  });

  it('🔴 το ΓΕΜΙΣΜΑ και τα ΕΝΤΟΝΑ επιβιώνουν ως παράκαμψη κελιού', async () => {
    const back = await cycle(
      persist({
        columns: [col('c0')],
        rows: [row('r0')],
        cells: [
          ['r0', 'c0', {
            kind: 'text',
            value: 'Δ1',
            styleOverride: { bold: true, fillColorHex: '#FFE599', textColorHex: '#1E293B' },
          }],
        ],
      }),
    );
    const override = back.cells[0][2].styleOverride;
    expect(override?.bold).toBe(true);
    expect(override?.fillColorHex).toBe('#FFE599');
    expect(override?.textColorHex).toBe('#1E293B');
  });

  it('🔴 ο ΤΥΠΟΣ φεύγει ως τύπος και ΓΥΡΝΑ ως τιμή — η τεκμηριωμένη απόφαση, μετρημένη', async () => {
    const model = persist({
      columns: [col('c0'), col('c1')],
      rows: [row('r0')],
      cells: [
        ['r0', 'c0', { kind: 'text', value: 10 }],
        ['r0', 'c1', {
          kind: 'formula',
          value: 10,
          formula: { root: { kind: 'ref', cell: { rowId: 'r0', colId: 'c0' } } },
        }],
      ],
    });
    const blob = await tableWorksheetsToXlsxBlob(
      [{ id: tableWorksheetId('ws0'), name: 'Φ', model }],
      STYLE,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const cell = workbook.worksheets[0].getCell(1, 2);
    // Έφυγε ως ΤΥΠΟΣ, με το αποτέλεσμά του δίπλα (ώστε κάθε προεπισκόπηση να δείχνει νούμερο).
    expect(cell.value).toMatchObject({ formula: 'A1', result: 10 });

    // …και γυρίζει ως ΤΙΜΗ: η απόφαση του §1.5 του αναγνώστη, τώρα με αριθμό στην απαρίθμηση.
    const format = readWorksheetFormat(workbook.worksheets[0], worksheetGeometry(workbook.worksheets[0]));
    expect(format.formulaCells).toBe(1);
  });
});

describe('ADR-833 Φ6 — §5.7.4: το κελί που έχει ΜΟΝΟ μορφοποίηση', () => {
  it('🔴 δεν εξαφανίζεται πια — η γεωμετρία ρωτιέται από τρεις πηγές', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Φ');
    sheet.getCell('A1').value = 'x';
    sheet.getCell('C3').border = { top: { style: 'thin' } };
    sheet.getCell('E5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    const buffer = await workbook.xlsx.writeBuffer();

    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer);
    const target = reloaded.worksheets[0];

    // Η παλιά ερώτηση — αυτή που έλεγε ψέματα.
    expect(target.columnCount).toBe(1);
    // Η νέα, με τις τρεις πηγές.
    expect(worksheetGeometry(target)).toEqual({ rows: 5, columns: 5 });
  });

  it('🔴 …και η μορφοποίησή του φτάνει στο μοντέλο', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Φ');
    sheet.getCell('A1').value = 'x';
    sheet.getCell('C3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } };
    const buffer = await workbook.xlsx.writeBuffer();
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer);
    const target = reloaded.worksheets[0];
    const geometry = worksheetGeometry(target);
    const format = readWorksheetFormat(target, geometry);

    const grid: string[][] = [];
    for (let r = 0; r < geometry.rows; r++) grid.push(new Array<string>(geometry.columns).fill(''));
    grid[0][0] = 'x';
    const model = worksheetGridToModel(grid, format).model;
    const resolved = resolveTableModel(model);
    const cell = resolved.cells.get(
      // 3η γραμμή, 3η στήλη — θεσιακή ταύτιση 1:1, όπως υπόσχεται το `worksheet-to-model`.
      [...resolved.cells.keys()].find((key) => key.includes(resolved.rows[2].id) && key.includes(resolved.columns[2].id)) as never,
    );
    expect(cell?.styleOverride?.fillColorHex).toBe('#00FF00');
  });
});
