/**
 * 🔴 ADR-833 Φάση 7 — **ΤΥΠΟΙ ΑΝΑΜΕΣΑ ΣΕ ΦΥΛΛΑ**: `=Φύλλο2!A1`.
 *
 * Η φάση δεν είναι το `!` του λεξικογράφου — εκείνο είναι μισή μέρα. Είναι ότι ολόκληρη η
 * αλυσίδα εγγραφής δούλευε πάνω σε **ένα** φύλλο, και ένας τύπος που διαβάζει άλλο φύλλο
 * χρειάζεται είσοδο που **δεν υπήρχε σε καμία υπογραφή**. Αυτή η σουίτα καρφώνει τις
 * υποσχέσεις του §5.9, ομαδοποιημένες όπως γεννήθηκαν.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.9
 */

/**
 * 🔴 **Η ΖΩΝΤΑΝΗ ΓΛΩΣΣΑ, ΣΤΟ ΔΕΙΓΜΑ.** Το προεπιλεγμένο όνομα φύλλου είναι **παράγωγο** της
 * i18n (`table.worksheet.defaultName` → `Φύλλο{index}` στα ελληνικά), και η Φάση 7 το κάνει
 * μέρος της **γραμματικής**: ο χρήστης πληκτρολογεί `=Φύλλο2!A1`. Χωρίς το singleton φορτωμένο
 * ο επιλυτής επιστρέφει το **κλειδί**, οπότε καμία δια-φυλλική αναφορά δεν θα έδενε.
 *
 * Το πρότυπο αναπαράγεται **αυτούσιο** από το `locales/el/dxf-viewer-shell.json` — ίδιο ιδίωμα
 * με το `table-worksheet-name.test.ts`, που είναι ο ιδιοκτήτης της ερώτησης «πώς λέγεται μια
 * καρτέλα». Εδώ η ερώτηση είναι **άλλη**: «τι κάνει ένας τύπος με αυτό το όνομα».
 */
jest.mock('@/i18n', () => ({
  i18n: {
    t: (_key: string, options: { readonly index: number }) => `Φύλλο${options.index}`,
  },
}));

import type {
  PersistedTableModel,
  TableColumn,
  TableRow,
} from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { TableWorksheet, TableWorksheetId } from '../../../types/table-worksheet';
import { tableWorksheetId } from '../../../types/table-worksheet';
import { uniqueSheetNames } from '@/lib/spreadsheet/unique-sheet-names';
import {
  createTableModel,
  getCell,
  resolveTableModel,
  toPersistedTableModel,
} from '../table-model-helpers';
import {
  cellInputText,
  commitCellWrites,
  writeCellInput,
} from '../formula/table-formula-engine';
import { FORMULA_ERROR } from '../formula/table-formula-value';
import { offsetTableFormula } from '../formula/table-formula-offset';
import { remapTableFormulaRefs } from '../formula/table-formula-remap';
import { expandRangeShape } from '../formula/table-formula-eval';
import {
  namedWorksheetReads,
  NO_WORKSHEET_NAMING,
  sameSheetRefs,
} from '../formula/table-formula-workbook';
import { cellKey } from '../table-model-helpers';
import { worksheetsWithActiveModel } from '../table-worksheet-write';
import { deleteTableRow } from '../table-row-column-ops';
import { deleteTableRows } from '../table-row-column-bulk-ops';
import { planWorksheetDelete } from '../table-worksheet-ops';
import {
  screenWorksheetNaming,
  worksheetsFormulaBook,
} from '../table-worksheet-book';
import { worksheetsAfterHomeChange } from '../table-worksheet-formulas';
import { makeTableEntity } from './make-table-entity';
import { tableFormulaReferenceSpans } from '../formula/table-formula-reference-spans';
import { resolveFormulaPointState } from '../formula/table-formula-point-state';
import { tableWorksheetsToXlsxBlob } from '../export/table-to-xlsx';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';

const REF = FORMULA_ERROR.reference;

const COLUMNS: readonly TableColumn[] = ['c1', 'c2'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 } as const,
  valueType: 'number' as const,
  align: 'right' as const,
}));

const ROWS: readonly TableRow[] = ['r1', 'r2', 'r3', 'r4'].map((id) => ({
  id,
  rowClass: 'data' as const,
  heightMm: 8,
}));

function emptyModel(): PersistedTableModel {
  return toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS }));
}

// ──────────────────────────────────────────────────────────────────────────────
// Ένα βιβλίο δείγματος — φύλλα με ονόματα, και η **μία** πόρτα εγγραφής
// ──────────────────────────────────────────────────────────────────────────────

interface SheetDraft {
  readonly name?: string;
  readonly cells?: readonly (readonly [string, string, string])[];
}

/** Οντότητα με τα φύλλα που ζητήθηκαν· ταυτότητες `ws0`, `ws1`, … (ντετερμινιστικές). */
function book(drafts: readonly SheetDraft[], activeIndex = 0): TableEntity {
  const worksheets: TableWorksheet[] = drafts.map((draft, index) => ({
    id: tableWorksheetId(`ws${index}`),
    ...(draft.name === undefined ? {} : { name: draft.name }),
    model: emptyModel(),
  }));
  let entity: TableEntity = {
    ...makeTableEntity(),
    worksheets,
    activeWorksheetId: worksheets[activeIndex].id,
  };
  drafts.forEach((draft, index) => {
    for (const [rowId, colId, text] of draft.cells ?? []) {
      entity = write(entity, tableWorksheetId(`ws${index}`), rowId, colId, text);
    }
  });
  return entity;
}

/**
 * 🔑 **Η ΜΙΑ ΠΟΡΤΑ**: ακριβώς ό,τι κάνει το `buildTableCellEditCommand` — γράψε στο φύλλο,
 * ξαναϋπολόγισε το φύλλο, **και μετά** άφησε την πύλη του βιβλίου να φτάσει στα άλλα.
 *
 * Το δείγμα δεν επιτρέπεται να παρακάμψει την πύλη: αν την παρέκαμπτε, οι άγκυρες θα
 * μετρούσαν κάτι που η παραγωγή δεν κάνει.
 */
function write(
  entity: TableEntity,
  sheetId: TableWorksheetId,
  rowId: string,
  colId: string,
  text: string,
): TableEntity {
  const worksheets = entity.worksheets ?? [];
  const before = worksheets.find((sheet) => sheet.id === sheetId);
  if (!before) throw new Error(`άγνωστο φύλλο ${sheetId}`);

  const scoped = worksheetsFormulaBook(worksheets, sheetId);
  const nextModel = commitCellWrites(
    scoped,
    writeCellInput(scoped, before.model, rowId, colId, text),
  );
  const replaced = worksheets.map((sheet) =>
    sheet.id === sheetId ? { ...sheet, model: nextModel } : sheet,
  );
  return {
    ...entity,
    worksheets: worksheetsAfterHomeChange(replaced, sheetId, before.model),
  };
}

/** Η **τιμή** ενός κελιού — αυτό που ταξιδεύει σε DXF και σε `.xlsx`. */
function valueAt(entity: TableEntity, sheetIndex: number, rowId: string, colId: string): unknown {
  const model = (entity.worksheets ?? [])[sheetIndex].model;
  return getCell(resolveTableModel(model), rowId, colId)?.value;
}

/** Η **γραμμή τύπων** ενός κελιού, με το βιβλίο του πίνακα. */
function sourceAt(entity: TableEntity, sheetIndex: number, rowId: string, colId: string): string {
  const worksheets = entity.worksheets ?? [];
  const sheet = worksheets[sheetIndex];
  return cellInputText(
    worksheetsFormulaBook(worksheets, sheet.id),
    sheet.model,
    rowId,
    colId,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Α. Η ΓΡΑΜΜΑΤΙΚΗ — τι δένεται, και σε τι
// ══════════════════════════════════════════════════════════════════════════════

describe('Α. το πληκτρολογημένο όνομα λύνεται σε ΤΑΥΤΟΤΗΤΑ', () => {
  it('🎯 το αίτημα: `=Φύλλο2!A1` διαβάζει το άλλο φύλλο', () => {
    const entity = book([
      { cells: [['r1', 'c1', '=Φύλλο2!A1']] },
      { cells: [['r1', 'c1', '42']] },
    ]);
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe(42);
  });

  it('η αναφορά κρατά την **ταυτότητα** του φύλλου, όχι το όνομά του', () => {
    const entity = book([{ cells: [['r1', 'c1', '=Φύλλο2!A1']] }, {}]);
    const cell = resolveTableModel((entity.worksheets ?? [])[0].model).cells.get(
      [...resolveTableModel((entity.worksheets ?? [])[0].model).cells.keys()][0],
    );
    const root = cell?.formula?.root;
    expect(root?.kind).toBe('ref');
    if (root?.kind !== 'ref') return;
    expect(root.cell.worksheetId).toBe('ws1');
  });

  it('🔴 το ΔΙΚΟ ΜΑΣ φύλλο γραμμένο ρητά κανονικοποιείται σε **απουσία**', () => {
    // Το `=Φύλλο1!A1` μέσα στο Φύλλο1 σημαίνει ό,τι και το `=A1`. Χωρίς αυτό, η μετακόμιση
    // και η δομική θεραπεία θα το θεωρούσαν «ξένο» και θα έπαυε να ακολουθεί τις γραμμές του.
    const entity = book([{ cells: [['r2', 'c1', '7'], ['r1', 'c1', '=Φύλλο1!A2']] }, {}]);
    const model = resolveTableModel((entity.worksheets ?? [])[0].model);
    const root = getCell(model, 'r1', 'c1')?.formula?.root;
    expect(root?.kind).toBe('ref');
    if (root?.kind !== 'ref') return;
    expect(root.cell.worksheetId).toBeUndefined();
    expect(sourceAt(entity, 0, 'r1', 'c1')).toBe('=A2');
  });

  it('όνομα με κενά δουλεύει **σε απόστροφους**, όπως στο Excel', () => {
    const entity = book([
      { cells: [['r1', 'c1', "='Τιμές 2024'!A1"]] },
      { name: 'Τιμές 2024', cells: [['r1', 'c1', '5']] },
    ]);
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe(5);
  });

  it('η **διπλή** απόστροφος μέσα σε όνομα είναι μία κυριολεκτική (σύμβαση Excel)', () => {
    const entity = book([
      { cells: [['r1', 'c1', "='Ο''Νιλ'!A1"]] },
      { name: "Ο'Νιλ", cells: [['r1', 'c1', '9']] },
    ]);
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe(9);
  });

  it('🔴 άγνωστο φύλλο ⇒ `#REF!` (αποτυχία ΔΕΣΙΜΑΤΟΣ), ΟΧΙ σιωπηλό κείμενο', () => {
    const entity = book([{ cells: [['r1', 'c1', '=Φύλλο9!A1']] }, {}]);
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe(REF);
    expect(sourceAt(entity, 0, 'r1', 'c1')).toBe(`=${REF}`);
  });

  it('🔴 εισαγωγικό όνομα ΧΩΡΙΣ `!` δεν είναι τύπος — μένει κείμενο, αυτούσιο', () => {
    // Ένα φύλλο μπορεί να λέγεται `A1`: αν το `='A1'` περνούσε για διεύθυνση, ο χρήστης θα
    // έβλεπε αριθμό που δεν ζήτησε.
    const entity = book([{ cells: [['r1', 'c1', "='A1'"]] }, {}]);
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe("='A1'");
  });

  it('εύρος: το δεξί άκρο **κληρονομεί** το φύλλο του αριστερού', () => {
    const entity = book([
      { cells: [['r1', 'c1', '=SUM(Φύλλο2!A1:A3)']] },
      { cells: [['r1', 'c1', '1'], ['r2', 'c1', '2'], ['r3', 'c1', '3']] },
    ]);
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe(6);
  });

  it('ένα φύλλο που λέγεται `A1` είναι προσπελάσιμο — το `!` κρίνεται ΠΡΩΤΟ', () => {
    const entity = book([
      { cells: [['r1', 'c1', "='A1'!A1"]] },
      { name: 'A1', cells: [['r1', 'c1', '11']] },
    ]);
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe(11);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Β. Ο ΕΚΤΥΠΩΤΗΣ — και το round-trip που η Φάση 7 κόντεψε να σπάσει
// ══════════════════════════════════════════════════════════════════════════════

describe('Β. η γραμμή τύπων γράφει ΟΝΟΜΑ, παραγόμενο τη στιγμή της ερώτησης', () => {
  it('γράφει `=Φύλλο2!A1` για αναφορά στο δεύτερο φύλλο', () => {
    const entity = book([{ cells: [['r1', 'c1', '=Φύλλο2!A1']] }, {}]);
    expect(sourceAt(entity, 0, 'r1', 'c1')).toBe('=Φύλλο2!A1');
  });

  it('εύρος: το φύλλο γράφεται **μία** φορά, στο αριστερό άκρο (όπως το Excel)', () => {
    const entity = book([{ cells: [['r1', 'c1', '=SUM(Φύλλο2!A1:A3)']] }, {}]);
    expect(sourceAt(entity, 0, 'r1', 'c1')).toBe('=SUM(Φύλλο2!A1:A3)');
  });

  it('όνομα με κενά ξαναγράφεται **σε απόστροφους**', () => {
    const entity = book([{ cells: [['r1', 'c1', "='Τιμές 2024'!A1"]] }, { name: 'Τιμές 2024' }]);
    expect(sourceAt(entity, 0, 'r1', 'c1')).toBe("='Τιμές 2024'!A1");
  });

  it('ελληνικό όνομα **χωρίς** κενά μένει γυμνό — ο λεξικογράφος το διαβάζει πίσω', () => {
    const entity = book([{ cells: [['r1', 'c1', '=Κόστη!A1']] }, { name: 'Κόστη' }]);
    expect(sourceAt(entity, 0, 'r1', 'c1')).toBe('=Κόστη!A1');
  });

  it('🔴 όνομα σε **σχήμα διεύθυνσης** παίρνει απόστροφους — για το Excel, όχι για εμάς', () => {
    const entity = book([{ cells: [['r1', 'c1', "='A1'!A1"]] }, { name: 'A1' }]);
    expect(sourceAt(entity, 0, 'r1', 'c1')).toBe("='A1'!A1");
  });

  it('🏆 ΜΕΤΟΝΟΜΑΣΙΑ: ο τύπος **δεν αγγίζεται**, το γραμμένο όνομα αλλάζει μόνο του', () => {
    // Το Excel και τα Sheets υποχρεώνονται να ξαναγράψουν **κάθε** τύπο. Εδώ η μετονομασία
    // δεν έχει τίποτα να αγγίξει: η αναφορά κρατά ταυτότητα.
    const entity = book([{ cells: [['r1', 'c1', '=Φύλλο2!A1']] }, {}]);
    const worksheets = entity.worksheets ?? [];
    const formulaBefore = resolveTableModel(worksheets[0].model).cells;
    const renamed: TableEntity = {
      ...entity,
      worksheets: worksheets.map((sheet, index) =>
        index === 1 ? { ...sheet, name: 'Υλικά' } : sheet,
      ),
    };
    expect(sourceAt(renamed, 0, 'r1', 'c1')).toBe('=Υλικά!A1');
    // Το ίδιο δέντρο, το ίδιο μοντέλο: καμία εγγραφή, κανένα βήμα undo.
    expect(resolveTableModel((renamed.worksheets ?? [])[0].model).cells).toBe(formulaBefore);
  });

  it('🔴 ΟΜΩΝΥΜΑ ΦΥΛΛΑ: το δεύτερο γράφεται `(2)` — και ξαναδιαβάζεται στο ΔΕΥΤΕΡΟ', () => {
    // Χωρίς τη μοναδικοποίηση, το ίδιο κείμενο θα ξαναδενόταν στο **πρώτο** «Κόστη»: ένας
    // τύπος που ο χρήστης απλώς άνοιξε και έκλεισε θα άλλαζε σιωπηλά φύλλο.
    const entity = book([
      { cells: [['r1', 'c1', '=Κόστη!A1']] },
      { name: 'Κόστη', cells: [['r1', 'c1', '100']] },
      { name: 'Κόστη', cells: [['r1', 'c1', '200']] },
    ]);
    const withSecond = write(entity, tableWorksheetId('ws0'), 'r2', 'c1', "='Κόστη (2)'!A1");
    expect(valueAt(withSecond, 0, 'r1', 'c1')).toBe(100);
    expect(valueAt(withSecond, 0, 'r2', 'c1')).toBe(200);
    expect(sourceAt(withSecond, 0, 'r2', 'c1')).toBe("='Κόστη (2)'!A1");
  });

  it('🔑 round-trip: άνοιγμα και δέσμευση χωρίς αλλαγή αφήνει τον τύπο **ταυτόσημο**', () => {
    const entity = book([
      { cells: [['r1', 'c1', '=Κόστη!A1']] },
      { name: 'Κόστη', cells: [['r1', 'c1', '100']] },
      { name: 'Κόστη', cells: [['r1', 'c1', '200']] },
    ]);
    const withSecond = write(entity, tableWorksheetId('ws0'), 'r2', 'c1', "='Κόστη (2)'!A1");
    const reopened = write(
      withSecond,
      tableWorksheetId('ws0'),
      'r2',
      'c1',
      sourceAt(withSecond, 0, 'r2', 'c1'),
    );
    expect(valueAt(reopened, 0, 'r2', 'c1')).toBe(200);
  });

  it('τα ονόματα των φύλλων μοναδικοποιούνται **μόνο στη γραφή** — τα δεδομένα μένουν', () => {
    const entity = book([{}, { name: 'Κόστη' }, { name: 'Κόστη' }]);
    const worksheets = entity.worksheets ?? [];
    expect(worksheets[1].name).toBe('Κόστη');
    expect(worksheets[2].name).toBe('Κόστη');
    const naming = screenWorksheetNaming(worksheets);
    expect(naming.nameOf(worksheets[1].id)).toBe('Κόστη');
    expect(naming.nameOf(worksheets[2].id)).toBe('Κόστη (2)');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Γ. Ο ΚΑΘΟΛΙΚΟΣ ΓΡΑΦΟΣ — η αλλαγή φτάνει στα άλλα φύλλα
// ══════════════════════════════════════════════════════════════════════════════

describe('Γ. ο γράφος είναι ΤΟΥ ΒΙΒΛΙΟΥ', () => {
  it('🎯 γραφή στο Φύλλο1 ⇒ **ενημερώνεται** το κελί του Φύλλου2 που το διαβάζει', () => {
    // Χωρίς αυτό, το Φύλλο2 θα εξαγόταν σε DXF και σε `.xlsx` με **μπαγιάτικη** τιμή —
    // ακριβώς ο λόγος για τον οποίο ο ADR-764 §6 απέρριψε τον οκνηρό δρόμο.
    let entity = book([{ cells: [['r1', 'c1', '10']] }, {}]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=Φύλλο1!A1*2');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(20);

    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '50');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(100);
  });

  it('🔴 ΜΕΤΑΒΑΤΙΚΑ: Φύλλο3 → Φύλλο2 → Φύλλο1, χωρίς το Φύλλο3 να κατονομάζει το Φύλλο1', () => {
    let entity = book([{ cells: [['r1', 'c1', '3']] }, {}, {}]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=Φύλλο1!A1*2');
    entity = write(entity, tableWorksheetId('ws2'), 'r1', 'c1', '=Φύλλο2!A1+1');
    expect(valueAt(entity, 2, 'r1', 'c1')).toBe(7);

    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '10');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(20);
    expect(valueAt(entity, 2, 'r1', 'c1')).toBe(21);
  });

  it('🔑 ΚΥΚΛΟΣ ανάμεσα σε φύλλα ⇒ `#CIRCULAR!` — δωρεάν, από την ίδια ταξινόμηση', () => {
    let entity = book([{}, {}]);
    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '=Φύλλο2!A1');
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=Φύλλο1!A1');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(FORMULA_ERROR.circular);
  });

  it('🔴 Ο ΦΡΟΥΡΟΣ: βιβλίο χωρίς δια-φυλλικούς τύπους επιστρέφει τα **ΙΔΙΑ** φύλλα', () => {
    // Είναι όλη η απόδοση της φάσης: ×1,0 αντί για ×4–6. Και ταυτότητα by-reference σημαίνει
    // «καμία εντολή, κανένα βήμα undo» για τα φύλλα που δεν αφορά η αλλαγή.
    const entity = book([{ cells: [['r1', 'c1', '1']] }, { cells: [['r1', 'c1', '2']] }]);
    const worksheets = entity.worksheets ?? [];
    const after = worksheetsAfterHomeChange(worksheets, tableWorksheetId('ws0'), emptyModel());
    expect(after).toBe(worksheets);
  });

  it('φύλλο που **δεν** διαβάζει το αλλαγμένο μένει αυτούσιο by-reference', () => {
    let entity = book([{ cells: [['r1', 'c1', '1']] }, {}, {}]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=Φύλλο1!A1');
    const untouched = (entity.worksheets ?? [])[2];
    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '99');
    expect((entity.worksheets ?? [])[2]).toBe(untouched);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Δ. ΤΟ ΦΥΛΛΟ ΠΟΥ ΕΦΥΓΕ — και η γραμμή που έφυγε μέσα του
// ══════════════════════════════════════════════════════════════════════════════

describe('Δ. `#REF!` — η ΤΡΙΤΗ αιτία, με τον ίδιο μηχανισμό', () => {
  it('🔴 ΔΙΑΓΡΑΦΗ ΦΥΛΛΟΥ ⇒ `#REF!` στην τιμή **και** στη γραμμή τύπων', () => {
    let entity = book([{}, { cells: [['r1', 'c1', '5']] }]);
    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '=Φύλλο2!A1');
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe(5);

    const worksheets = (entity.worksheets ?? []).filter((sheet) => sheet.id !== 'ws1');
    const after: TableEntity = { ...entity, worksheets };
    expect(sourceAt(after, 0, 'r1', 'c1')).toBe(`=${REF}`);
  });

  it('🔴 η ΤΙΜΗ γίνεται `#REF!` κιόλας, όχι μόνο η γραμμή τύπων', () => {
    // Το εύρημα που έφερε το `worksheetsAfterRemoval`: ο εκτυπωτής έλεγε ήδη `#REF!`, αλλά η
    // **αποθηκευμένη** τιμή έμενε ο παλιός αριθμός — ακριβώς το σφάλμα του ADR-764, ανάποδα.
    let entity = book([{}, { cells: [['r1', 'c1', '5']] }]);
    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '=Φύλλο2!A1*2');
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe(10);

    const plan = planWorksheetDelete(entity, tableWorksheetId('ws1'), null);
    expect(plan).not.toBeNull();
    if (!plan) return;
    const after: TableEntity = { ...entity, worksheets: plan.worksheets };
    expect(valueAt(after, 0, 'r1', 'c1')).toBe(REF);
  });

  it('🏆 ΞΕΝΟ ΕΥΡΟΣ: διαγραφή γραμμής στο Φύλλο1 **συρρικνώνει** το `=SUM(Φύλλο1!A1:A4)` του Φύλλου2', () => {
    // Το Excel το κρατά ζωντανό· ένα `#REF!` εδώ θα ήταν απόκλιση από την parity, και μάλιστα
    // σιωπηλή — ο χρήστης δεν άγγιξε το Φύλλο2.
    let entity = book([
      { cells: [['r1', 'c1', '1'], ['r2', 'c1', '2'], ['r3', 'c1', '3'], ['r4', 'c1', '4']] },
      {},
    ]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=SUM(Φύλλο1!A1:A4)');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(10);

    entity = deleteRow(entity, tableWorksheetId('ws0'), 'r4');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(6);
    expect(sourceAt(entity, 1, 'r1', 'c1')).toBe('=SUM(Φύλλο1!A1:A3)');
  });

  it('ΞΕΝΗ ΑΜΕΣΗ αναφορά σε σβησμένη γραμμή ⇒ `#REF!` (το εύρος επιβιώνει, το κελί όχι)', () => {
    let entity = book([{ cells: [['r4', 'c1', '4']] }, {}]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=Φύλλο1!A4');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(4);

    entity = deleteRow(entity, tableWorksheetId('ws0'), 'r4');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(REF);
  });
});

/** Διαγραφή γραμμής σε ένα φύλλο, **μέσα από την πύλη** — όπως η παραγωγή. */
function deleteRow(
  entity: TableEntity,
  sheetId: TableWorksheetId,
  rowId: string,
): TableEntity {
  const worksheets = entity.worksheets ?? [];
  const before = worksheets.find((sheet) => sheet.id === sheetId);
  if (!before) throw new Error(`άγνωστο φύλλο ${sheetId}`);
  const scoped = worksheetsFormulaBook(worksheets, sheetId);
  const replaced = worksheets.map((sheet) =>
    sheet.id === sheetId ? { ...sheet, model: deleteTableRow(scoped, sheet.model, rowId) } : sheet,
  );
  return {
    ...entity,
    worksheets: worksheetsAfterHomeChange(replaced, sheetId, before.model),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Ε. ΑΝΤΙΓΡΑΦΗ ΚΑΙ ΜΕΤΑΚΟΜΙΣΗ — το πλέγμα είναι ΤΗΣ ΑΝΑΦΟΡΑΣ
// ══════════════════════════════════════════════════════════════════════════════

describe('Ε. η ολίσθηση μετριέται πάνω στο ΞΕΝΟ πλέγμα', () => {
  it('🔴 αντιγραφή μία γραμμή κάτω: `=Φύλλο2!A1` γίνεται `=Φύλλο2!A2`', () => {
    const entity = book([{ cells: [['r1', 'c1', '=Φύλλο2!A1']] }, {}]);
    const worksheets = entity.worksheets ?? [];
    const model = resolveTableModel(worksheets[0].model);
    const formula = getCell(model, 'r1', 'c1')?.formula;
    expect(formula).toBeDefined();
    if (!formula) return;

    const moved = offsetTableFormula(
      worksheetsFormulaBook(worksheets, worksheets[0].id),
      formula,
      { rows: 1, columns: 0 },
    );
    const root = moved.root;
    expect(root.kind).toBe('ref');
    if (root.kind !== 'ref') return;
    expect(root.cell.worksheetId).toBe('ws1');
    expect(root.cell.rowId).toBe('r2');
  });

  it('🔴 ξένη αναφορά που πέφτει **εκτός** του ξένου πλέγματος ⇒ `#REF!`', () => {
    const entity = book([{ cells: [['r1', 'c1', '=Φύλλο2!A4']] }, {}]);
    const worksheets = entity.worksheets ?? [];
    const formula = getCell(resolveTableModel(worksheets[0].model), 'r1', 'c1')?.formula;
    if (!formula) throw new Error('χωρίς τύπο');
    const moved = offsetTableFormula(
      worksheetsFormulaBook(worksheets, worksheets[0].id),
      formula,
      { rows: 1, columns: 0 },
    );
    expect(moved.root.kind).toBe('error');
  });

  it('🔴 M85 — αντιγραφή τύπου που δείχνει σε ΣΒΗΣΜΕΝΟ φύλλο δίνει `#REF!`', () => {
    let entity = book([{}, { cells: [['r1', 'c1', '5']] }]);
    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '=Φύλλο2!A1');
    const worksheets = entity.worksheets ?? [];
    const formula = getCell(resolveTableModel(worksheets[0].model), 'r1', 'c1')?.formula;
    if (!formula) throw new Error('χωρίς τύπο');

    // Το βιβλίο **χωρίς** το Φύλλο2: ό,τι μένει από μια διαγραφή φύλλου.
    const shrunk = worksheetsFormulaBook(worksheets.slice(0, 1), worksheets[0].id);
    const moved = offsetTableFormula(shrunk, formula, { rows: 1, columns: 0 });
    expect(moved.root.kind).toBe('error');
  });

  it('🔴 M70 — ΜΑΖΙΚΗ διαγραφή δύο γραμμών συρρικνώνει το ξένο εύρος με ΔΥΟ σχέδια', () => {
    // Μία πράξη, **δύο** σβησμένες ταυτότητες: η λίστα των στοιχείων πρέπει να συρρικνώνεται
    // **ανάμεσα** στα σχέδια, αλλιώς το δεύτερο βλέπει σειρά που δεν υπάρχει πια και το άκρο
    // μετακομίζει σε γραμμή που κι εκείνη σβήστηκε.
    let entity = book([
      { cells: [['r1', 'c1', '1'], ['r2', 'c1', '2'], ['r3', 'c1', '3'], ['r4', 'c1', '4']] },
      {},
    ]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=SUM(Φύλλο1!A1:A4)');

    const worksheets = entity.worksheets ?? [];
    const scoped = worksheetsFormulaBook(worksheets, tableWorksheetId('ws0'));
    const trimmed = deleteTableRows(scoped, worksheets[0].model, ['r4', 'r3']);
    const replaced = worksheets.map((sheet) =>
      sheet.id === 'ws0' ? { ...sheet, model: trimmed } : sheet,
    );
    const after: TableEntity = {
      ...entity,
      worksheets: worksheetsAfterHomeChange(replaced, tableWorksheetId('ws0'), worksheets[0].model),
    };
    expect(sourceAt(after, 1, 'r1', 'c1')).toBe('=SUM(Φύλλο1!A1:A2)');
    expect(valueAt(after, 1, 'r1', 'c1')).toBe(3);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ΣΤ. Η ΜΟΝΑΔΙΚΟΠΟΙΗΣΗ — ένα SSoT, δύο σύνορα
// ══════════════════════════════════════════════════════════════════════════════

describe('ΣΤ. `uniqueSheetNames` — η σύμβαση `(2)` του Excel', () => {
  it('τα διπλά παίρνουν `(2)`, `(3)`, … στη σειρά τους', () => {
    expect(uniqueSheetNames(['Κόστη', 'Κόστη', 'Κόστη'])).toEqual([
      'Κόστη',
      'Κόστη (2)',
      'Κόστη (3)',
    ]);
  });

  it('🔴 case-insensitive — αυστηρότερα από τον `exceljs`, όσο αυστηρά και το Excel', () => {
    expect(uniqueSheetNames(['Φύλλο', 'φύλλο'])).toEqual(['Φύλλο', 'φύλλο (2)']);
  });

  it('χωρίς ταβάνι δεν κόβεται τίποτα — η οθόνη δεν έχει όριο μήκους', () => {
    const long = 'Α'.repeat(40);
    expect(uniqueSheetNames([long, long])).toEqual([long, `${long} (2)`]);
  });

  it('🔑 με ταβάνι κόβεται η **ΒΑΣΗ**, ποτέ το επίθεμα', () => {
    const long = 'Α'.repeat(40);
    const [first, second] = uniqueSheetNames([long, long], 31);
    expect(first).toBe(long);
    expect(second).toHaveLength(31);
    expect(second.endsWith(' (2)')).toBe(true);
  });

  it('ονόματα που ήδη διαφέρουν μένουν **αυτούσια**', () => {
    expect(uniqueSheetNames(['Α', 'Β', 'Γ'])).toEqual(['Α', 'Β', 'Γ']);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Ζ. ΤΑ ΚΕΝΑ ΠΟΥ ΒΡΗΚΑΝ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ — και το καθένα ονομάζει τη μετάλλαξή του
// ══════════════════════════════════════════════════════════════════════════════

describe('Ζ. η ΚΑΛΩΔΙΩΣΗ και οι γωνίες που έμειναν ακάλυπτες', () => {
  it('🔴 M72 — η αλλαγή περνά από τον ΠΡΑΓΜΑΤΙΚΟ γραφέα (`worksheetsWithActiveModel`)', () => {
    // Οι υπόλοιπες άγκυρες καλούν την πύλη **απευθείας**. Αυτή καρφώνει τη **σύνδεση**: ο ένας
    // γραφέας πινάκων («κάθε γραφέας περνά από εδώ — και μόνο από εδώ») οφείλει να την καλεί.
    // Χωρίς αυτήν, η ολόκληρη Φάση 7 θα ήταν σωστός κώδικας που **κανείς δεν εκτελεί** — το
    // μάθημα «το όργανο μπορεί να έχει μηδέν καταναλωτές» (Φ5Α).
    let entity = book([{ cells: [['r1', 'c1', '10']] }, {}]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=Φύλλο1!A1*2');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(20);

    const worksheets = entity.worksheets ?? [];
    const scoped = worksheetsFormulaBook(worksheets, tableWorksheetId('ws0'));
    const nextHome = commitCellWrites(
      scoped,
      writeCellInput(scoped, worksheets[0].model, 'r1', 'c1', '50'),
    );
    const through: TableEntity = {
      ...entity,
      worksheets: worksheetsWithActiveModel(entity, nextHome),
    };
    expect(valueAt(through, 1, 'r1', 'c1')).toBe(100);
  });

  it('🔴 M8 — ΓΥΜΝΗ αναφορά μέσα σε ΕΞΑΡΤΗΜΕΝΟ φύλλο δείχνει στο ΔΙΚΟ του πλέγμα', () => {
    // Ο καθολικός γράφος αξιολογεί τύπους **πολλών** φύλλων στο ίδιο πέρασμα. Αν το «σπίτι»
    // δεν άλλαζε ανά κόμβο, το `=A2` του Φύλλου2 θα διάβαζε το πλέγμα του Φύλλου1 — σιωπηλά
    // λάθος αριθμός, η ακριβής κλάση του ADR-764.
    let entity = book([
      { cells: [['r1', 'c1', '10'], ['r2', 'c1', '999']] },
      { cells: [['r2', 'c1', '7']] },
    ]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=Φύλλο1!A1+A2');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(17);

    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '20');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(27);
  });

  it('🔴 M9 — η μεταβατικότητα ΕΠΑΝΑΛΑΜΒΑΝΕΤΑΙ: αλυσίδα ΑΝΑΠΟΔΑ από τη σειρά των φύλλων', () => {
    // ⚠️ Η αλυσίδα είναι **τεσσάρων** φύλλων επίτηδες, και ανάποδα: `Φύλλο2 ← Φύλλο3 ← Φύλλο4
    // ← Φύλλο1`. Με **ένα** πέρασμα πάνω στη σειρά των φύλλων μπαίνει μόνο το Φύλλο4 (και,
    // στο επόμενο επίπεδο, το Φύλλο3) — το **Φύλλο2** μένει έξω και σαπίζει σιωπηλά. Μια
    // αλυσίδα τριών θα περνούσε **και χωρίς** επανάληψη, γιατί ο δεύτερος κρίκος βρίσκεται
    // ήδη ενεργός μέσα στο ίδιο πέρασμα: μετρημένο, η μετάλλαξη έμενε πράσινη.
    let entity = book([{ cells: [['r1', 'c1', '2']] }, {}, {}, {}]);
    entity = write(entity, tableWorksheetId('ws3'), 'r1', 'c1', '=Φύλλο1!A1*10');
    entity = write(entity, tableWorksheetId('ws2'), 'r1', 'c1', '=Φύλλο4!A1+1');
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=Φύλλο3!A1+100');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(121);

    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '5');
    expect(valueAt(entity, 3, 'r1', 'c1')).toBe(50);
    expect(valueAt(entity, 2, 'r1', 'c1')).toBe(51);
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(151);
  });

  it('🔴 M11/M62/M73 — τα κακοσχηματισμένα μένουν ΚΕΙΜΕΝΟ, ποτέ μισοδεμένος τύπος', () => {
    const entity = book([
      { cells: [['r1', 'c1', "=''!A1"], ['r2', 'c1', "='Ανοιχτό!A1"], ['r3', 'c1', '=Φύλλο2!']] },
      {},
    ]);
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe("=''!A1");
    expect(valueAt(entity, 0, 'r2', 'c1')).toBe("='Ανοιχτό!A1");
    expect(valueAt(entity, 0, 'r3', 'c1')).toBe('=Φύλλο2!');
  });

  it('🔴 M73 — μετά το `!` πρέπει να ακολουθεί ΟΝΟΜΑ, όχι ό,τι να ναι', () => {
    // Με χαλαρό φύλακα, το `=Φύλλο2!5` θα γινόταν **τύπος** με `#REF!` αντί να μείνει κείμενο:
    // ο χρήστης θα έχανε ό,τι πληκτρολόγησε και θα έβλεπε σφάλμα που δεν έγραψε.
    const entity = book([{ cells: [['r1', 'c1', '=Φύλλο2!5'], ['r2', 'c1', '=Φύλλο2!(A1)']] }, {}]);
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe('=Φύλλο2!5');
    expect(valueAt(entity, 0, 'r2', 'c1')).toBe('=Φύλλο2!(A1)');
  });

  it('🔴 M23 — η απόστροφος **διπλασιάζεται** και στην ΕΚΤΥΠΩΣΗ, όχι μόνο στην ανάγνωση', () => {
    const entity = book([{ cells: [['r1', 'c1', "='Ο''Νιλ'!A1"]] }, { name: "Ο'Νιλ" }]);
    expect(sourceAt(entity, 0, 'r1', 'c1')).toBe("='Ο''Νιλ'!A1");
  });

  it('🔴 M24 — σύνορο ΧΩΡΙΣ λεξιλόγιο ονομάτων γράφει `#REF!`, ποτέ γυμνή διεύθυνση', () => {
    // Μια διεύθυνση **χωρίς** το φύλλο της θα ξαναδιαβαζόταν ως αναφορά στο δικό μας φύλλο —
    // σιωπηλά, και με αριθμό.
    const entity = book([{ cells: [['r1', 'c1', '=Φύλλο2!A1']] }, { cells: [['r1', 'c1', '5']] }]);
    const worksheets = entity.worksheets ?? [];
    const blind = worksheetsFormulaBook(worksheets, worksheets[0].id, NO_WORKSHEET_NAMING);
    expect(cellInputText(blind, worksheets[0].model, 'r1', 'c1')).toBe(`=${REF}`);
  });

  it('🔴 M33 — διαγραφή γραμμής στο ΣΠΙΤΙ δεν αγγίζει εύρος που δείχνει σε ΑΛΛΟ φύλλο', () => {
    // Η θεραπεία δουλεύει πάνω σε **ζεύγη ταυτοτήτων**, και κάθε φύλλο ξεκινά από τον ίδιο
    // κατασκευαστή: χωρίς το φίλτρο φύλλου, το `=SUM(Φύλλο2!A1:A4)` θα συρρικνωνόταν επειδή
    // σβήστηκε γραμμή **αλλού**.
    let entity = book([
      {},
      { cells: [['r1', 'c1', '1'], ['r2', 'c1', '2'], ['r3', 'c1', '3'], ['r4', 'c1', '4']] },
    ]);
    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '=SUM(Φύλλο2!A1:A4)');
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe(10);

    entity = deleteRow(entity, tableWorksheetId('ws0'), 'r4');
    expect(sourceAt(entity, 0, 'r1', 'c1')).toBe('=SUM(Φύλλο2!A1:A4)');
    expect(valueAt(entity, 0, 'r1', 'c1')).toBe(10);
  });

  it('🔴 M70 — δύο διαδοχικές διαγραφές συρρικνώνουν το ξένο εύρος ΒΗΜΑ-ΒΗΜΑ', () => {
    let entity = book([
      { cells: [['r1', 'c1', '1'], ['r2', 'c1', '2'], ['r3', 'c1', '3'], ['r4', 'c1', '4']] },
      {},
    ]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=SUM(Φύλλο1!A1:A4)');
    entity = deleteRow(entity, tableWorksheetId('ws0'), 'r4');
    entity = deleteRow(entity, tableWorksheetId('ws0'), 'r3');
    expect(sourceAt(entity, 1, 'r1', 'c1')).toBe('=SUM(Φύλλο1!A1:A2)');
    expect(valueAt(entity, 1, 'r1', 'c1')).toBe(3);
  });

  it('🔴 M71 — φύλλο που ΔΙΑΒΑΖΕΙ αλλά δεν άλλαξε τιμή μένει αυτούσιο by-reference', () => {
    // Νέο αντικείμενο χωρίς λόγο = ακυρωμένη μνήμη **και** βήμα undo που δεν αναιρεί τίποτα.
    let entity = book([{ cells: [['r1', 'c1', '5']] }, {}]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=Φύλλο1!A1');
    const dependent = (entity.worksheets ?? [])[1];

    // Ίδια τιμή ξαναγραμμένη: το εξαρτημένο φύλλο δεν έχει λόγο να γεννηθεί ξανά.
    entity = write(entity, tableWorksheetId('ws0'), 'r2', 'c2', 'σχόλιο');
    expect((entity.worksheets ?? [])[1]).toBe(dependent);
  });

  it('🔴 M4/M5/M30 — εύρος με άκρα σε ΔΥΟ φύλλα είναι ΜΗ ΕΚΦΡΑΣΙΜΟ, και ο φύλακας ζει', () => {
    // Ο αναλυτής δεν το παράγει ποτέ (το δεξί άκρο **κληρονομεί**). Ο φύλακας φυλάει την
    // **κατασκευή** του ορθογωνίου, δηλαδή κάθε μελλοντική διαδρομή που θα έφτιαχνε ασύμφωνα
    // άκρα — γι' αυτό ελέγχεται με δέντρο φτιαγμένο **στο χέρι**.
    const entity = book([{}, {}]);
    const worksheets = entity.worksheets ?? [];
    const mixed = worksheetsFormulaBook(worksheets, worksheets[0].id);
    const from = { rowId: 'r1', colId: 'c1' };
    const to = { rowId: 'r3', colId: 'c1', worksheetId: tableWorksheetId('ws1') };
    expect(expandRangeShape(mixed, from, to).cells).toEqual([]);
    expect(sameSheetRefs(mixed, from, to)).toBe(false);

    // 🔴 M5 — και ο **φρουρός του γράφου** βλέπει **και τα δύο** άκρα: ένα εύρος του οποίου
    // μόνο το δεξί άκρο κατονομάζει φύλλο δεν επιτρέπεται να περάσει αόρατο, αλλιώς το φύλλο
    // εκείνο δεν θα έμπαινε ποτέ στο κλείσιμο και θα σάπιζε σιωπηλά.
    const mixedModel = createTableModel({
      columns: COLUMNS,
      rows: ROWS,
      cells: [['r1', 'c1', {
        kind: 'formula',
        value: 0,
        formula: { root: { kind: 'range', from, to } },
      }]],
    });
    expect([...namedWorksheetReads(mixedModel)]).toEqual(['ws1']);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Η. ΞΕΝΟ ΠΛΕΓΜΑ ΜΕ ΑΛΛΟ ΣΧΗΜΑ — εκεί όπου «σπίτι» και «στόχος» ΔΙΑΦΕΡΟΥΝ
// ══════════════════════════════════════════════════════════════════════════════

describe('Η. η ολίσθηση και η μετακόμιση μετριούνται στο ΣΩΣΤΟ πλέγμα', () => {
  /** Δύο φύλλα με **διαφορετικό** πλήθος γραμμών: το σπίτι έχει 4, ο στόχος 2. */
  function unevenBook(): TableEntity {
    const short = toPersistedTableModel(
      createTableModel({ columns: COLUMNS, rows: ROWS.slice(0, 2) }),
    );
    const worksheets: TableWorksheet[] = [
      { id: tableWorksheetId('ws0'), model: emptyModel() },
      { id: tableWorksheetId('ws1'), model: short },
    ];
    return { ...makeTableEntity(), worksheets, activeWorksheetId: worksheets[0].id };
  }

  it('🔴 M39/M85 — αντίγραφο εκτός των ΞΕΝΩΝ ορίων γίνεται `#REF!`, όχι έγκυρη αναφορά', () => {
    // Το σπίτι έχει 4 γραμμές, το Φύλλο2 μόνο 2: μια ολίσθηση +1 από το `Φύλλο2!A2` πέφτει
    // **έξω από το Φύλλο2** ενώ θα χωρούσε άνετα στο σπίτι. Με ίδιου σχήματος φύλλα η διαφορά
    // είναι αόρατη — γι' αυτό εδώ τα σχήματα διαφέρουν.
    let entity = unevenBook();
    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '=Φύλλο2!A2');
    const worksheets = entity.worksheets ?? [];
    const formula = getCell(resolveTableModel(worksheets[0].model), 'r1', 'c1')?.formula;
    if (!formula) throw new Error('χωρίς τύπο');

    const moved = offsetTableFormula(
      worksheetsFormulaBook(worksheets, worksheets[0].id),
      formula,
      { rows: 1, columns: 0 },
    );
    expect(moved.root.kind).toBe('error');
  });

  it('🔴 M40/M75 — η μετακόμιση κελιού στο σπίτι ΔΕΝ ακολουθεί αναφορές προς άλλο φύλλο', () => {
    // Κάθε φύλλο ξεκινά από τον ίδιο κατασκευαστή, άρα το `r1/c1` υπάρχει **και στα δύο**: η
    // απεικόνιση «ποιο πήγε πού» του σπιτιού θα ταίριαζε **κατά λάθος** στην ξένη αναφορά.
    let entity = book([{}, { cells: [['r1', 'c1', '7']] }]);
    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c2', '=Φύλλο2!A1');
    entity = write(entity, tableWorksheetId('ws0'), 'r2', 'c2', '=SUM(Φύλλο2!A1:A2)');
    const worksheets = entity.worksheets ?? [];

    // ⚠️ Η απεικόνιση καλύπτει **και τα δύο** άκρα του εύρους: αλλιώς το `remapRange` θα
    // σταματούσε ούτως ή άλλως στο «λείπει άκρο» και ο φύλακας φύλλου δεν θα δοκιμαζόταν ποτέ.
    const moved = remapTableFormulaRefs(
      worksheets[0].model,
      new Map([
        [cellKey('r1', 'c1'), { rowId: 'r3', colId: 'c1' }],
        [cellKey('r2', 'c1'), { rowId: 'r4', colId: 'c1' }],
      ]),
    );
    expect(moved).toBe(worksheets[0].model);
  });
});


// ══════════════════════════════════════════════════════════════════════════════
// Θ. ΤΟ .xlsx — ο τύπος φεύγει με το όνομα ΠΟΥ ΕΧΕΙ ΜΕΣΑ ΣΤΟ ΑΡΧΕΙΟ
// ══════════════════════════════════════════════════════════════════════════════

describe('Θ. η εξαγωγή γράφει δια-φυλλικούς τύπους που το Excel μπορεί να λύσει', () => {
  /** Ό,τι έγραψε ο εξαγωγέας στο `<f>` του κελιού, διαβασμένο πίσω με τον ίδιο `exceljs`. */
  async function exportedFormula(
    entity: TableEntity,
    sheetIndex: number,
  ): Promise<{ readonly names: readonly string[]; readonly formula: string }> {
    const style = BUILTIN_TABLE_STYLES.find((it) => it.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
    if (!style) throw new Error('χωρίς στυλ');
    const blob = await tableWorksheetsToXlsxBlob(entity.worksheets ?? [], style);
    const ExcelJSLib = (await import('exceljs')).default;
    const workbook = new ExcelJSLib.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    const names = workbook.worksheets.map((sheet) => sheet.name);
    const cell = workbook.worksheets[sheetIndex].getCell(1, 1);
    const value = cell.value;
    const formula =
      value !== null && typeof value === 'object' && 'formula' in value
        ? String(value.formula)
        : '';
    return { names, formula };
  }

  it('🔴 M80/M81/M82 — ο τύπος δείχνει στο φύλλο με το **εξυγιασμένο, μοναδικό** όνομά του', async () => {
    // Το `.xlsx` δείχνει φύλλα **κατά όνομα**. Αν ο τύπος έγραφε το όνομα της οθόνης, ένα
    // βιβλίο με απαγορευμένο χαρακτήρα ή με ομώνυμα φύλλα θα παρήγαγε αναφορά που δεν λύνεται
    // — δηλαδή αρχείο που το Excel αρνείται να ανοίξει, ή που δείχνει σε **λάθος** φύλλο.
    let entity = book([{}, { name: 'Α/Β' }, { name: 'Α Β' }]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '7');
    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', "='Α/Β'!A1");

    const { names, formula } = await exportedFormula(entity, 0);
    // Ο `/` απαγορεύεται σε όνομα φύλλου του OOXML: γίνεται κενό — και τότε τα δύο φύλλα
    // **ταυτίζονται**, οπότε το δεύτερο παίρνει `(2)`.
    expect(names).toEqual(['Φύλλο1', 'Α Β', 'Α Β (2)']);
    expect(formula).toBe("'Α Β'!A1");
  });

  it('🔴 M81 — ΚΑΘΕ φύλλο εξάγεται με ΤΟ ΔΙΚΟ ΤΟΥ σπίτι, όχι του πρώτου', async () => {
    // Ένας τύπος που ζει στο **δεύτερο** φύλλο και δείχνει στο **πρώτο**: με σπίτι το πρώτο,
    // ο εκτυπωτής θα έκρινε την αναφορά «δική μου» και θα έγραφε **γυμνό `A1`** — δηλαδή το
    // αρχείο θα έδειχνε στο **λάθος φύλλο**, σιωπηλά και με αριθμό.
    let entity = book([{ cells: [['r1', 'c1', '9']] }, {}]);
    entity = write(entity, tableWorksheetId('ws1'), 'r1', 'c1', '=Φύλλο1!A1');

    const { formula } = await exportedFormula(entity, 1);
    expect(formula).toBe('Φύλλο1!A1');
  });

  it('🔴 M57 — εύρος που έσβησε ΟΛΟΚΛΗΡΟ γράφεται `#REF!`, όχι `#REF!:#REF!`', () => {
    let entity = book([{}, { cells: [['r1', 'c1', '1'], ['r2', 'c1', '2']] }]);
    entity = write(entity, tableWorksheetId('ws0'), 'r1', 'c1', '=SUM(Φύλλο2!A1:A2)');
    const worksheets = (entity.worksheets ?? []).filter((sheet) => sheet.id !== 'ws1');
    const after: TableEntity = { ...entity, worksheets };
    expect(sourceAt(after, 0, 'r1', 'c1')).toBe(`=SUM(${REF})`);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Ι. Ο ΕΠΕΞΕΡΓΑΣΤΗΣ — τι ΒΛΕΠΕΙ και τι ΕΠΙΤΡΕΠΕΤΑΙ να πατήσει ο άνθρωπος
// ══════════════════════════════════════════════════════════════════════════════

describe('Ι. η γραμμή τύπων δεν λέει ψέματα για δια-φυλλική αναφορά', () => {
  const GRID = createTableModel({ columns: COLUMNS, rows: ROWS });

  it('🔴 δια-φυλλική αναφορά ΔΕΝ χρωματίζει κελί του τρέχοντος φύλλου', () => {
    // Το `Φύλλο2` δεν λύνεται ως διεύθυνση, οπότε ο σαρωτής το προσπερνούσε και έπεφτε στο
    // `A1` — ζωγραφίζοντας περίγραμμα γύρω από κελί που ο τύπος **δεν διαβάζει**.
    expect(tableFormulaReferenceSpans(GRID, '=Φύλλο2!A1')).toEqual([]);
    expect(tableFormulaReferenceSpans(GRID, "='Τιμές 2024'!A1")).toEqual([]);
  });

  it('🔴 ούτε ΤΟ ΕΥΡΟΣ της: το `=Φύλλο2!A1:B2` έδινε ΔΥΟ ψεύτικα περιγράμματα', () => {
    expect(tableFormulaReferenceSpans(GRID, '=Φύλλο2!A1:B2')).toEqual([]);
  });

  it('η ΤΟΠΙΚΗ αναφορά δίπλα στη δια-φυλλική χρωματίζεται κανονικά', () => {
    // Ο φύλακας οφείλει να καταναλώνει **ακριβώς** τη δια-φυλλική και τίποτα παραπάνω.
    const spans = tableFormulaReferenceSpans(GRID, '=Φύλλο2!A1+B2');
    expect(spans).toHaveLength(1);
    expect(spans[0].bounds.firstRow).toBe(1);
    expect(spans[0].bounds.firstCol).toBe(1);
  });

  it('🔑 η ΥΠΟΔΕΙΞΗ είναι ΚΛΕΙΣΤΗ μέσα σε δια-φυλλική αναφορά — κανένα κλικ δεν τη διαφθείρει', () => {
    // Το §5.9.4 δηλώνει ότι η υπόδειξη ανάμεσα σε φύλλα δεν υπάρχει. Εδώ καρφώνεται ότι το
    // όριο είναι **ασφαλές**: ένα κλικ μετά από `=Φύλλο2!A1` δεν αντικαθιστά το `A1` με κελί
    // του **τρέχοντος** φύλλου — που θα ήταν σιωπηλά λάθος φύλλο.
    const draft = '=Φύλλο2!A1';
    expect(resolveFormulaPointState(GRID, draft, draft.length).kind).toBe('off');
    expect(resolveFormulaPointState(GRID, '=Φύλλο2!', '=Φύλλο2!'.length).kind).toBe('off');
  });

  it('η υπόδειξη παραμένει ΑΝΟΙΧΤΗ για τοπική αναφορά, όπως πριν τη φάση', () => {
    expect(resolveFormulaPointState(GRID, '=A1', 3).kind).not.toBe('off');
  });
});
