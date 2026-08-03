/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 3) — **το σύνορο εισαγωγής** ως εκτελέσιμη προδιαγραφή.
 *
 * Κλειδώνει τρία πράγματα που είναι εύκολο να γραφτούν «σχεδόν σωστά»:
 *  - ο **άξονας** βγαίνει από το ποιο σύνορο είναι **πιο κοντά**, όχι από πλήκτρο (§36)·
 *  - η **ισοπαλία** έχει ρητό νικητή, αλλιώς ο προσανατολισμός ταλαντώνεται πάνω στη γωνία·
 *  - η γραμμή-Ι βγαίνει από το **ορθογώνιο προσγείωσης**, άρα δεν μπορεί να δείξει αλλού
 *    από το φάντασμα (§36.5).
 */

import { layoutTable } from '../table-layout';
import { createTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import {
  tableRangeInsertBoundaryAtFrame,
  tableRangeInsertCaretMm,
} from '../table-range-insert-boundary';
import type { TableLayout } from '../table-layout-types';
import type { TableStyle } from '../table-style';
import type { TableColumn, TableRow } from '../../../types/table';

const STANDARD = BUILTIN_TABLE_STYLES.find(
  (s): s is TableStyle => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
);
if (!STANDARD) throw new Error('missing preset: standard');

/** 3 στήλες × 20mm, 4 γραμμές × 10mm ⇒ σύνορα u: 0/20/40/60 · v: 0/10/20/30/40. */
const COLUMNS: TableColumn[] = ['c0', 'c1', 'c2'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));
const ROWS: TableRow[] = ['r0', 'r1', 'r2', 'r3'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 10,
}));

const LAYOUT: TableLayout = layoutTable(createTableModel({ columns: COLUMNS, rows: ROWS }), STANDARD);

const EMPTY_LAYOUT: TableLayout = {
  widthMm: 0,
  heightMm: 0,
  columns: [],
  rows: [],
  cells: [],
  borders: [],
};

describe('tableRangeInsertBoundaryAtFrame — ποιο σύνορο κρέμεται κάτω από το χέρι', () => {
  it('η διάταξη έχει τα σύνορα που υποθέτουν τα υπόλοιπα tests', () => {
    expect(LAYOUT.widthMm).toBe(60);
    expect(LAYOUT.heightMm).toBe(40);
    expect(LAYOUT.rows.map((r) => r.yMm)).toEqual([0, 10, 20, 30]);
    expect(LAYOUT.columns.map((c) => c.xMm)).toEqual([0, 20, 40]);
  });

  it('πάνω μισό γραμμής ⇒ ολίσθηση ΚΑΤΩ, στο σύνορο ΠΑΝΩ της', () => {
    // v = 12 ⇒ 2mm από το σύνορο 10· u = 5 ⇒ 5mm από το σύνορο 0. Νικά το οριζόντιο.
    expect(tableRangeInsertBoundaryAtFrame(LAYOUT, { u: 5, v: 12 })).toEqual({
      axis: 'down',
      line: 1,
    });
  });

  it('κάτω μισό γραμμής ⇒ το σύνορο ΚΑΤΩ της (δηλαδή η επόμενη θέση)', () => {
    expect(tableRangeInsertBoundaryAtFrame(LAYOUT, { u: 5, v: 18 })).toEqual({
      axis: 'down',
      line: 2,
    });
  });

  it('κοντά σε ΚΑΤΑΚΟΡΥΦΟ σύνορο ⇒ ολίσθηση ΔΕΞΙΑ', () => {
    // u = 19 ⇒ 1mm από το σύνορο 20· v = 15 ⇒ 5mm από τα σύνορα 10/20.
    expect(tableRangeInsertBoundaryAtFrame(LAYOUT, { u: 19, v: 15 })).toEqual({
      axis: 'right',
      line: 1,
    });
  });

  it('🔴 ΙΣΟΠΑΛΙΑ ΑΞΟΝΩΝ (ίδια απόσταση σε οριζόντιο και κατακόρυφο) ⇒ ΠΑΝΤΑ «down»', () => {
    // (5, 5): 5mm από το οριζόντιο σύνορο 0/10 **και** 5mm από το κατακόρυφο 0. Χωρίς ρητό
    // νικητή, ο άξονας θα κρινόταν από αριθμητικό σφάλμα σε κάθε καρέ και η γραμμή-Ι θα
    // «χτυπούσε» ανάμεσα σε οριζόντια και κατακόρυφη με **ακίνητο** χέρι.
    expect(tableRangeInsertBoundaryAtFrame(LAYOUT, { u: 5, v: 5 })?.axis).toBe('down');
  });

  it('ΙΣΟΠΑΛΙΑ ΜΕΣΑ ΣΤΟΝ ΑΞΟΝΑ (ακριβές μέσο γραμμής) ⇒ το ΕΠΟΜΕΝΟ σύνορο, σταθερά', () => {
    // Στο ακριβές μέσο, «πάνω» και «κάτω» απέχουν εξίσου. Η επιλογή είναι αδιάφορη ως προς
    // την ορθότητα και **καθοριστική** ως προς τη σταθερότητα: το πάνω μισό δίνει αυστηρά το
    // πάνω σύνορο, το υπόλοιπο το κάτω — καμία ζώνη όπου η απάντηση εξαρτάται από το ε.
    expect(tableRangeInsertBoundaryAtFrame(LAYOUT, { u: 5, v: 5 })?.line).toBe(1);
    expect(tableRangeInsertBoundaryAtFrame(LAYOUT, { u: 5, v: 4.9 })?.line).toBe(0);
  });

  it('το ΤΕΛΕΥΤΑΙΟ σύνορο είναι εκφράσιμο εδώ — το φιλτράρει το σχέδιο, όχι η γεωμετρία', () => {
    // Δείκτης `rows.length`: «μετά την τελευταία». Ένα φράγμα εδώ θα έλεγε «όχι» και σε
    // θέσεις που η μετάθεση δέχεται — το «χωράει;» ξέρει μόνο εκείνη (ξέρει το μέγεθος).
    expect(tableRangeInsertBoundaryAtFrame(LAYOUT, { u: 5, v: 38 })).toEqual({
      axis: 'down',
      line: 4,
    });
  });

  it('πίνακας χωρίς γραμμές/στήλες ⇒ κανένα σύνορο', () => {
    expect(tableRangeInsertBoundaryAtFrame(EMPTY_LAYOUT, { u: 0, v: 0 })).toBeNull();
  });
});

describe('tableRangeInsertCaretMm — η γραμμή-Ι', () => {
  const DESTINATION = { x: 20, y: 10, w: 40, h: 20 };

  it('«down» ⇒ ΟΡΙΖΟΝΤΙΟ τμήμα στην ΠΑΝΩ ακμή, με το πλάτος της περιοχής', () => {
    expect(tableRangeInsertCaretMm(DESTINATION, 'down')).toEqual({ x: 20, y: 10, w: 40, h: 0 });
  });

  it('«right» ⇒ ΚΑΤΑΚΟΡΥΦΟ τμήμα στην ΑΡΙΣΤΕΡΗ ακμή, με το ύψος της περιοχής', () => {
    expect(tableRangeInsertCaretMm(DESTINATION, 'right')).toEqual({ x: 20, y: 10, w: 0, h: 20 });
  });

  it('🔴 δεν έχει ΠΑΧΟΣ — αυτό ανήκει στα px οθόνης, όχι στα sheet-mm', () => {
    // Σε mm η μπάρα θα εξαφανιζόταν σε zoom-out και θα γινόταν πλάκα σε zoom-in. Ίδιος
    // κανόνας με το `lineWidthPx` κάθε άλλου δείκτη διεπαφής του πίνακα.
    const caret = tableRangeInsertCaretMm(DESTINATION, 'down');
    expect(caret.h).toBe(0);
    expect(tableRangeInsertCaretMm(DESTINATION, 'right').w).toBe(0);
  });
});
