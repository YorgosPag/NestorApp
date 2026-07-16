/**
 * ADR-666 — pseudo locale = runtime transform
 *
 * Το regression lock αντλήθηκε από τα 15.816 πραγματικά ζεύγη el↔pseudo που
 * υπήρχαν ως committed αρχεία πριν τη διαγραφή τους. Το fixture κρατά ένα
 * αντιπροσωπευτικό δείγμα ανά κλάση συμπεριφοράς — όχι dump 2MB (θα ήταν
 * ακριβώς το λάθος που διορθώνει αυτό το ADR: committed generated data).
 */

import { toPseudo, pseudoPostProcessor, PSEUDO_LANGUAGE } from '../pseudo-post-processor';
import regressionPairs from './fixtures/pseudo-regression-pairs.json';

interface RegressionPair {
  readonly ns: string;
  readonly key: string;
  readonly el: string;
  readonly pseudo: string;
  readonly covers: string;
}

const pairs = regressionPairs as readonly RegressionPair[];

const process = (value: string, lng: string): string =>
  pseudoPostProcessor.process(value, 'k', { lng }, {}) as string;

describe('toPseudo — regression lock από τα πραγματικά committed δεδομένα', () => {
  it('το fixture καλύπτει κάθε κλάση συμπεριφοράς', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(30);
    expect(new Set(pairs.map((p) => p.covers)).size).toBeGreaterThanOrEqual(8);
  });

  it.each(pairs.map((p) => [`${p.covers} · ${p.ns}:${p.key}`, p.el, p.pseudo]))(
    'αναπαράγει %s',
    (_label, el, expected) => {
      expect(toPseudo(el as string)).toBe(expected);
    }
  );
});

describe('toPseudo — ο κανόνας', () => {
  it('floor: πολύ κοντά strings παίρνουν 2 tildes', () => {
    expect(toPseudo('ΑΦΜ')).toBe('[[~~ ΑΦΜ ~~]]');
    expect(toPseudo('α')).toBe('[[~~ α ~~]]');
  });

  it('cap: πολύ μακριά strings δεν ξεπερνούν τα 12 tildes', () => {
    const long = 'α'.repeat(500);
    expect(toPseudo(long)).toBe(`[[${'~'.repeat(12)} ${long} ${'~'.repeat(12)}]]`);
  });

  it('κλιμακώνει ανά 5 χαρακτήρες, αγνοώντας τα κενά', () => {
    expect(toPseudo('αβγδε')).toBe('[[~~ αβγδε ~~]]'); // 5 → 1 → floor 2
    expect(toPseudo('αβγδεαβγδεα')).toBe('[[~~~ αβγδεαβγδεα ~~~]]'); // 11 → 3
    // ίδιο μήκος-χωρίς-κενά ⇒ ίδιος αριθμός tildes
    expect(toPseudo('αβγδε αβγδε α')).toBe('[[~~~ αβγδε αβγδε α ~~~]]');
  });

  it('διατηρεί το κείμενο αυτούσιο μέσα στο wrapper', () => {
    const icu = '{count, plural, one {# εγγραφή} other {# εγγραφές}}';
    expect(toPseudo(icu)).toContain(icu);
  });
});

describe('toPseudo — edge cases', () => {
  it('κενό string μένει κενό (σημερινή συμπεριφορά των locale αρχείων)', () => {
    expect(toPseudo('')).toBe('');
  });

  it('είναι idempotent — δεν ξανατυλίγει ήδη τυλιγμένο κείμενο', () => {
    const once = toPseudo('Αποθήκευση');
    expect(toPseudo(once)).toBe(once);
  });
});

describe('pseudoPostProcessor — gating', () => {
  it('τυλίγει μόνο όταν η γλώσσα είναι pseudo', () => {
    expect(process('Αποθήκευση', PSEUDO_LANGUAGE)).toBe('[[~~ Αποθήκευση ~~]]');
  });

  it('αφήνει το el ανέπαφο', () => {
    expect(process('Αποθήκευση', 'el')).toBe('Αποθήκευση');
  });

  it('αφήνει το en ανέπαφο', () => {
    expect(process('Save', 'en')).toBe('Save');
  });

  it('πέφτει πίσω στη γλώσσα του translator όταν λείπει το options.lng', () => {
    const viaTranslator = pseudoPostProcessor.process('Αποθήκευση', 'k', {}, { language: PSEUDO_LANGUAGE });
    expect(viaTranslator).toBe('[[~~ Αποθήκευση ~~]]');
  });

  it('περνά αμετάβλητες τις μη-string τιμές (returnObjects)', () => {
    const obj = { a: 1 };
    expect(pseudoPostProcessor.process(obj as never, 'k', { lng: PSEUDO_LANGUAGE }, {})).toBe(obj);
  });
});
