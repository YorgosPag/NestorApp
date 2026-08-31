/**
 * ADR-739 Φ.Ε (Α2) — οι καθαρές πράξεις μορφοποίησης άξονα.
 *
 * Τρία πράγματα αποδεικνύονται εδώ, και κανένα δεν είναι ορατό διαβάζοντας τον κώδικα:
 *  1. **νέο αντικείμενο** σε κάθε επίπεδο (αλλιώς τα δύο `WeakMap` δείχνουν παλιά διάταξη)·
 *  2. **ίδιο αντικείμενο by-reference** στο no-op (αλλιώς άχρηστα βήματα undo)·
 *  3. η κατάσταση του κουμπιού διαβάζεται από την **πραγματική επίλυση**, όχι από την
 *     παράκαμψη — γι' αυτό μια άβαφη στήλη πάνω σε κεφαλίδα+δεδομένα είναι **μεικτή**.
 *
 * @see bim/table/table-axis-style-ops.ts
 */

import {
  clearAxisStyleOverride,
  hasAnyAxisStyleOverride,
  hasAxisStyleOverride,
  nextBooleanFormat,
  resolveAxesFormat,
  resolveAxisFormat,
  resolveAxisNumericRange,
  setAxisStyleField,
  writeEachAxis,
} from '../table-axis-style-ops';
import { insertTableColumn, insertTableRow } from '../table-row-column-ops';
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { PersistedTableModel } from '../../../types/table';
import { bookOf } from './formula-book-fixture';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

/**
 * Το `standard` **με** την ιστορική ιεραρχία γραμμών (τίτλος 4mm έντονος · κεφαλίδα 3mm
 * έντονη με γέμισμα · δεδομένα 2,8mm κανονικά). Από την 2026-08-04 το ίδιο το preset είναι
 * ουδέτερο — κάθε κελί ισάξιο — οπότε δείγμα «μεικτής σειράς» δεν υπάρχει πια εκεί. Το
 * ερώτημα αυτής της ομάδας είναι η μηχανή, όχι το preset· με ομοιόμορφο δείγμα θα έμενε
 * πράσινη χωρίς να ρωτά τίποτα.
 */
const HIERARCHICAL = hierarchicalTableStyle();

/** Κεφαλίδα (έντονη από το στυλ) + δύο γραμμές δεδομένων (όχι έντονες) × δύο στήλες. */
function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
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

// ── Εγγραφή ─────────────────────────────────────────────────────────────────

describe('setAxisStyleField — οι τρεις καταστάσεις', () => {
  it('τιμή: γράφει την παράκαμψη στη σωστή στήλη και μόνο σε αυτήν', () => {
    const next = setAxisStyleField(model(), 'column', 'c1', 'bold', true);
    expect(next.columns[1].styleOverride).toEqual({ bold: true });
    expect(next.columns[0].styleOverride).toBeUndefined();
  });

  it('`undefined`: αφαιρεί το πεδίο — πίσω στην κληρονομιά', () => {
    const withBold = setAxisStyleField(model(), 'row', 'r1', 'bold', true);
    const cleared = setAxisStyleField(withBold, 'row', 'r1', 'bold', undefined);
    expect(cleared.rows[1].styleOverride).toBeUndefined();
  });

  it('`null`: μένει στην παράκαμψη ως ρητό ΚΑΝΕΝΑ, δεν εξαφανίζεται', () => {
    const next = setAxisStyleField(model(), 'column', 'c0', 'fillColorHex', null);
    expect(next.columns[0].styleOverride).toEqual({ fillColorHex: null });
  });

  it('η αφαίρεση του ΤΕΛΕΥΤΑΙΟΥ πεδίου δεν αφήνει κενό αντικείμενο πίσω της', () => {
    const two = setAxisStyleField(
      setAxisStyleField(model(), 'column', 'c0', 'bold', true),
      'column', 'c0', 'italic', true,
    );
    const one = setAxisStyleField(two, 'column', 'c0', 'bold', undefined);
    expect(one.columns[0].styleOverride).toEqual({ italic: true });

    const none = setAxisStyleField(one, 'column', 'c0', 'italic', undefined);
    expect(none.columns[0].styleOverride).toBeUndefined();
  });

  it('άγνωστη ταυτότητα ⇒ το ίδιο μοντέλο, καμία εντολή', () => {
    const start = model();
    expect(setAxisStyleField(start, 'column', 'ΔΕΝ_ΥΠΑΡΧΕΙ', 'bold', true)).toBe(start);
  });
});

describe('🔴 ταυτότητα — ο φύλακας των δύο WeakMap και του undo', () => {
  it('no-op (ίδια τιμή) ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference', () => {
    const bold = setAxisStyleField(model(), 'column', 'c0', 'bold', true);
    expect(setAxisStyleField(bold, 'column', 'c0', 'bold', true)).toBe(bold);
  });

  it('αφαίρεση πεδίου που δεν υπήρχε ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference', () => {
    const start = model();
    expect(setAxisStyleField(start, 'row', 'r0', 'italic', undefined)).toBe(start);
  });

  it('`clearAxisStyleOverride` σε άξονα χωρίς παράκαμψη ⇒ ΤΟ ΙΔΙΟ μοντέλο', () => {
    const start = model();
    expect(clearAxisStyleOverride(start, 'column', 'c0')).toBe(start);
  });

  it('πραγματική αλλαγή ⇒ ΝΕΟ αντικείμενο σε ΚΑΘΕ επίπεδο (μοντέλο, πίνακας, στοιχείο)', () => {
    const start = model();
    const next = setAxisStyleField(start, 'column', 'c0', 'bold', true);
    expect(next).not.toBe(start);
    expect(next.columns).not.toBe(start.columns);
    expect(next.columns[0]).not.toBe(start.columns[0]);
    // Ο άλλος άξονας ΔΕΝ αντιγράφεται χωρίς λόγο — μηδέν άχρηστη ακύρωση μνήμης.
    expect(next.rows).toBe(start.rows);
    expect(next.columns[1]).toBe(start.columns[1]);
  });

  it('`null` και `undefined` ΔΕΝ θεωρούνται ίδια τιμή (αλλιώς το «κανένα» θα ήταν no-op)', () => {
    const start = model();
    const nulled = setAxisStyleField(start, 'column', 'c0', 'fillColorHex', null);
    expect(nulled).not.toBe(start);
    expect(setAxisStyleField(nulled, 'column', 'c0', 'fillColorHex', undefined)).not.toBe(nulled);
  });
});

describe('clearAxisStyleOverride — η επιστροφή στο στυλ', () => {
  it('σβήνει ΟΛΑ τα πεδία με μία κίνηση', () => {
    const dressed = setAxisStyleField(
      setAxisStyleField(model(), 'row', 'r2', 'bold', true),
      'row', 'r2', 'textHeightMm', 9,
    );
    expect(clearAxisStyleOverride(dressed, 'row', 'r2').rows[2].styleOverride).toBeUndefined();
  });
});

// ── Κληρονομιά σε εισαγωγή (§28.7 ρίσκο 5) ──────────────────────────────────

describe('🔴 κληρονομιά σε εισαγωγή — ο λόγος ύπαρξης του μοντέλου επιπέδου άξονα', () => {
  it('νέα στήλη κληρονομεί το `styleOverride` της στήλης-αναφοράς', () => {
    const bold = setAxisStyleField(model(), 'column', 'c1', 'bold', true);
    const grown = insertTableColumn(bookOf(bold),bold, 1);
    expect(grown.columns[1].styleOverride).toEqual({ bold: true });
  });

  it('νέα γραμμή κληρονομεί το `styleOverride` της γραμμής-αναφοράς', () => {
    const italic = setAxisStyleField(model(), 'row', 'r1', 'italic', true);
    const grown = insertTableRow(bookOf(italic),italic, 1);
    expect(grown.rows[1].styleOverride).toEqual({ italic: true });
  });

  it('άβαφη αναφορά ⇒ άβαφο νέο στοιχείο (καμία εφεύρεση παράκαμψης)', () => {
    expect(insertTableColumn(bookOf(model()),model(), 0).columns[0].styleOverride).toBeUndefined();
    expect(insertTableRow(bookOf(model()),model(), 1).rows[1].styleOverride).toBeUndefined();
  });

  it('η νέα γραμμή ΔΕΝ κληρονομεί το `borderTop` (δείκτης συνόλων, όχι μορφοποίηση)', () => {
    const withTotalRule: PersistedTableModel = {
      ...model(),
      rows: model().rows.map((r) =>
        r.id === 'r2' ? { ...r, borderTop: { visible: true, colorHex: '#000', widthMm: 0.5 } } : r,
      ),
    };
    expect(insertTableRow(bookOf(withTotalRule),withTotalRule, 2).rows[2].borderTop).toBeUndefined();
  });
});

// ── Η κατάσταση του κουμπιού ────────────────────────────────────────────────

describe('resolveAxisFormat — τι δείχνει το χειριστήριο', () => {
  it('🔴 στήλη που περνά από κεφαλίδα (έντονη) και δεδομένα (όχι) ⇒ ΜΕΙΚΤΗ', () => {
    const state = resolveAxisFormat(model(), HIERARCHICAL, 'column', 'c0', 'bold');
    expect(state).toEqual({ value: undefined, mixed: true, overridden: false });
  });

  it('γραμμή δεδομένων χωρίς παράκαμψη ⇒ όχι έντονη, κληρονομημένη', () => {
    expect(resolveAxisFormat(model(), HIERARCHICAL, 'row', 'r1', 'bold'))
      .toEqual({ value: false, mixed: false, overridden: false });
  });

  it('γραμμή κεφαλίδας ⇒ έντονη ΑΠΟ ΤΟ ΣΤΥΛ — τιμή ναι, παράκαμψη όχι', () => {
    expect(resolveAxisFormat(model(), HIERARCHICAL, 'row', 'r0', 'bold'))
      .toEqual({ value: true, mixed: false, overridden: false });
  });

  it('παράκαμψη στήλης ισοπεδώνει τη μεικτή κατάσταση και δηλώνεται ως ρητή', () => {
    const bold = setAxisStyleField(model(), 'column', 'c0', 'bold', true);
    expect(resolveAxisFormat(bold, HIERARCHICAL, 'column', 'c0', 'bold'))
      .toEqual({ value: true, mixed: false, overridden: true });
  });

  it('🔴 παράκαμψη ΚΕΛΙΟΥ που διαφωνεί κρατά τον άξονα μεικτό — λέει την αλήθεια', () => {
    const bold = setAxisStyleField(model(), 'column', 'c0', 'bold', true);
    const withCell: PersistedTableModel = {
      ...bold,
      cells: [['r1', 'c0', { kind: 'text', value: 'x', styleOverride: { bold: false } }]],
    };
    const state = resolveAxisFormat(withCell, HIERARCHICAL, 'column', 'c0', 'bold');
    expect(state?.mixed).toBe(true);
    // …αλλά η ΠΑΡΑΚΑΜΨΗ του άξονα εξακολουθεί να υπάρχει: δύο ορθογώνιες ερωτήσεις.
    expect(state?.overridden).toBe(true);
  });

  it('`overridden` βλέπει ΤΟ ΣΥΓΚΕΚΡΙΜΕΝΟ πεδίο, όχι «έχει κάποια παράκαμψη»', () => {
    const italic = setAxisStyleField(model(), 'row', 'r1', 'italic', true);
    expect(resolveAxisFormat(italic, HIERARCHICAL, 'row', 'r1', 'bold')?.overridden).toBe(false);
    expect(resolveAxisFormat(italic, HIERARCHICAL, 'row', 'r1', 'italic')?.overridden).toBe(true);
  });

  it('άγνωστη ταυτότητα ⇒ `null`, ποτέ ψεύτικη κατάσταση', () => {
    expect(resolveAxisFormat(model(), HIERARCHICAL, 'row', 'ΔΕΝ_ΥΠΑΡΧΕΙ', 'bold')).toBeNull();
  });

  it('διαβάζει και μη-δίτιμα πεδία με το ίδιο σχήμα', () => {
    const sized = setAxisStyleField(model(), 'column', 'c1', 'textHeightMm', 5);
    expect(resolveAxisFormat(sized, HIERARCHICAL, 'column', 'c1', 'textHeightMm'))
      .toEqual({ value: 5, mixed: false, overridden: true });
  });
});

describe('nextBooleanFormat — ο κανόνας του πατήματος', () => {
  it('ναι ⇒ όχι', () => {
    expect(nextBooleanFormat({ value: true, mixed: false, overridden: true })).toBe(false);
  });

  it('όχι ⇒ ναι', () => {
    expect(nextBooleanFormat({ value: false, mixed: false, overridden: false })).toBe(true);
  });

  it('🔴 μεικτό ⇒ ναι (η μόνη επιλογή με ορατή αλλαγή σε ΚΑΘΕ κελί που διαφωνούσε)', () => {
    expect(nextBooleanFormat({ value: undefined, mixed: true, overridden: false })).toBe(true);
  });

  it('άγνωστη κατάσταση ⇒ ναι', () => {
    expect(nextBooleanFormat(null)).toBe(true);
  });
});

// ── Το εύρος — από πού ξεκινά ένα βήμα μεγέθους (ADR-739 Φ.Ε βήμα 5) ────────────

describe('resolveAxisNumericRange — τα άκρα μιας αριθμητικής ιδιότητας κατά μήκος του άξονα', () => {
  it('🔴 μεικτή στήλη (κεφαλίδα 3mm έντονη + δύο γραμμές δεδομένων 2.8mm) ⇒ σωστά min/max', () => {
    // Ο ίδιος λόγος που υπάρχει η συνάρτηση: καμία στήλη δεν είναι ομοιόμορφη σε ύψος
    // κειμένου, γιατί περνά από κεφαλίδα (HIERARCHICAL: 3mm) και δεδομένα (HIERARCHICAL: 2.8mm).
    expect(resolveAxisNumericRange(model(), HIERARCHICAL, 'column', 'c0', 'textHeightMm'))
      .toEqual({ min: 2.8, max: 3 });
  });

  it('άγνωστη ταυτότητα ⇒ null', () => {
    expect(resolveAxisNumericRange(model(), HIERARCHICAL, 'row', 'ΔΕΝ_ΥΠΑΡΧΕΙ', 'textHeightMm')).toBeNull();
  });

  it('αγνοεί μη-αριθμητικά (NaN σε παράκαμψη κελιού) χωρίς να χαλάει το εύρος των υπολοίπων', () => {
    // Η κεφαλίδα (r0) παίρνει ΜΗ-πεπερασμένη παράκαμψη κελιού· ο βρόχος πρέπει να την
    // προσπεράσει σιωπηλά (`Number.isFinite`) αντί να επιστρέψει `NaN` ή να σκάσει.
    const withNaN: PersistedTableModel = {
      ...model(),
      cells: [['r0', 'c0', { kind: 'text', value: 'x', styleOverride: { textHeightMm: NaN } }]],
    };
    // Μένουν μόνο οι δύο γραμμές δεδομένων (2.8mm) — ομοιόμορφο εύρος.
    expect(resolveAxisNumericRange(withNaN, HIERARCHICAL, 'column', 'c0', 'textHeightMm'))
      .toEqual({ min: 2.8, max: 2.8 });
  });
});

describe('hasAxisStyleOverride — έχει ο άξονας κάτι να σβήσει;', () => {
  it('true όταν ο άξονας δηλώνει ρητά τουλάχιστον ένα πεδίο', () => {
    const bold = setAxisStyleField(model(), 'column', 'c0', 'bold', true);
    expect(hasAxisStyleOverride(bold, 'column', 'c0')).toBe(true);
  });

  it('false όταν ο άξονας δεν έχει καμία παράκαμψη (τίποτα να καθαρίσει)', () => {
    expect(hasAxisStyleOverride(model(), 'column', 'c0')).toBe(false);
  });

  it('false για άγνωστη ταυτότητα — όχι σφάλμα, όχι ψευδές true', () => {
    expect(hasAxisStyleOverride(model(), 'row', 'ΔΕΝ_ΥΠΑΡΧΕΙ')).toBe(false);
  });
});

describe('🔴 regression — resolveAxisFormat και resolveAxisNumericRange μοιράζονται ΤΟΝ ΙΔΙΟ βρόχο (Α6)', () => {
  it('σύγκρουση στήλης/γραμμής στο ΙΔΙΟ αριθμητικό πεδίο ⇒ η γραμμή νικά — ένας δεύτερος βρόχος με άλλη σειρά merge θα έδινε {min:9, max:9}', () => {
    const withBoth = setAxisStyleField(
      setAxisStyleField(model(), 'column', 'c0', 'textHeightMm', 9),
      'row', 'r1', 'textHeightMm', 1.5,
    );
    // r0 (κεφαλίδα) + r2 (δεδομένα) ακολουθούν τη στήλη (9)· η r1 έχει ΔΙΚΗ ΤΗΣ παράκαμψη
    // γραμμής (1.5) που νικά τη στήλη — αν το εύρος δεν το έβλεπε, θα ήταν {min:9,max:9}.
    expect(resolveAxisNumericRange(withBoth, HIERARCHICAL, 'column', 'c0', 'textHeightMm'))
      .toEqual({ min: 1.5, max: 9 });
  });

  it('η ΙΔΙΑ ακριβώς σύγκρουση σε δίτιμο πεδίο, μέσα από το resolveAxisFormat, δίνει μεικτή κατάσταση — ίδιο σχήμα προτεραιότητας', () => {
    const withBoth = setAxisStyleField(
      setAxisStyleField(model(), 'column', 'c0', 'bold', true),
      'row', 'r1', 'bold', false,
    );
    // Αν το resolveAxisFormat χρησιμοποιούσε δικό του βρόχο θα μπορούσε να δει `bold: true`
    // παντού (μόνο τη στήλη) και να χάσει ότι η r1 νικά με `false` — δηλαδή θα έλεγε ψευδώς
    // «δεν είναι μεικτό».
    expect(resolveAxisFormat(withBoth, HIERARCHICAL, 'column', 'c0', 'bold')?.mixed).toBe(true);
  });
});

// ── Πολλοί άξονες (§27.17) ──────────────────────────────────────────────────

/**
 * 🔴 ADR-739 §27.17 — **η ίδια ερώτηση, ένα επίπεδο πάνω.**
 *
 * Η συνάθροιση δεν είναι κοσμητική: από αυτήν βγαίνει η **επόμενη τιμή** του `nextBooleanFormat`
 * («μεικτό ⇒ όλα ναι»). Αν απαντούσε λάθος, το «Β» πάνω σε δύο έντονες και μία απλή στήλη θα
 * **αντέστρεφε** τη μία αντί να τις ορίσει όλες — δηλαδή το κουμπί θα έκανε το αντίθετο από το
 * όνομά του, ακριβώς στην περίπτωση που η πολλαπλή επιλογή υπάρχει για να εξυπηρετήσει.
 */
describe('resolveAxesFormat — η συνάθροιση πάνω από άξονες', () => {
  const bolded = (ids: readonly string[]): PersistedTableModel =>
    ids.reduce((m, id) => setAxisStyleField(m, 'column', id, 'bold', true), model());

  it('συμφωνία ⇒ η κοινή τιμή, καθόλου μεικτό', () => {
    // Και οι δύο στήλες ρητά έντονες σε **όλα** τα κελιά τους ⇒ μία απάντηση.
    const next = bolded(['c0', 'c1']);
    expect(resolveAxesFormat(next, HIERARCHICAL, 'column', ['c0', 'c1'], 'bold'))
      .toEqual({ value: true, mixed: false, overridden: true });
  });

  it('🔴 διαφωνία ΜΕΤΑΞΥ αξόνων ⇒ μεικτό, χωρίς τιμή — ακόμα κι όταν ο καθένας είναι ομοιόμορφος', () => {
    const next = setAxisStyleField(bolded(['c0']), 'column', 'c1', 'bold', false);
    expect(resolveAxesFormat(next, HIERARCHICAL, 'column', ['c0', 'c1'], 'bold'))
      .toEqual({ value: undefined, mixed: true, overridden: true });
  });

  it('ένας μεικτός μολύνει το σύνολο — μία διαφωνία αρκεί', () => {
    // Το `c1` δεν δηλώνει τίποτα ⇒ κληρονομεί κεφαλίδα (έντονη) + δεδομένα (όχι) ⇒ μεικτό.
    const state = resolveAxesFormat(bolded(['c0']), HIERARCHICAL, 'column', ['c0', 'c1'], 'bold');
    expect(state?.mixed).toBe(true);
  });

  it('🔴 `overridden` = ΟΛΟΙ ρητά — ο δείκτης λέει «το ζήτησες εσύ», όχι «κάποιος το ζήτησε»', () => {
    const next = bolded(['c0']);
    expect(resolveAxesFormat(next, HIERARCHICAL, 'column', ['c0', 'c1'], 'bold')?.overridden)
      .toBe(false);
  });

  it('ένας άξονας ⇒ ταυτόσημη απάντηση με το `resolveAxisFormat` (καμία αλλαγή συμπεριφοράς)', () => {
    const next = bolded(['c0']);
    expect(resolveAxesFormat(next, HIERARCHICAL, 'column', ['c0'], 'bold'))
      .toEqual(resolveAxisFormat(next, HIERARCHICAL, 'column', 'c0', 'bold'));
  });

  it('μπαγιάτικη ταυτότητα προσπερνιέται· κενή λίστα ⇒ `null`, ποτέ μαντεψιά', () => {
    const next = bolded(['c0']);
    expect(resolveAxesFormat(next, HIERARCHICAL, 'column', ['c0', 'c9'], 'bold')?.value).toBe(true);
    expect(resolveAxesFormat(next, HIERARCHICAL, 'column', [], 'bold')).toBeNull();
    expect(resolveAxesFormat(next, HIERARCHICAL, 'column', ['c9'], 'bold')).toBeNull();
  });

  it('🔴 τροφοδοτεί σωστά τον κανόνα του πατήματος: μεικτό ⇒ ΟΛΑ ΝΑΙ', () => {
    const mixedState = resolveAxesFormat(bolded(['c0']), HIERARCHICAL, 'column', ['c0', 'c1'], 'bold');
    expect(nextBooleanFormat(mixedState)).toBe(true);

    const allBold = resolveAxesFormat(bolded(['c0', 'c1']), HIERARCHICAL, 'column', ['c0', 'c1'], 'bold');
    expect(nextBooleanFormat(allBold)).toBe(false);
  });
});

describe('writeEachAxis / hasAnyAxisStyleOverride — η εγγραφή και το «τι θα σβήσει»', () => {
  it('γράφει σε όλους τους ζητούμενους άξονες με μία κλήση', () => {
    const next = writeEachAxis(model(), ['c0', 'c1'], (m, id) =>
      setAxisStyleField(m, 'column', id, 'bold', true));
    expect(next.columns.map((c) => c.styleOverride)).toEqual([{ bold: true }, { bold: true }]);
  });

  it('🔴 κανένας άξονας δεν άλλαξε ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo)', () => {
    const before = writeEachAxis(model(), ['c0', 'c1'], (m, id) =>
      setAxisStyleField(m, 'column', id, 'bold', true));
    const again = writeEachAxis(before, ['c0', 'c1'], (m, id) =>
      setAxisStyleField(m, 'column', id, 'bold', true));
    expect(again).toBe(before);
  });

  it('🔴 «υπάρχει τι να επαναφερθεί;» = `some`: ένας στους τρεις αρκεί', () => {
    const next = setAxisStyleField(model(), 'column', 'c1', 'bold', true);
    expect(hasAnyAxisStyleOverride(next, 'column', ['c0', 'c1'])).toBe(true);
    expect(hasAnyAxisStyleOverride(next, 'column', ['c0'])).toBe(false);
    expect(hasAnyAxisStyleOverride(next, 'column', [])).toBe(false);
  });
});
