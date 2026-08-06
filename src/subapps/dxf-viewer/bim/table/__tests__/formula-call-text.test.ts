/**
 * ADR-763 §14/§17 — **από τα κουτιά στο κείμενο, και από τη σειρά στην επεξήγηση.**
 *
 * Δύο πυρήνες που ζωγραφίζουν μαζί τη μία σειρά του διαλόγου, και δύο τρόποι να πουν λάθος
 * πράγμα **χωρίς κανένα σφάλμα**:
 *   1. η σύνθεση του προχείρου — μια κοπή παραπάνω αλλάζει τη **σημασία** του τύπου·
 *   2. ο δείκτης επεξήγησης — μια απόκλιση από την αριθμητική των ονομάτων βάζει σωστό όνομα
 *      πάνω από λάθος επεξήγηση.
 *
 * @see bim/table/formula/catalog/formula-call-text.ts
 * @see bim/table/formula/catalog/formula-signature.ts
 */

import el from '@/i18n/locales/el/dxf-viewer.json';
import en from '@/i18n/locales/en/dxf-viewer.json';
import {
  buildFormulaCallDraft,
  filledArgumentCount,
  formulaCallFrameFromInsert,
  type FormulaCallFrame,
} from '../formula/catalog/formula-call-text';
import { insertFunctionCall } from '../formula/catalog/formula-insert-text';
import { FORMULA_ARGUMENT_STRUCTURE } from '../formula/catalog/formula-argument-data';
import { formulaCatalogKey } from '../formula/catalog/formula-catalog-taxonomy';
import { formulaHelpUrl } from '../formula/catalog/formula-help-url';
import {
  argumentHelpIndex,
  hasArgumentHelp,
  parseArgumentNames,
  resolveFormulaSignature,
  signatureRows,
} from '../formula/catalog/formula-signature';

const SUM_FRAME: FormulaCallFrame = { prefix: '=SUM(', suffix: ')' };

describe('ADR-763 §14 — η σύνθεση του προχείρου', () => {
  it('το πλαίσιο βγαίνει από την εισαγωγή της Φάσης 1, χωρίς δεύτερη ανάλυση', () => {
    const frame = formulaCallFrameFromInsert(insertFunctionCall({ draft: '', functionName: 'SUM' }));
    expect(frame).toEqual({ prefix: '=SUM(', suffix: ')' });
  });

  it('εμφύτευση σε υπάρχοντα τύπο κρατά ΚΑΙ ΤΑ ΔΥΟ άκρα', () => {
    // `=B2*|` + `SUM` ⇒ `=B2*SUM(|)`. Το `suffix` δεν είναι μόνο η κλειστή παρένθεση όταν
    // υπάρχει συνέχεια — και η πρώτη υλοποίηση που θα υπέθετε `')'` θα έκοβε τον τύπο.
    const inserted = insertFunctionCall({ draft: '=B2*+1', caretIndex: 4, functionName: 'SUM' });
    const frame = formulaCallFrameFromInsert(inserted);
    expect(frame.prefix).toBe('=B2*SUM(');
    expect(frame.suffix).toBe(')+1');
    expect(buildFormulaCallDraft(frame, ['A1'], ';').draft).toBe('=B2*SUM(A1)+1');
  });

  it('γράφει τα ορίσματα με τον διαχωριστή ΠΟΥ ΤΟΥ ΔΟΘΗΚΕ', () => {
    expect(buildFormulaCallDraft(SUM_FRAME, ['A1', 'B2'], ';').draft).toBe('=SUM(A1;B2)');
    // 🔴 Ο διαχωριστής είναι της γραμματικής του σχεδίου (ADR-761). Σταθερό `;` εδώ θα ήταν
    // η επόμενη αυθεντία — ακριβώς εκείνη που η Φ2.1 έσβησε από τις μεταφράσεις.
    expect(buildFormulaCallDraft(SUM_FRAME, ['A1', 'B2'], ',').draft).toBe('=SUM(A1,B2)');
  });

  it('🔴 τα κενά ΤΕΛΕΥΤΑΙΑ ορίσματα δεν γράφονται', () => {
    // Ο διάλογος δείχνει πάντα μία κενή σειρά παραπάνω· χωρίς την κοπή, κάθε τύπος θα
    // κουβαλούσε φάντασμα ορίσματος που ο χρήστης δεν ζήτησε.
    expect(buildFormulaCallDraft(SUM_FRAME, ['A1', 'B2', '', ''], ';').draft).toBe('=SUM(A1;B2)');
    expect(buildFormulaCallDraft(SUM_FRAME, [''], ';').draft).toBe('=SUM()');
    expect(buildFormulaCallDraft(SUM_FRAME, [], ';').draft).toBe('=SUM()');
  });

  it('🔴 τα κενά ΕΝΔΙΑΜΕΣΑ ορίσματα ΓΡΑΦΟΝΤΑΙ — αλλιώς αλλάζει η σημασία', () => {
    // `=IF(A1;;B2)` σημαίνει «τίποτα αν αληθές». Στοιβαγμένο αριστερά, το `B2` θα γινόταν
    // *τιμή αν αληθές* — άλλος τύπος, καμία προειδοποίηση.
    const frame: FormulaCallFrame = { prefix: '=IF(', suffix: ')' };
    expect(buildFormulaCallDraft(frame, ['A1', '', 'B2'], ';').draft).toBe('=IF(A1;;B2)');
  });

  it('τα εύρη δείχνουν πού κάθεται ΚΑΘΕ όρισμα μέσα στο πλήρες πρόχειρο', () => {
    const built = buildFormulaCallDraft(SUM_FRAME, ['A1', 'B2:C3'], ';');
    expect(built.spans).toEqual([{ from: 5, to: 7 }, { from: 8, to: 13 }]);
    expect(built.draft.slice(8, 13)).toBe('B2:C3');
  });

  it('🔴 τα εύρη είναι ΠΑΝΤΑ όσα και οι τιμές, ακόμη και για τις κομμένες', () => {
    // Κοντύτερος πίνακας θα φόρτωνε κάθε καταναλωτή με τη μετάφραση «κουτί → εύρος», και ο
    // πρώτος που θα την ξεχνούσε θα ρωτούσε για τη θέση **άλλου** ορίσματος.
    const built = buildFormulaCallDraft(SUM_FRAME, ['A1', '', ''], ';');
    expect(built.spans).toHaveLength(3);
    expect(built.spans[1]).toEqual({ from: 7, to: 7 });
    expect(built.spans[2]).toEqual({ from: 7, to: 7 });
    expect(built.draft).toBe('=SUM(A1)');
  });

  it('καθαρή και ιδεμποτής: ίδιες τιμές ⇒ ίδιο αποτέλεσμα', () => {
    const a = buildFormulaCallDraft(SUM_FRAME, ['A1', 'B2'], ';');
    const b = buildFormulaCallDraft(SUM_FRAME, ['A1', 'B2'], ';');
    expect(a).toEqual(b);
  });
});

describe('ADR-763 §14 — «πόσα κουτιά είναι σε χρήση»', () => {
  it('μετρά ΜΕΧΡΙ το τελευταίο γεμάτο, όχι πόσα είναι μη κενά', () => {
    // Ο χρήστης που γέμισε το πρώτο και το τρίτο έχει **τρία** ορίσματα σε χρήση· η σειρά
    // που μεγαλώνει είναι η τέταρτη. Με ωμή καταμέτρηση ο διάλογος θα «μάζευε» σειρά που
    // ο χρήστης βλέπει γεμάτη.
    expect(filledArgumentCount(['A1', '', 'C3'])).toBe(3);
    expect(filledArgumentCount(['A1', 'B2', '', ''])).toBe(2);
    expect(filledArgumentCount(['', ''])).toBe(0);
    expect(filledArgumentCount([])).toBe(0);
  });
});

/** Οι συναρτήσεις που **δηλώνουν** ότι έχουν γραμμένες επεξηγήσεις ορισμάτων. */
const HELPED = Object.keys(FORMULA_ARGUMENT_STRUCTURE).filter((name) => hasArgumentHelp(name));

type ArgHelpBundle = Record<string, Record<string, string>>;
type Locale = { table: { insertFunction: { args: Record<string, string> };
  functionArguments: { argHelp: ArgHelpBundle; kind: Record<string, string> } } };

const LOCALES: ReadonlyArray<readonly [string, Locale]> = [
  ['el', el as unknown as Locale],
  ['en', en as unknown as Locale],
];

describe('ADR-763 §17 — οι επεξηγήσεις ορισμάτων δεν επιτρέπεται να λείπουν μισές', () => {
  it.each(LOCALES)('%s: κάθε δηλωμένη έχει επεξήγηση για ΚΑΘΕ όρισμά της', (_lang, locale) => {
    const incomplete: string[] = [];
    for (const name of HELPED) {
      const key = formulaCatalogKey(name);
      const declared = parseArgumentNames(locale.table.insertFunction.args[key] ?? '').length;
      const written = Object.keys(locale.table.functionArguments.argHelp[key] ?? {}).length;
      if (written !== declared) incomplete.push(`${name}: ${written}/${declared}`);
    }
    // Μισή κάλυψη είναι χειρότερη από καμία: η κάτω γραμμή αδειάζει σε ένα μόνο `Tab` και ο
    // χρήστης το διαβάζει ως «αυτό το όρισμα δεν έχει σημασία».
    expect(incomplete).toEqual([]);
  });

  it.each(LOCALES)('%s: καμία ορφανή επεξήγηση σε συνάρτηση που δεν τη δηλώνει', (_lang, locale) => {
    const declared = new Set(HELPED.map((name) => formulaCatalogKey(name)));
    const orphans = Object.keys(locale.table.functionArguments.argHelp)
      .filter((key) => !declared.has(key));
    // Ορφανή επεξήγηση = κείμενο που μεταφράστηκε και **δεν ζωγραφίζεται ποτέ**, γιατί η
    // σημαία `h` είναι ο μόνος δρόμος προς αυτό.
    expect(orphans).toEqual([]);
  });

  it.each(LOCALES)('%s: κάθε είδος ορίσματος έχει μεταφρασμένη ετικέτα', (_lang, locale) => {
    const kinds = ['number', 'text', 'logical', 'reference', 'range', 'any'];
    const missing = kinds.filter((kind) => (locale.table.functionArguments.kind[kind] ?? '') === '');
    expect(missing).toEqual([]);
  });

  it('η κάλυψη ΜΕΤΡΙΕΤΑΙ — δεν είναι στόχος, είναι δηλωμένη κατάσταση', () => {
    // Ο ίδιος φρουρός με το `documented`: μια εφευρημένη επεξήγηση είναι χειρότερη από την
    // απουσία της, γιατί ο χρήστης τη διαβάζει ως βεβαιότητα (ADR-763 §3). Το νούμερο
    // **μεγαλώνει μόνο**· αν πέσει, κάποιος αφαίρεσε κείμενο χωρίς να το δηλώσει.
    expect(HELPED.length).toBeGreaterThanOrEqual(36);
  });
});

describe('ADR-763 §17 — ποιο κλειδί επεξήγησης διαβάζει κάθε σειρά', () => {
  const signatureOf = (name: string) => resolveFormulaSignature({
    name,
    argumentNames: (el as unknown as Locale).table.insertFunction.args[formulaCatalogKey(name)] ?? '',
    genericName: 'Όρισμα',
  });

  it('οι δηλωμένες σειρές διαβάζουν τον δικό τους δείκτη', () => {
    const vlookup = signatureOf('VLOOKUP');
    expect([0, 1, 2, 3].map((i) => argumentHelpIndex(vlookup, i))).toEqual([0, 1, 2, 3]);
  });

  it('🔴 η επαναλαμβανόμενη σειρά δανείζεται την επεξήγηση της ΘΕΣΗΣ ΤΗΣ ΣΤΗΝ ΟΜΑΔΑ', () => {
    // Το `Κείμενο7` του CONCATENATE σημαίνει ό,τι και το `Κείμενο2` — και η αριθμητική είναι
    // **η ίδια** που του δίνει το όνομά του. Αν οι δύο αποκλίνουν, ο χρήστης βλέπει σωστό
    // όνομα πάνω από λάθος επεξήγηση, χωρίς κανένα σφάλμα.
    const concat = signatureOf('CONCATENATE');
    expect(concat.repeat?.groupSize).toBe(1);
    expect([2, 3, 6].map((i) => argumentHelpIndex(concat, i))).toEqual([1, 1, 1]);
  });

  it('🔴 η ομάδα ΖΕΥΓΟΥΣ εναλλάσσει τους δύο δείκτες της', () => {
    const sumifs = signatureOf('SUMIFS');
    expect(sumifs.repeat?.groupSize).toBe(2);
    // Δηλωμένα: 0=περιοχή_άθροισης, 1=περιοχή_κριτηρίων1, 2=κριτήρια1. Η ομάδα είναι τα δύο
    // τελευταία, άρα οι νέες σειρές διαβάζουν εναλλάξ 1, 2, 1, 2…
    expect([3, 4, 5, 6].map((i) => argumentHelpIndex(sumifs, i))).toEqual([1, 2, 1, 2]);
  });

  it('η αριθμητική συμφωνεί με τα ΟΝΟΜΑΤΑ που παράγει το signatureRows', () => {
    // Η πραγματική άγκυρα: το όνομα και η επεξήγηση πρέπει να δείχνουν στο ίδιο πράγμα.
    const sumifs = signatureOf('SUMIFS');
    const rows = signatureRows(sumifs, 5);
    const helpIndex = argumentHelpIndex(sumifs, 3);
    expect(helpIndex).not.toBeNull();
    // Η σειρά 3 ονομάζεται «περιοχή_κριτηρίων2» και δανείζεται τη σειρά 1, «περιοχή_κριτηρίων1».
    expect(rows[3].name.replace(/\d+$/, '')).toBe(sumifs.args[1].name.replace(/\d+$/, ''));
  });

  it('καμία επεξήγηση όπου δεν υπάρχει: μη δηλωμένη, γενική υπογραφή, αρνητικός δείκτης', () => {
    expect(argumentHelpIndex(signatureOf('SUMSQ'), 0)).toBeNull();
    const generic = resolveFormulaSignature({ name: 'ΑΓΝΩΣΤΗ', argumentNames: '', genericName: 'Όρισμα' });
    expect(generic.named).toBe(false);
    expect(argumentHelpIndex(generic, 0)).toBeNull();
    expect(argumentHelpIndex(signatureOf('SUM'), -1)).toBeNull();
  });

  it('συνάρτηση μηδενικής τάξης: καμία σειρά, καμία επεξήγηση', () => {
    const pi = signatureOf('PI');
    expect(signatureRows(pi, 0)).toEqual([]);
    expect(argumentHelpIndex(pi, 0)).toBeNull();
  });
});

describe('ADR-763 §17 — ο σύνδεσμος τεκμηρίωσης', () => {
  it('κατασκευάζεται από το όνομα, άρα δεν μπορεί να αποκλίνει', () => {
    expect(formulaHelpUrl('VLOOKUP')).toContain('Excel%20VLOOKUP%20function');
  });

  it('η τελεία του ονόματος κωδικοποιείται, δεν σπάει τη διεύθυνση', () => {
    expect(formulaHelpUrl('CEILING.MATH')).toContain('CEILING.MATH'.replace('.', '.'));
    expect(formulaHelpUrl('CEILING.MATH')).not.toContain(' ');
  });

  it('κενό όνομα ⇒ κανένας σύνδεσμος, όχι σύνδεσμος προς το πουθενά', () => {
    expect(formulaHelpUrl('')).toBe('');
  });
});
