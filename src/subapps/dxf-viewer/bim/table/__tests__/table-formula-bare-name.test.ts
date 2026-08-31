/**
 * 🔴 ADR-765 — **ΤΟ ΓΥΜΝΟ ΟΝΟΜΑ ΕΙΝΑΙ ΤΥΠΟΣ ΜΕ `#NAME?`, ΟΧΙ ΚΕΙΜΕΝΟ.**
 *
 * Ο ιδιοκτήτης συμπλήρωσε τον διάλογο «Ορίσματα συνάρτησης» με `=IF(A3>0;ΣΩΣΤΟ;ΛΑΘΟΣ)`,
 * είδε **κενό** δίπλα στα δύο ορίσματα και **κενό** στο «Αποτέλεσμα», πάτησε «OK», και το
 * κελί κράτησε **ωμό κείμενο**. Δύο σιωπές για ένα ελάττωμα.
 *
 * Το πρότυπο είναι ρητό και ομόφωνο (Excel · Google Sheets · LibreOffice): μια γυμνή λέξη
 * μέσα σε τύπο είναι **όνομα που δεν ορίστηκε** — ο τύπος γίνεται δεκτός και αποτιμάται σε
 * `#NAME?`. Δες ADR-765 §3 για τις πηγές.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-765-formula-bare-name.md
 */

import { commitCellWrites, previewFormulaValue, writeCellInput } from '../formula/table-formula-engine';
import { functionArgumentsPreview } from '../formula/catalog/formula-argument-preview';
import { parseTableFormula } from '../formula/table-formula-parse';
import { printTableFormula } from '../formula/table-formula-print';
import { resolveTableModel } from '../table-model-helpers';
import type {
  PersistedTableModel,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../../types/table';
import { bookOf, commitPendingForTest } from './formula-book-fixture';

/**
 * Πίνακας 3 × 4 με `A3 = 5`, δηλαδή **ακριβώς** το φύλλο του στιγμιότυπου: ο λογικός έλεγχος
 * `A3>0` είναι αληθής, οπότε ό,τι δείξει το κελί το έδωσε το **δεύτερο** όρισμα.
 */
function sheet(): PersistedTableModel {
  const columns: TableColumn[] = ['cA', 'cB', 'cC', 'cD'].map((id) => ({
    id,
    sizing: { kind: 'fixed', widthMm: 20 },
    valueType: 'text',
    align: 'right',
  }));
  const rows: TableRow[] = ['r1', 'r2', 'r3'].map((id) => ({ id, rowClass: 'data', heightMm: 6 }));
  const cells: TableCellEntry[] = [['r3', 'cA', { kind: 'text', value: 5 }]];
  return { columns, rows, cells, merges: [] };
}

/** Το κελί `D3` μετά τη δέσμευση: τι **είδους** κελί έγινε και τι **τιμή** κρατά. */
function commit(text: string): { kind: string; value: unknown } {
  const model = commitPendingForTest(writeCellInput(bookOf(sheet()),sheet(), 'r3', 'cD', text));
  const cell = model.cells.find(([r, c]) => r === 'r3' && c === 'cD')?.[2];
  return { kind: cell?.kind ?? 'missing', value: cell?.value };
}

/** `κείμενο → δέντρο → κείμενο` πάνω στο ίδιο φύλλο. */
function reprint(text: string): string | null {
  const model = resolveTableModel(sheet());
  const formula = parseTableFormula(bookOf(model), text);
  return formula === null ? null : printTableFormula(bookOf(model), formula);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Το στιγμιότυπο, αυτούσιο
// ─────────────────────────────────────────────────────────────────────────────

describe('ADR-765 — η δέσμευση από τον διάλογο δεν εκφυλίζεται σε κείμενο', () => {
  it('`=IF(A3>0;ΣΩΣΤΟ;ΛΑΘΟΣ)` γίνεται ΤΥΠΟΣ και δίνει `#NAME?`', () => {
    expect(commit('=IF(A3>0;ΣΩΣΤΟ;ΛΑΘΟΣ)')).toEqual({ kind: 'formula', value: '#NAME?' });
  });

  it('το ίδιο με λατινικά γράμματα — η γλώσσα του ονόματος δεν αλλάζει την απάντηση', () => {
    expect(commit('=IF(A3>0;SOSTO;LATHOS)')).toEqual({ kind: 'formula', value: '#NAME?' });
  });

  it('σκέτο γυμνό όνομα: `=ΣΩΣΤΟ` ⇒ `#NAME?`', () => {
    expect(commit('=ΣΩΣΤΟ')).toEqual({ kind: 'formula', value: '#NAME?' });
  });

  it('🔑 ο τύπος ξαναγράφεται ΑΥΤΟΥΣΙΟΣ — το όνομα δεν πειράζεται (round-trip)', () => {
    expect(reprint('=IF(A3>0;ΣΩΣΤΟ;ΛΑΘΟΣ)')).toBe('=IF(A3>0;ΣΩΣΤΟ;ΛΑΘΟΣ)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Ο διάλογος δεν δείχνει πια ΚΕΝΟ (§5.4 του handoff)
// ─────────────────────────────────────────────────────────────────────────────

describe('ADR-765 — «Αποτέλεσμα =» γεμίζει, όπως στο Excel', () => {
  it('κάθε άγνωστο όρισμα δείχνει `#NAME?`, και το αποτέλεσμα επίσης', () => {
    const preview = functionArgumentsPreview({
      book: bookOf(resolveTableModel(sheet())),
      functionName: 'IF',
      frame: { prefix: '=IF(', suffix: ')' },
      values: ['A3>0', 'ΣΩΣΤΟ', 'ΛΑΘΟΣ'],
      separator: ';',
    });

    expect(preview.perArgument).toEqual(['TRUE', '#NAME?', '#NAME?']);
    expect(preview.result).toBe('#NAME?');
  });

  it('η ζωντανή αποτίμηση απαντά **σφάλμα**, όχι `null` (που ο διάλογος δείχνει κενό)', () => {
    expect(previewFormulaValue(bookOf(resolveTableModel(sheet())), '=ΣΩΣΤΟ')).toBe('#NAME?');
  });

  it('το ημιτελές μένει `null` — η σιωπή είναι σωστή ΜΟΝΟ όσο ο χρήστης πληκτρολογεί', () => {
    expect(previewFormulaValue(bookOf(resolveTableModel(sheet())), '=1+')).toBeNull();
    expect(previewFormulaValue(bookOf(resolveTableModel(sheet())), '=SUM(')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Το κενό ΕΝΔΙΑΜΕΣΟ όρισμα (§5.7 — ADR-763 §19.9)
// ─────────────────────────────────────────────────────────────────────────────

describe('ADR-765 — το παραλειπόμενο όρισμα είναι γλώσσα, όχι συντακτικό σφάλμα', () => {
  it('`=IF(A3>0;;99)` γίνεται ΤΥΠΟΣ — ο ίδιος ο διάλογος το παράγει', () => {
    expect(commit('=IF(A3>0;;99)')).toEqual({ kind: 'formula', value: 0 });
  });

  it('ο κλάδος που ΔΕΝ παραλείφθηκε δίνει την τιμή του', () => {
    expect(commit('=IF(A3<0;;99)')).toEqual({ kind: 'formula', value: 99 });
  });

  it('🔑 το κενό ξαναγράφεται κενό — ο τύπος δεν «μαζεύεται» (round-trip)', () => {
    expect(reprint('=IF(A3>0;;99)')).toBe('=IF(A3>0;;99)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. 🔴 ΟΙ ΑΜΕΤΑΚΙΝΗΤΕΣ — τι ΔΕΝ επιτρέπεται να μεταπέσει σε `#NAME?`
// ─────────────────────────────────────────────────────────────────────────────

describe('ADR-765 — οι διαχωριστικές γραμμές μένουν ακέραιες', () => {
  it('§5.3 — αναφορά εκτός πλέγματος μένει `#REF!` (ADR-764), ΠΟΤΕ `#NAME?`', () => {
    expect(commit('=A99')).toEqual({ kind: 'formula', value: '#REF!' });
    expect(reprint('=A99')).toBe('=#REF!');
  });

  it('τα κυριολεκτικά `TRUE`/`FALSE` προηγούνται του ονόματος', () => {
    expect(commit('=TRUE')).toEqual({ kind: 'formula', value: 'TRUE' });
    expect(reprint('=IF(A3>0;TRUE;FALSE)')).toBe('=IF(A3>0;TRUE;FALSE)');
  });

  it('άγνωστη ΣΥΝΑΡΤΗΣΗ (με παρενθέσεις) δίνει το ίδιο `#NAME?` — μία έννοια, ένας κωδικός', () => {
    expect(commit('=ΦΟΥ(1)')).toEqual({ kind: 'formula', value: '#NAME?' });
  });

  it('🔑 η ΗΜΙΤΕΛΗΣ πληκτρολόγηση μένει ΚΕΙΜΕΝΟ — η τομή του §2.2 δεν ξηλώθηκε', () => {
    expect(commit('=1+')).toEqual({ kind: 'text', value: '=1+' });
    expect(commit('=SUM(A1')).toEqual({ kind: 'text', value: '=SUM(A1' });
    expect(commit('=IF(A3>0;"ναι"')).toEqual({ kind: 'text', value: '=IF(A3>0;"ναι"' });
  });

  it('ελληνικό κείμενο που ξεκινά με `=` και ΔΕΝ είναι τύπος μένει κείμενο', () => {
    expect(commit('=Δοκός Δ1')).toEqual({ kind: 'text', value: '=Δοκός Δ1' });
  });
});
