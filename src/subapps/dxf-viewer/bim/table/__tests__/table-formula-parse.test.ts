/**
 * ADR-739 Φ.Ζ — **ανάλυση, εκτύπωση και το ταξίδι σε JSON**.
 *
 * Το κεντρικό test της φάσης είναι το `round-trip`: `κείμενο → δέντρο → κείμενο`. Αν
 * αναλυτής και εκτυπωτής αποκλίνουν έστω σε μία παρένθεση, ο χρήστης θα έβλεπε στη γραμμή
 * τύπων **άλλον** τύπο από αυτόν που έγραψε — και θα τον διόρθωνε, γράφοντας τρίτο.
 */

import { createTableModel } from '../table-model-helpers';
import type { TableColumn, TableModel, TableRow } from '../../../types/table';
import { parseTableFormula, isFormulaInput } from '../formula/table-formula-parse';
import { printTableFormula } from '../formula/table-formula-print';
import { bookOf } from './formula-book-fixture';

const COLUMNS: TableColumn[] = ['c1', 'c2', 'c3'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3'].map((id) => ({ id, rowClass: 'data', heightMm: 8 }));

const MODEL: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS, cells: [] });

/** `κείμενο → δέντρο → κείμενο`, σε μία κίνηση. */
function reprint(text: string): string | null {
  const formula = parseTableFormula(bookOf(MODEL), text);
  return formula === null ? null : printTableFormula(bookOf(MODEL), formula);
}

describe('isFormulaInput — τι είναι δήλωση τύπου', () => {
  it.each(['=1+1', '  =SUM(A1:A3)', '='])('«%s» ξεκινά τύπο', (text) => {
    expect(isFormulaInput(text)).toBe(true);
  });

  it.each(['1+1', 'Δοκός Δ1', '', '−=5'])('«%s» ΔΕΝ ξεκινά τύπο', (text) => {
    expect(isFormulaInput(text)).toBe(false);
  });
});

describe('ανάλυση + εκτύπωση — round-trip', () => {
  it.each([
    // Το αίτημα του ιδιοκτήτη, αυτούσιο.
    ['=(2*5)/2', '=(2*5)/2'],
    ['=1+2*3', '=1+2*3'],
    // 🔑 Οι παρενθέσεις του χρήστη **δεν πειράζονται**, ακόμη κι όταν η προτεραιότητα
    // συμφωνεί χωρίς αυτές: το εργαλείο δεν ξαναγράφει ό,τι έγραψε ο μηχανικός.
    ['=(1+2)+3', '=(1+2)+3'],
    ['=(1+2)*3', '=(1+2)*3'],
    ['=1-(2-3)', '=1-(2-3)'],
    ['=10/(2*5)', '=10/(2*5)'],
    ['=2^3^2', '=2^3^2'],
    ['=-A1', '=-A1'],
    ['=SUM(A1:A3)', '=SUM(A1:A3)'],
    // 🔴 ADR-761 — ο διαχωριστής είναι `;`: η γραμματική **του σχεδίου** (locale `el-GR`,
    // ίδια αυθεντία με το ADR-760). Δες τη σουίτα `table-formula-grammar.test.ts` για το
    // γιατί, και για την ανεκτική εφεδρεία που δέχεται ΚΑΙ τη γραφή με `,`.
    ['=SUM(A1:A3;B1)', '=SUM(A1:A3;B1)'],
    ['=IF(A1>0;"ναι";"όχι")', '=IF(A1>0;"ναι";"όχι")'],
    ['=A1&" τεμ."', '=A1&" τεμ."'],
    // Κανονικοποίηση: πεζά και κενά είναι γραφή, όχι νόημα — όπως σε Excel/AutoCAD.
    ['=sum( a1 : a3 )', '=SUM(A1:A3)'],
    ['=1e3', '=1000'],
  ])('«%s» → «%s»', (input, expected) => {
    expect(reprint(input)).toBe(expected);
  });

  it('η δεύτερη ανάλυση δίνει ταυτόσημο κείμενο (σταθερό σημείο)', () => {
    const once = reprint('=sum(a1:a3)*(1+b2)');
    expect(once).not.toBeNull();
    expect(reprint(once as string)).toBe(once);
  });
});

describe('συντακτική αποτυχία ⇒ `null` (ο καλών κρατά ΚΕΙΜΕΝΟ)', () => {
  it.each(// ⚠️ Το `=SUM(A1,A2)` **έφυγε** από αυτή τη λίστα με το ADR-761: στη γραμματική του
  // σχεδίου δεν αναλύεται, αλλά ο `writeCellInput` το δέχεται μέσω της εφεδρείας. Ένα
  // δείγμα εδώ θα έλεγε «μένει κείμενο», που είναι αλήθεια για ΑΥΤΗ τη συνάρτηση και
  // ψέμα για τη διαδρομή του χρήστη — δες `table-formula-grammar.test.ts`.
  ['=1+', '=SUM(', '=(1+2', '=1++', '=', '=@3', '=SUM(A1:A2:A3)', '="ανοιχτό'])(
    '«%s» δεν είναι τύπος',
    (text) => {
      expect(parseTableFormula(bookOf(MODEL), text)).toBeNull();
    },
  );

  it('κείμενο χωρίς `=` δεν αναλύεται ποτέ ως τύπος', () => {
    expect(parseTableFormula(bookOf(MODEL), '1+1')).toBeNull();
  });

  /**
   * 🔴 **ΑΛΛΑΞΕ ΜΕ ΤΟ ADR-765 — η ΠΡΟΚΕΙΜΕΝΗ ΗΤΑΝ ΣΩΣΤΗ, ΤΟ ΣΥΜΠΕΡΑΣΜΑ ΛΑΘΟΣ.**
   *
   * Αυτό το `it` έλεγε «μένει ΚΕΙΜΕΝΟ» και το αιτιολογούσε ως εξής: *«το `ACAD_TABLE` γράφει
   * `=Sum(A1:A5)` και τα ελληνικά Excel χρησιμοποιούν επίσης τα αγγλικά ονόματα»*. Η
   * προκείμενη **επαληθεύτηκε** (ADR-765 §3.4: η Microsoft δεν μεταφράζει ονόματα συναρτήσεων
   * στα ελληνικά) — αλλά οδηγεί στο **αντίθετο** συμπέρασμα: αφού το `ΑΘΡΟΙΣΜΑ` δεν είναι
   * συνάρτηση, είναι **όνομα που δεν ορίστηκε**, και το ελληνικό Excel δίνει γι' αυτό `#NAME?`.
   *
   * 🔑 Και ήταν **ασυνεπές με τον εαυτό του**: το `=ΦΟΥ(1)` και το `=FOO(1)` είναι το ίδιο
   * λάθος γραμμένο σε δύο αλφάβητα, και έπαιρναν διαφορετική απάντηση — το λατινικό `#NAME?`,
   * το ελληνικό σιωπηλό κείμενο. Ο λόγος δεν ήταν απόφαση: ήταν ότι το `NAME_START` του
   * λεξικογράφου ήταν `[A-Za-z_$]`, οπότε το ελληνικό όνομα δεν γινόταν καν **μονάδα**.
   *
   * Τίποτα δεν χάνεται: ο τύπος ξαναγράφεται **αυτούσιος** στη γραμμή τύπων.
   */
  it('ελληνικό όνομα συνάρτησης είναι ΤΥΠΟΣ (⇒ `#NAME?`), όχι σιωπηλό κείμενο (ADR-765)', () => {
    // Ο μάρτυρας είναι ο **αυτούσιος** επανασχηματισμός: ο τύπος έγινε δεκτός ΚΑΙ η γραμμή
    // τύπων εξακολουθεί να δείχνει ό,τι πληκτρολογήθηκε. Την **τιμή** `#NAME?` τη μετρά η
    // σουίτα `table-formula-bare-name.test.ts`, που έχει και αξιολογητή.
    expect(reprint('=ΑΘΡΟΙΣΜΑ(A1:A3)')).toBe('=ΑΘΡΟΙΣΜΑ(A1:A3)');
  });
});

describe('δέσιμο αναφορών', () => {
  it('το `A1` γίνεται ταυτότητες, όχι κείμενο', () => {
    const formula = parseTableFormula(bookOf(MODEL), '=A1');
    expect(formula?.root).toEqual({ kind: 'ref', cell: { rowId: 'r1', colId: 'c1' } });
  });

  it('τα πεζά είναι ίδια αναφορά με τα κεφαλαία', () => {
    expect(parseTableFormula(bookOf(MODEL), '=b3')).toEqual(parseTableFormula(bookOf(MODEL), '=B3'));
  });

  it('αναφορά εκτός πλέγματος παγώνει ως `#REF!` — ο τύπος ΔΕΝ απορρίπτεται', () => {
    expect(parseTableFormula(bookOf(MODEL), '=A99')?.root).toEqual({ kind: 'error', code: '#REF!' });
  });

  it('εύρος με άκρο εκτός πλέγματος είναι ολόκληρο `#REF!`', () => {
    expect(parseTableFormula(bookOf(MODEL), '=SUM(A1:A99)')?.root).toEqual({
      kind: 'call',
      name: 'SUM',
      args: [{ kind: 'error', code: '#REF!' }],
    });
  });
});

describe('όρια', () => {
  it('υπερβολικό φώλιασμα απορρίπτεται αντί να εξαντλήσει τη στοίβα', () => {
    const deep = `=${'('.repeat(200)}1${')'.repeat(200)}`;
    expect(parseTableFormula(bookOf(MODEL), deep)).toBeNull();
  });
});

describe('JSON — ο τύπος ταξιδεύει ακέραιος', () => {
  it('επιβιώνει σε `JSON.parse(JSON.stringify(...))` χωρίς απώλεια', () => {
    const formula = parseTableFormula(bookOf(MODEL), '=SUM(A1:A3)/COUNT(A1:A3)');
    const travelled = JSON.parse(JSON.stringify(formula));
    expect(travelled).toEqual(formula);
    expect(printTableFormula(bookOf(MODEL), travelled)).toBe('=SUM(A1:A3)/COUNT(A1:A3)');
  });
});
