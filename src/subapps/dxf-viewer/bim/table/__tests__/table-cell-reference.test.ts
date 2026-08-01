/**
 * ADR-739 Φ.Δ βήμα 7 — η **ονοματολογία αναφοράς κελιού**, το SSoT που θα κληρονομήσουν οι
 * τύποι (`=SUM(B2:B7)`, Φ.Δ.11).
 *
 * Το πλέγμα δοκιμής μιμείται τον πραγματικό πίνακα ποσοτήτων του Giorgio, γιατί εκεί
 * συγκεντρώνονται και τα τρία ρίσκα ταυτόχρονα:
 *
 *   c1        c2           c3
 * r1 [ΠΙΝΑΚΑΣ ── συγχώνευση 1×3 ──]      ← τίτλος: η αρίθμηση ΔΕΝ τον πηδά
 * r2  Α/Α      Περιγραφή     Ποσότητα    ← κεφαλίδα: από εδώ βγαίνει το συμφραζόμενο
 * r3  ·        ·             ·           ← δεδομένα
 */

import {
  parseTableCellReference,
  tableCellReference,
  tableColumnHeaderText,
  tableColumnLetter,
  tableColumnTicks,
  tableRowNumber,
  tableRowTicks,
} from '../table-cell-reference';
import { createTableModel } from '../table-model-helpers';
import type { TableColumn, TableModel, TableRow } from '../../../types/table';
import type { TableColumnLayout, TableRowLayout } from '../table-layout-types';

const COLUMNS: TableColumn[] = ['c1', 'c2', 'c3'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));

const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'title', heightMm: 10 },
  { id: 'r2', rowClass: 'header', heightMm: 8 },
  { id: 'r3', rowClass: 'data', heightMm: 8 },
];

const model: TableModel = createTableModel({
  columns: COLUMNS,
  rows: ROWS,
  cells: [
    ['r1', 'c1', { kind: 'text', value: 'ΠΙΝΑΚΑΣ' }],
    ['r2', 'c1', { kind: 'text', value: 'Α/Α' }],
    ['r2', 'c2', { kind: 'text', value: 'Περιγραφή' }],
    ['r2', 'c3', { kind: 'text', value: 'Ποσότητα' }],
  ],
  merges: [{ anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 1, colSpan: 3 }],
});

describe('ονομασία στήλης / γραμμής', () => {
  it('η στήλη παίρνει το γράμμα της ΘΕΣΗΣ της, όχι της ταυτότητάς της', () => {
    // Το μοντέλο μιλά ids (`c2`)· η οθόνη και οι τύποι μιλούν θέσεις (`B`). Αν κάποτε
    // εισαχθεί στήλη στη μέση, το `B` θα δείχνει σε άλλο id — και αυτό είναι **σωστό**:
    // ακριβώς γι' αυτό ο adapter τύπων (§9.2) μεταφράζει, αντί να αποθηκεύει γράμματα.
    expect(tableColumnLetter(model, 'c1')).toBe('A');
    expect(tableColumnLetter(model, 'c3')).toBe('C');
  });

  it('η αρίθμηση γραμμών ΔΕΝ πηδά τίτλο και κεφαλίδα', () => {
    // Ο μηχανισμός τύπων διευθυνσιοδοτεί το ΙΔΙΟ πλέγμα. Μια αρίθμηση που ξεκινούσε από
    // τα δεδομένα θα σήμαινε ότι το «B3» της οθόνης δεν είναι το «B3» του τύπου.
    expect(tableRowNumber(model, 'r1')).toBe(1);
    expect(tableRowNumber(model, 'r2')).toBe(2);
    expect(tableRowNumber(model, 'r3')).toBe(3);
  });

  it('άγνωστη ταυτότητα ⇒ κενό / μηδέν, ποτέ μαντεψιά', () => {
    expect(tableColumnLetter(model, 'σβησμένη')).toBe('');
    expect(tableRowNumber(model, 'σβησμένη')).toBe(0);
  });
});

describe('tableCellReference', () => {
  it('ελεύθερο κελί ⇒ σκέτη αναφορά', () => {
    expect(tableCellReference(model, 'r3', 'c2')?.a1).toBe('B3');
  });

  it('συγχωνευμένο ⇒ ΕΥΡΟΣ στην οθόνη, ΑΓΚΥΡΑ στους τύπους', () => {
    // Το Excel δείχνει σκέτο `A1` ενώ ο τύπος του γράφει `A1:C1` — τεκμηριωμένη πηγή
    // σύγχυσης. Εδώ το εύρος είναι γνωστό από το μοντέλο, άρα λέγεται.
    const ref = tableCellReference(model, 'r1', 'c1');
    expect(ref?.a1).toBe('A1:C1');
    expect(ref?.anchorA1).toBe('A1');
  });

  it('κουβαλά το κείμενο κεφαλίδας ως ΣΥΜΦΡΑΖΟΜΕΝΟ — ποτέ ως ταυτότητα', () => {
    expect(tableCellReference(model, 'r3', 'c2')?.columnHeader).toBe('Περιγραφή');
  });

  it('μπαγιάτικος δρομέας ⇒ null, ώστε ο καλών να μη δείξει τίποτα', () => {
    expect(tableCellReference(model, 'σβησμένη', 'c1')).toBeNull();
  });
});

describe('tableColumnHeaderText', () => {
  it('διαβάζει τη ΠΡΩΤΗ γραμμή κεφαλίδας', () => {
    expect(tableColumnHeaderText(model, 'c3')).toBe('Ποσότητα');
  });

  it('πίνακας χωρίς γραμμή κεφαλίδας ⇒ κενό, ΟΧΙ σφάλμα', () => {
    // Ένας πίνακας υπομνήματος δεν έχει κεφαλίδες· αυτό είναι φυσιολογικό.
    const bare = createTableModel({ columns: COLUMNS, rows: [{ id: 'r1', rowClass: 'data' }] });
    expect(tableColumnHeaderText(bare, 'c1')).toBe('');
  });

  it('κελί κάτω από ΟΜΑΔΙΚΗ (συγχωνευμένη) κεφαλίδα δεν μένει ανώνυμο', () => {
    const grouped = createTableModel({
      columns: COLUMNS,
      rows: [{ id: 'h', rowClass: 'header' }, { id: 'd', rowClass: 'data' }],
      cells: [['h', 'c1', { kind: 'text', value: 'Διαστάσεις' }]],
      merges: [{ anchorRowId: 'h', anchorColId: 'c1', rowSpan: 1, colSpan: 2 }],
    });
    expect(grouped.columns).toHaveLength(3);
    expect(tableColumnHeaderText(grouped, 'c2')).toBe('Διαστάσεις');
  });
});

describe('parseTableCellReference — ο κλειστός κύκλος', () => {
  it('γυρίζει στο ίδιο κελί από το οποίο ξεκίνησε', () => {
    const ref = tableCellReference(model, 'r3', 'c2');
    expect(parseTableCellReference(model, ref!.a1)).toEqual({
      rowId: 'r3',
      colId: 'c2',
      anchorColId: 'c2',
    });
  });

  it('ένα ΕΥΡΟΣ λύνεται στην αρχή του — εκεί κάθεται ο δρομέας', () => {
    expect(parseTableCellReference(model, 'A1:C1')?.rowId).toBe('r1');
  });

  it.each(['', 'ΑΒΓ', 'D1', 'A9', 'A0', '3B'])('απορρίπτει το %p', (bad) => {
    // `D1` και `A9` είναι **εκτός πλέγματος**: συντακτικά έγκυρα, σημασιολογικά ανύπαρκτα.
    expect(parseTableCellReference(model, bad)).toBeNull();
  });
});

describe('υποδιαιρέσεις ζωνών δείκτη', () => {
  const columns: TableColumnLayout[] = [
    { id: 'c1', xMm: 0, widthMm: 20 },
    { id: 'c2', xMm: 20, widthMm: 30 },
  ];
  const rows: TableRowLayout[] = [
    { id: 'r1', yMm: 0, heightMm: 10 },
    { id: 'r2', yMm: 10, heightMm: 8 },
    { id: 'r3', yMm: 18, heightMm: 8 },
  ];

  it('τα γράμματα ακολουθούν τα ΠΡΑΓΜΑΤΙΚΑ πλάτη στηλών', () => {
    expect(tableColumnTicks(columns, 'c2')).toEqual([
      { label: 'A', startMm: 0, sizeMm: 20, active: false },
      { label: 'B', startMm: 20, sizeMm: 30, active: true },
    ]);
  });

  it('το ορατό παράθυρο κόβει ΠΟΣΕΣ γραμμές, όχι ΠΩΣ αριθμούνται', () => {
    // Ο ADR-735 απαγορεύει δουλειά ανάλογη του zoom· ο αριθμός όμως μένει ο απόλυτος —
    // η γραμμή 3 λέγεται «3» και όταν είναι η πρώτη ορατή.
    expect(tableRowTicks(rows, 'r3', 2, 3)).toEqual([
      { label: '3', startMm: 18, sizeMm: 8, active: true },
    ]);
  });

  it('παράθυρο εκτός ορίων δεν ρίχνει και δεν εφευρίσκει γραμμές', () => {
    expect(tableRowTicks(rows, 'r1', -5, 99)).toHaveLength(3);
  });
});
