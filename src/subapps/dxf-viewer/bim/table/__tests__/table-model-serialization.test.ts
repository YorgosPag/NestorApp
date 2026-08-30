/**
 * ADR-739 Φάση Δ — **το δίχτυ της σειριοποίησης** (Λύση Α).
 *
 * Ο λόγος ύπαρξης αυτού του αρχείου είναι ένα σφάλμα που **καμία** πράσινη σουίτα δεν
 * μπορούσε να δει: το `TableModel.cells` ήταν `Map`, και ο `Map` δεν επιβιώνει
 * `JSON.stringify` — γίνεται `{}` **σιωπηλά**, χωρίς εξαίρεση. Πέντε γενικοί μηχανισμοί
 * της εφαρμογής (αποθήκευση σκηνής, `deepClone` για undo, διαγραφή+αναίρεση, πρόχειρο,
 * λανθάνουσα μνήμη ζωγραφικής) περνούν κάθε οντότητα από JSON round-trip· ο πίνακας
 * έβγαινε από καθέναν **άδειος** και ο χρήστης έχανε τη δουλειά του.
 *
 * Τα 92 tests της Φ.Γ ήταν όλα πράσινα όσο ίσχυε αυτό. Πράσινα tests δεν αποδεικνύουν
 * εγγραφή — μόνο ένα test που **περνά τα δεδομένα από το ίδιο κανάλι** το κάνει.
 * Καθένα από τα παρακάτω τρέχει τον **πραγματικό** μηχανισμό, όχι μίμησή του.
 */

type LoggerSpy = {
  readonly debug: jest.Mock;
  readonly info: jest.Mock;
  readonly warn: jest.Mock;
  readonly error: jest.Mock;
};

// `var` υποχρεωτικά, και η ανάθεση **μέσα** στο εργοστάσιο: το `jest.mock` ανυψώνεται
// πάνω από κάθε import, και το `table-model-helpers` φτιάχνει τον logger του στο top-level
// του module — δηλαδή πριν προλάβει να τρέξει οποιοδήποτε `const` αυτού του αρχείου.
var mockLogger: LoggerSpy | undefined;

jest.mock('@/lib/telemetry', () => {
  mockLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { createModuleLogger: () => mockLogger };
});

import { deepClone } from '@/lib/clone-utils';
import type { CreateTableModelInput } from '../table-model-helpers';
import {
  cellKey,
  createTableModel,
  getCell,
  resolveTableModel,
  toPersistedTableModel,
} from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type {
  PersistedTableModel,
  TableCell,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import { tableWorksheetFields } from './make-table-entity';
import { activeTableModel } from '../table-worksheet-resolve';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'number', align: 'right' },
];

const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

const text = (value: string | number): TableCell => ({ kind: 'text', value });

/** Τέσσερα γεμάτα κελιά — δηλαδή **πλήρης** ο αραιός χάρτης του 2×2. */
const ALL_CELLS: readonly TableCellEntry[] = [
  ['r1', 'c1', text('Στοιχείο')],
  ['r1', 'c2', text('Ποσότητα')],
  ['r2', 'c1', text('Δοκός Δ1')],
  ['r2', 'c2', text(12.5)],
];

function makePersisted(cells: readonly TableCellEntry[] = ALL_CELLS): PersistedTableModel {
  return toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, cells }));
}

/** Οι κραυγές του module — «σιωπηλά άδειος πίνακας» είναι ακριβώς ό,τι δεν επιτρέπεται. */
function loggedErrors(): jest.Mock {
  if (!mockLogger) throw new Error('telemetry mock not initialised');
  return mockLogger.error;
}

/**
 * Ό,τι φτάνει από παλιά σκηνή **δεν** είναι `TableCellEntry[]` — γι' αυτό ακριβώς υπάρχει
 * το δίχτυ. Ο τύπος χαλαρώνει εδώ, σε **ένα** σημείο και με ρητό όνομα: `unknown` που
 * περνά ως το πεδίο. Ποτέ `any`.
 */
function withCells(cells: unknown): CreateTableModelInput {
  return { columns: COLUMNS, rows: ROWS, cells: cells as CreateTableModelInput['cells'] };
}

function makeEntity(model: PersistedTableModel = makePersisted()): TableEntity {
  return {
    id: 'tbl_1',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 100, y: 200 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    ...tableWorksheetFields(model),
  };
}

// ── 1. Ο ΛΟΓΟΣ ΥΠΑΡΞΗΣ: τα κελιά επιβιώνουν το JSON ─────────────────────────

describe('JSON round-trip — αυτό ακριβώς κάνουν save/reload και render cache', () => {
  it('ΟΛΑ τα κελιά επιβιώνουν το `JSON.parse(JSON.stringify(entity))`', () => {
    const entity = makeEntity();
    const revived: TableEntity = JSON.parse(JSON.stringify(entity));

    expect(activeTableModel(revived).cells).toHaveLength(4);
    expect(activeTableModel(revived).cells).toEqual(activeTableModel(entity).cells);
  });

  it('τα κελιά είναι ΑΝΑΓΝΩΣΙΜΑ μετά την αναβίωση — όχι απλώς παρόντα', () => {
    // Το «παρόντα» θα ικανοποιούνταν και από σκουπίδια· η ερώτηση είναι αν ο πίνακας
    // ξαναδιαβάζεται σαν πίνακας.
    const revived: TableEntity = JSON.parse(JSON.stringify(makeEntity()));
    const model = resolveTableModel(activeTableModel(revived));

    expect(getCell(model, 'r2', 'c1')?.value).toBe('Δοκός Δ1');
    expect(getCell(model, 'r2', 'c2')?.value).toBe(12.5);
  });

  it('ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΘΑ ΕΙΧΕ ΠΙΑΣΕΙ: ο `Map` χάνεται σιωπηλά — γι\' αυτό δεν ταξιδεύει', () => {
    // Αποδεικνύει ότι ο κίνδυνος είναι υπαρκτός, όχι υποθετικός: κανένα σφάλμα, καμία
    // προειδοποίηση — απλώς `{}`. Το ίδιο θα συνέβαινε σε ΚΑΘΕ αποθήκευση πίνακα.
    const withMap = createTableModel({ columns: COLUMNS, rows: ROWS, cells: ALL_CELLS });
    expect(withMap.cells.size).toBe(4);
    const revived: { cells: Record<string, TableCell> } = JSON.parse(
      JSON.stringify({ cells: withMap.cells }),
    );
    expect(revived.cells).toEqual({});
  });
});

// ── 2. ΣΕΝΑΡΙΟ UNDO — ο πραγματικός μηχανισμός, όχι μίμησή του ──────────────

describe('deepClone — η διαδρομή του UpdateEntityCommand / DeleteEntityCommand', () => {
  it('τα κελιά ΕΠΙΒΙΩΝΟΥΝ το snapshot της αναίρεσης', () => {
    // Το `deepClone` του `@/lib/clone-utils` ΕΙΝΑΙ `JSON.parse(JSON.stringify())`: το
    // στιγμιότυπο που κρατά η στοίβα undo περνά από εδώ. Με `Map` ο χρήστης πατούσε undo
    // και ο πίνακας «επανερχόταν» άδειος — απώλεια δεδομένων, όχι σφάλμα εμφάνισης.
    const snapshot = deepClone(makeEntity());

    expect(activeTableModel(snapshot).cells).toHaveLength(4);
    expect(getCell(resolveTableModel(activeTableModel(snapshot)), 'r1', 'c2')?.value).toBe('Ποσότητα');
  });

  it('το στιγμιότυπο είναι ΑΝΕΞΑΡΤΗΤΟ αντίγραφο (αλλαγή στο ένα δεν αγγίζει το άλλο)', () => {
    const entity = makeEntity();
    const snapshot = deepClone(entity);
    expect(activeTableModel(snapshot).cells).not.toBe(activeTableModel(entity).cells);
    expect(activeTableModel(snapshot).cells[0]).not.toBe(activeTableModel(entity).cells[0]);
  });
});

// ── 3. Round-trip persisted ↔ runtime ──────────────────────────────────────

describe('resolveTableModel / toPersistedTableModel — αυστηρά αντίστροφες', () => {
  it('persisted → runtime → persisted είναι ΤΑΥΤΟΤΙΚΟ', () => {
    const persisted = makePersisted();
    expect(toPersistedTableModel(resolveTableModel(persisted))).toEqual(persisted);
  });

  it('ο παραγόμενος `Map` έχει τα σωστά κλειδιά — μέσω `cellKey`, ποτέ χειροποίητα', () => {
    const model = resolveTableModel(makePersisted());
    expect(model.cells.size).toBe(4);
    expect(model.cells.get(cellKey('r2', 'c2'))?.value).toBe(12.5);
    // Ανάποδα σκέλη ⇒ ΔΕΝ βρίσκει τίποτα: το branded κλειδί δεν είναι μεταθετικό.
    expect(model.cells.get(cellKey('c2', 'r2'))).toBeUndefined();
  });

  it('στήλες / γραμμές / συγχωνεύσεις περνούν ΑΥΤΟΥΣΙΕΣ (ίδιες αναφορές, μηδέν αντιγραφή)', () => {
    const persisted = makePersisted();
    const model = resolveTableModel(persisted);
    expect(model.columns).toBe(persisted.columns);
    expect(model.rows).toBe(persisted.rows);
    expect(model.merges).toBe(persisted.merges);
  });
});

// ── 4. Ντετερμινιστική σειρά ────────────────────────────────────────────────

describe('toPersistedTableModel — σειρά γραμμής, μετά στήλης', () => {
  it('ΑΝΕΞΑΡΤΗΤΗ από τη σειρά εισαγωγής στον `Map`', () => {
    // Η σειρά εισαγωγής ενός `Map` διατηρείται — άρα, χωρίς ρητή ταξινόμηση, δύο
    // ταυτόσημοι πίνακες θα έδιναν διαφορετικό JSON: άχρηστα diffs, ασταθή snapshots και
    // ψευδείς «αλλαγές» που πυροδοτούν auto-save σε πίνακα που κανείς δεν άγγιξε.
    const forward = makePersisted(ALL_CELLS);
    const backward = makePersisted([...ALL_CELLS].reverse());
    const shuffled = makePersisted([ALL_CELLS[2], ALL_CELLS[0], ALL_CELLS[3], ALL_CELLS[1]]);

    expect(backward.cells).toEqual(forward.cells);
    expect(shuffled.cells).toEqual(forward.cells);
  });

  it('η σειρά είναι ΑΥΤΗ των `rows` × `columns`, όχι αλφαβητική ούτε τυχαία', () => {
    const ids = makePersisted().cells.map(([rowId, colId]) => `${rowId}/${colId}`);
    expect(ids).toEqual(['r1/c1', 'r1/c2', 'r2/c1', 'r2/c2']);
  });

  it('αναδιάταξη ΓΡΑΜΜΩΝ αλλάζει τη σειρά των κελιών — η διάταξη είναι η αυθεντία', () => {
    const swapped = toPersistedTableModel(
      createTableModel({ columns: COLUMNS, rows: [ROWS[1], ROWS[0]], cells: ALL_CELLS }),
    );
    expect(swapped.cells.map(([rowId, colId]) => `${rowId}/${colId}`)).toEqual([
      'r2/c1', 'r2/c2', 'r1/c1', 'r1/c2',
    ]);
  });

  it('κελί σε ανύπαρκτη γραμμή/στήλη παραλείπεται σιωπηλά (ανοχή του `buildMergeIndex`)', () => {
    // Μια αναφορά σε σβησμένη γραμμή είναι φυσιολογικό ενδιάμεσο στάδιο επεξεργασίας —
    // δεν επιτρέπεται να ρίξει ή να αδειάσει ολόκληρο τον πίνακα.
    const persisted = makePersisted([
      ...ALL_CELLS,
      ['r_deleted', 'c1', text('ορφανό')],
      ['r1', 'c_deleted', text('ορφανό')],
    ]);
    expect(persisted.cells).toHaveLength(4);
  });

  it('πίνακας χωρίς κελιά ⇒ κενή ακολουθία, ποτέ `undefined`', () => {
    expect(makePersisted([]).cells).toEqual([]);
  });
});

// ── 5. Απομνημόνευση WeakMap ────────────────────────────────────────────────

describe('resolveTableModel — απομνημόνευση με κλειδί την ταυτότητα', () => {
  it('ίδιο persisted ⇒ Η ΙΔΙΑ ΑΝΑΦΟΡΑ `TableModel` (όχι απλώς ίση)', () => {
    const persisted = makePersisted();
    expect(resolveTableModel(persisted)).toBe(resolveTableModel(persisted));
  });

  it('νέο αντικείμενο persisted ⇒ ΝΕΟ `TableModel` — η ταυτότητα ΕΙΝΑΙ η έκδοση', () => {
    const a = makePersisted();
    const b = makePersisted();
    expect(a).toEqual(b);            // ίδιο περιεχόμενο…
    expect(resolveTableModel(a)).not.toBe(resolveTableModel(b)); // …άλλη έκδοση
  });

  it('η αλυσίδα κρατά: σταθερό persisted ⇒ σταθερό μοντέλο ⇒ σταθερή διάταξη (§6)', () => {
    // Αυτό είναι η **προϋπόθεση** για το «διάταξη ποτέ ανά καρέ»: αν το `resolveTableModel`
    // επέστρεφε νέο αντικείμενο κάθε φορά, το WeakMap του `resolveTableLayout` θα αστοχούσε
    // σε **κάθε** καρέ και η μηχανή διάταξης θα έτρεχε 60 φορές το δευτερόλεπτο.
    const entity = makeEntity();
    const first = resolveTableModel(activeTableModel(entity));
    for (let frame = 0; frame < 10; frame++) {
      expect(resolveTableModel(activeTableModel(entity))).toBe(first);
    }
  });

  it('ένα σύρσιμο λαβής (νέο αντικείμενο μοντέλου) ΑΚΥΡΩΝΕΙ τη μνήμη, χωρίς invalidate()', () => {
    const entity = makeEntity();
    const before = resolveTableModel(activeTableModel(entity));
    const edited: PersistedTableModel = { ...activeTableModel(entity), columns: [COLUMNS[1], COLUMNS[0]] };
    expect(resolveTableModel(edited)).not.toBe(before);
  });
});

// ── 6. Άκυρο σχήμα κελιών: ΑΝΑΚΤΗΣΗ ή ΚΡΑΥΓΗ — ποτέ σιωπηλά άδειος ──────────

describe('createTableModel — ο μηχανισμός ανάνηψης δεν έχει δικό του σιωπηλό μονοπάτι', () => {
  beforeEach(() => {
    loggedErrors().mockClear();
  });

  it('`{}` (το πτώμα ενός Map μετά από JSON.stringify) ΔΕΝ ρίχνει το καρέ', () => {
    // Η κλήση ζει μέσα στο `computeTableEntityGeometry`, δηλαδή μέσα στο render pass: ένα
    // «not iterable» εδώ έριχνε ΟΛΟΚΛΗΡΟ το καρέ, όχι μόνο τον χαλασμένο πίνακα.
    expect(() => createTableModel(withCells({}))).not.toThrow();
    const model = createTableModel(withCells({}));
    expect(model.cells.size).toBe(0);
    expect(model.rows).toBe(ROWS); // ο υπόλοιπος πίνακας υπάρχει ακόμα
  });

  it('`{}` ΟΥΡΛΙΑΖΕΙ: άδειος πίνακας χωρίς ίχνος είναι το σφάλμα που κυνηγά όλη η φάση', () => {
    createTableModel(withCells({}));
    expect(loggedErrors()).toHaveBeenCalledTimes(1);
  });

  it('λεξικό «κλειδί → κελί» ανακτάται ΟΛΟΚΛΗΡΟ — και το λέει', () => {
    const runtime = createTableModel({ columns: COLUMNS, rows: ROWS, cells: ALL_CELLS });
    const dict: Record<string, TableCell> = {};
    for (const [key, cell] of runtime.cells) dict[key] = cell;

    const model = createTableModel(withCells(dict));
    expect(model.cells.size).toBe(4);
    expect(getCell(model, 'r2', 'c1')?.value).toBe('Δοκός Δ1');
    expect(loggedErrors()).toHaveBeenCalledTimes(1);
  });

  it('ΠΡΑΓΜΑΤΙΚΟΣ `Map`: τα κελιά ανακτώνται αντί να εξαφανιστούν σιωπηλά', () => {
    // Πριν το δίχτυ δεν πετούσε τίποτα: ο iterator του `Map` δίνει ζεύγη **μήκους 2**,
    // οπότε η τριάδα αποδομούνταν λάθος (`cell === undefined`) και ΟΛΑ τα κελιά χάνονταν
    // χωρίς ούτε μία προειδοποίηση — ακριβώς η σιωπηλή απώλεια που η Φ.Δ ήρθε να σκοτώσει.
    const legacy = createTableModel({ columns: COLUMNS, rows: ROWS, cells: ALL_CELLS });
    const model = createTableModel(withCells(legacy.cells));

    expect(model.cells.size).toBe(4);
    expect(getCell(model, 'r1', 'c1')?.value).toBe('Στοιχείο');
    expect(getCell(model, 'r2', 'c2')?.value).toBe(12.5);
    expect(loggedErrors()).toHaveBeenCalledTimes(1);
  });

  it('`null` / `undefined` = «κανένα κελί»: νόμιμος αραιός πίνακας, ΚΑΜΙΑ κραυγή', () => {
    expect(createTableModel(withCells(null)).cells.size).toBe(0);
    expect(createTableModel(withCells(undefined)).cells.size).toBe(0);
    expect(loggedErrors()).not.toHaveBeenCalled();
  });

  it('τριάδες με λάθος αριθμό σκελών πέφτουν έξω — οι υγιείς επιβιώνουν', () => {
    const model = createTableModel(withCells([
      ALL_CELLS[0],
      ['r2', 'c1'],                            // 2 σκέλη: ζεύγος `Map` μεταμφιεσμένο
      ['r2', 'c1', text('Δοκός Δ2'), 'έξτρα'], // 4 σκέλη
      [42, 'c1', text('x')],                   // η γραμμή δεν είναι ταυτότητα
      ['r1', 'c2', 'σκέτο κείμενο'],           // το τρίτο σκέλος δεν είναι κελί
      ALL_CELLS[3],
    ]));

    expect(model.cells.size).toBe(2);
    expect(getCell(model, 'r1', 'c1')?.value).toBe('Στοιχείο');
    expect(getCell(model, 'r2', 'c2')?.value).toBe(12.5);
    expect(loggedErrors()).toHaveBeenCalledTimes(1);
  });

  it('σκουπίδι που δεν είναι καν αντικείμενο ⇒ κενός πίνακας ΜΕ ίχνος', () => {
    expect(createTableModel(withCells('κελιά;')).cells.size).toBe(0);
    expect(loggedErrors()).toHaveBeenCalledTimes(1);
  });

  it('ΙΔΙΑ ΚΛΑΣΗ: και τα υπόλοιπα πεδία αντέχουν μη-ακολουθία (το πρώτο `.length` έριχνε)', () => {
    const model = createTableModel({
      columns: COLUMNS,
      rows: ROWS,
      merges: 'όχι ακολουθία' as unknown as CreateTableModelInput['merges'],
    });
    expect(model.merges).toEqual([]);
    expect(loggedErrors()).toHaveBeenCalledTimes(1);
  });

  it('το `resolveTableModel` κληρονομεί το δίχτυ — αυτή είναι η πόρτα από τη σκηνή', () => {
    const broken = {
      columns: COLUMNS, rows: ROWS, cells: {}, merges: [],
    } as unknown as PersistedTableModel;

    expect(() => resolveTableModel(broken)).not.toThrow();
    expect(resolveTableModel(broken).cells.size).toBe(0);
    expect(loggedErrors()).toHaveBeenCalled();
  });
});
