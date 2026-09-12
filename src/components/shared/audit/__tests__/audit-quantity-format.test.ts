/**
 * ΑΓΚΥΡΕΣ — ADR-852 Φ2: η τιμή είναι **ποσοτικά σωστή**, ή δεν την αγγίζουμε καθόλου.
 *
 * ⚠️ ΤΙ ΔΕΝ ΔΟΚΙΜΑΖΕΤΑΙ ΕΔΩ, ΚΑΙ ΕΠΙΤΗΔΕΣ: η **ακριβής συμβολοσειρά** («0,750 m» με
 * ελληνικό κόμμα) ανήκει στο `formatLengthForDisplay` + `FormatterRegistry` + `Intl`,
 * που έχουν **δικές τους** άγκυρες (`units-format.test.ts`). Μια άγκυρα που καρφώνει
 * εδώ το δεκαδικό σύμβολο θα κοκκίνιζε σε άλλο locale του CI χωρίς να έχει σπάσει
 * τίποτα — θα μετρούσε το `Intl`, όχι τη ΔΙΚΗ μας απόφαση.
 *
 * Εδώ καρφώνεται **μόνο** ό,τι αποφασίζει αυτό το αρχείο: ΠΟΙΑ πεδία μετατρέπονται,
 * ΠΟΙΑ μένουν άθικτα, και το **ΠΡΟΣΗΜΟ**.
 */

import { formatQuantityValue } from '../audit-quantity-format';

describe('ADR-852 Φ2 — μετατρέπεται ΜΟΝΟ το δηλωμένο μήκος μοντέλου', () => {
  it('Β1 ΠΑΡΟΝΟΜΑΣΤΗΣ — το `model-length` ΟΝΤΩΣ μορφοποιείται', () => {
    // Χωρίς αυτό, τα Β2-Β4 θα περνούσαν θριαμβευτικά και με συνάρτηση που γυρίζει
    // πάντα `undefined` — δηλαδή θα αποδείκνυαν ότι δεν κάνουμε τίποτα.
    const out = formatQuantityValue('model-length', 749.9999999999927);
    expect(out).toBeDefined();
    expect(out).not.toContain('749.99');
  });

  it('Β2 — κάθε ΑΛΛΗ ποσότητα μένει άθικτη («16 βαθμίδες» δεν γίνεται ποτέ «0,016 m»)', () => {
    for (const kind of ['count', 'angle', 'percent', 'paper-length', 'nominal-diameter'] as const) {
      expect(formatQuantityValue(kind, 16)).toBeUndefined();
    }
  });

  it('Β3 — ΑΔΗΛΩΤΟ πεδίο μένει άθικτο: απουσία δήλωσης σημαίνει «δεν ξέρω», όχι «μήκος»', () => {
    expect(formatQuantityValue(undefined, 900)).toBeUndefined();
  });

  it('Β4 — μη αριθμητικές τιμές δεν προσποιούνται ότι είναι μήκη', () => {
    expect(formatQuantityValue('model-length', null)).toBeUndefined();
    expect(formatQuantityValue('model-length', '')).toBeUndefined();
    expect(formatQuantityValue('model-length', true)).toBeUndefined();
    expect(formatQuantityValue('model-length', 'rectangular')).toBeUndefined();
  });

  it('Β5 — αριθμός γραμμένος ως συμβολοσειρά μετρά (το Firestore σειριοποιεί)', () => {
    expect(formatQuantityValue('model-length', '750')).toBeDefined();
  });
});

describe('ADR-852 Φ2 — ΤΟ ΠΡΟΣΗΜΟ: μια μετατόπιση −200 δεν είναι μήκος 200', () => {
  // 🔴 Η ΠΑΓΙΔΑ: το `formatLengthForDisplay` εφαρμόζει `Math.abs` εκ σχεδιασμού (τα
  // μήκη είναι μη αρνητικά). Όμως από εδώ περνούν και ΜΕΤΑΤΟΠΙΣΕΙΣ — `baseOffset`,
  // `topOffset`, `offsetFromStorey` — που είναι ειλικρινά αρνητικές. Χωρίς ρητό
  // χειρισμό, το −200 εμφανιζόταν «0,200 m»: λάθος με πρόσωπο σωστού, μέσα σε αρχείο
  // που υποτίθεται ότι καταγράφει τι συνέβη.

  it('Β6 🔴 — η αρνητική τιμή ΚΡΑΤΑ το πρόσημό της', () => {
    const negative = formatQuantityValue('model-length', -200);
    expect(negative).toBeDefined();
    expect(negative!.startsWith('-')).toBe(true);
  });

  it('Β7 — θετικό και αρνητικό διαφέρουν ΑΚΡΙΒΩΣ κατά το πρόσημο', () => {
    const positive = formatQuantityValue('model-length', 200);
    const negative = formatQuantityValue('model-length', -200);
    expect(negative).toBe(`-${positive}`);
  });

  it('Β8 — το μηδέν δεν αποκτά πρόσημο', () => {
    expect(formatQuantityValue('model-length', 0)!.startsWith('-')).toBe(false);
  });
});
