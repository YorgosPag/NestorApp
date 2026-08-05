/**
 * ADR-739 Επίπεδο Β — **το δίχτυ του μοντέλου δεσμών**.
 *
 * Κάθε test εδώ τρέχει τον **πραγματικό** μηχανισμό, όχι μίμησή του: το round-trip περνά από
 * αληθινό `JSON.parse(JSON.stringify())` (αυτό ακριβώς κάνουν save/reload και το `deepClone`
 * της αναίρεσης), και η επιβίωση σε διαγραφή περνά από τη **ζωντανή** `deleteTableRow`, όχι
 * από στημένο μοντέλο.
 *
 * Το μάθημα του `table-model-serialization.test.ts` ισχύει αυτούσιο: **πράσινα tests δεν
 * αποδεικνύουν εγγραφή** — μόνο ένα test που περνά τα δεδομένα από το ίδιο κανάλι το κάνει.
 */

type LoggerSpy = {
  readonly debug: jest.Mock;
  readonly info: jest.Mock;
  readonly warn: jest.Mock;
  readonly error: jest.Mock;
};

// `var` υποχρεωτικά, και η ανάθεση **μέσα** στο εργοστάσιο: το `jest.mock` ανυψώνεται πάνω
// από κάθε import, ενώ τα modules φτιάχνουν τον logger τους στο top-level (TDZ). Ίδιο μοτίβο
// με το `table-edge-model.test.ts`.
// eslint-disable-next-line no-var -- η ανύψωση του `jest.mock` δεν αφήνει άλλη επιλογή
var mockLogger: LoggerSpy | undefined;

jest.mock('@/lib/telemetry', () => {
  mockLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { createModuleLogger: () => mockLogger };
});

import {
  buildTableRowLinkIndex,
  dropTableRowLink,
  sameRowLink,
  setTableRowLinks,
  toPersistedTableRowLinks,
} from '../table-row-link-model';
import type { TableRowLinkPatchMap } from '../table-row-link-model';
import { createTableModel, resolveTableModel, toPersistedTableModel } from '../table-model-helpers';
import { deleteTableRow, insertTableRow } from '../table-row-column-ops';
import type { PersistedTableModel, TableColumn, TableRow } from '../../../types/table';
import type { TableRowLink, TableRowLinkEntry } from '../../../types/table-row-link';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

const COLUMNS: TableColumn[] = [
  { id: 'c0', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'number', align: 'right' },
];

const ROWS: TableRow[] = [
  { id: 'r0', rowClass: 'header', heightMm: 8 },
  { id: 'r1', rowClass: 'data', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

const IDS_LINK: TableRowLink = {
  target: { kind: 'ids', entityIds: ['wall_a', 'wall_b'] },
  origin: 'manual',
};

const QUERY_LINK: TableRowLink = {
  target: { kind: 'query', criteria: { floorIds: ['f1'], categories: ['foundation'] } },
  origin: 'bound',
};

function makePersisted(rowLinks?: readonly TableRowLinkEntry[]): PersistedTableModel {
  return {
    columns: COLUMNS,
    rows: ROWS,
    cells: [],
    merges: [],
    ...(rowLinks ? { rowLinks } : {}),
  };
}

/** Τα ονόματα γραμμών με δεσμό, στη σειρά που ταξιδεύουν. */
function linkedRowIds(model: PersistedTableModel): string[] {
  return (model.rowLinks ?? []).map((entry) => entry[0]);
}

beforeEach(() => {
  mockLogger?.error.mockClear();
});

// ── Η εγγύηση που δεν επιτρέπεται να σπάσει ────────────────────────────────

describe('πίνακας χωρίς δεσμούς — byte-ταυτόσημο JSON', () => {
  it('το πεδίο ΔΕΝ γράφεται καθόλου όταν δεν υπάρχουν δεσμοί', () => {
    const persisted = makePersisted();
    const round = toPersistedTableModel(resolveTableModel(persisted));

    expect(round.rowLinks).toBeUndefined();
    expect('rowLinks' in round).toBe(false);
    expect(JSON.stringify(round)).toBe(JSON.stringify(persisted));
  });

  it('ο χάρτης στη μνήμη είναι ΠΑΝΤΑ παρών (κενός), ποτέ undefined', () => {
    // Ένα προαιρετικό πεδίο εδώ θα γεννούσε δύο απαντήσεις στο «έχει δεσμούς;».
    expect(resolveTableModel(makePersisted()).rowLinks.size).toBe(0);
  });
});

describe('round-trip μέσα από ΠΡΑΓΜΑΤΙΚΟ JSON', () => {
  it('δεσμός με ρητές ταυτότητες επιβιώνει save → reload', () => {
    const persisted = makePersisted([['r1', IDS_LINK]]);
    const revived: PersistedTableModel = JSON.parse(JSON.stringify(persisted));
    const index = resolveTableModel(revived).rowLinks;

    expect(index.get('r1')).toEqual(IDS_LINK);
  });

  it('δεσμός με κριτήριο επιβιώνει save → reload χωρίς να χάσει άξονα', () => {
    const persisted = makePersisted([['r1', QUERY_LINK]]);
    const revived: PersistedTableModel = JSON.parse(JSON.stringify(persisted));
    const link = resolveTableModel(revived).rowLinks.get('r1');

    expect(link?.target).toEqual({
      kind: 'query',
      criteria: { floorIds: ['f1'], categories: ['foundation'] },
    });
  });

  it('persisted → runtime → persisted είναι ταυτοτικό', () => {
    const persisted = makePersisted([
      ['r0', QUERY_LINK],
      ['r2', IDS_LINK],
    ]);
    expect(toPersistedTableModel(resolveTableModel(persisted)).rowLinks).toEqual(persisted.rowLinks);
  });
});

// ── Το δίχτυ ────────────────────────────────────────────────────────────────

describe('buildTableRowLinkIndex — φθορά, όχι κληρονομιά', () => {
  it('undefined / null ⇒ κενός χάρτης ΧΩΡΙΣ κραυγή (η συνηθέστερη είσοδος)', () => {
    expect(buildTableRowLinkIndex(undefined).size).toBe(0);
    expect(buildTableRowLinkIndex(null).size).toBe(0);
    expect(mockLogger?.error).not.toHaveBeenCalled();
  });

  it('μη-ακολουθία ⇒ κενός χάρτης ΜΕ ίχνος', () => {
    expect(buildTableRowLinkIndex({ r1: IDS_LINK }).size).toBe(0);
    expect(mockLogger?.error).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['λείπει σκέλος', [['r1']]],
    ['origin εκτός λεξιλογίου', [['r1', { target: IDS_LINK.target, origin: 'auto' }]]],
    ['kind εκτός λεξιλογίου', [['r1', { target: { kind: 'tag' }, origin: 'manual' }]]],
    ['entityIds όχι αλφαριθμητικά', [['r1', { target: { kind: 'ids', entityIds: [7] }, origin: 'manual' }]]],
    ['rowId όχι αλφαριθμητικό', [[7, IDS_LINK]]],
  ])('%s ⇒ παραλείπεται ΜΕ ίχνος', (_name, entries) => {
    expect(buildTableRowLinkIndex(entries).size).toBe(0);
    expect(mockLogger?.error).toHaveBeenCalledTimes(1);
  });

  it('η άκυρη εγγραφή δεν παρασύρει τις έγκυρες', () => {
    const index = buildTableRowLinkIndex([['r0', IDS_LINK], ['r1', { origin: 'manual' }]]);
    expect([...index.keys()]).toEqual(['r0']);
  });

  it('το κριτήριο ελέγχεται ως ΣΧΗΜΑ, όχι ως περιεχόμενο — άγνωστος άξονας περνά', () => {
    // Συνειδητό όριο: η γνώση «τι είναι έγκυρο κριτήριο» ανήκει στο `bim/schedule/filters.ts`.
    // Έλεγχος εδώ θα αποσυγχρονιζόταν στον έκτο άξονα και θα απέρριπτε ΣΙΩΠΗΛΑ έγκυρο δεδομένο.
    const link = { target: { kind: 'query', criteria: { newAxis: ['x'] } }, origin: 'bound' };
    expect(buildTableRowLinkIndex([['r1', link]]).size).toBe(1);
    expect(mockLogger?.error).not.toHaveBeenCalled();
  });
});

// ── Σειρά + κλάδεμα ─────────────────────────────────────────────────────────

describe('toPersistedTableRowLinks — ντετερμινιστική σειρά', () => {
  it('η σειρά είναι η σειρά ΤΩΝ ΓΡΑΜΜΩΝ, όχι της εισαγωγής στον Map', () => {
    const index = new Map([
      ['r2', IDS_LINK],
      ['r0', QUERY_LINK],
    ]);
    expect(toPersistedTableRowLinks({ rows: ROWS, columns: COLUMNS }, index).map((e) => e[0])).toEqual([
      'r0',
      'r2',
    ]);
  });

  it('δεσμός σε ανύπαρκτη γραμμή κλαδεύεται', () => {
    const index = new Map([['r_ghost', IDS_LINK]]);
    expect(toPersistedTableRowLinks({ rows: ROWS, columns: COLUMNS }, index)).toEqual([]);
  });
});

// ── Επιβίωση σε διαγραφή — η ΠΡΑΓΜΑΤΙΚΗ πράξη ──────────────────────────────

describe('deleteTableRow — ο δεσμός φεύγει μαζί με τη γραμμή', () => {
  it('ο δεσμός της σβησμένης γραμμής δεν επιβιώνει', () => {
    const next = deleteTableRow(makePersisted([['r1', IDS_LINK]]), 'r1');
    expect(next.rowLinks).toBeUndefined();
  });

  it('οι δεσμοί των άλλων γραμμών μένουν άθικτοι', () => {
    const model = makePersisted([
      ['r0', QUERY_LINK],
      ['r1', IDS_LINK],
    ]);
    expect(linkedRowIds(deleteTableRow(model, 'r1'))).toEqual(['r0']);
  });

  it('🔴 η ΑΝΑΚΥΚΛΩΣΗ ΤΑΥΤΟΤΗΤΑΣ δεν αναστήνει νεκρό δεσμό', () => {
    // Το `nextAxisId` δίνει «μέγιστο των υπαρχόντων + 1»: σβήνοντας την τελευταία γραμμή και
    // προσθέτοντας νέα, εκείνη παίρνει ΞΑΝΑ το ίδιο id. Χωρίς το κλάδεμα στη διαγραφή, η νέα
    // γραμμή θα κληρονομούσε σιωπηλά ποσότητες που δεν της ανήκουν — σφάλμα ΤΙΜΗΣ.
    const withLink = makePersisted([['r2', IDS_LINK]]);
    const afterDelete = deleteTableRow(withLink, 'r2');
    const afterInsert = insertTableRow(afterDelete, 'r1', 'after');

    expect(afterInsert.rows.map((r) => r.id)).toContain('r2');
    expect(afterInsert.rowLinks).toBeUndefined();
  });

  it('γραμμή χωρίς δεσμό ⇒ το ΙΔΙΟ αντικείμενο by-reference', () => {
    const model = makePersisted([['r0', IDS_LINK]]);
    expect(deleteTableRow(model, 'r1').rowLinks).toBe(model.rowLinks);
  });

  it('πίνακας χωρίς δεσμούς μένει χωρίς πεδίο', () => {
    expect(deleteTableRow(makePersisted(), 'r1').rowLinks).toBeUndefined();
  });
});

describe('dropTableRowLink — απευθείας', () => {
  it('undefined είσοδος ⇒ undefined έξοδος (καμία γέννηση πεδίου)', () => {
    expect(dropTableRowLink(undefined, 'r1')).toBeUndefined();
  });

  it('τελευταίος δεσμός που φεύγει ⇒ undefined, ΠΟΤΕ []', () => {
    expect(dropTableRowLink([['r1', IDS_LINK]], 'r1')).toBeUndefined();
  });
});

// ── Ταυτοδυναμία ────────────────────────────────────────────────────────────

describe('sameRowLink', () => {
  it('ίδιο περιεχόμενο, άλλη αναφορά ⇒ ίδιο', () => {
    expect(sameRowLink(IDS_LINK, { ...IDS_LINK, target: { kind: 'ids', entityIds: ['wall_a', 'wall_b'] } })).toBe(true);
  });

  it('η ΣΕΙΡΑ των ταυτοτήτων μετράει — είναι η σειρά επιλογής του χρήστη', () => {
    const reversed: TableRowLink = {
      target: { kind: 'ids', entityIds: ['wall_b', 'wall_a'] },
      origin: 'manual',
    };
    expect(sameRowLink(IDS_LINK, reversed)).toBe(false);
  });

  it('διαφορετικό origin ⇒ διαφορετικό, ακόμη κι αν ο στόχος ταυτίζεται', () => {
    expect(sameRowLink(IDS_LINK, { ...IDS_LINK, origin: 'bound' })).toBe(false);
  });

  it('το κριτήριο συγκρίνεται ΒΑΘΙΑ — αλλιώς η αλλαγή ορόφου χανόταν σιωπηλά', () => {
    const other: TableRowLink = {
      target: { kind: 'query', criteria: { floorIds: ['f2'], categories: ['foundation'] } },
      origin: 'bound',
    };
    expect(sameRowLink(QUERY_LINK, other)).toBe(false);
  });

  it('δύο είδη στόχου δεν συγχέονται ποτέ', () => {
    expect(sameRowLink(IDS_LINK, { ...QUERY_LINK, origin: 'manual' })).toBe(false);
  });
});

// ── Μαζική εγγραφή ──────────────────────────────────────────────────────────

describe('setTableRowLinks', () => {
  it('κενή δέσμη ⇒ το ΙΔΙΟ μοντέλο', () => {
    const model = makePersisted();
    expect(setTableRowLinks(model, new Map())).toBe(model);
  });

  it('🔴 δέσμη που δεν αλλάζει τίποτα ⇒ το ΙΔΙΟ μοντέλο (μηδέν βήμα undo)', () => {
    const model = makePersisted([['r1', IDS_LINK]]);
    const patches: TableRowLinkPatchMap = new Map([
      ['r1', { target: { kind: 'ids', entityIds: ['wall_a', 'wall_b'] }, origin: 'manual' }],
    ]);
    expect(setTableRowLinks(model, patches)).toBe(model);
  });

  it('γράφει νέο δεσμό στη σωστή θέση της σειράς', () => {
    const model = makePersisted([['r2', IDS_LINK]]);
    const next = setTableRowLinks(model, new Map([['r0', QUERY_LINK]]));
    expect(linkedRowIds(next)).toEqual(['r0', 'r2']);
  });

  it('null ⇒ ΛΥΣΙΜΟ του δεσμού', () => {
    const model = makePersisted([
      ['r0', QUERY_LINK],
      ['r1', IDS_LINK],
    ]);
    expect(linkedRowIds(setTableRowLinks(model, new Map([['r1', null]])))).toEqual(['r0']);
  });

  it('«δεμένο σε κανένα» ΔΕΝ είναι «λυμένο» — η διάκριση επιβιώνει', () => {
    const empty: TableRowLink = { target: { kind: 'ids', entityIds: [] }, origin: 'manual' };
    const next = setTableRowLinks(makePersisted(), new Map([['r1', empty]]));
    expect(next.rowLinks).toEqual([['r1', empty]]);
  });

  it('λύσιμο του τελευταίου δεσμού ⇒ undefined, ΠΟΤΕ []', () => {
    const model = makePersisted([['r1', IDS_LINK]]);
    const next = setTableRowLinks(model, new Map([['r1', null]]));
    expect(next.rowLinks).toBeUndefined();
    expect(JSON.stringify(next)).toBe(JSON.stringify(makePersisted()));
  });

  it('λύσιμο γραμμής που δεν είχε δεσμό ⇒ το ΙΔΙΟ μοντέλο', () => {
    const model = makePersisted([['r0', IDS_LINK]]);
    expect(setTableRowLinks(model, new Map([['r1', null]]))).toBe(model);
  });
});

// ── Το factory ──────────────────────────────────────────────────────────────

describe('createTableModel', () => {
  it('περνά τους δεσμούς στο ευρετήριο', () => {
    const model = createTableModel({
      columns: COLUMNS,
      rows: ROWS,
      rowLinks: [['r1', IDS_LINK]],
    });
    expect(model.rowLinks.get('r1')).toEqual(IDS_LINK);
  });

  it('χωρίς δεσμούς ⇒ κενός χάρτης, όχι undefined', () => {
    expect(createTableModel({ columns: COLUMNS, rows: ROWS }).rowLinks.size).toBe(0);
  });
});
