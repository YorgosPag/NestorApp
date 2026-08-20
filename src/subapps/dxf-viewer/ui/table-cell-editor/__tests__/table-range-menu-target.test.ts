/**
 * ADR-750 Φάση 4, απόφαση **Α22** — **τι βάφει το δεξί κλικ μέσα στο πλέγμα**.
 *
 * Ο κανόνας σε μία γραμμή: *το κελί, εκτός αν ανήκει στην επιλογή — τότε όλη η επιλογή.*
 *
 * Δοκιμάζεται ως **καθαρή συνάρτηση**, γι' αυτό ακριβώς η επιλογή περνά ως όρισμα και δεν
 * διαβάζεται από το store μέσα της.
 *
 * ## 🔴 ADR-739 §68 (20/08) — ΤΟ ΔΕΞΙ ΚΛΙΚ ΜΕΤΑΚΙΝΕΙ ΠΛΕΟΝ ΤΗΝ ΕΠΙΛΟΓΗ
 * Εδώ έγραφε «*η σημασιολογία του Excel **χωρίς την παρενέργειά του***» — το Excel συμπεραίνει
 * τον στόχο **μετακινώντας** την επιλογή, ενώ εδώ το δεξί δεν την άγγιζε ποτέ (§27.14). Ο
 * ιδιοκτήτης ζήτησε ρητά **full parity**, και η ίδια απόφαση είχε ήδη παρθεί για τη γωνία (§43).
 *
 * 🔑 **Ο κανόνας Α22 δεν χαλάρωσε ούτε άλλαξε γραμμή**: η μετακίνηση γίνεται στο `mousedown`
 * ({@link tableContextMenuMovesSelection} + `table-context-menu-selection.ts`), δηλαδή **πριν**
 * ρωτηθεί ο Α22. Όταν ρωτηθεί, το κελί του δεξιού κλικ **είναι** ήδη η επιλογή, οπότε απαντά
 * «η επιλογή» από μόνος του — έπαψε να είναι ο μηχανισμός και έμεινε **φρουρός**.
 *
 * Οι δύο συναρτήσεις ζουν δίπλα-δίπλα και **μοιράζονται τον ίδιο resolver**, που είναι όλο το
 * νόημα: δεν επιτρέπεται να διαφωνήσουν για το ποια κελιά είναι «μέσα».
 */

import { resolveTableModel } from '../../../bim/table/table-model-helpers';
// 🔴 ADR-739 §61 — οι δύο καθαρές συναρτήσεις **εξήχθησαν** από το `use-table-range-menu.ts`
// (470/500, N.7.1) στο ομώνυμο module. Το όνομα αυτής της σουίτας το είχε ήδη προβλέψει.
import {
  rangeLabel,
  tableBorderTargetBounds,
  tableContextMenuMovesSelection,
} from '../table-range-menu-target';
import type { TableSelectionSpan } from '../../../bim/table/table-cell-range';
import type { CellSpan, PersistedTableModel, TableColumn, TableRow } from '../../../types/table';

function model(rowCount: number, colCount: number, merges: readonly CellSpan[] = []) {
  const columns: TableColumn[] = Array.from({ length: colCount }, (_, c) => ({
    id: `c${c + 1}`,
    sizing: { kind: 'fixed', widthMm: 10 },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: `r${r + 1}`,
    rowClass: 'data',
    heightMm: 6,
  }));
  const persisted: PersistedTableModel = { columns, rows, cells: [], merges };
  return resolveTableModel(persisted);
}

const cell = (row: number, col: number) => ({ rowId: `r${row}`, colId: `c${col}` });

/** Επιλογή περιοχής B2:D4 σε δείκτες `{firstRow:1,lastRow:3,firstCol:1,lastCol:3}`. */
const B2_D4: TableSelectionSpan = { from: cell(2, 2), to: cell(4, 4), kind: 'range' };

describe('Α22 — ο στόχος του δεξιού κλικ σε κελιά', () => {
  it('κλικ ΜΕΣΑ στην επιλογή ⇒ στόχος ΟΛΗ η επιλογή', () => {
    expect(tableBorderTargetBounds(model(6, 6), cell(3, 3), B2_D4)).toEqual({
      firstRow: 1, lastRow: 3, firstCol: 1, lastCol: 3,
    });
  });

  it('🔴 κλικ ΕΞΩ από την επιλογή ⇒ στόχος ΜΟΝΟ το κελί, όχι η μακρινή επιλογή', () => {
    // Η εναλλακτική «πάντα η τρέχουσα επιλογή» θα έβαφε το B2:D4 ενώ ο δείκτης είναι στο E5 —
    // αλλαγή μακριά από το σημείο που κοιτά ο χρήστης, χωρίς καμία ένδειξη.
    expect(tableBorderTargetBounds(model(6, 6), cell(5, 5), B2_D4)).toEqual({
      firstRow: 4, lastRow: 4, firstCol: 4, lastCol: 4,
    });
  });

  it('καμία επιλογή ⇒ στόχος το κελί — η κύρια περίπτωση χρήσης', () => {
    expect(tableBorderTargetBounds(model(6, 6), cell(2, 3), null)).toEqual({
      firstRow: 1, lastRow: 1, firstCol: 2, lastCol: 2,
    });
  });

  it('κλικ σε γωνία της επιλογής μετράει ως ΜΕΣΑ (κλειστό διάστημα)', () => {
    expect(tableBorderTargetBounds(model(6, 6), cell(2, 2), B2_D4)).toEqual({
      firstRow: 1, lastRow: 3, firstCol: 1, lastCol: 3,
    });
    expect(tableBorderTargetBounds(model(6, 6), cell(4, 4), B2_D4)).toEqual({
      firstRow: 1, lastRow: 3, firstCol: 1, lastCol: 3,
    });
  });

  it('επιλογή ΟΛΟΚΛΗΡΗΣ στήλης: κλικ μέσα της δίνει τη στήλη ολόκληρη', () => {
    const column: TableSelectionSpan = { from: cell(1, 2), to: cell(6, 2), kind: 'column' };
    expect(tableBorderTargetBounds(model(6, 6), cell(4, 2), column)).toEqual({
      firstRow: 0, lastRow: 5, firstCol: 1, lastCol: 1,
    });
  });

  it('🔑 συγχωνευμένο κελί: ο στόχος κουμπώνει σε ΟΛΗ τη συγχώνευση, δωρεάν', () => {
    // Δώρο από τον ΕΝΑ δρόμο ερμηνείας: το μεμονωμένο κελί περνά με είδος `'range'`, άρα
    // κληρονομεί το κούμπωμα του ADR-739 §26.5 χωρίς μία γραμμή ειδικής λογικής.
    const merges: readonly CellSpan[] = [
      { anchorRowId: 'r2', anchorColId: 'c2', rowSpan: 2, colSpan: 3 },
    ];
    expect(tableBorderTargetBounds(model(6, 6, merges), cell(2, 2), null)).toEqual({
      firstRow: 1, lastRow: 2, firstCol: 1, lastCol: 3,
    });
  });

  it('μπαγιάτικο κελί (σβησμένη γραμμή μετά από undo) ⇒ `null`, ποτέ μαντεψιά', () => {
    expect(tableBorderTargetBounds(model(3, 3), cell(9, 1), null)).toBeNull();
  });
});

/**
 * 🔴 ADR-739 §68 — **ΠΡΕΠΕΙ ΤΟ ΔΕΞΙ ΚΛΙΚ ΝΑ ΜΕΤΑΚΙΝΗΣΕΙ ΤΗΝ ΕΠΙΛΟΓΗ;**
 *
 * Ο κανόνας του Excel σε μία γραμμή: *μετακίνησε, εκτός αν το κελί είναι ήδη στόχος.* Και
 * «ήδη στόχος» είναι **δύο** πεδία εδώ (επιλογή **ή** ενεργό κελί), ενώ στο Excel είναι ένα —
 * γιατί το §27.15 κράτησε ρητά τη διάκριση «καμία επιλογή ≠ επιλογή 1×1».
 *
 * ⚠️ Η ζωντανή αλυσίδα (`table-context-menu-selection.test.tsx`) δοκιμάζει τις ίδιες
 * περιπτώσεις **με πραγματικό πάτημα**· εδώ μπαίνουν αυτές που εκείνη δομικά δεν φτάνει: η
 * **συγχώνευση** (ο προεπιλεγμένος πίνακας δεν έχει καμία) και το **μπαγιάτικο κελί**.
 */
describe('🔴 §68 — πότε το δεξί κλικ μετακινεί την επιλογή', () => {
  const M = model(6, 6);

  it('καμία επιλογή, κλικ σε ΑΛΛΟ κελί από το ενεργό ⇒ μετακινεί', () => {
    expect(tableContextMenuMovesSelection(M, cell(2, 2), cell(1, 1), null)).toBe(true);
  });

  /**
   * 🔴 Η περίπτωση που κάνει το κριτήριο να ρωτά **δύο** πεδία και όχι μόνο την επιλογή.
   * Χωρίς αυτό το σκέλος θα απαντούσε `true` και ο δρομέας θα ξαναγραφόταν στο **ίδιο** κελί —
   * αβλαβές στα μάτια, αλλά το `tableCursorAt` γεννά **νέα στήλη αγκύρωσης**: θα άλλαζε σιωπηλά
   * πού επιστρέφει το επόμενο `Enter`.
   */
  it('🔴 καμία επιλογή, κλικ ΠΑΝΩ στο ενεργό κελί ⇒ ΔΕΝ μετακινεί', () => {
    expect(tableContextMenuMovesSelection(M, cell(3, 3), cell(3, 3), null)).toBe(false);
  });

  it('επιλογή B2:D4, κλικ ΜΕΣΑ της ⇒ ΔΕΝ μετακινεί (η επιλογή επιβιώνει, Excel)', () => {
    expect(tableContextMenuMovesSelection(M, cell(3, 3), cell(2, 2), B2_D4)).toBe(false);
  });

  it('επιλογή B2:D4, κλικ ΕΞΩ της ⇒ μετακινεί', () => {
    expect(tableContextMenuMovesSelection(M, cell(5, 5), cell(2, 2), B2_D4)).toBe(true);
  });

  /**
   * 🔴 Η επιλογή **υπερισχύει** του ενεργού κελιού όταν υπάρχει: το ενεργό είναι το `B2` και το
   * κλικ πέφτει στο `D4`, δηλαδή αλλού — αλλά και τα δύο είναι μέσα στο `B2:D4`. Αν το κριτήριο
   * ρωτούσε **μόνο** το ενεργό κελί, θα διέλυε την επιλογή με δεξί κλικ μέσα της.
   */
  it('🔴 επιλογή B2:D4, ενεργό B2, κλικ στο D4 ⇒ ΔΕΝ μετακινεί', () => {
    expect(tableContextMenuMovesSelection(M, cell(4, 4), cell(2, 2), B2_D4)).toBe(false);
  });

  /**
   * 🔑 **Το κούμπωμα σε συγχώνευση έρχεται δωρεάν, και στα δύο σκέλη** — επειδή περνούν από τον
   * ΕΝΑ resolver. Ενεργό το `B2` (η άγκυρα μιας συγχώνευσης `B2:D3`), δεξί κλικ στο `D3`: είναι
   * **το ίδιο κελί**, όσο κι αν οι δείκτες διαφέρουν. Ένα κριτήριο που συνέκρινε ταυτότητες θα
   * απαντούσε `true` και θα ξαναέγραφε τον δρομέα πάνω στον εαυτό του.
   */
  it('🔴 συγχώνευση: κλικ σε καλυμμένο κελί της ίδιας συγχώνευσης ⇒ ΔΕΝ μετακινεί', () => {
    const merges: readonly CellSpan[] = [
      { anchorRowId: 'r2', anchorColId: 'c2', rowSpan: 2, colSpan: 3 },
    ];
    const merged = model(6, 6, merges);
    expect(tableContextMenuMovesSelection(merged, cell(3, 4), cell(2, 2), null)).toBe(false);
  });

  it('συγχώνευση: κλικ ΕΞΩ από αυτήν ⇒ μετακινεί κανονικά', () => {
    const merges: readonly CellSpan[] = [
      { anchorRowId: 'r2', anchorColId: 'c2', rowSpan: 2, colSpan: 3 },
    ];
    expect(tableContextMenuMovesSelection(model(6, 6, merges), cell(5, 5), cell(2, 2), null)).toBe(true);
  });

  it('μπαγιάτικο κελί (undo ανάμεσα στο πάτημα και την ερώτηση) ⇒ `false`, ποτέ μαντεψιά', () => {
    expect(tableContextMenuMovesSelection(model(3, 3), cell(9, 1), cell(1, 1), null)).toBe(false);
  });
});

describe('η ετικέτα μιλά τη γλώσσα του χρήστη (Α5)', () => {
  it('ένα κελί ⇒ σκέτο όνομα· περιοχή ⇒ δύο γωνίες', () => {
    expect(rangeLabel({ firstRow: 2, lastRow: 2, firstCol: 2, lastCol: 2 })).toBe('C3');
    expect(rangeLabel({ firstRow: 1, lastRow: 3, firstCol: 1, lastCol: 3 })).toBe('B2:D4');
  });

  it('η αρίθμηση αρχίζει από το 1 και τα γράμματα από το A — όπως οι ζώνες δείκτη', () => {
    expect(rangeLabel({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 })).toBe('A1');
  });

  it('ποτέ δεν λέει τη λέξη «ακμή» — ούτε σε περιοχή μιας γραμμής', () => {
    expect(rangeLabel({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 4 })).toBe('A1:E1');
  });
});
