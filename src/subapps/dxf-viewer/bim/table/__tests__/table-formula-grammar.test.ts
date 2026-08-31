/**
 * 🔴 ADR-761 — **Η ΓΡΑΜΜΑΤΙΚΗ ΤΩΝ ΤΥΠΩΝ**: η γραφή είναι διεπαφή, η σημασία είναι δέντρο.
 *
 * ## Τι φυλάει αυτό το αρχείο
 * Ο ιδιοκτήτης πληκτρολόγησε `=CONCATENATE(A2;" ";A3)` —τη γραφή που ξέρει από το ελληνικό
 * Excel— και το κελί έδειξε **το ίδιο το κείμενο**. Δεν έλειπε συνάρτηση: το `;` δεν ήταν καν
 * χαρακτήρας της γλώσσας. Και επειδή το κελί έμεινε κείμενο, ο τύπος της διπλανής στήλης που
 * το διάβαζε έδωσε `#VALUE!` — **ένα ελάττωμα, δύο συμπτώματα**, το δεύτερο χωρίς προφανή
 * σχέση με το πρώτο.
 *
 * ## 🔑 Οι τέσσερις ιδιότητες που δεν επιτρέπεται να σπάσουν
 * 1. **Ζεύξη**: ο διαχωριστής δεν είναι ΠΟΤΕ ο δεκαδικός της ίδιας γραμματικής. Χωρίς αυτήν,
 *    το `=SUM(1,5; 2)` θα έδινε **8 αντί για 3,5** — σφάλμα τιμής σε πίνακα ποσοτήτων.
 * 2. **Αντιστρεψιμότητα**: `κείμενο → δέντρο → κείμενο` σε **κάθε** γραμματική. Αν εκτύπωση
 *    και ανάλυση διαφωνούν, ένας τύπος που ο χρήστης απλώς **άνοιξε και έκλεισε** γίνεται
 *    κείμενο.
 * 3. **Ταυτοσημία σημασίας**: η ίδια έκφραση, γραμμένη στις δύο γραμματικές, δίνει το **ίδιο
 *    δέντρο**. Η γραφή δεν αγγίζει ποτέ το μοντέλο.
 * 4. 🔴 **Η εφεδρεία δεν υπερισχύει ΠΟΤΕ**: όπου η κύρια γραμματική βγάζει νόημα, αυτό είναι
 *    το νόημα. Είναι η ολόκληρη απόδειξη ότι η ανεκτικότητα **δεν είναι μαντεψιά**.
 *
 * @see bim/table/formula/table-formula-grammar.ts — ο επιλογέας (locale → γραμματική)
 * @see docs/centralized-systems/reference/adrs/ADR-761-table-formula-grammar.md
 */

import type {
  PersistedTableModel,
  TableColumn,
  TableModel,
  TableRow,
} from '../../../types/table';
import {
  CANONICAL_FORMULA_GRAMMAR,
  SEMICOLON_FORMULA_GRAMMAR,
  type TableFormulaGrammar,
} from '../../../types/table-formula-grammar';
import {
  alternateFormulaGrammar,
  drawingFormulaGrammar,
  formulaGrammarForLocale,
} from '../formula/table-formula-grammar';
import { parseTableFormula } from '../formula/table-formula-parse';
import { diagnoseFormulaText } from '../formula/table-formula-diagnosis';
import { resolveFormulaPointState } from '../formula/table-formula-point-state';
import { printTableFormula } from '../formula/table-formula-print';
import {
  cellInputText,
  commitCellWrites,
  writeCellInput,
} from '../formula/table-formula-engine';
import { createTableModel } from '../table-model-helpers';
import { bookOf, commitPendingForTest } from './formula-book-fixture';

const COLUMNS: TableColumn[] = ['cA', 'cB', 'cC'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  // `text` επίτηδες: το `number` ενεργοποιεί μορφοποίηση (ADR-760) και αυτό το αρχείο
  // ελέγχει **γραφή**, όχι εμφάνιση.
  valueType: 'text',
  align: 'left',
}));
const ROWS: TableRow[] = ['r1', 'r2', 'r3'].map((id) => ({ id, rowClass: 'data', heightMm: 8 }));
const MODEL: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS, cells: [] });

const EMPTY: PersistedTableModel = { columns: COLUMNS, rows: ROWS, cells: [], merges: [] };

const GRAMMARS: readonly (readonly [string, TableFormulaGrammar])[] = [
  ['κανονική', CANONICAL_FORMULA_GRAMMAR],
  ['δεκαδικού κόμματος', SEMICOLON_FORMULA_GRAMMAR],
];

/**
 * Το ίδιο νόημα, γραμμένο και στις δύο γραμματικές.
 *
 * Καλύπτει ό,τι μπορεί να **διαφέρει**: διαχωριστή, δεκαδικό, και τα δύο μαζί, ένθεση,
 * κυριολεκτικό κείμενο δίπλα σε διαχωριστή, εύρος, και τη γυμνή έκφραση που δεν έχει καμία
 * από τις δύο (αναλλοίωτος μάρτυρας).
 */
const EQUIVALENT: readonly (readonly [string, string])[] = [
  ['=SUM(A1:A3,B1)', '=SUM(A1:A3;B1)'],
  ['=CONCATENATE(A2," ",A3)', '=CONCATENATE(A2;" ";A3)'],
  ['=IF(A1>0,"ναι","όχι")', '=IF(A1>0;"ναι";"όχι")'],
  ['=ROUND(2.567,2)', '=ROUND(2,567;2)'],
  ['=SUM(1.5,2)', '=SUM(1,5;2)'],
  ['=MROUND(7,3)', '=MROUND(7;3)'],
  ['=IF(SUM(A1:A2)>1.5,ROUND(B1,1),0)', '=IF(SUM(A1:A2)>1,5;ROUND(B1;1);0)'],
  ['=-2^2', '=-2^2'],
  ['=A1&" τεμ."', '=A1&" τεμ."'],
];

describe('🔴 1 — ΖΕΥΞΗ: ο διαχωριστής δεν είναι ΠΟΤΕ ο δεκαδικός', () => {
  it.each(GRAMMARS)('%s', (_name, grammar) => {
    expect(grammar.argumentSeparator).not.toBe(grammar.decimalSeparator);
  });

  // Χωρίς αυτό, ο λεξικογράφος θα έπρεπε να κρίνει από τα συμφραζόμενα — και ο λόγος ύπαρξής
  // του είναι ακριβώς ότι **δεν κρίνει**.
  it('η γραμματική του σχεδίου το τηρεί κι αυτή', () => {
    const grammar = drawingFormulaGrammar();
    expect(grammar.argumentSeparator).not.toBe(grammar.decimalSeparator);
  });
});

describe('ο επιλογέας — CLDR, όχι χειρόγραφη λίστα locale', () => {
  it('el-GR ⇒ `;` ορίσματα, `,` δεκαδικό', () => {
    expect(formulaGrammarForLocale('el-GR')).toEqual(SEMICOLON_FORMULA_GRAMMAR);
  });

  it('en-US ⇒ `,` ορίσματα, `.` δεκαδικό', () => {
    expect(formulaGrammarForLocale('en-US')).toEqual(CANONICAL_FORMULA_GRAMMAR);
  });

  // Το σχέδιο είναι ελληνικό εξ ορισμού (ADR-760 `DEFAULT_TABLE_FORMAT_LOCALE`) — και η
  // γραμματική **οφείλει** να ακολουθεί το ίδιο locale, όχι δεύτερο.
  it('η γραμματική του σχεδίου ακολουθεί το locale του ADR-760', () => {
    expect(drawingFormulaGrammar()).toEqual(SEMICOLON_FORMULA_GRAMMAR);
  });

  it.each(GRAMMARS)('η «άλλη» της %s δεν είναι η ίδια', (_name, grammar) => {
    expect(alternateFormulaGrammar(grammar)).not.toEqual(grammar);
    expect(alternateFormulaGrammar(alternateFormulaGrammar(grammar))).toEqual(grammar);
  });

  // ⚠️ Κρίνεται από την **τιμή**, όχι από την ταυτότητα αντικειμένου: ένα ισοδύναμο
  // κυριολεκτικό θα έπαιρνε αλλιώς τη ΔΙΚΗ του γραμματική πίσω, και η εφεδρεία θα ήταν
  // σιωπηλά ανενεργή.
  it('ισοδύναμο αντίγραφο δίνει την ίδια «άλλη» με το πρωτότυπο', () => {
    const clone: TableFormulaGrammar = { argumentSeparator: ';', decimalSeparator: ',' };
    expect(alternateFormulaGrammar(clone)).toEqual(CANONICAL_FORMULA_GRAMMAR);
  });
});

describe('🔴 2 — ΑΝΤΙΣΤΡΕΨΙΜΟΤΗΤΑ: round-trip σε κάθε γραμματική', () => {
  const cases = GRAMMARS.flatMap(([name, grammar]) =>
    EQUIVALENT.map(([canonical, semicolon], index) => {
      const text = grammar === CANONICAL_FORMULA_GRAMMAR ? canonical : semicolon;
      return [name, index, text, grammar] as const;
    }),
  );

  it.each(cases)('%s #%i — «%s» επιβιώνει', (_name, _index, text, grammar) => {
    const formula = parseTableFormula(bookOf(MODEL), text, grammar);
    expect(formula).not.toBeNull();
    // Το πρώτο πέρασμα μπορεί να κανονικοποιήσει (πεζά, κενά)· το **δεύτερο** οφείλει να
    // είναι σταθερό σημείο, αλλιώς κάθε άνοιγμα κελιού θα ξαναέγραφε τον τύπο.
    const printed = printTableFormula(bookOf(MODEL), formula!, grammar);
    const again = parseTableFormula(bookOf(MODEL), printed, grammar);
    expect(again).not.toBeNull();
    expect(printTableFormula(bookOf(MODEL), again!, grammar)).toBe(printed);
  });
});

describe('🔴 3 — ΤΑΥΤΟΣΗΜΙΑ: η γραφή δεν αγγίζει το μοντέλο', () => {
  it.each(EQUIVALENT)('«%s» και «%s» δίνουν το ΙΔΙΟ δέντρο', (canonical, semicolon) => {
    const left = parseTableFormula(bookOf(MODEL), canonical, CANONICAL_FORMULA_GRAMMAR);
    const right = parseTableFormula(bookOf(MODEL), semicolon, SEMICOLON_FORMULA_GRAMMAR);
    expect(left).not.toBeNull();
    expect(right).toEqual(left);
  });
});

/**
 * 🔴 **Η ΑΠΟΔΕΙΞΗ ΟΤΙ Η ΑΝΕΚΤΙΚΟΤΗΤΑ ΔΕΝ ΕΙΝΑΙ ΜΑΝΤΕΨΙΑ.**
 *
 * Η εφεδρεία εκτελείται **μόνο** στον κλάδο όπου η κύρια γραμματική επέστρεψε `null` —
 * δηλαδή εκεί που το κείμενο δεν είχε **καμία** ερμηνεία. Άρα δεν μπορεί να **αλλάξει**
 * νόημα· μπορεί μόνο να **δώσει** νόημα εκεί που δεν υπήρχε.
 *
 * Ο έλεγχος τρέχει σε **ολόκληρο** το corpus, και στις δύο γραφές: για κάθε κείμενο που η
 * κύρια αναλύει, το δέντρο που αποθηκεύει ο `writeCellInput` οφείλει να είναι **ταυτόσημο**
 * με εκείνο της κύριας. Ένα «έξυπνο» sniffing που θα προτιμούσε άλλοτε τη μία και άλλοτε την
 * άλλη θα έπεφτε εδώ.
 */
describe('🔴 4 — Η ΕΦΕΔΡΕΙΑ ΔΕΝ ΥΠΕΡΙΣΧΥΕΙ ΠΟΤΕ', () => {
  const corpus = EQUIVALENT.flatMap(([canonical, semicolon]) => [canonical, semicolon]);

  it.each(corpus)('«%s»', (text) => {
    const primary = parseTableFormula(bookOf(MODEL), text, drawingFormulaGrammar());
    const stored = commitPendingForTest(writeCellInput(bookOf(EMPTY),EMPTY, 'r1', 'cA', text));
    const cell = stored.cells.find(([r, c]) => r === 'r1' && c === 'cA')?.[2];

    if (primary === null) {
      // Η κύρια δεν είχε νόημα ⇒ η εφεδρεία επιτρέπεται (και οφείλει) να το δώσει.
      expect(cell?.kind).toBe('formula');
      return;
    }
    // Η κύρια είχε νόημα ⇒ **αυτό** είναι το νόημα, χωρίς εξαίρεση.
    expect(cell?.kind).toBe('formula');
    expect(cell?.formula).toEqual(primary);
  });
});

describe('🎯 Η ΑΓΚΥΡΑ ΤΟΥ ΙΔΙΟΚΤΗΤΗ — το στιγμιότυπο G753_ergasia F.dxf', () => {
  /** Ο πίνακας της οθόνης, χτισμένος από την ΙΔΙΑ πόρτα που χρησιμοποιεί ο χρήστης. */
  function snapshot(a1: string): PersistedTableModel {
    let model = EMPTY;
    const write = (r: string, c: string, text: string) => {
      model = commitPendingForTest(writeCellInput(bookOf(model),model, r, c, text));
    };
    write('r2', 'cA', '20');
    write('r3', 'cA', '30');
    write('r1', 'cB', '1,0255');
    write('r1', 'cA', a1);
    write('r1', 'cC', '=A1+B1');
    return model;
  }

  const valueAt = (model: PersistedTableModel, r: string, c: string): unknown =>
    model.cells.find(([rr, cc]) => rr === r && cc === c)?.[2].value;

  it('`=CONCATENATE(A2;" ";A3)` δίνει «20 30» — όχι το ίδιο του το κείμενο', () => {
    const model = snapshot('=CONCATENATE(A2;" ";A3)');
    expect(valueAt(model, 'r1', 'cA')).toBe('20 30');
  });

  // Η ίδια γραφή που έγραφε ο χρήστης πριν το ADR-761 — δεν επιτρέπεται να πάψει να δουλεύει.
  it('η αγγλική γραφή `=CONCATENATE(A2," ",A3)` δίνει το ΙΔΙΟ', () => {
    expect(valueAt(snapshot('=CONCATENATE(A2," ",A3)'), 'r1', 'cA')).toBe('20 30');
  });

  it('η γραμμή τύπων ξαναγράφει και τις δύο στη γραφή του σχεδίου', () => {
    for (const written of ['=CONCATENATE(A2;" ";A3)', '=CONCATENATE(A2," ",A3)']) {
      expect(cellInputText(bookOf(snapshot(written)),snapshot(written), 'r1', 'cA')).toBe('=CONCATENATE(A2;" ";A3)');
    }
  });

  /**
   * 🔑 Το `#VALUE!` του στιγμιότυπου **δεν ήταν δεύτερο ελάττωμα** — ήταν το ίδιο, ένα βήμα
   * κατάντη: το `A1` είχε μείνει **κείμενο**, και κείμενο + αριθμός δίνει `#VALUE!`.
   *
   * ⚠️ Και **παραμένει** `#VALUE!` μετά τη διόρθωση, γιατί τώρα το `A1` παράγει τη
   * συμβολοσειρά `'20 30'` — που εξακολουθεί να μην είναι αριθμός. Είναι η **σωστή** απάντηση
   * και η ίδια που δίνει το Excel: το `=A1+B1` πάνω σε `CONCATENATE` είναι λάθος τύπος, όχι
   * λάθος μηχανή. Καταγράφεται ρητά ώστε να μη «διορθωθεί» κάποτε σε σιωπηλό μηδέν.
   */
  it('το `#VALUE!` του C1 ήταν ΣΥΜΠΤΩΜΑ, και η αιτία του άλλαξε', () => {
    const broken = snapshot('=CONCATENATE(A2;" ";A3)');
    // Πριν: το A1 ήταν το ΚΕΙΜΕΝΟ του τύπου. Τώρα είναι το αποτέλεσμά του.
    expect(valueAt(broken, 'r1', 'cA')).not.toBe('=CONCATENATE(A2;" ";A3)');
    // Το C1 μένει #VALUE! — σωστά: προσθέτει κείμενο σε αριθμό.
    expect(valueAt(broken, 'r1', 'cC')).toBe('#VALUE!');
  });

  it('με αριθμητικό A1 το C1 υπολογίζει κανονικά — το κόμμα διαβάζεται δεκαδικό', () => {
    const model = snapshot('=A2');
    expect(valueAt(model, 'r1', 'cC')).toBe(21.0255);
  });
});

describe('η μοναδική αμφισημία, ρητά τεκμηριωμένη', () => {
  /**
   * Κόμμα ανάμεσα σε δύο ψηφία είναι το **μόνο** σημείο όπου οι δύο γραμματικές διαφωνούν
   * χωρίς η μία να είναι συντακτικά άκυρη. Σε σχέδιο με ελληνικό locale υπερισχύει η
   * ελληνική ανάγνωση — όπως ακριβώς στο ελληνικό Excel. Δεν «διορθώνεται»· δηλώνεται.
   */
  it('`=MROUND(7,3)` σε ελληνικό σχέδιο είναι ΕΝΑ όρισμα (7,3), όχι δύο', () => {
    const formula = parseTableFormula(bookOf(MODEL), '=MROUND(7,3)', drawingFormulaGrammar());
    expect(formula?.root).toEqual({
      kind: 'call',
      name: 'MROUND',
      args: [{ kind: 'number', value: 7.3 }],
    });
  });

  it('το ίδιο κείμενο στην κανονική γραμματική είναι ΔΥΟ ορίσματα', () => {
    const formula = parseTableFormula(bookOf(MODEL), '=MROUND(7,3)', CANONICAL_FORMULA_GRAMMAR);
    expect(formula?.root).toEqual({
      kind: 'call',
      name: 'MROUND',
      args: [
        { kind: 'number', value: 7 },
        { kind: 'number', value: 3 },
      ],
    });
  });
});

/**
 * 🔴 ADR-761 Στάδιο 3 — **καμία σιωπή**, αλλά ούτε θόρυβος.
 *
 * Ο ιδιοκτήτης είδε το κείμενό του σε κελί και δεν είχε τρόπο να μάθει γιατί. Η διάγνωση
 * κλείνει το κενό — με τη ρητή διάκριση «όσο γράφει» / «δεσμευμένο», γιατί ένα μήνυμα που
 * είναι μονίμως αναμμένο είναι χειρότερο από τη σιωπή.
 */
describe('η διάγνωση — καμία σιωπή, κανένας θόρυβος', () => {
  it('σκέτο κείμενο δεν διαγιγνώσκεται ποτέ', () => {
    expect(diagnoseFormulaText('Δοκός Δ12', true)).toBeNull();
    expect(diagnoseFormulaText('', true)).toBeNull();
  });

  it('έγκυρος τύπος στη γραμματική του σχεδίου ⇒ καμία διάγνωση', () => {
    expect(diagnoseFormulaText('=SUM(A1;A2)', true)).toBeNull();
  });

  it('η άλλη γραφή εξηγείται ΚΑΙ όσο γράφει — γιατί θα γίνει δεκτή', () => {
    expect(diagnoseFormulaText('=SUM(A1,A2)', false)).toEqual({
      kind: 'other-grammar',
      separator: ';',
    });
  });

  // 🔑 Η καρδιά της απόφασης: όσο γράφει, κάθε τύπος περνά από άκυρα ενδιάμεσα στάδια.
  it.each(['=', '=S', '=SUM(', '=1+'])('«%s» ΔΕΝ ενοχλεί όσο γράφεται', (draft) => {
    expect(diagnoseFormulaText(draft, false)).toBeNull();
  });

  it.each(['=SUM(', '=1+', '=(1+2', '="ανοιχτό'])('«%s» εξηγείται ΔΕΣΜΕΥΜΕΝΟ', (text) => {
    expect(diagnoseFormulaText(text, true)).toEqual({ kind: 'not-a-formula', separator: ';' });
  });

  // Συγκεκριμένη πληροφορία για συγκεκριμένο όνομα προηγείται του γενικού «δεν αναγνωρίζεται».
  it('η αποκλεισμένη συνάρτηση κερδίζει τη γενική εξήγηση', () => {
    expect(diagnoseFormulaText('=TODAY()', true)).toEqual({
      kind: 'refused-function',
      name: 'TODAY',
      reason: expect.any(String),
    });
  });

  it('ο διαχωριστής στα μηνύματα είναι ΠΑΝΤΑ αυτός της γραμματικής του σχεδίου', () => {
    const diagnosis = diagnoseFormulaText('=SUM(A1,A2)', false);
    expect(diagnosis).not.toBeNull();
    expect('separator' in diagnosis! && diagnosis.separator).toBe(
      drawingFormulaGrammar().argumentSeparator,
    );
  });
});

/**
 * 🔴 ADR-761 × ADR-754 — **ο μισογραμμένος δεκαδικός δεν σβήνεται από κλικ.**
 *
 * Το `continuesLexeme` απαντά «ο δρομέας κάθεται στη μέση μιας μονάδας;» και η απάντηση
 * **αλλάζει με τη γραμματική**: στη γραφή του δεκαδικού κόμματος το `,` συνεχίζει αριθμό,
 * στην κανονική όχι.
 *
 * ⚠️ Ο μάρτυρας χρειάστηκε **σχεδιασμό**: στα προφανή δείγματα (`=1|,5`, `=A1+2|,5`) και οι
 * δύο εκδοχές δίνουν `off` για διαφορετικό λόγο, δηλαδή η μετάλλαξη επιβιώνει. Ξεχωρίζουν
 * **μόνο** όταν η προηγούμενη μονάδα είναι διαχωριστής — τότε η λάθος εκδοχή **οπλίζεται**
 * και το επόμενο κλικ θα έσβηνε το `,5` που ο χρήστης πληκτρολογεί ακόμη.
 */
describe('🔴 ο δρομέας ΜΕΣΑ σε δεκαδικό — η γραμματική αλλάζει την απάντηση', () => {
  it('«=SUM(A1;|,5» ⇒ ΟΧΙ οπλισμένο: ο δρομέας κόβει αριθμό που γράφεται', () => {
    expect(resolveFormulaPointState(MODEL, '=SUM(A1;,5', 8)).toEqual({ kind: 'off' });
  });

  // Ο μάρτυρας ελέγχου: ίδια θέση, χαρακτήρας που **δεν** συνεχίζει μονάδα ⇒ οπλισμένο.
  it('«=SUM(A1;|"α"» ⇒ οπλισμένο, γιατί το εισαγωγικό δεν συνεχίζει μονάδα', () => {
    expect(resolveFormulaPointState(MODEL, '=SUM(A1;"α"', 8)).toEqual({ kind: 'armed', at: 8 });
  });
});
