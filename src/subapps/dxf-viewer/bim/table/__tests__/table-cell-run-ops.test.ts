/**
 * 🔴 ADR-753 Φ1 — **μορφοποίηση ανά χαρακτήρα**: οι καθαρές πράξεις.
 *
 * ## Τι κλειδώνεται εδώ, και γιατί αυτό
 * Οι πέντε αναλλοίωτες της κανονικοποίησης δεν ελέγχονται μία-μία σε στημένα σχήματα: αυτό θα
 * κλείδωνε τον **τρόπο**, όχι το αποτέλεσμα. Ελέγχονται μέσα από τον {@link readBack} — ένας
 * ανεξάρτητος αναγνώστης που ξεδιπλώνει τα runs **ανά χαρακτήρα** χωρίς να ξέρει τίποτα για
 * τη μηχανή. Έτσι μια «απλοποίηση» που παράγει επικαλυπτόμενα ή ασυγχώνευτα runs φαίνεται ως
 * **λάθος χαρακτήρας**, όχι ως διαφορετικό σχήμα που κάποιος θα έμπαινε στον πειρασμό να
 * ενημερώσει στο test.
 *
 * ⚠️ Ο αναγνώστης είναι επίτηδες **αφελής** (τελευταία εγγραφή κερδίζει): αν η μηχανή αρχίσει
 * να παράγει επικαλύψεις, εκείνος δεν θα «διορθώσει» — θα δείξει το αποτέλεσμα της επικάλυψης.
 *
 * @see bim/table/table-cell-run-ops.ts
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md
 */

import {
  clearCellRunStyles,
  remapCellTextRuns,
  setCellRunStyleField,
} from '../table-cell-run-ops';
// ADR-753 Φ4 (N.7.1) — η **ανάγνωση** μετακόμισε σε αδελφό αρχείο όταν το `table-cell-run-ops`
// πέρασε τις 500 γραμμές. Ίδιες συναρτήσεις, ίδια συμπεριφορά, άλλη διαδρομή εισαγωγής.
import {
  hasCellRunStyles,
  resolveCellRunFormat,
} from '../table-cell-run-state';
import type { TableCellTextRun, TableTextRunStyle } from '../../../types/table';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

/**
 * Τα runs ξεδιπλωμένα σε **ένα σύμβολο ανά χαρακτήρα** — ο ανεξάρτητος αναγνώστης.
 *
 * `Β` έντονο · `Ι` πλάγιο · `Υ` υπογραμμισμένο · `.` τίποτα ρητό. Ένας συνδυασμός γράφεται
 * μαζί (`ΒΙ`), οπότε η σύγκριση γίνεται με πίνακα συμβολοσειρών και διαβάζεται με το μάτι.
 */
function readBack(runs: readonly TableCellTextRun[] | undefined, length: number): string[] {
  const out = new Array<string>(length).fill('.');
  for (const run of runs ?? []) {
    for (let i = Math.max(0, run.start); i < Math.min(length, run.end); i += 1) {
      const marks = `${run.style.bold ? 'Β' : ''}${run.style.italic ? 'Ι' : ''}${run.style.underline ? 'Υ' : ''}`;
      out[i] = marks === '' ? (run.style.textColorHex ?? '.') : marks;
    }
  }
  return out;
}

const range = (start: number, end: number) => ({ start, end });

/** «ΤΕΣΤ» με τα δύο πρώτα γράμματα έντονα — το ακριβές σενάριο του αιτήματος. */
const TEST_TEXT = 'ΤΕΣΤ';
const boldFirstTwo = (): readonly TableCellTextRun[] | undefined =>
  setCellRunStyleField(undefined, TEST_TEXT.length, range(0, 2), 'bold', true);

// ── Εγγραφή ─────────────────────────────────────────────────────────────────

describe('setCellRunStyleField — το αίτημα, κατά γράμμα', () => {
  it('«ΤΕΣΤ», επιλογή «ΤΕ», Β ⇒ έντονα ΜΟΝΟ τα δύο πρώτα', () => {
    expect(readBack(boldFirstTwo(), 4)).toEqual(['Β', 'Β', '.', '.']);
  });

  it('δεύτερο πεδίο στο ίδιο εύρος συσσωρεύεται, δεν αντικαθιστά', () => {
    const runs = setCellRunStyleField(boldFirstTwo(), 4, range(0, 2), 'italic', true);
    expect(readBack(runs, 4)).toEqual(['ΒΙ', 'ΒΙ', '.', '.']);
  });

  it('επικαλυπτόμενα εύρη δεν αφήνουν ποτέ δύο runs στον ίδιο χαρακτήρα', () => {
    const bold = setCellRunStyleField(undefined, 4, range(0, 3), 'bold', true);
    const runs = setCellRunStyleField(bold, 4, range(2, 4), 'italic', true);

    expect(readBack(runs, 4)).toEqual(['Β', 'Β', 'ΒΙ', 'Ι']);
    // Η ουσία: κάθε χαρακτήρας ανήκει σε ΕΝΑ run — αλλιώς οι 4 ζωγράφοι θα ρωτούσαν «ποιο νικά;»
    for (let i = 0; i < 4; i += 1) {
      expect((runs ?? []).filter((r) => r.start <= i && r.end > i)).toHaveLength(1);
    }
  });

  it('γειτονικά ΙΣΑ runs συγχωνεύονται σε ένα', () => {
    const first = setCellRunStyleField(undefined, 4, range(0, 2), 'bold', true);
    const runs = setCellRunStyleField(first, 4, range(2, 4), 'bold', true);

    expect(readBack(runs, 4)).toEqual(['Β', 'Β', 'Β', 'Β']);
    expect(runs).toHaveLength(1);
    expect(runs?.[0]).toEqual({ start: 0, end: 4, style: { bold: true } });
  });

  it('γειτονικά ΑΝΙΣΑ runs ΔΕΝ συγχωνεύονται', () => {
    const bold = setCellRunStyleField(undefined, 4, range(0, 2), 'bold', true);
    const runs = setCellRunStyleField(bold, 4, range(2, 4), 'italic', true);
    expect(runs).toHaveLength(2);
  });

  it('🔴 ίσα στυλ φτιαγμένα με ΑΝΤΙΣΤΡΟΦΗ σειρά πατημάτων συγχωνεύονται κι αυτά', () => {
    // Ο φύλακας του `sameStyle`: το αριστερό run γεννιέται «Β μετά Ι», το δεξί «Ι μετά Β».
    // Είναι το ΙΔΙΟ στυλ — αλλά με άλλη σειρά κλειδιών στο αντικείμενο. Μια σύγκριση μέσω
    // `JSON.stringify` θα τα έκρινε διαφορετικά, δεν θα τα συγχώνευε ποτέ, και η εγγύηση
    // ταυτότητας θα έλεγε «άλλαξε» σε κάθε πάτημα που δεν αλλάζει τίποτα.
    let runs = setCellRunStyleField(undefined, 4, range(0, 2), 'bold', true);
    runs = setCellRunStyleField(runs, 4, range(2, 4), 'italic', true);
    runs = setCellRunStyleField(runs, 4, range(0, 2), 'italic', true);
    runs = setCellRunStyleField(runs, 4, range(2, 4), 'bold', true);

    expect(readBack(runs, 4)).toEqual(['ΒΙ', 'ΒΙ', 'ΒΙ', 'ΒΙ']);
    expect(runs).toHaveLength(1);
  });

  it('`undefined` αφαιρεί το πεδίο — και το κενό run εξαφανίζεται μαζί του', () => {
    const runs = setCellRunStyleField(boldFirstTwo(), 4, range(0, 2), 'bold', undefined);
    expect(readBack(runs, 4)).toEqual(['.', '.', '.', '.']);
    // ⚠️ `undefined`, ΟΧΙ `[]`: ένα άδειο άρθρωμα θα ταξίδευε στο JSON και θα έλεγε «έχει
    // μορφοποίηση» για κελί που δεν έχει καμία.
    expect(runs).toBeUndefined();
  });

  it('αφαίρεση ΕΝΟΣ πεδίου αφήνει τα υπόλοιπα ζωντανά', () => {
    const both = setCellRunStyleField(boldFirstTwo(), 4, range(0, 2), 'italic', true);
    const runs = setCellRunStyleField(both, 4, range(0, 2), 'bold', undefined);
    expect(readBack(runs, 4)).toEqual(['Ι', 'Ι', '.', '.']);
  });

  it('εύρος πέρα από το κείμενο κόβεται — κανένα run δεν δείχνει στο πουθενά', () => {
    const runs = setCellRunStyleField(undefined, 4, range(2, 99), 'bold', true);
    expect(runs?.every((run) => run.end <= 4)).toBe(true);
    expect(readBack(runs, 4)).toEqual(['.', '.', 'Β', 'Β']);
  });

  it('ανάποδο εύρος διαβάζεται σωστά (η επιλογή προς τα πίσω είναι επιλογή)', () => {
    const runs = setCellRunStyleField(undefined, 4, range(3, 1), 'bold', true);
    expect(readBack(runs, 4)).toEqual(['.', 'Β', 'Β', '.']);
  });

  it('κενό εύρος δεν γράφει τίποτα', () => {
    expect(setCellRunStyleField(undefined, 4, range(2, 2), 'bold', true)).toBeUndefined();
  });
});

describe('εγγύηση ταυτότητας — κανένα βήμα undo για το τίποτα', () => {
  it('ίδια τιμή σε ήδη έντονο εύρος ⇒ ο ΙΔΙΟΣ πίνακας by-reference', () => {
    const runs = boldFirstTwo();
    expect(setCellRunStyleField(runs, 4, range(0, 2), 'bold', true)).toBe(runs);
  });

  it('ισχύει και όταν η ισότητα προκύπτει από συγχώνευση, όχι από παράλειψη', () => {
    const whole = setCellRunStyleField(undefined, 4, range(0, 4), 'bold', true);
    // Ξαναγράφεται ένα υποσύνολο με την ίδια τιμή: το αποτέλεσμα ξαναχτίζεται από την αρχή και
    // πρέπει να αναγνωριστεί ως ταυτόσημο — αλλιώς κάθε πάτημα γεννά νέο αντικείμενο.
    expect(setCellRunStyleField(whole, 4, range(1, 3), 'bold', true)).toBe(whole);
  });

  it('αφαίρεση πεδίου που δεν υπάρχει ⇒ ο ίδιος πίνακας', () => {
    const runs = boldFirstTwo();
    expect(setCellRunStyleField(runs, 4, range(0, 2), 'italic', undefined)).toBe(runs);
  });

  it('πραγματική αλλαγή ⇒ ΝΕΟΣ πίνακας (ο φύλακας δεν είναι υπερβολικά πρόθυμος)', () => {
    const runs = boldFirstTwo();
    expect(setCellRunStyleField(runs, 4, range(0, 2), 'italic', true)).not.toBe(runs);
  });
});

describe('clearCellRunStyles — η «Απαλοιφή μορφοποίησης» σε εύρος', () => {
  it('σβήνει ΚΑΘΕ πεδίο μέσα στο εύρος, με ένα πέρασμα', () => {
    const bold = setCellRunStyleField(undefined, 4, range(0, 4), 'bold', true);
    const both = setCellRunStyleField(bold, 4, range(0, 4), 'underline', true);
    expect(readBack(clearCellRunStyles(both, 4, range(1, 3)), 4)).toEqual(['ΒΥ', '.', '.', 'ΒΥ']);
  });

  it('αφήνει ανέπαφο ό,τι είναι έξω από το εύρος', () => {
    const runs = clearCellRunStyles(boldFirstTwo(), 4, range(2, 4));
    expect(readBack(runs, 4)).toEqual(['Β', 'Β', '.', '.']);
  });
});

// ── Μετατόπιση δεικτών ──────────────────────────────────────────────────────

describe('remapCellTextRuns — οι δείκτες ακολουθούν το κείμενο', () => {
  it('εισαγωγή ΠΡΙΝ τη βαμμένη ζώνη τη σπρώχνει δεξιά', () => {
    // «ΤΕΣΤ» με έντονα τα «ΤΕ» → «ΧΤΕΣΤ»: τα έντονα είναι πλέον οι θέσεις 1-2.
    const runs = remapCellTextRuns(boldFirstTwo(), 'ΤΕΣΤ', 'ΧΤΕΣΤ');
    expect(readBack(runs, 5)).toEqual(['.', 'Β', 'Β', '.', '.']);
  });

  it('διαγραφή ΠΡΙΝ τη βαμμένη ζώνη την τραβά αριστερά', () => {
    const runs = setCellRunStyleField(undefined, 5, range(3, 5), 'bold', true);
    expect(readBack(remapCellTextRuns(runs, 'ΑΒΓΔΕ', 'ΒΓΔΕ'), 4)).toEqual(['.', '.', 'Β', 'Β']);
  });

  it('🔴 ό,τι γράφεται ΜΕΣΑ σε βαμμένη ζώνη κληρονομεί από ΑΡΙΣΤΕΡΑ', () => {
    // «ΤΕΣΤ» έντονα τα «ΤΕ»· γράφεται «Χ» ανάμεσά τους ⇒ το «Χ» βγαίνει έντονο, όπως σε κάθε
    // επεξεργαστή όταν συνεχίζεις να γράφεις μέσα σε έντονη λέξη.
    expect(readBack(remapCellTextRuns(boldFirstTwo(), 'ΤΕΣΤ', 'ΤΧΕΣΤ'), 5))
      .toEqual(['Β', 'Β', 'Β', '.', '.']);
  });

  it('ό,τι γράφεται ΑΜΕΣΩΣ ΜΕΤΑ τη ζώνη κληρονομεί κι αυτό (το αριστερά είναι βαμμένο)', () => {
    expect(readBack(remapCellTextRuns(boldFirstTwo(), 'ΤΕΣΤ', 'ΤΕΧΣΤ'), 5))
      .toEqual(['Β', 'Β', 'Β', '.', '.']);
  });

  it('ό,τι γράφεται στη ΘΕΣΗ 0 γεννιέται άβαφο — δεν υπάρχει αριστερά να κληρονομήσει', () => {
    expect(readBack(remapCellTextRuns(boldFirstTwo(), 'ΤΕΣΤ', 'ΧΤΕΣΤ'), 5)[0]).toBe('.');
  });

  it('διαγραφή ΟΛΟΚΛΗΡΗΣ της βαμμένης ζώνης τη σβήνει', () => {
    expect(remapCellTextRuns(boldFirstTwo(), 'ΤΕΣΤ', 'ΣΤ')).toBeUndefined();
  });

  it('άδειασμα του κελιού σβήνει τα πάντα', () => {
    expect(remapCellTextRuns(boldFirstTwo(), 'ΤΕΣΤ', '')).toBeUndefined();
  });

  it('🔴 επαναλαμβανόμενοι χαρακτήρες: το πρόθεμα δεν επιτρέπεται να σκεπάσει το επίθεμα', () => {
    // «αα» με ΔΙΑΦΟΡΕΤΙΚΟ στυλ ανά χαρακτήρα (Β, Ι) → «αααα»: γράφτηκαν δύο «α» στο τέλος.
    //
    // Πρόθεμα 2· ανεξάρτητο επίθεμα επίσης 2 ⇒ 4 «αμετάβλητοι» χαρακτήρες σε κείμενο 4, με
    // αλλαγμένη ζώνη ΑΡΝΗΤΙΚΗ. Χωρίς τον φραγμό, οι νέες θέσεις διαβάζουν `old[i − delta]`
    // και το αποτέλεσμα βγαίνει **εναλλάξ** [Β, Ι, Β, Ι] — σαν να επαναλήφθηκε η μορφοποίηση,
    // ενώ ο χρήστης απλώς πληκτρολόγησε δύο γράμματα. Το σωστό είναι κληρονομιά από αριστερά.
    //
    // ⚠️ Το σενάριο χρειάζεται **δύο διαφορετικά** στυλ: με ενιαίο στυλ οι δύο εκδοχές δίνουν
    // κατά σύμπτωση το ίδιο αποτέλεσμα και η μετάλλαξη επιβιώνει (μετρημένο).
    let runs = setCellRunStyleField(undefined, 2, range(0, 1), 'bold', true);
    runs = setCellRunStyleField(runs, 2, range(1, 2), 'italic', true);

    expect(readBack(remapCellTextRuns(runs, 'αα', 'αααα'), 4)).toEqual(['Β', 'Ι', 'Ι', 'Ι']);
  });

  it('ίδιο κείμενο ⇒ ο ίδιος πίνακας by-reference', () => {
    const runs = boldFirstTwo();
    expect(remapCellTextRuns(runs, 'ΤΕΣΤ', 'ΤΕΣΤ')).toBe(runs);
  });

  it('κελί χωρίς runs μένει χωρίς runs, ό,τι κι αν γίνει στο κείμενο', () => {
    expect(remapCellTextRuns(undefined, 'Α', 'ΑΒΓ')).toBeUndefined();
  });

  it('αντικατάσταση όλου του κειμένου με άλλο ίδιου μήκους δεν αφήνει μπαγιάτικο χρώμα', () => {
    const runs = setCellRunStyleField(undefined, 4, range(0, 4), 'textColorHex', '#ff0000');
    // Κανένα κοινό πρόθεμα/επίθεμα ⇒ όλα νέα ⇒ καμία κληρονομιά από αριστερά (θέση 0).
    expect(readBack(remapCellTextRuns(runs, 'ΑΒΓΔ', 'ΕΖΗΘ'), 4)).toEqual(['.', '.', '.', '.']);
  });
});

// ── Ανάγνωση ────────────────────────────────────────────────────────────────

describe('resolveCellRunFormat — τι δείχνει το κουμπί', () => {
  const inherited = false;

  it('ομοιόμορφη επιλογή ⇒ η τιμή της, χωρίς ανάμεικτο', () => {
    expect(resolveCellRunFormat(boldFirstTwo(), 4, range(0, 2), 'bold', inherited))
      .toEqual({ value: true, mixed: false, overridden: true });
  });

  it('επιλογή που πατά και στα δύο ⇒ ΑΝΑΜΕΙΚΤΟ', () => {
    const state = resolveCellRunFormat(boldFirstTwo(), 4, range(0, 4), 'bold', inherited);
    expect(state.mixed).toBe(true);
    expect(state.value).toBeUndefined();
  });

  it('🔴 επιλογή χωρίς runs απαντά την ΚΛΗΡΟΝΟΜΙΑ, όχι «όχι έντονα»', () => {
    // Το κρίσιμο: σε κελί που το ΣΤΥΛ του γράφει έντονο, το κουμπί οφείλει να δείχνει έντονο.
    // Διαβάζοντας μόνο τα runs θα διέψευδε ό,τι βλέπει ο χρήστης στην οθόνη.
    expect(resolveCellRunFormat(undefined, 4, range(0, 4), 'bold', true))
      .toEqual({ value: true, mixed: false, overridden: false });
  });

  it('ρητό run ΙΣΟ με την κληρονομιά δεν είναι ανάμεικτο — αλλά ΕΙΝΑΙ ρητό', () => {
    const runs = setCellRunStyleField(undefined, 4, range(0, 2), 'bold', true);
    const state = resolveCellRunFormat(runs, 4, range(0, 4), 'bold', true);
    expect(state).toEqual({ value: true, mixed: false, overridden: true });
  });

  it('κενή επιλογή (κέρσορας) απαντά για τον χαρακτήρα ΑΡΙΣΤΕΡΑ', () => {
    // Ίδιος κανόνας με τη μετατόπιση: «τι δείχνει το κουμπί» και «τι θα πάρει ό,τι γράψω τώρα»
    // πρέπει να είναι η ίδια απάντηση, αλλιώς το κουμπί δεν προβλέπει το αποτέλεσμά του.
    expect(resolveCellRunFormat(boldFirstTwo(), 4, range(2, 2), 'bold', inherited).value).toBe(true);
    expect(resolveCellRunFormat(boldFirstTwo(), 4, range(3, 3), 'bold', inherited).value).toBe(false);
  });

  it('κέρσορας στη θέση 0 δεν πέφτει έξω από το κείμενο', () => {
    expect(resolveCellRunFormat(boldFirstTwo(), 4, range(0, 0), 'bold', inherited).value).toBe(true);
  });

  it('κενό κελί απαντά κληρονομιά αντί να σκάσει', () => {
    expect(resolveCellRunFormat(undefined, 0, range(0, 0), 'bold', inherited))
      .toEqual({ value: false, mixed: false, overridden: false });
  });

  it('δουλεύει και για μη δίτιμα πεδία (χρώμα)', () => {
    const runs = setCellRunStyleField(undefined, 4, range(0, 2), 'textColorHex', '#ff0000');
    expect(resolveCellRunFormat(runs, 4, range(0, 2), 'textColorHex', '#111111').value).toBe('#ff0000');
    expect(resolveCellRunFormat(runs, 4, range(2, 4), 'textColorHex', '#111111').value).toBe('#111111');
    expect(resolveCellRunFormat(runs, 4, range(0, 4), 'textColorHex', '#111111').mixed).toBe(true);
  });
});

describe('hasCellRunStyles', () => {
  it('βλέπει run που τέμνει το εύρος έστω κατά έναν χαρακτήρα', () => {
    expect(hasCellRunStyles(boldFirstTwo(), 4, range(1, 3))).toBe(true);
  });

  it('δεν βλέπει run που ακουμπά μόνο το όριο (το `end` είναι αποκλειστικό)', () => {
    expect(hasCellRunStyles(boldFirstTwo(), 4, range(2, 4))).toBe(false);
  });

  it('κελί χωρίς runs ⇒ όχι', () => {
    expect(hasCellRunStyles(undefined, 4, range(0, 4))).toBe(false);
  });
});

// ── Ανθεκτικότητα σε ξένη είσοδο ────────────────────────────────────────────

describe('μη κανονικοποιημένη είσοδος — αποθηκευμένο αρχείο, εισαγωγή, μπαγιάτικο undo', () => {
  const overlapping: readonly TableCellTextRun[] = [
    { start: 0, end: 3, style: { bold: true } },
    { start: 1, end: 4, style: { italic: true } },
  ];

  it('δεν σκάει, και ΚΑΝΟΝΙΚΟΠΟΙΕΙ με την πρώτη εγγραφή', () => {
    const runs = setCellRunStyleField(overlapping, 4, range(0, 1), 'underline', true);
    for (let i = 0; i < 4; i += 1) {
      expect((runs ?? []).filter((r) => r.start <= i && r.end > i).length).toBeLessThanOrEqual(1);
    }
  });

  it('run που ξεπερνά το κείμενο κόβεται αντί να διαρρεύσει', () => {
    const tooLong: readonly TableCellTextRun[] = [{ start: 0, end: 99, style: { bold: true } }];
    const runs = setCellRunStyleField(tooLong, 4, range(0, 1), 'italic', true);
    expect(runs?.every((run) => run.end <= 4)).toBe(true);
  });

  it('run με μηδενικό μήκος αγνοείται', () => {
    const empty: readonly TableCellTextRun[] = [{ start: 2, end: 2, style: { bold: true } }];
    expect(setCellRunStyleField(empty, 4, range(0, 1), 'bold', true)?.every((r) => r.start < r.end))
      .toBe(true);
  });

  it('run με άδειο στυλ δεν επιβιώνει της πρώτης εγγραφής', () => {
    const blank: readonly TableCellTextRun[] = [{ start: 0, end: 4, style: {} as TableTextRunStyle }];
    expect(setCellRunStyleField(blank, 4, range(0, 0), 'bold', true)).toBeDefined();
    expect(clearCellRunStyles(blank, 4, range(0, 4))).toBeUndefined();
  });
});
