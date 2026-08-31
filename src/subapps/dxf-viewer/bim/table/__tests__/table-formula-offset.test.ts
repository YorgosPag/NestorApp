/**
 * 🔴 ADR-754 **Γ1** — **η αντιγραφή τύπου ολισθαίνει τις σχετικές αναφορές του**.
 *
 * Ο έλεγχος γράφεται σε **κείμενο** (`=B2*C2` ⇒ `=B3*C3`) και όχι σε δέντρα, επίτηδες: αυτό
 * βλέπει ο χρήστης στη γραμμή τύπων, και η διαδρομή `κείμενο → δέντρο → μετατόπιση → κείμενο`
 * περνά ταυτόχρονα από τον αναλυτή, τον εκτυπωτή και τις σημαίες `$`. Ένα test πάνω σε σκέτους
 * κόμβους θα ήταν πράσινο ακόμη κι αν ο εκτυπωτής ξεχνούσε να γράψει τα δολάρια.
 *
 * ⚠️ **Πλέγμα 5×5, όπως κάθε test αυτού του ADR** (§1.2): σε 3×3 κάθε μετατόπιση προς `E`/`5`
 * θα έβγαινε `#REF!` επειδή η στήλη δεν υπάρχει — δηλαδή πράσινα που δοκιμάζουν το λάθος
 * πράγμα.
 */

import { createTableModel } from '../table-model-helpers';
import type { TableColumn, TableModel, TableRow } from '../../../types/table';
import { parseTableFormula } from '../formula/table-formula-parse';
import { CANONICAL_FORMULA_GRAMMAR } from '../../../types/table-formula-grammar';
import { printTableFormula } from '../formula/table-formula-print';
import {
  offsetTableFormula,
  tableFormulaOffsetBetween,
} from '../formula/table-formula-offset';
import { bookOf } from './formula-book-fixture';

const COLUMNS: TableColumn[] = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 8,
}));

const MODEL: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS, cells: [] });

/**
 * `'=A1'` μετατοπισμένο κατά (γραμμές, στήλες), ξαναγραμμένο ως κείμενο.
 *
 * 🔑 **Ρητά η κανονική γραμματική** (ADR-761), για τον ίδιο λόγο με το
 * `table-formula-eval.test.ts`: εδώ ελέγχεται η **μετατόπιση αναφορών**, όχι η γραφή. Ίδια
 * γραμματική σε ανάλυση **και** εκτύπωση — αλλιώς το test θα μετρούσε τη διαφορά τους.
 */
function shift(text: string, rows: number, columns: number): string {
  const formula = parseTableFormula(bookOf(MODEL), text, CANONICAL_FORMULA_GRAMMAR);
  if (formula === null) throw new Error(`Δεν αναλύθηκε: ${text}`);
  return printTableFormula(bookOf(MODEL),
    offsetTableFormula(bookOf(MODEL), formula, { rows, columns }),
    CANONICAL_FORMULA_GRAMMAR,
  );
}

describe('η σχετική αναφορά ΑΚΟΛΟΥΘΕΙ', () => {
  it.each([
    ['=A1', 1, 0, '=A2', 'μία γραμμή κάτω'],
    ['=A1', 0, 1, '=B1', 'μία στήλη δεξιά'],
    ['=A1', 2, 2, '=C3', 'διαγώνια'],
    ['=C3', -1, -1, '=B2', 'προς τα πίσω'],
    ['=B2*C2', 1, 0, '=B3*C3', '🔑 η κλασική συμπλήρωση προς τα κάτω'],
    ['=SUM(A1:A3)', 0, 1, '=SUM(B1:B3)', 'εύρος — ΚΑΙ ΤΑ ΔΥΟ άκρα'],
    ['=SUM(A1:A3)+B1', 1, 0, '=SUM(A2:A4)+B2', 'εύρος και σκέτη μαζί'],
    ['=(A1+B1)*2', 1, 0, '=(A2+B2)*2', 'μέσα σε ρητή παρένθεση'],
    ['=-A1', 1, 0, '=-A2', 'κάτω από πρόσημο'],
    ['=IF(A1>0,B1,C1)', 1, 0, '=IF(A2>0,B2,C2)', 'και τα τρία ορίσματα κλήσης'],
  ])('«%s» + (%i,%i) ⇒ «%s» (%s)', (text, rows, columns, expected) => {
    expect(shift(text, rows, columns)).toBe(expected);
  });
});

/**
 * 🔑 **Εδώ ζει ολόκληρος ο λόγος ύπαρξης του `$`.** Χωρίς αυτό, η συμπλήρωση θα μετατόπιζε
 * **πάντα**, και ο χρήστης δεν θα είχε κανέναν τρόπο να πει «αυτό το κελί όχι».
 */
describe('🔴 η ΚΛΕΙΔΩΜΕΝΗ αναφορά ΜΕΝΕΙ', () => {
  it.each([
    ['=$A$1', 1, 1, '=$A$1', 'και οι δύο άξονες — ακίνητη προς κάθε κατεύθυνση'],
    ['=A$1', 1, 1, '=B$1', 'κλειδωμένη ΓΡΑΜΜΗ: η στήλη ακολουθεί, η γραμμή όχι'],
    ['=$A1', 1, 1, '=$A2', 'κλειδωμένη ΣΤΗΛΗ: η γραμμή ακολουθεί, η στήλη όχι'],
    ['=A1*$C$1', 1, 0, '=A2*$C$1', '🔑 το κλασικό «επί σταθερό συντελεστή»'],
  ])('«%s» + (%i,%i) ⇒ «%s» (%s)', (text, rows, columns, expected) => {
    expect(shift(text, rows, columns)).toBe(expected);
  });

  /**
   * 🔑 Το **τρέχον άθροισμα** του Excel: η αρχή καρφωμένη, το τέλος ακολουθεί. Είναι ο λόγος
   * που οι σημαίες ζουν στο **άκρο** του εύρους και όχι στο εύρος.
   */
  it('🔑 «=SUM(A$1:A2)» κατεβαίνει ⇒ «=SUM(A$1:A3)» — τρέχον άθροισμα', () => {
    expect(shift('=SUM(A$1:A2)', 1, 0)).toBe('=SUM(A$1:A3)');
  });

  it('τα δύο άκρα κρατούν ΤΙΣ ΔΙΚΕΣ ΤΟΥΣ σημαίες', () => {
    expect(shift('=SUM($A$1:B2)', 1, 1)).toBe('=SUM($A$1:C3)');
  });
});

/**
 * Το Excel γράφει `#REF!` και όχι «κόλλα το στην άκρη». Ένας τύπος που **μοιάζει σωστός** και
 * αθροίζει λάθος κελί είναι το είδος σφάλματος που ο ADR-720 ονομάζει «λάθος τιμής σε
 * παραδοτέο» — πάντα ακριβότερο από ένα ορατό σφάλμα.
 */
describe('🔴 εκτός πλέγματος ⇒ #REF!, ποτέ σιωπηλή στάθμευση', () => {
  it.each([
    ['=A1', -1, 0, 'πάνω από την πρώτη γραμμή'],
    ['=A1', 0, -1, 'αριστερά από την πρώτη στήλη'],
    ['=E5', 1, 0, 'κάτω από την τελευταία γραμμή'],
    ['=E5', 0, 1, 'δεξιά από την τελευταία στήλη'],
    ['=SUM(A1:A3)', -1, 0, 'εύρος με το ένα άκρο έξω ⇒ ΟΛΟΚΛΗΡΟ #REF!'],
  ])('«%s» + (%i,%i) ⇒ #REF! (%s)', (text, rows, columns) => {
    expect(shift(text, rows, columns)).toContain('#REF!');
  });

  it('🔑 η ΚΛΕΙΔΩΜΕΝΗ δεν βγαίνει ποτέ έξω — «=$A$1» με −1 μένει «=$A$1»', () => {
    expect(shift('=$A$1', -1, 0)).toBe('=$A$1');
  });

  it('ο μισός τύπος επιβιώνει: «=A1+E5» + (1,0) ⇒ «=A2+#REF!»', () => {
    expect(shift('=A1+E5', 1, 0)).toBe('=A2+#REF!');
  });
});

/**
 * 🔴 Η **εγγύηση ταυτότητας** δεν είναι βελτιστοποίηση: η αλυσίδα `PersistedTableModel →
 * RESOLVED_MODEL_CACHE → LAYOUT_CACHE` κλειδώνει σε ταυτότητα αντικειμένου, και νέο αντικείμενο
 * χωρίς λόγο σημαίνει ακυρωμένη μνήμη **και** βήμα undo που δεν αναιρεί τίποτα.
 */
describe('🔴 ταυτότητα by-reference', () => {
  it('μηδενική μετατόπιση ⇒ ΤΟ ΙΔΙΟ αντικείμενο', () => {
    const formula = parseTableFormula(bookOf(MODEL), '=A1+B2');
    expect(offsetTableFormula(bookOf(MODEL), formula!, { rows: 0, columns: 0 })).toBe(formula);
  });

  it('🔑 τύπος με ΜΟΝΟ κλειδωμένες αναφορές ⇒ ΤΟ ΙΔΙΟ αντικείμενο, παρότι η μετατόπιση ≠ 0', () => {
    const formula = parseTableFormula(bookOf(MODEL), '=$A$1+$B$2*3');
    expect(offsetTableFormula(bookOf(MODEL), formula!, { rows: 2, columns: 1 })).toBe(formula);
  });

  it('τύπος χωρίς καμία αναφορά ⇒ ΤΟ ΙΔΙΟ αντικείμενο', () => {
    const formula = parseTableFormula(bookOf(MODEL), '=1+2*3');
    expect(offsetTableFormula(bookOf(MODEL), formula!, { rows: 1, columns: 1 })).toBe(formula);
  });

  it('μία σχετική αναφορά αρκεί για νέο αντικείμενο', () => {
    const formula = parseTableFormula(bookOf(MODEL), '=$A$1+B2');
    expect(offsetTableFormula(bookOf(MODEL), formula!, { rows: 1, columns: 0 })).not.toBe(formula);
  });
});

describe('η μετατόπιση ανάμεσα σε δύο κελιά', () => {
  it('μετριέται σε ΔΕΙΚΤΕΣ, με τη φορά που διαβάζει ο χρήστης', () => {
    expect(
      tableFormulaOffsetBetween(MODEL, { rowId: 'r1', colId: 'c1' }, { rowId: 'r3', colId: 'c2' }),
    ).toEqual({ rows: 2, columns: 1 });
  });

  it('προς τα πίσω δίνει αρνητικά', () => {
    expect(
      tableFormulaOffsetBetween(MODEL, { rowId: 'r3', colId: 'c3' }, { rowId: 'r1', colId: 'c1' }),
    ).toEqual({ rows: -2, columns: -2 });
  });

  it('μπαγιάτικη ταυτότητα ⇒ null — ο καλών δεν μαντεύει', () => {
    expect(
      tableFormulaOffsetBetween(MODEL, { rowId: 'rX', colId: 'c1' }, { rowId: 'r1', colId: 'c1' }),
    ).toBeNull();
  });
});
