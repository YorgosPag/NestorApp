/**
 * 🔴 ADR-739 §69 — **ΤΟ `2R x 2C` ΤΟΥ ΠΛΑΙΣΙΟΥ ΟΝΟΜΑΤΟΣ**, ως εκτελέσιμη προδιαγραφή.
 *
 * Το `tableSelectionSize` είναι σύνθεση δύο υπαρχόντων, και ολόκληρη η αξία του είναι η
 * **σειρά**: κούμπωμα **πριν** τη μέτρηση. Η αντίστροφη σειρά περνά κάθε test «πόσο κάνει
 * 2-1+1;» και **αποτυγχάνει μόνο πάνω σε συγχώνευση** — δηλαδή ακριβώς εκεί που ο αριθμός
 * θα διαφωνούσε με τα φωτισμένα κελιά της οθόνης.
 *
 * Γι' αυτό ο πίνακας εδώ φέρει τη **γραμμή τίτλου των αληθινών πινάκων της σκηνής**
 * (`r0` × τρεις στήλες), όπως και το `table-cell-range.test.ts`: το σφάλμα που φυλάμε δεν
 * είναι υποθετικό — είναι το σχήμα δεδομένων που ήδη υπάρχει σε κάθε σχέδιο.
 */

import { tableSelectionSize } from '../table-cell-range';
import { createTableModel } from '../table-model-helpers';
import type {
  CellSpan,
  TableColumn,
  TableColumnId,
  TableModel,
  TableRow,
  TableRowId,
} from '../../../types/table';

const COLUMNS: TableColumn[] = ['c0', 'c1', 'c2', 'c3'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));

const ROWS: TableRow[] = ['r0', 'r1', 'r2', 'r3'].map((id, i) => ({
  id,
  rowClass: i === 0 ? 'title' : 'data',
  heightMm: 8,
}));

function modelWith(merges: CellSpan[] = []): TableModel {
  return createTableModel({ columns: COLUMNS, rows: ROWS, merges });
}

/** Η **αληθινή** γραμμή τίτλου των πινάκων της σκηνής: `r0` × τρεις στήλες. */
const TITLE_MERGE: CellSpan = { anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 3 };

const ref = (rowId: string, colId: string) => ({
  rowId: rowId as TableRowId,
  colId: colId as TableColumnId,
});

describe('tableSelectionSize — ο αριθμός που διαβάζει ο άνθρωπος όσο σέρνει', () => {
  it('σύρση δύο επί δύο δίνει 2 × 2', () => {
    expect(
      tableSelectionSize(modelWith(), { from: ref('r1', 'c1'), to: ref('r2', 'c2'), kind: 'range' }),
    ).toEqual({ rows: 2, columns: 2 });
  });

  it('το πάτημα πριν κουνηθεί το χέρι δίνει 1 × 1 — το `1R x 1C` του Excel', () => {
    expect(
      tableSelectionSize(modelWith(), { from: ref('r1', 'c1'), to: ref('r1', 'c1'), kind: 'range' }),
    ).toEqual({ rows: 1, columns: 1 });
  });

  it('🔴 η ΦΟΡΑ της σύρσης δεν μετράει: κάτω-δεξιά → πάνω-αριστερά δίνει τον ΙΔΙΟ αριθμό', () => {
    const model = modelWith();
    const forward = tableSelectionSize(model, {
      from: ref('r1', 'c1'), to: ref('r3', 'c3'), kind: 'range',
    });
    const backward = tableSelectionSize(model, {
      from: ref('r3', 'c3'), to: ref('r1', 'c1'), kind: 'range',
    });
    expect(forward).toEqual({ rows: 3, columns: 3 });
    expect(backward).toEqual(forward);
  });

  it('🔴 ΤΟ ΚΛΕΙΔΙ: η σύρση που ακουμπά συγχώνευση μετρά τα κελιά που ΦΩΤΙΖΟΝΤΑΙ, όχι όσα άγγιξε το χέρι', () => {
    // Το χέρι πήγε ως τη στήλη `c0` της γραμμής τίτλου· η συγχώνευση απλώνεται ως το `c2`,
    // άρα η επιλογή **κουμπώνει** και φωτίζει τρεις στήλες. Χωρίς το κούμπωμα πριν τη
    // μέτρηση, το πλαίσιο ονόματος θα έγραφε `1R x 1C` πάνω σε τρία μαρκαρισμένα κελιά.
    expect(
      tableSelectionSize(modelWith([TITLE_MERGE]), {
        from: ref('r0', 'c0'), to: ref('r0', 'c0'), kind: 'range',
      }),
    ).toEqual({ rows: 1, columns: 3 });
  });

  it('🔴 η επιλογή ΑΞΟΝΑ δεν κουμπώνει — η στήλη μένει μία, όπως τη ζωγραφίζει η οθόνη', () => {
    // §27.15: το κούμπωμα εφαρμόζεται **μόνο** σε `kind: 'range'`. Ένα κλικ στο γράμμα `A`
    // πάνω σε πίνακα με συγχωνευμένο τίτλο δεν επιτρέπεται να μαρκάρει τρεις στήλες — και
    // το πλαίσιο ονόματος οφείλει να λέει ακριβώς ό,τι λέει το χρώμα.
    expect(
      tableSelectionSize(modelWith([TITLE_MERGE]), {
        from: ref('r0', 'c0'), to: ref('r3', 'c0'), kind: 'column',
      }),
    ).toEqual({ rows: 4, columns: 1 });
  });

  it('μπαγιάτικο άκρο (κελί που δεν υπάρχει πια) δίνει `null` — καμία μαντεψιά', () => {
    expect(
      tableSelectionSize(modelWith(), {
        from: ref('r1', 'c1'), to: ref('rX', 'c2'), kind: 'range',
      }),
    ).toBeNull();
  });
});
