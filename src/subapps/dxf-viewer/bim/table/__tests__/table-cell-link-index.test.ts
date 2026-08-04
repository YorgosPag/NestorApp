/**
 * ADR-751 Φ8 — **το ευρετήριο συνδέσμων**: η ερώτηση του πληκτρολογίου.
 *
 * Δύο πράγματα κλειδώνονται εδώ, και κανένα δεν είναι «βρίσκει συνδέσμους»:
 *
 *  1. **Η σειρά ανάγνωσης.** Η λίστα εντοπισμένων συνδέσμων και η σειρά του `Tab` στο Mirror
 *     DOM διαβάζονται από τον ίδιο πίνακα· αν η σειρά έβγαινε από τη σειρά εισαγωγής των
 *     κελιών στο `Map`, θα άλλαζε σιωπηλά με κάθε επεξεργασία.
 *  2. **Η συμφωνία με την οθόνη.** Το ευρετήριο χτίζεται από τη **διάταξη**, άρα κληρονομεί
 *     τον φραγμό ψευδών τηλεφώνων (§4) και τον κανόνα «όλο ή τίποτα» (§5). Ένα ευρετήριο
 *     χτισμένο από το μοντέλο θα περνούσε αυτά τα tests μόνο κατά τύχη.
 *
 * @see bim/table/table-cell-link-index.ts
 */

import { collectTableCellLinks, tableCellLinksAt } from '../table-cell-link-index';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';

const COLUMNS: TableColumn[] = [
  { id: 'cA', sizing: { kind: 'fixed', widthMm: 120 }, valueType: 'text', align: 'left' },
  { id: 'cB', sizing: { kind: 'fixed', widthMm: 120 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [
  { id: 'rHead', rowClass: 'header' },
  { id: 'r1', rowClass: 'data' },
  { id: 'r2', rowClass: 'data' },
];

type CellTriple = readonly [string, string, TableCell];

function entityWith(cells: readonly CellTriple[]): TableEntity {
  const model = createTableModel({ columns: COLUMNS, rows: ROWS, cells: cells.slice() });
  return {
    id: 'ent_link_index',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: toPersistedTableModel(model),
  };
}

const text = (value: string): TableCell => ({ kind: 'text', value });

describe('σειρά ανάγνωσης — γραμμή προς γραμμή, μετά στήλη προς στήλη', () => {
  // Τα κελιά δίνονται ΕΠΙΤΗΔΕΣ ανάποδα: αν το ευρετήριο επέστρεφε τη σειρά εισαγωγής, το
  // test θα ήταν πράσινο κατά λάθος με τη λάθος υλοποίηση.
  const entity = entityWith([
    ['rHead', 'cA', text('E-mail')],
    ['rHead', 'cB', text('Ιστοσελίδα')],
    ['r2', 'cB', text('www.nestorconstruct.gr')],
    ['r2', 'cA', text('b@nestor.gr')],
    ['r1', 'cA', text('a@nestor.gr')],
  ]);

  it('επιστρέφει τους συνδέσμους με τη σειρά που τους βλέπει ο χρήστης', () => {
    const hrefs = collectTableCellLinks(entity).map((e) => e.span.href);
    expect(hrefs).toEqual([
      'mailto:a@nestor.gr',
      'mailto:b@nestor.gr',
      'https://www.nestorconstruct.gr',
    ]);
  });

  it('ονομάζει κάθε σύνδεσμο με το A1 του κελιού του', () => {
    expect(collectTableCellLinks(entity).map((e) => e.a1)).toEqual(['A2', 'A3', 'B3']);
  });

  it('κουβαλά την κεφαλίδα της στήλης — το «τι», δίπλα στο «πού»', () => {
    const entries = collectTableCellLinks(entity);
    expect(entries[0]?.columnHeader).toBe('E-mail');
    expect(entries[2]?.columnHeader).toBe('Ιστοσελίδα');
  });
});

describe('ενός κελιού — ό,τι ζητά το Alt+Enter', () => {
  it('φιλτράρει στο κελί του δρομέα', () => {
    const entity = entityWith([
      ['r1', 'cA', text('a@nestor.gr')],
      ['r1', 'cB', text('b@nestor.gr')],
    ]);
    const links = tableCellLinksAt(entity, 'r1', 'cB');
    expect(links).toHaveLength(1);
    expect(links[0]?.span.href).toBe('mailto:b@nestor.gr');
  });

  it('κενό σε κελί χωρίς διεύθυνση — ο καλών δεν χρειάζεται δεύτερο έλεγχο', () => {
    const entity = entityWith([['r1', 'cA', text('Απλό κείμενο')]]);
    expect(tableCellLinksAt(entity, 'r1', 'cA')).toEqual([]);
  });

  it('πολλαπλοί σύνδεσμοι στο ΙΔΙΟ κελί βγαίνουν με τη σειρά του κειμένου', () => {
    const entity = entityWith([['r1', 'cA', text('a@nestor.gr · b@nestor.gr')]]);
    expect(tableCellLinksAt(entity, 'r1', 'cA').map((e) => e.span.href)).toEqual([
      'mailto:a@nestor.gr',
      'mailto:b@nestor.gr',
    ]);
  });
});

describe('🔴 συμφωνεί με την οθόνη, γιατί διαβάζει τη ΔΙΑΤΑΞΗ', () => {
  it('αριθμητική τιμή ΔΕΝ γίνεται τηλέφωνο — ο φραγμός του §4 κληρονομείται', () => {
    const entity = entityWith([['r1', 'cA', { kind: 'text', value: 2310788493 }]]);
    expect(collectTableCellLinks(entity)).toEqual([]);
  });

  it('η ΙΔΙΑ τιμή ως κείμενο ΕΙΝΑΙ τηλέφωνο', () => {
    const entity = entityWith([['r1', 'cA', text('2310788493')]]);
    expect(collectTableCellLinks(entity).map((e) => e.span.href)).toEqual(['tel:2310788493']);
  });
});

describe('άδειος πίνακας', () => {
  it('χωρίς κελιά επιστρέφει κενό, χωρίς να σκάσει', () => {
    expect(collectTableCellLinks(entityWith([]))).toEqual([]);
  });
});
