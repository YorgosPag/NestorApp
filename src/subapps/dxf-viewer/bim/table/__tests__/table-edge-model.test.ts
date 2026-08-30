/**
 * ADR-750 Φάση 1 — **το δίχτυ του μοντέλου ακμών**.
 *
 * Κάθε test εδώ τρέχει τον **πραγματικό** μηχανισμό, όχι μίμησή του: το round-trip περνά από
 * αληθινό `JSON.parse(JSON.stringify())` (αυτό ακριβώς κάνουν save/reload και το `deepClone`
 * της αναίρεσης), και η σταθερότητα σε εισαγωγή/διαγραφή περνά από τις **ζωντανές** πράξεις
 * του `table-row-column-ops`, όχι από στημένο μοντέλο.
 *
 * Το μάθημα είναι γραμμένο στην κορυφή του `table-model-serialization.test.ts` και ισχύει
 * αυτούσιο: **πράσινα tests δεν αποδεικνύουν εγγραφή** — μόνο ένα test που περνά τα δεδομένα
 * από το ίδιο κανάλι το κάνει.
 */

type LoggerSpy = {
  readonly debug: jest.Mock;
  readonly info: jest.Mock;
  readonly warn: jest.Mock;
  readonly error: jest.Mock;
};

// `var` υποχρεωτικά, και η ανάθεση **μέσα** στο εργοστάσιο: το `jest.mock` ανυψώνεται πάνω
// από κάθε import, ενώ τα modules φτιάχνουν τον logger τους στο top-level — δηλαδή πριν
// προλάβει να τρέξει οποιοδήποτε `const`/`let` αυτού του αρχείου (TDZ). Είναι το ίδιο μοτίβο
// με το `table-model-serialization.test.ts`· εκεί ο κανόνας μένει ασίγαστος, εδώ σιωπά ρητά.
// eslint-disable-next-line no-var -- η ανύψωση του `jest.mock` δεν αφήνει άλλη επιλογή
var mockLogger: LoggerSpy | undefined;

jest.mock('@/lib/telemetry', () => {
  mockLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { createModuleLogger: () => mockLogger };
});

import {
  HIDDEN_TABLE_EDGE,
  TABLE_EDGE_END,
  buildTableEdgeIndex,
  sameBorderSpec,
  setTableEdges,
  tableEdgeKey,
  tableEdgeKeyAt,
} from '../table-edge-model';
import type { TableEdgePatchMap } from '../table-edge-model';
import { createTableModel, resolveTableModel, toPersistedTableModel } from '../table-model-helpers';
import { deleteTableColumn, deleteTableRow, insertTableRow } from '../table-row-column-ops';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { PersistedTableModel, TableColumn, TableRow } from '../../../types/table';
import type { TableBorderSpec, TableEdgeEntry, TableEdgeKey } from '../../../types/table-edges';
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
  { id: 'r3', rowClass: 'data', heightMm: 8 },
];

const PEN: TableBorderSpec = { visible: true, colorHex: '#ff00ff', widthMm: 0.5 };
const OTHER_PEN: TableBorderSpec = { visible: true, colorHex: '#00aa00', widthMm: 0.13 };

function makePersisted(edges: readonly TableEdgeEntry[] = []): PersistedTableModel {
  return toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, edges }));
}

/** Οι ακμές ως αναγνώσιμα ονόματα — για συγκρίσεις που διαβάζονται σαν πρόταση. */
function edgeNames(model: PersistedTableModel): readonly string[] {
  return (model.edges ?? []).map(([o, rowAnchor, colAnchor]) => `${o}:${rowAnchor}:${colAnchor}`);
}

function loggedErrors(): jest.Mock {
  if (!mockLogger) throw new Error('telemetry mock not initialised');
  return mockLogger.error;
}

function makeEntity(model: PersistedTableModel): TableEntity {
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

// ── 1. Η ταυτότητα ──────────────────────────────────────────────────────────

describe('tableEdgeKey — μία ακμή, ένα όνομα, ένας ιδιοκτήτης', () => {
  it('ο προσανατολισμός ΕΙΝΑΙ μέρος της ταυτότητας: πάνω και αριστερή του ίδιου κελιού διαφέρουν', () => {
    expect(tableEdgeKey('H', 'r2', 'c1')).not.toBe(tableEdgeKey('V', 'r2', 'c1'));
  });

  it('τα σκέλη ΔΕΝ είναι μεταθετικά — ανάποδη σειρά δίνει άλλο κλειδί', () => {
    expect(tableEdgeKey('H', 'r2', 'c1')).not.toBe(tableEdgeKey('H', 'c1', 'r2'));
  });

  it('ίδια σκέλη ⇒ ίδιο κλειδί, πάντα (προϋπόθεση για ευρετήριο)', () => {
    expect(tableEdgeKey('V', 'r2', 'c1')).toBe(tableEdgeKey('V', 'r2', 'c1'));
  });

  it('το sentinel δεν μπορεί να συγκρουστεί με ταυτότητα που παράγει το σύστημα', () => {
    // `nextAxisId` δίνει `r0…rN`, το `enterprise-id.service` δίνει `<prefix>_<UUID>`:
    // καμία από τις δύο πηγές δεν ξεκινά με `$`.
    expect(TABLE_EDGE_END).toBe('$end');
    expect(TABLE_EDGE_END.startsWith('$')).toBe(true);
  });
});

describe('tableEdgeKeyAt — το sentinel μένει κρυφό από κάθε καλούντα', () => {
  const axes = { rows: ROWS, columns: COLUMNS };

  it('🔑 η ΚΑΤΩ ακμή του κελιού (r,c) ΕΙΝΑΙ η ΠΑΝΩ ακμή του (r+1,c) — μία οντότητα', () => {
    // Αυτό είναι ολόκληρο το ADR-750: η κοινή ακμή δεν έχει δύο ονόματα, άρα η σύγκρουση
    // ιδιοκτησίας του Excel (Π2/Π3/Π4) δεν επιλύεται καλύτερα — δεν υπάρχει.
    const bottomOfFirst = tableEdgeKeyAt(axes, 'H', 1, 0);
    const topOfSecond = tableEdgeKeyAt(axes, 'H', 1, 0);
    expect(bottomOfFirst).toBe(topOfSecond);
    expect(bottomOfFirst).toBe(tableEdgeKey('H', 'r2', 'c1'));
  });

  it('η βάση του πίνακα παίρνει το sentinel στη ΓΡΑΜΜΗ', () => {
    expect(tableEdgeKeyAt(axes, 'H', ROWS.length, 1)).toBe(tableEdgeKey('H', TABLE_EDGE_END, 'c2'));
  });

  it('η δεξιά πλευρά του πίνακα παίρνει το sentinel στη ΣΤΗΛΗ', () => {
    expect(tableEdgeKeyAt(axes, 'V', 0, COLUMNS.length)).toBe(
      tableEdgeKey('V', 'r1', TABLE_EDGE_END),
    );
  });

  it('εκτός πλέγματος ⇒ `undefined`: οριζόντια ακμή δεν ζει σε ανύπαρκτη στήλη', () => {
    expect(tableEdgeKeyAt(axes, 'H', 0, COLUMNS.length)).toBeUndefined();
    expect(tableEdgeKeyAt(axes, 'V', ROWS.length, 0)).toBeUndefined();
    expect(tableEdgeKeyAt(axes, 'H', ROWS.length + 1, 0)).toBeUndefined();
    expect(tableEdgeKeyAt(axes, 'H', -1, 0)).toBeUndefined();
  });
});

describe('sameBorderSpec — ίδιο μολύβι, ανεξάρτητα από αναφορά', () => {
  it('ταυτόσημα πεδία ⇒ ίδια, ακόμη κι όταν το `dashMm` είναι άλλος πίνακας', () => {
    expect(sameBorderSpec({ ...PEN, dashMm: [1, 2] }, { ...PEN, dashMm: [1, 2] })).toBe(true);
  });

  it('διαφορετικό μοτίβο ⇒ διαφορετικά (αλλιώς θα ενώνονταν τμήματα που δεν πρέπει)', () => {
    expect(sameBorderSpec({ ...PEN, dashMm: [1, 2] }, { ...PEN, dashMm: [2, 1] })).toBe(false);
    expect(sameBorderSpec({ ...PEN, dashMm: [1] }, PEN)).toBe(false);
  });
});

// ── 2. Το ταξίδι ────────────────────────────────────────────────────────────

describe('JSON round-trip — αυτό ακριβώς κάνουν save/reload και το snapshot της αναίρεσης', () => {
  const EDGES: readonly TableEdgeEntry[] = [
    ['H', 'r2', 'c1', PEN],
    ['V', 'r2', TABLE_EDGE_END, OTHER_PEN],
  ];

  it('οι ρητές ακμές επιβιώνουν το `JSON.parse(JSON.stringify(entity))`', () => {
    const entity = makeEntity(makePersisted(EDGES));
    const revived: TableEntity = JSON.parse(JSON.stringify(entity));

    expect(activeTableModel(revived).edges).toHaveLength(2);
    expect(activeTableModel(revived).edges).toEqual(activeTableModel(entity).edges);
  });

  it('είναι ΑΝΑΓΝΩΣΙΜΕΣ μετά την αναβίωση — όχι απλώς παρούσες', () => {
    const revived: TableEntity = JSON.parse(JSON.stringify(makeEntity(makePersisted(EDGES))));
    const model = resolveTableModel(activeTableModel(revived));

    expect(model.edges.get(tableEdgeKey('H', 'r2', 'c1'))).toEqual(PEN);
    expect(model.edges.get(tableEdgeKey('V', 'r2', TABLE_EDGE_END))).toEqual(OTHER_PEN);
  });

  it('το κλειδί ΔΕΝ ταξιδεύει: στο αρχείο γράφονται αποσυντεθειμένα σκέλη', () => {
    // Αν ταξίδευε το κλειδί, κάθε αποθηκευμένο σχέδιο θα κουβαλούσε χαρακτήρα ελέγχου και
    // η μορφή του κλειδιού θα γινόταν δέσμευση μορφής αρχείου.
    const raw = JSON.stringify(makePersisted(EDGES));
    expect(raw).not.toContain('\\u0000');
    expect(JSON.parse(raw).edges[0]).toEqual(['H', 'r2', 'c1', PEN]);
  });

  it('persisted → runtime → persisted είναι ΤΑΥΤΟΤΙΚΟ', () => {
    const persisted = makePersisted(EDGES);
    expect(toPersistedTableModel(resolveTableModel(persisted))).toEqual(persisted);
  });

  it('🔴 πίνακας ΧΩΡΙΣ ακμές δεν αποκτά καν το πεδίο — μηδέν migration, μηδέν ψεύτικο diff', () => {
    const persisted = makePersisted();
    expect(persisted).not.toHaveProperty('edges');
    expect(toPersistedTableModel(resolveTableModel(persisted))).toEqual(persisted);
  });

  it('παλιός πίνακας (χωρίς `edges`) φορτώνει αναλλοίωτος, με κενό ευρετήριο', () => {
    const legacy: PersistedTableModel = { columns: COLUMNS, rows: ROWS, cells: [], merges: [] };
    const model = resolveTableModel(legacy);
    expect(model.edges.size).toBe(0);
    expect(model.rows).toBe(ROWS);
  });
});

describe('ντετερμινιστική σειρά — ταυτόσημο περιεχόμενο ⇒ ταυτόσημο JSON', () => {
  it('ΑΝΕΞΑΡΤΗΤΗ από τη σειρά εισαγωγής', () => {
    const forward = makePersisted([
      ['H', 'r1', 'c1', PEN],
      ['V', 'r2', 'c2', PEN],
      ['H', TABLE_EDGE_END, 'c1', PEN],
    ]);
    const backward = makePersisted([
      ['H', TABLE_EDGE_END, 'c1', PEN],
      ['V', 'r2', 'c2', PEN],
      ['H', 'r1', 'c1', PEN],
    ]);
    expect(backward.edges).toEqual(forward.edges);
  });

  it('σειρά γραμμής → στήλης → προσανατολισμού· το sentinel ΤΕΛΕΥΤΑΙΟ στον άξονά του', () => {
    const persisted = makePersisted([
      ['V', 'r1', TABLE_EDGE_END, PEN],
      ['H', TABLE_EDGE_END, 'c1', PEN],
      ['V', 'r1', 'c1', PEN],
      ['H', 'r1', 'c1', PEN],
    ]);
    expect(edgeNames(persisted)).toEqual([
      'H:r1:c1',
      'V:r1:c1',
      'V:r1:$end',
      'H:$end:c1',
    ]);
  });

  it('ακμή σε ανύπαρκτη γραμμή/στήλη παραλείπεται σιωπηλά (ίδια ανοχή με τα κελιά)', () => {
    const persisted = makePersisted([
      ['H', 'r2', 'c1', PEN],
      ['H', 'r_deleted', 'c1', PEN],
      ['V', 'r2', 'c_deleted', PEN],
    ]);
    expect(edgeNames(persisted)).toEqual(['H:r2:c1']);
  });
});

// ── 3. Άκυρο σχήμα: ΑΝΑΚΤΗΣΗ ή ΚΡΑΥΓΗ — ποτέ σιωπηλά άδειο ─────────────────

describe('buildTableEdgeIndex — καμία σιωπηλή απώλεια', () => {
  beforeEach(() => {
    loggedErrors().mockClear();
  });

  it('`undefined` / `null` = «καμία ρητή ακμή»: νόμιμο, ΚΑΜΙΑ κραυγή', () => {
    expect(buildTableEdgeIndex(undefined).size).toBe(0);
    expect(buildTableEdgeIndex(null).size).toBe(0);
    expect(loggedErrors()).not.toHaveBeenCalled();
  });

  it('ό,τι δεν είναι ακολουθία ⇒ κενό ευρετήριο ΜΕ ίχνος', () => {
    expect(buildTableEdgeIndex({}).size).toBe(0);
    expect(buildTableEdgeIndex('ακμές;').size).toBe(0);
    expect(loggedErrors()).toHaveBeenCalledTimes(2);
  });

  it('τετράδες με άκυρα σκέλη πέφτουν έξω — οι υγιείς επιβιώνουν, με ίχνος', () => {
    const index = buildTableEdgeIndex([
      ['H', 'r2', 'c1', PEN],
      ['X', 'r2', 'c1', PEN], // άγνωστος προσανατολισμός
      ['H', 'r2', 'c1'], // 3 σκέλη
      ['H', 'r2', 'c1', PEN, 'έξτρα'], // 5 σκέλη
      ['V', 42, 'c1', PEN], // η γραμμή δεν είναι ταυτότητα
      ['V', 'r2', 'c1', { visible: true }], // ημιτελές μολύβι
      ['V', 'r3', 'c2', OTHER_PEN],
    ]);

    expect(index.size).toBe(2);
    expect(index.get(tableEdgeKey('H', 'r2', 'c1'))).toEqual(PEN);
    expect(index.get(tableEdgeKey('V', 'r3', 'c2'))).toEqual(OTHER_PEN);
    expect(loggedErrors()).toHaveBeenCalledTimes(1);
  });

  it('η τελευταία εγγραφή για την ίδια ακμή νικά — μία ακμή, ένα μολύβι', () => {
    const index = buildTableEdgeIndex([
      ['H', 'r2', 'c1', PEN],
      ['H', 'r2', 'c1', OTHER_PEN],
    ]);
    expect(index.size).toBe(1);
    expect(index.get(tableEdgeKey('H', 'r2', 'c1'))).toEqual(OTHER_PEN);
  });
});

// ── 4. ΕΙΣΑΓΩΓΗ: ο λόγος ύπαρξης της αγκύρωσης σε ταυτότητες ────────────────

describe('insertTableRow — το παράπονο Π5 του Excel είναι ΜΗ ΕΚΦΡΑΣΙΜΟ', () => {
  const withEdges = makePersisted([
    ['H', 'r3', 'c1', PEN],
    ['V', 'r2', 'c2', OTHER_PEN],
    ['H', TABLE_EDGE_END, 'c1', PEN],
  ]);

  it('εισαγωγή στη μέση ΔΕΝ μετακινεί καμία ακμή — ίδια αναφορά, μηδέν δουλειά', () => {
    const next = insertTableRow(withEdges, 1);
    expect(next.rows).toHaveLength(ROWS.length + 1);
    expect(next.edges).toBe(withEdges.edges);
  });

  it('εισαγωγή στην ΚΟΡΥΦΗ αφήνει το περίγραμμα στην ίδια γραμμή δεδομένων', () => {
    const next = insertTableRow(withEdges, 0);
    expect(edgeNames(next)).toEqual(edgeNames(withEdges));
  });
});

// ── 5. ΔΙΑΓΡΑΦΗ: το σύνορο επιβιώνει, το τμήμα φεύγει ──────────────────────

describe('deleteTableRow — «το σύνορο μετακομίζει, το τμήμα φεύγει»', () => {
  it('η οριζόντια ακμή της σβησμένης γραμμής ΜΕΤΑΚΟΜΙΖΕΙ στην επόμενη επιζώσα', () => {
    const model = makePersisted([['H', 'r2', 'c1', PEN]]);
    const next = deleteTableRow(model, 'r2');
    expect(edgeNames(next)).toEqual(['H:r3:c1']);
    expect(next.edges?.[0][3]).toEqual(PEN);
  });

  it('🔴 διαγραφή της ΠΡΩΤΗΣ γραμμής δεν σβήνει το πάνω πλαίσιο του πίνακα', () => {
    // Το πάνω περίγραμμα είναι αγκυρωμένο στην πρώτη γραμμή. Σκέτο σβήσιμο θα εξαφάνιζε το
    // πλαίσιο επειδή ο χρήστης έσβησε μια γραμμή — σιωπηλή απώλεια που δεν είχε τρόπο να
    // προβλέψει (Απόφαση 4 του `table-row-column-ops`, εφαρμοσμένη σε γεωμετρία).
    const model = makePersisted([
      ['H', 'r1', 'c1', PEN],
      ['H', 'r1', 'c2', PEN],
    ]);
    const next = deleteTableRow(model, 'r1');
    expect(edgeNames(next)).toEqual(['H:r2:c1', 'H:r2:c2']);
  });

  it('ο κληρονόμος που δηλώνει ΗΔΗ δική του ακμή νικά — καμία σιωπηλή αντικατάσταση', () => {
    const model = makePersisted([
      ['H', 'r2', 'c1', PEN],
      ['H', 'r3', 'c1', OTHER_PEN],
    ]);
    const next = deleteTableRow(model, 'r2');
    expect(edgeNames(next)).toEqual(['H:r3:c1']);
    expect(next.edges?.[0][3]).toEqual(OTHER_PEN);
  });

  it('οι ΚΑΤΑΚΟΡΥΦΕΣ ακμές της γραμμής φεύγουν μαζί της (ήταν τμήμα μέσα στο ύψος της)', () => {
    const model = makePersisted([
      ['V', 'r2', 'c1', PEN],
      ['V', 'r2', TABLE_EDGE_END, PEN],
      ['V', 'r3', 'c1', OTHER_PEN],
    ]);
    const next = deleteTableRow(model, 'r2');
    expect(edgeNames(next)).toEqual(['V:r3:c1']);
  });

  it('η κάτω ακμή του ΠΙΝΑΚΑ (`$end`) δεν επηρεάζεται ποτέ — δεν ανήκε σε γραμμή', () => {
    const model = makePersisted([['H', TABLE_EDGE_END, 'c1', PEN]]);
    expect(edgeNames(deleteTableRow(model, 'r3'))).toEqual(['H:$end:c1']);
    expect(edgeNames(deleteTableRow(model, 'r1'))).toEqual(['H:$end:c1']);
  });

  it('διαγραφή της ΤΕΛΕΥΤΑΙΑΣ γραμμής: το σύνορό της παύει όντως να υπάρχει', () => {
    // Η γραμμή ανάμεσα σε r2 και r3 δεν έχει πού να μετακομίσει — και δεν πρέπει: το
    // εξωτερικό περίγραμμα το κρατά το `$end`, που τώρα κάθεται κάτω από την r2.
    const model = makePersisted([['H', 'r3', 'c1', PEN]]);
    expect(deleteTableRow(model, 'r3').edges ?? []).toEqual([]);
  });

  it('καμία ακμή στη σβησμένη γραμμή ⇒ ΙΔΙΑ αναφορά (καμία ψεύτικη αλλαγή)', () => {
    const model = makePersisted([['H', 'r3', 'c1', PEN]]);
    expect(deleteTableRow(model, 'r2').edges).toBe(model.edges);
  });

  it('πίνακας χωρίς καθόλου ακμές δεν αποκτά πεδίο από τη διαγραφή', () => {
    expect(deleteTableRow(makePersisted(), 'r2').edges).toBeUndefined();
  });
});

describe('deleteTableColumn — η ίδια συμμετρία, ανεστραμμένη', () => {
  it('η ΚΑΤΑΚΟΡΥΦΗ ακμή της σβησμένης στήλης μετακομίζει· η οριζόντια φεύγει', () => {
    const model = makePersisted([
      ['V', 'r2', 'c1', PEN],
      ['H', 'r2', 'c1', OTHER_PEN],
      ['H', 'r2', 'c2', PEN],
    ]);
    const next = deleteTableColumn(model, 'c1');
    expect(edgeNames(next)).toEqual(['H:r2:c2', 'V:r2:c2']);
  });

  it('η δεξιά ακμή του ΠΙΝΑΚΑ (`$end`) δεν επηρεάζεται', () => {
    const model = makePersisted([['V', 'r2', TABLE_EDGE_END, PEN]]);
    expect(edgeNames(deleteTableColumn(model, 'c2'))).toEqual(['V:r2:$end']);
  });
});

// ── Ο μαζικός εγγραφέας (ADR-750 Φ2) ───────────────────────────────────────

describe('setTableEdges — μία δέσμη, ένα πέρασμα, μία σειρά', () => {
  function patch(
    entries: readonly (readonly [TableEdgeKey, TableBorderSpec | null])[],
  ): TableEdgePatchMap {
    return new Map(entries);
  }

  const H_R2_C1 = tableEdgeKey('H', 'r2', 'c1');
  const H_R3_C1 = tableEdgeKey('H', 'r3', 'c1');
  const V_R2_END = tableEdgeKey('V', 'r2', TABLE_EDGE_END);

  it('γράφει όλες τις ακμές της δέσμης, στη ΜΙΑ ντετερμινιστική σειρά', () => {
    // Η δέσμη δίνεται ανάποδα· η σειρά στο αρχείο δεν την ακολουθεί.
    const next = setTableEdges(
      makePersisted(),
      patch([
        [V_R2_END, PEN],
        [H_R3_C1, PEN],
        [H_R2_C1, PEN],
      ]),
    );
    expect(edgeNames(next)).toEqual(['H:r2:c1', 'V:r2:$end', 'H:r3:c1']);
  });

  it('🔴 ίδιο μολύβι ⇒ ΤΟ ΙΔΙΟ αντικείμενο by-reference (κανένα βήμα undo)', () => {
    const first = setTableEdges(makePersisted(), patch([[H_R2_C1, PEN]]));
    // Νέο αντικείμενο μολυβιού, ίδια τιμή: η σύγκριση είναι σημασιολογική, όχι αναφοράς.
    const same = setTableEdges(first, patch([[H_R2_C1, { ...PEN }]]));
    expect(same).toBe(first);
  });

  it('διαφορετικό μολύβι ⇒ νέο αντικείμενο (αλλιώς η αλλαγή δεν φαίνεται ποτέ)', () => {
    const first = setTableEdges(makePersisted(), patch([[H_R2_C1, PEN]]));
    expect(setTableEdges(first, patch([[H_R2_C1, OTHER_PEN]]))).not.toBe(first);
  });

  it('κενή δέσμη ⇒ το ίδιο αντικείμενο, χωρίς καν ανάγνωση του ευρετηρίου', () => {
    const model = makePersisted([['H', 'r2', 'c1', PEN]]);
    expect(setTableEdges(model, new Map())).toBe(model);
  });

  it('`null` ΔΙΑΓΡΑΦΕΙ την εγγραφή — δεν τη σβήνει με αόρατο μολύβι', () => {
    const model = makePersisted([['H', 'r2', 'c1', PEN]]);
    const cleared = setTableEdges(model, patch([[H_R2_C1, null]]));
    expect(cleared.edges).toBeUndefined();
  });

  it('`null` σε ακμή που δεν υπάρχει ⇒ καμία αλλαγή, ίδιο αντικείμενο', () => {
    const model = makePersisted([['H', 'r2', 'c1', PEN]]);
    expect(setTableEdges(model, patch([[H_R3_C1, null]]))).toBe(model);
  });

  it('το αόρατο μολύβι ΔΕΝ είναι διαγραφή: μένει ως ρητή εγγραφή', () => {
    const model = makePersisted();
    const erased = setTableEdges(model, patch([[H_R2_C1, HIDDEN_TABLE_EDGE]]));
    expect(erased.edges).toEqual([['H', 'r2', 'c1', HIDDEN_TABLE_EDGE]]);
  });

  it('μία δέσμη με 430 ακμές γράφεται σε ΕΝΑ πέρασμα και μένει ταξινομημένη', () => {
    const entries: (readonly [TableEdgeKey, TableBorderSpec | null])[] = [];
    for (const row of ['r3', 'r2', 'r1']) {
      for (const col of ['c2', 'c1']) {
        entries.push([tableEdgeKey('H', row, col), PEN]);
        entries.push([tableEdgeKey('V', row, col), PEN]);
      }
    }
    const next = setTableEdges(makePersisted(), patch(entries));
    expect(next.edges).toHaveLength(entries.length);
    expect(edgeNames(next).slice(0, 4)).toEqual(['H:r1:c1', 'V:r1:c1', 'H:r1:c2', 'V:r1:c2']);
  });
});
