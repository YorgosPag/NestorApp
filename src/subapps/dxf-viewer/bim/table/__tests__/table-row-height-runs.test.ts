/**
 * 🔴 ADR-753 Φ4 (§15.5) — **η γραμμή μεγαλώνει για να χωρέσει τα ψηλά γράμματα.**
 *
 * ## Το ελάττωμα, αυτούσιο από την αναφορά του ιδιοκτήτη
 * *«Με “A↑” σε δύο χαρακτήρες το κείμενο βγαίνει έξω από τη γραμμή.»* Η αιτία ήταν μία γραμμή
 * κώδικα: το ύψος που ζητά το περιεχόμενο υπολογιζόταν από το `cellStyle.textHeightMm` — **του
 * κελιού** — ενώ ο ζωγράφος τιμούσε ήδη το ύψος **του τμήματος** (Φ3). Δύο απαντήσεις στο ίδιο
 * ερώτημα, με τη μία να ζωγραφίζει και την άλλη να μετρά.
 *
 * ## Γιατί αυτή η ομάδα υπάρχει χωριστά από το `table-text-pieces.test.ts`
 * Εκείνο το αρχείο **καρφώνει** πλέον το ύψος γραμμής, ακριβώς για να μπορεί να συγκρίνει
 * γεωμετρία ανάμεσα σε δύο μοντέλα. Δηλαδή, όσο ζει εκείνη η επιλογή, **κανένα** test του
 * αρχείου δεν μπορεί να δει το αυτόματο ύψος: μια πύλη που εξαφανίζεται όταν εξυπηρετεί άλλη
 * ερώτηση δεν είναι πύλη. Εδώ το ύψος είναι **αυτόματο** και είναι το μόνο που εξετάζεται.
 *
 * @see bim/table/table-layout-measure.ts — `contentHeightMm` / `wrappedCellHeightMm`
 */

import { layoutTable } from '../table-layout';
import { createTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableTextMeasurer } from '../table-layout-types';
import type { TableCellTextRun } from '../../../types/table';

const STYLE: TableStyle = BUILTIN_TABLE_STYLES.find(
  (s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
)!;

const measureText: TableTextMeasurer = (text, heightMm, style) =>
  text.length * heightMm * 0.6 * (style.bold === true ? 2 : 1);

/** Το ύψος της **μίας** γραμμής, όπως το αποφασίζει η μέτρηση. Ρητό `heightMm` πουθενά. */
function rowHeightMm(runs?: readonly TableCellTextRun[]): number {
  const model = createTableModel({
    columns: [{ id: 'c1', sizing: { kind: 'fixed', widthMm: 400 }, valueType: 'text', align: 'left' }],
    // ⚠️ **Χωρίς** `heightMm` — αλλιώς η ερώτηση δεν τίθεται καν (`measureRows`: ρητό ⇒ καρφωμένο).
    rows: [{ id: 'r1', rowClass: 'data' }],
    cells: [['r1', 'c1', { kind: 'text', value: 'ΝΕΣΤΩΡ', ...(runs && { runs }) }]],
  });
  return layoutTable(model, STYLE, { measureText }).rows[0].heightMm;
}

const CELL_TEXT_MM = STYLE.rowClasses.data.textHeightMm;

describe('🔴 §15.5 — το αυτόματο ύψος γραμμής ακούει τα RUNS', () => {
  it('🔴 δύο ψηλοί χαρακτήρες ΜΕΓΑΛΩΝΟΥΝ τη γραμμή — το ελάττωμα της αναφοράς', () => {
    const tall: readonly TableCellTextRun[] = [
      { start: 2, end: 4, style: { textHeightMm: CELL_TEXT_MM * 4 } },
    ];
    expect(rowHeightMm(tall)).toBeGreaterThan(rowHeightMm());
  });

  it('🔴 η γραμμή χωρά ΟΛΟΚΛΗΡΟ το ψηλό τμήμα, όχι λίγο παραπάνω', () => {
    const heightMm = CELL_TEXT_MM * 4;
    const tall: readonly TableCellTextRun[] = [
      { start: 2, end: 4, style: { textHeightMm: heightMm } },
    ];
    // Το κείμενο πιάνει `2×περιθώριο + ύψος` σε μία γραμμή — ο ίδιος τύπος με τη μέτρηση.
    expect(rowHeightMm(tall)).toBeGreaterThanOrEqual(
      heightMm + STYLE.rowClasses.data.margins.vMm * 2,
    );
  });

  it('🔴 ΧΑΜΗΛΟΤΕΡΟ τμήμα ΔΕΝ συρρικνώνει τη γραμμή — το αυτόματο ύψος μόνο μεγαλώνει', () => {
    const small: readonly TableCellTextRun[] = [
      { start: 0, end: 6, style: { textHeightMm: CELL_TEXT_MM / 4 } },
    ];
    expect(rowHeightMm(small)).toBe(rowHeightMm());
  });

  it('🔴 ΚΑΝΕΝΑΣ σημερινός πίνακας δεν μετακινείται: χωρίς runs, byte-ίδιο ύψος', () => {
    // Η αναλλοίωτη του §11.2, εκφρασμένη ως αριθμός: χωρίς runs παράγεται **ένα** τμήμα, με
    // ύψος ακριβώς το ύψος του κελιού — άρα η αριθμητική είναι η ταυτόσημη.
    expect(rowHeightMm()).toBe(STYLE.defaultRowHeightMm);
  });

  it('🔴 ρητό ύψος ΝΙΚΑ — ο χρήστης κάρφωσε, και το Excel δεν το παρακάμπτει ποτέ', () => {
    const model = createTableModel({
      columns: [{ id: 'c1', sizing: { kind: 'fixed', widthMm: 400 }, valueType: 'text', align: 'left' }],
      rows: [{ id: 'r1', rowClass: 'data', heightMm: 5 }],
      cells: [['r1', 'c1', {
        kind: 'text',
        value: 'ΝΕΣΤΩΡ',
        runs: [{ start: 0, end: 6, style: { textHeightMm: 200 } }],
      }]],
    });
    expect(layoutTable(model, STYLE, { measureText }).rows[0].heightMm).toBe(5);
  });
});
