/**
 * 🔴 ADR-739 §58 Γ2 — **ΤΟ ΞΕΧΕΙΛΙΣΜΑ ΩΣ ΠΡΑΞΗ ΜΟΡΦΟΠΟΙΗΣΗΣ**: η ανάγνωση και η εγγραφή που
 * τροφοδοτούν **και τις δύο** επιφάνειες (κορδέλα + mini toolbar).
 *
 * Ξεχωριστό αρχείο από το `table-format-scope.test.ts` επειδή ρωτά κάτι που **κανένα** άλλο
 * suite δεν μπορεί να ρωτήσει: το `overflow` δεν είναι πεδίο του `TableCellStyle`, άρα δεν
 * περνά ούτε από το `resolveTableFormatState` ούτε από το `setTableFormatField` — τα δύο
 * σημεία που καλύπτει εκείνο.
 *
 * ## 🔴 Οι τρεις ανεξάρτητες αποτυχίες
 * 1. **Η ανάγνωση ισοπεδώνει το «ανάμεικτο»** ⇒ και τα δύο κουμπιά δείχνουν πατημένα σε
 *    επιλογή όπου τα μισά κελιά αναδιπλώνονται και τα μισά όχι.
 * 2. **Η εγγραφή πάει σε ΑΞΟΝΑ** ⇒ το `TableColumn.overflow` δεν σβήνεται από την «Επαναφορά
 *    μορφοποίησης», και η στήλη χάνει από κάθε κελί που δηλώνει δικό του ξεχείλισμα.
 * 3. **Η αμοιβαία αποκλειστικότητα ξεφεύγει** ⇒ κελί που είναι ταυτόχρονα «αναδιπλωμένο» και
 *    «σμικρυμένο», κατάσταση που δεν σημαίνει τίποτα.
 *
 * @see ../table-format-scope.ts · ../table-overflow-ops.ts
 */

import {
  clearTableFormatScope,
  resolveTableFormatOverflow,
  setTableFormatOverflow,
  tableFormatScopeOf,
  type TableFormatScope,
} from '../table-format-scope';
import { nextTableOverflow } from '../table-overflow-ops';
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { PersistedTableModel } from '../../../types/table';

const STYLE = hierarchicalTableStyle();

/** Δύο στήλες × τρεις γραμμές· `c1` δηλώνει **προεπιλογή στήλης** `'wrap'`. */
function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left', overflow: 'wrap' },
    ],
    rows: [
      { id: 'r0', rowClass: 'header' },
      { id: 'r1', rowClass: 'data' },
      { id: 'r2', rowClass: 'data' },
    ],
    cells: [],
    merges: [],
  };
}

const range = (
  firstRow: number, lastRow: number, firstCol: number, lastCol: number,
): TableFormatScope => ({
  kind: 'range',
  bounds: { firstRow, lastRow, firstCol, lastCol },
});

const CELL_R1C0 = range(1, 1, 0, 0);
const CELL_R1C1 = range(1, 1, 1, 1);
/** Και οι δύο στήλες της γραμμής 1 — το ένα κελί κληρονομεί `'wrap'`, το άλλο όχι. */
const ROW1_BOTH = range(1, 1, 0, 1);

/** Η ρητή παράκαμψη ενός κελιού, όπως γράφτηκε στον αραιό χάρτη. */
function overrideAt(m: PersistedTableModel, rowId: string, colId: string) {
  return m.cells.find(([r, c]) => r === rowId && c === colId)?.[2].styleOverride;
}

// ──────────────────────────────────────────────────────────────────────────────

describe('resolveTableFormatOverflow — τι ισχύει στον στόχο', () => {
  it('κελί χωρίς παράκαμψη και στήλη χωρίς προεπιλογή ⇒ `clip`', () => {
    expect(resolveTableFormatOverflow(model(), STYLE, CELL_R1C0)).toBe('clip');
  });

  /**
   * 🔴 Η **προεπιλογή στήλης** μετρά — και είναι ο λόγος που η ανάγνωση περνά από τον
   * `resolveCellOverflow` αντί να κοιτά μόνο το `styleOverride` του κελιού.
   *
   * Χωρίς αυτό, το κουμπί θα έλεγε «δεν αναδιπλώνεται» για κελί που **αναδιπλώνεται στην
   * οθόνη** — ψέμα για ό,τι βλέπει ο χρήστης, το ίδιο σχήμα που τεκμηριώνει το
   * `resolveCellsFormat` για τα έντονα.
   */
  it('🔴 κελί που ΚΛΗΡΟΝΟΜΕΙ `wrap` από τη στήλη ⇒ `wrap`', () => {
    expect(resolveTableFormatOverflow(model(), STYLE, CELL_R1C1)).toBe('wrap');
  });

  it('🔴 τα κελιά διαφωνούν ⇒ `null` (ανάμεικτο), ποτέ η τιμή του πρώτου', () => {
    expect(resolveTableFormatOverflow(model(), STYLE, ROW1_BOTH)).toBeNull();
  });

  it('στόχος εκτός πλέγματος ⇒ `null`, ποτέ σφάλμα', () => {
    expect(resolveTableFormatOverflow(model(), STYLE, range(9, 9, 9, 9))).toBeNull();
  });

  /**
   * Στόχος **άξονας**: η ερώτηση είναι κελιών, και η μετάφραση σε ορθογώνιο γίνεται από τον
   * ΕΝΑ ορισμό της «ολόκληρης στήλης» (§27.16 Ε2) — ίδια διαδρομή με τη μορφή αριθμού.
   */
  it('στόχος-ΑΞΟΝΑΣ (στήλη με προεπιλογή) ⇒ διαβάζεται σαν τα κελιά της', () => {
    const scope = tableFormatScopeOf(model(), { rowId: 'r1', colId: 'c1' }, {
      from: { rowId: 'r0', colId: 'c1' },
      to: { rowId: 'r2', colId: 'c1' },
      kind: 'column',
    });
    expect(scope).not.toBeNull();
    expect(resolveTableFormatOverflow(model(), STYLE, scope as TableFormatScope)).toBe('wrap');
  });
});

describe('setTableFormatOverflow — ΠΑΝΤΑ σε επίπεδο κελιού', () => {
  it('γράφει ρητή τιμή στο κελί', () => {
    const next = setTableFormatOverflow(model(), CELL_R1C0, 'wrap');
    expect(overrideAt(next, 'r1', 'c0')?.overflow).toBe('wrap');
    expect(resolveTableFormatOverflow(next, STYLE, CELL_R1C0)).toBe('wrap');
  });

  /**
   * 🔴 **Η ΕΓΓΡΑΦΗ ΔΕΝ ΑΓΓΙΖΕΙ ΤΟΝ ΑΞΟΝΑ — και αυτό είναι το παραδοτέο.**
   *
   * Αν έγραφε `TableColumn.overflow`, η «Επαναφορά μορφοποίησης» (που καθαρίζει
   * `styleOverride`) **δεν** θα μπορούσε να το σβήσει: ο χρήστης θα δημιουργούσε με ένα κλικ
   * κατάσταση που η ορατή αναιρετική πράξη δεν αναιρεί. Ο επόμενος έλεγχος το αποδεικνύει.
   */
  it('🔴 ΔΕΝ γράφει ποτέ στη στήλη — ούτε σε στόχο-άξονα', () => {
    const scope = tableFormatScopeOf(model(), { rowId: 'r1', colId: 'c0' }, {
      from: { rowId: 'r0', colId: 'c0' },
      to: { rowId: 'r2', colId: 'c0' },
      kind: 'column',
    });
    const next = setTableFormatOverflow(model(), scope as TableFormatScope, 'shrink');

    expect(next.columns[0].overflow).toBeUndefined();
    expect(next.cells).toHaveLength(3);
  });

  /**
   * 🔴 Η **συμμετρία set / reset**: ό,τι γράφει το κουμπί, το σβήνει η «Επαναφορά».
   */
  it('🔴 η «Επαναφορά μορφοποίησης» ΣΒΗΝΕΙ ό,τι έγραψε το κουμπί', () => {
    const painted = setTableFormatOverflow(model(), CELL_R1C0, 'wrap');
    const reset = clearTableFormatScope(painted, CELL_R1C0);

    expect(resolveTableFormatOverflow(reset, STYLE, CELL_R1C0)).toBe('clip');
  });

  it('στόχος εκτός πλέγματος ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo)', () => {
    const before = model();
    expect(setTableFormatOverflow(before, range(9, 9, 9, 9), 'wrap')).toBe(before);
  });
});

describe('🔴 Η ΑΜΟΙΒΑΙΑ ΑΠΟΚΛΕΙΣΤΙΚΟΤΗΤΑ — δομική, όχι γραμμένη', () => {
  /**
   * Το πάτημα «σμίκρυνση» πάνω σε αναδιπλωμένο κελί **σβήνει** την αναδίπλωση, χωρίς κανέναν
   * ρητό έλεγχο: το `nextTableOverflow` επιστρέφει **μία** τιμή της ένωσης. Το test περνά την
   * ίδια διαδρομή που περνά και η επιφάνεια — SSoT μέσα, γραφέας έξω.
   */
  it('«σμίκρυνση» πάνω σε αναδιπλωμένο ⇒ ΜΟΝΟ σμίκρυνση', () => {
    const wrapped = setTableFormatOverflow(model(), CELL_R1C0, 'wrap');
    const current = resolveTableFormatOverflow(wrapped, STYLE, CELL_R1C0);
    const next = setTableFormatOverflow(wrapped, CELL_R1C0, nextTableOverflow(current, 'shrink'));

    expect(resolveTableFormatOverflow(next, STYLE, CELL_R1C0)).toBe('shrink');
  });

  it('ξαναπάτημα του ΙΔΙΟΥ ⇒ ξεπάτωμα, πίσω στην περικοπή', () => {
    const wrapped = setTableFormatOverflow(model(), CELL_R1C0, 'wrap');
    const current = resolveTableFormatOverflow(wrapped, STYLE, CELL_R1C0);
    const next = setTableFormatOverflow(wrapped, CELL_R1C0, nextTableOverflow(current, 'wrap'));

    expect(resolveTableFormatOverflow(next, STYLE, CELL_R1C0)).toBe('clip');
  });

  /**
   * 🔴 **Ανάμεικτος στόχος ⇒ ΕΦΑΡΜΟΓΗ, ποτέ ξεπάτωμα.**
   *
   * Ο χρήστης που πατά κουμπί πάνω σε ανάμεικτη επιλογή ζητά «κάνε τα όλα έτσι» — η ίδια
   * σύμβαση με το `nextBooleanFormat` και με κάθε toolbar του Office.
   */
  it('🔴 ανάμεικτη επιλογή + «αναδίπλωση» ⇒ ΟΛΑ αναδιπλώνονται', () => {
    const current = resolveTableFormatOverflow(model(), STYLE, ROW1_BOTH);
    expect(current).toBeNull();

    const next = setTableFormatOverflow(model(), ROW1_BOTH, nextTableOverflow(current, 'wrap'));
    expect(resolveTableFormatOverflow(next, STYLE, ROW1_BOTH)).toBe('wrap');
  });
});
