/**
 * canonical-encoding — ΕΝΕΣΙΜΟΤΗΤΑ (injectivity)
 *
 * Κάθε έλεγχος εδώ αντιστοιχεί σε μια **πραγματική σύγκρουση του
 * `JSON.stringify`**, δηλαδή σε έναν τρόπο με τον οποίο ένα αφελές hash θα
 * έλεγε ψέματα για την αναπαραγωγιμότητα.
 *
 * @see ADR-734 §6.3 κανόνας 2
 */

import { canonicalize } from '../canonical-encoding';

describe('canonicalize — ντετερμινισμός', () => {
  it('αγνοεί τη σειρά εισαγωγής κλειδιών', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it('αγνοεί τη σειρά εγγραφών Map', () => {
    const first = new Map<string, number>([['a', 1], ['b', 2]]);
    const second = new Map<string, number>([['b', 2], ['a', 1]]);
    expect(canonicalize(first)).toBe(canonicalize(second));
  });

  it('αγνοεί τη σειρά μελών Set', () => {
    expect(canonicalize(new Set([1, 2, 3]))).toBe(canonicalize(new Set([3, 1, 2])));
  });

  it('είναι σταθερό σε επαναλαμβανόμενες κλήσεις', () => {
    const value = { m: new Map([['k', [1, 2]]]), s: new Set(['x']), d: new Date(0) };
    expect(canonicalize(value)).toBe(canonicalize(value));
  });
});

describe('canonicalize — συγκρούσεις που ΣΠΑΕΙ το JSON.stringify', () => {
  it('Map δεν ισοπεδώνεται σε {} (η περίπτωση του computeBuildingSummary)', () => {
    const withNames = new Map<string, string>([['OIK-2', 'Σκυροδέματα']]);
    const withOtherNames = new Map<string, string>([['OIK-2', 'Χωματουργικά']]);
    expect(JSON.stringify(withNames)).toBe(JSON.stringify(withOtherNames)); // η απόδειξη του προβλήματος
    expect(canonicalize(withNames)).not.toBe(canonicalize(withOtherNames));
    expect(canonicalize(withNames)).not.toBe(canonicalize({ 'OIK-2': 'Σκυροδέματα' }));
  });

  it('Set δεν ισοπεδώνεται σε {}', () => {
    expect(canonicalize(new Set([1]))).not.toBe(canonicalize(new Set([2])));
    expect(canonicalize(new Set([1]))).not.toBe(canonicalize({}));
  });

  it('NaN / Infinity δεν γίνονται null', () => {
    expect(canonicalize(NaN)).not.toBe(canonicalize(null));
    expect(canonicalize(Infinity)).not.toBe(canonicalize(null));
    expect(canonicalize(-Infinity)).not.toBe(canonicalize(Infinity));
  });

  it('undefined ιδιότητα δεν εξαφανίζεται', () => {
    expect(canonicalize({ a: undefined })).not.toBe(canonicalize({}));
    expect(canonicalize({ a: undefined })).not.toBe(canonicalize({ a: null }));
  });

  it('το -0 διακρίνεται από το 0', () => {
    expect(canonicalize(-0)).not.toBe(canonicalize(0));
  });

  it('η Date διακρίνεται από ισοδύναμο string', () => {
    const iso = '2026-01-01T00:00:00.000Z';
    expect(canonicalize(new Date(iso))).not.toBe(canonicalize(iso));
  });

  it('αριθμός και αριθμητικό string δεν συγχέονται', () => {
    expect(canonicalize(1)).not.toBe(canonicalize('1'));
  });
});

describe('canonicalize — μονοσήμαντη οριοθέτηση', () => {
  it('δεν συγχέει διαφορετικές κατατμήσεις συμβολοσειρών', () => {
    expect(canonicalize(['a', 'bc'])).not.toBe(canonicalize(['ab', 'c']));
  });

  it('δεν συγχέει ένθετο πίνακα με επίπεδο', () => {
    expect(canonicalize([[1], [2]])).not.toBe(canonicalize([1, 2]));
  });

  it('διακρίνει κλειδί από τιμή', () => {
    expect(canonicalize({ ab: '' })).not.toBe(canonicalize({ a: 'b' }));
  });
});

describe('canonicalize — δυνατή αποτυχία', () => {
  it('πετά σε κυκλική αναφορά αντί για μερικό hash', () => {
    const cyclic: Record<string, unknown> = { name: 'x' };
    cyclic.self = cyclic;
    expect(() => canonicalize(cyclic)).toThrow(TypeError);
  });

  it('πετά σε function και symbol', () => {
    expect(() => canonicalize({ fn: () => undefined })).toThrow(TypeError);
    expect(() => canonicalize({ sym: Symbol('x') })).toThrow(TypeError);
  });

  it('ΔΕΝ πετά σε κοινό αντικείμενο σε αδελφικές θέσεις (DAG, όχι κύκλος)', () => {
    const shared = { q: 1 };
    expect(() => canonicalize({ left: shared, right: shared })).not.toThrow();
  });
});
