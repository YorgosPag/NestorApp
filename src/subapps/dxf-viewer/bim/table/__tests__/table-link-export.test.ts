/**
 * ADR-751 — **ο σύνδεσμος φτάνει και στο χαρτί.**
 *
 * Το `table-cell-clipping.test.ts` κλείδωσε ήδη την αρχή: ένας κανόνας, τέσσερα backends, και
 * κανένα από αυτά δεν καλεί τον κανόνα — όλα διαβάζουν το ίδιο `TableCellLayout.text`. Εδώ
 * κλειδώνεται το ίδιο για τους συνδέσμους, μαζί με τον **δηλωμένο περιορισμό** του μικτού
 * κειμένου: αν κάποιος αύριο «διορθώσει» τη γέφυρα σπάζοντας το κείμενο σε Ν primitives, θα
 * το κάνει βλέποντας γιατί δεν έγινε.
 *
 * @see bim/table/table-layout-to-primitives.ts — `linkUnderlinePrimitives`
 */

import { layoutTable } from '../table-layout';
import { tableLayoutToPrimitives } from '../table-layout-to-primitives';
import { createTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { TABLE_CELL_LINK } from '../../../config/color-config';
import type { TableStyle } from '../table-style';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';

const STYLE: TableStyle = BUILTIN_TABLE_STYLES.find(
  (s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
)!;

const COLUMN: TableColumn = {
  id: 'c1',
  sizing: { kind: 'fixed', widthMm: 120 },
  valueType: 'text',
  align: 'left',
};
const ROW: TableRow = { id: 'r1', rowClass: 'data' };

function primitivesFor(value: TableCell['value']) {
  const model = createTableModel({
    columns: [COLUMN],
    rows: [ROW],
    cells: [['r1', 'c1', { kind: 'text', value }]],
  });
  return tableLayoutToPrimitives(layoutTable(model, STYLE));
}

const textsOf = (value: TableCell['value']) =>
  primitivesFor(value).filter((p) => p.kind === 'text');

const linkLinesOf = (value: TableCell['value']) =>
  primitivesFor(value).filter(
    (p) => p.kind === 'line' && p.stroke?.colorHex === TABLE_CELL_LINK.colorHex,
  );

describe('κελί που είναι ΟΛΟ διεύθυνση — πλήρες και σε χαρτί', () => {
  const VALUE = 'georgios.pagonis@gmail.com';

  it('τα γράμματα βγαίνουν μπλε στο πρωτογενές σχήμα', () => {
    const texts = textsOf(VALUE);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatchObject({ text: VALUE, colorHex: TABLE_CELL_LINK.colorHex });
  });

  it('υπογραμμίζεται, με μπλε πένα', () => {
    expect(linkLinesOf(VALUE)).toHaveLength(1);
  });

  it('🔴 ΕΝΑ primitive κειμένου — το σχήμα της γέφυρας δεν άλλαξε', () => {
    // Η ισοτιμία των τεσσάρων backends στηρίζεται στο ότι κάθε κελί δίνει ένα κείμενο.
    expect(textsOf(VALUE)).toHaveLength(1);
  });
});

describe('μικτό κείμενο — ο δηλωμένος περιορισμός', () => {
  const VALUE = 'Τηλ: 2310788493';

  it('το κείμενο μένει ΕΝΙΑΙΟ και στο χρώμα του στυλ', () => {
    const texts = textsOf(VALUE);
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe(VALUE);
    expect(texts[0].colorHex).not.toBe(TABLE_CELL_LINK.colorHex);
  });

  it('🔴 αλλά η υπογράμμιση ΔΕΙΧΝΕΙ ποιο κομμάτι είναι η διεύθυνση — το χαρτί δεν λέει ψέματα', () => {
    const lines = linkLinesOf(VALUE);
    expect(lines).toHaveLength(1);
    // Ξεκινά δεξιά από την άγκυρα του κειμένου, δηλαδή μετά το «Τηλ: ».
    const [text] = textsOf(VALUE);
    expect(lines[0].kind === 'line' && lines[0].a.x).toBeGreaterThan(text.position.x);
  });
});

describe('χωρίς διεύθυνση — καμία αλλαγή', () => {
  it('κανένα primitive συνδέσμου, χρώμα στυλ', () => {
    expect(linkLinesOf('ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ')).toHaveLength(0);
    expect(textsOf('ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ')[0].colorHex).not.toBe(TABLE_CELL_LINK.colorHex);
  });

  it('αριθμητικό κελί με δεκαψήφια τιμή δεν αποκτά ποτέ σύνδεσμο σε χαρτί', () => {
    expect(linkLinesOf(2000000000)).toHaveLength(0);
  });
});

describe('🔴 οθόνη και χαρτί συμφωνούν στο ΠΟΙΟ κελί είναι σύνδεσμος', () => {
  // Ο ζωγράφος και η γέφυρα χρησιμοποιούν την ΙΔΙΑ συνθήκη (`wholeRunLink`, ισότητα
  // κειμένου). Το test κλειδώνει το αποτέλεσμα: ό,τι βάφεται μπλε στην οθόνη βάφεται μπλε
  // και στο πρωτογενές σχήμα — και το αντίστροφο.
  it.each([
    ['georgios.pagonis@gmail.com', true],
    ['www.nestorconstruct.gr', true],
    ['6949727121', true],
    ['Τηλ: 2310788493', false],
    ['ΠΕΡΙΓΡΑΦΗ', false],
  ] as const)('%p → μπλε γράμματα: %p', (value, expected) => {
    expect(textsOf(value)[0]?.colorHex === TABLE_CELL_LINK.colorHex).toBe(expected);
  });
});
