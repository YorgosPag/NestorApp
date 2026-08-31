/**
 * 🔴 ADR-833 §5.7.4 / §5.7 — άγκυρες που **γεννήθηκαν από πράσινες μεταλλάξεις**.
 *
 * Οι δύο ισχυρισμοί-τίτλοι της Φάσης 6 έμεναν χωρίς φρουρό, και οι μεταλλάξεις το απέδειξαν
 * (M37 · M44 · M52 · M53 · M54 · M56 · M60 — όλες πράσινες):
 *
 * 1. **«Η γεωμετρία ρωτιέται από ΤΡΕΙΣ πηγές»** — η υπάρχουσα άγκυρα χρησιμοποιούσε φύλλο όπου
 *    **και οι τρεις** έδιναν την ίδια απάντηση, οπότε η αφαίρεση οποιασδήποτε από αυτές δεν
 *    άλλαζε τίποτα. Εδώ κάθε πηγή απομονώνεται σε **δικό της** φύλλο, όπου είναι η **μόνη** που
 *    ξέρει.
 * 2. **«Μία ακμή, ένα όνομα»** — η υπάρχουσα άγκυρα ρωτούσε «υπάρχει περίγραμμα;» και όχι
 *    «**ποιο**;», οπότε μια κάτω ακμή που έγραφε πάνω στην πάνω περνούσε αθόρυβα. Εδώ οι δύο
 *    πλευρές είναι **σκόπιμα διαφορετικές**, ώστε η σύγχυση να έχει ορατή τιμή.
 *
 * @see bim/table/import/xlsx-worksheet-format.ts — `worksheetGeometry`
 * @see bim/table/import/worksheet-format-apply.ts — τα δύο περάσματα των ακμών
 */

import ExcelJS from 'exceljs';
import { readWorksheetFormat, worksheetGeometry } from '../import/xlsx-worksheet-format';
import { applyWorksheetFormat } from '../import/worksheet-format-apply';
import { tableWorksheetsToXlsxBlob } from '../export/table-to-xlsx';
import { buildTableEdgeIndex, tableEdgeKey, HIDDEN_TABLE_EDGE } from '../table-edge-model';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableStyle } from '../table-style';
import type { PersistedTableModel, TableColumn, TableRow } from '../../../types/table';

const STYLE: TableStyle = (() => {
  const found = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!found) throw new Error('missing STANDARD preset');
  return found;
})();

/** Ένα φύλλο φτιαγμένο επί τόπου, ξαναδιαβασμένο από **πραγματικά bytes**. */
async function reload(build: (sheet: ExcelJS.Worksheet) => void): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  build(workbook.addWorksheet('Φ'));
  const buffer = await workbook.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer);
  return reloaded.worksheets[0];
}

describe('ADR-833 §5.7.4 — οι ΤΡΕΙΣ πηγές, καθεμιά ΜΟΝΗ της', () => {
  it('🔴 πηγή Α: μόνο τα ΚΕΛΙΑ των γραμμών ξέρουν (κελί με μόνο περίγραμμα, σε ΑΔΕΙΑ γραμμή)', async () => {
    const sheet = await reload((s) => {
      s.getCell('A1').value = 'x';
      s.getCell('D3').border = { top: { style: 'thin' } };
    });
    // 🔑 **Η ακριβής συνθήκη του ψεύδους**, οξυμένη από αυτή την ίδια άγκυρα: το
    // `columnCount` υλοποιείται με `eachRow`, που παραλείπει τις γραμμές **χωρίς καμία τιμή**.
    // Άρα το `D3` (γραμμή 3, ολόκληρη χωρίς τιμές) είναι αόρατο, ενώ ένα `D1` — στην ίδια
    // γραμμή με το `A1` — θα μετριόταν κανονικά. Δεν είναι «το columnCount είναι χαλασμένο»:
    // είναι «το columnCount βλέπει μόνο ό,τι βλέπει το `eachRow`», και αυτό ακριβώς χάνει τα
    // φύλλα-φόρμες με πλαισιωμένες κενές γραμμές.
    expect(sheet.columnCount).toBe(1);
    expect(sheet.getRow(3).cellCount).toBe(4);
    expect(worksheetGeometry(sheet).columns).toBe(4);
  });

  it('🔴 πηγή Β: μόνο οι ΔΗΛΩΜΕΝΕΣ ΣΤΗΛΕΣ ξέρουν (στήλη με μόνο πλάτος)', async () => {
    const sheet = await reload((s) => {
      s.getCell('A1').value = 'x';
      s.getColumn(6).width = 30;
    });
    expect(sheet.columnCount).toBe(1);
    expect(worksheetGeometry(sheet).columns).toBeGreaterThanOrEqual(6);
  });

  it('🔴 πηγή Γ: μόνο οι ΣΥΓΧΩΝΕΥΣΕΙΣ ξέρουν (κενή συγχώνευση προς τα κάτω)', async () => {
    const sheet = await reload((s) => {
      s.getCell('A1').value = 'x';
      s.mergeCells('B4:B7');
    });
    // Καμία τιμή, κανένα στυλ, καμία δηλωμένη στήλη κάτω από τη γραμμή 4 — μόνο η συγχώνευση.
    expect(worksheetGeometry(sheet).rows).toBeGreaterThanOrEqual(7);
  });
});

describe('ADR-833 §5.7 — ΜΙΑ ακμή, ΕΝΑ όνομα: ποιος γράφει όταν μιλούν δύο κελιά', () => {
  /** Φύλλο όπου η **κάτω** πλευρά του A1 και η **πάνω** του A2 λένε ΔΙΑΦΟΡΕΤΙΚΑ πράγματα. */
  async function conflicting(): Promise<PersistedTableModel> {
    const sheet = await reload((s) => {
      s.getCell('A1').value = 'πάνω';
      s.getCell('A2').value = 'κάτω';
      s.getCell('A1').border = { bottom: { style: 'thick' } };
      s.getCell('A2').border = { top: { style: 'hair' } };
    });
    const geometry = worksheetGeometry(sheet);
    const format = readWorksheetFormat(sheet, geometry);
    const empty = toPersistedTableModel(
      createTableModel({
        columns: [{ id: 'c0', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' }],
        rows: [
          { id: 'r0', rowClass: 'data' },
          { id: 'r1', rowClass: 'data' },
        ],
        cells: [],
        merges: [],
      }),
    );
    return applyWorksheetFormat(empty, format);
  }

  it('🔴 ΝΙΚΑΕΙ η ΠΑΝΩ πλευρά του κάτω κελιού — το όνομα που κατέχει το μοντέλο', async () => {
    const model = await conflicting();
    const edges = buildTableEdgeIndex(model.edges);
    const shared = edges.get(tableEdgeKey('H', 'r1', 'c0'));
    // «hair» ⇒ η λεπτότερη βαθμίδα (0,13 mm). Αν νικούσε το «thick» του A1, θα ήταν 1 mm.
    expect(shared?.widthMm).toBeLessThan(0.2);
  });

  it('🔴 …και η ΚΑΤΩ πλευρά ΔΕΝ χάνεται όταν κανείς άλλος δεν μιλά για την ακμή', async () => {
    const sheet = await reload((s) => {
      s.getCell('A1').value = 'μόνο';
      s.getCell('A1').border = { bottom: { style: 'thick' } };
    });
    const format = readWorksheetFormat(sheet, worksheetGeometry(sheet));
    const empty = toPersistedTableModel(
      createTableModel({
        columns: [{ id: 'c0', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' }],
        rows: [{ id: 'r0', rowClass: 'data' }],
        cells: [],
        merges: [],
      }),
    );
    const edges = buildTableEdgeIndex(applyWorksheetFormat(empty, format).edges);
    // Δεν υπάρχει γραμμή από κάτω ⇒ η ακμή είναι το **σύνορο** του πίνακα (`$end`).
    expect(edges.get(tableEdgeKey('H', '$end', 'c0'))?.widthMm).toBeGreaterThan(0.5);
  });
});

describe('ADR-833 §5.7 — η ΑΟΡΑΤΗ ακμή δεν ζωγραφίζεται στο αρχείο', () => {
  it('🔴 ρητά αόρατο περίγραμμα ⇒ ΚΑΜΙΑ πλευρά στο `.xlsx`', async () => {
    const columns: TableColumn[] = [
      { id: 'c0', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
    ];
    const rows: TableRow[] = [{ id: 'r0', rowClass: 'data' }];
    const model = toPersistedTableModel(
      createTableModel({
        columns,
        rows,
        cells: [],
        merges: [],
        // Και οι τέσσερις ακμές του μοναδικού κελιού, ρητά **αόρατες**.
        edges: [
          ['H', 'r0', 'c0', HIDDEN_TABLE_EDGE],
          ['H', '$end', 'c0', HIDDEN_TABLE_EDGE],
          ['V', 'r0', 'c0', HIDDEN_TABLE_EDGE],
          ['V', 'r0', '$end', HIDDEN_TABLE_EDGE],
        ],
      }),
    );
    const blob = await tableWorksheetsToXlsxBlob(
      [{ id: tableWorksheetId('ws0'), name: 'Φ', model }],
      STYLE,
    );
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await blob.arrayBuffer());
    const border = reloaded.worksheets[0].getCell(1, 1).border;
    // 🔴 «Αόρατη» ΔΕΝ σημαίνει «μηδενικού πάχους»: το δεύτερο αφήνει hairline σε κάποια
    // backends. Στο αρχείο δεν πρέπει να υπάρχει **καμία** δηλωμένη πλευρά.
    expect(border?.top?.style).toBeUndefined();
    expect(border?.left?.style).toBeUndefined();
    expect(border?.bottom?.style).toBeUndefined();
    expect(border?.right?.style).toBeUndefined();
  });
});

describe('ADR-833 §5.7 — η ΕΞΑΓΩΓΗ ρωτά ΔΙΑΦΟΡΕΤΙΚΗ ακμή για κάθε πλευρά', () => {
  it('🔴 πάνω ≠ κάτω: η κάθε πλευρά διαβάζεται από τη ΔΙΚΗ της θέση πλέγματος', async () => {
    // Δύο γραμμές, και η **ενδιάμεση** ακμή είναι σκόπιμα παχύτερη από την κορυφή. Αν ο
    // γραφέας ρωτούσε την ίδια θέση για πάνω και κάτω, οι δύο πλευρές θα έβγαιναν ίδιες και
    // ο πίνακας θα έχανε κάθε οριζόντιο τονισμό (γραμμή συνόλων, διαχωριστικό κεφαλίδας).
    const thick = { visible: true, colorHex: '#000000', widthMm: 1 } as const;
    const model = toPersistedTableModel(
      createTableModel({
        columns: [{ id: 'c0', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' }],
        rows: [
          { id: 'r0', rowClass: 'data' },
          { id: 'r1', rowClass: 'data' },
        ],
        cells: [],
        merges: [],
        edges: [['H', 'r1', 'c0', thick]],
      }),
    );
    const blob = await tableWorksheetsToXlsxBlob(
      [{ id: tableWorksheetId('ws0'), name: 'Φ', model }],
      STYLE,
    );
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await blob.arrayBuffer());
    const first = reloaded.worksheets[0].getCell(1, 1);
    expect(first.border?.bottom?.style).toBe('thick');
    expect(first.border?.top?.style).not.toBe('thick');
  });

  it('🔴 αριστερά ≠ δεξιά — ο ίδιος έλεγχος στον ΚΑΤΑΚΟΡΥΦΟ άξονα', async () => {
    // Ο οριζόντιος άξονας από μόνος του δεν φυλάει τον κατακόρυφο: μετρήθηκε (μετάλλαξη M69,
    // «δεξιά = αριστερή») ότι έμενε πράσινη όσο υπήρχε μόνο ο πρώτος έλεγχος.
    const thick = { visible: true, colorHex: '#000000', widthMm: 1 } as const;
    const model = toPersistedTableModel(
      createTableModel({
        columns: [
          { id: 'c0', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
          { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
        ],
        rows: [{ id: 'r0', rowClass: 'data' }],
        cells: [],
        merges: [],
        edges: [['V', 'r0', 'c1', thick]],
      }),
    );
    const blob = await tableWorksheetsToXlsxBlob(
      [{ id: tableWorksheetId('ws0'), name: 'Φ', model }],
      STYLE,
    );
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(await blob.arrayBuffer());
    const first = reloaded.worksheets[0].getCell(1, 1);
    expect(first.border?.right?.style).toBe('thick');
    expect(first.border?.left?.style).not.toBe('thick');
  });
});

describe('ADR-833 §5.7 — στοίχιση: το «Γενικά» του Excel ΔΕΝ καρφώνεται', () => {
  it('🔴 κελί με ΜΟΝΟ κατακόρυφη στοίχιση δεν αποκτά οριζόντια παράκαμψη', async () => {
    const sheet = await reload((s) => {
      s.getCell('A1').value = 42;
      s.getCell('A1').alignment = { vertical: 'top' };
    });
    const format = readWorksheetFormat(sheet, worksheetGeometry(sheet));
    const cell = format.cells.find((entry) => entry.row === 0 && entry.col === 0);
    // Ένα καρφωμένο `'TL'`/`'ML'` εδώ θα στοίχιζε **κάθε αριθμό** κάθε εισαγόμενου φύλλου
    // αριστερά, ενώ το Excel τους δείχνει δεξιά («Γενικά» = εξαρτάται από το περιεχόμενο).
    expect(cell?.styleOverride?.align).toBeUndefined();
  });

  it('όταν ΔΗΛΩΘΕΙ ο οριζόντιος, ο κατακόρυφος που λείπει είναι το «κάτω» του Excel', async () => {
    const sheet = await reload((s) => {
      s.getCell('A1').value = 'x';
      s.getCell('A1').alignment = { horizontal: 'center' };
    });
    const format = readWorksheetFormat(sheet, worksheetGeometry(sheet));
    expect(format.cells[0]?.styleOverride?.align).toBe('BC');
  });
});
