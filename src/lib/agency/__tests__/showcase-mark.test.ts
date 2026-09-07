/**
 * **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΣΗΜΑΤΟΣ** — ADR-841 §7 Α21.2.
 *
 * 🔴 Το σήμα υπάρχει επειδή η μετρημένη ποινή ήταν **η ανωνυμία** (IRSP, 4 μελέτες).
 * Άρα η μόνη ιδιότητα που **δεν επιτρέπεται** να χαθεί είναι: *«βγαίνει ΠΑΝΤΑ κάτι,
 * και είναι ΠΑΝΤΑ το ίδιο για τον ίδιο άνθρωπο»*.
 */

import { lettermarkOf, SHOWCASE_MARK_SLOTS } from '../showcase-mark';

const COMPANY = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

describe('Α21.2 — η ΑΝΑΓΝΩΡΙΣΙΜΟΤΗΤΑ: το χρώμα κρέμεται από την ταυτότητα', () => {
  it('🔑 ίδιο companyId ⇒ ΠΑΝΤΑ ίδιο slot', () => {
    const first = lettermarkOf(COMPANY, 'Παπαδόπουλος & Υιοί ΟΕ').slot;
    for (let i = 0; i < 50; i += 1) {
      expect(lettermarkOf(COMPANY, 'Παπαδόπουλος & Υιοί ΟΕ').slot).toBe(first);
    }
  });

  it('🔴 Η ΜΕΤΟΝΟΜΑΣΙΑ ΔΕΝ ΑΛΛΑΖΕΙ ΤΟ ΧΡΩΜΑ — αυτό είναι όλο το νόημα', () => {
    // Αν κάποιος «απλοποιήσει» χασάροντας το displayName, ΑΥΤΗ η γραμμή κοκκινίζει.
    // Το γραφείο που μετονομάζεται θα άλλαζε ταυτότητα στα μάτια του επισκέπτη.
    expect(lettermarkOf(COMPANY, 'Παλιά Επωνυμία').slot).toBe(
      lettermarkOf(COMPANY, 'Ολότελα Άλλη Επωνυμία ΑΕ').slot,
    );
  });

  it('διαφορετικές ταυτότητες ΔΕΝ κολλάνε όλες στο ίδιο χρώμα', () => {
    const slots = new Set(
      Array.from({ length: 200 }, (_, i) => lettermarkOf(`comp_${i}`, 'Χ').slot),
    );
    expect(slots.size).toBe(SHOWCASE_MARK_SLOTS);
  });
});

describe('Α21.2 — το slot είναι ΕΓΚΥΡΟ ευρετήριο της παλέτας, πάντα', () => {
  it('🔴 πάντα 1…8 — ποτέ 0, ποτέ 9, ποτέ αρνητικό', () => {
    // Το «ποτέ 0» φυλάει το `+1`: η παλέτα λέγεται `--chart-1..8`, όχι `--chart-0..7`.
    // Ένα slot 0 θα έδειχνε σε `MARK_SURFACES[-1]` ⇒ `undefined` ⇒ σήμα ΧΩΡΙΣ ΦΟΝΤΟ,
    // δηλαδή κείμενο χρώματος `--card` πάνω σε `--card`: εντελώς αόρατο.
    for (let i = 0; i < 3_000; i += 1) {
      const { slot } = lettermarkOf(`comp_${i}`, 'Δοκιμή');
      expect(slot).toBeGreaterThanOrEqual(1);
      expect(slot).toBeLessThanOrEqual(SHOWCASE_MARK_SLOTS);
      expect(Number.isInteger(slot)).toBe(true);
    }
  });
});

describe('Α21.2 — τα γράμματα ρωτούν τον ΕΝΑΝ SSoT', () => {
  it.each([
    ['Παπαδόπουλος & Υιοί ΟΕ', 'ΠΥ'],
    ['Άλφα Τεχνική', 'ΑΤ'],
    ['Παπαδόπουλος', 'ΠΑ'],
  ])('%p → %p', (name, expected) => {
    expect(lettermarkOf(COMPANY, name).initials).toBe(expected);
  });

  it('⚠️ επωνυμία χωρίς γράμμα δίνει κενά αρχικά — αλλά ΠΑΝΤΑ έγκυρο χρώμα', () => {
    // Λιγότερο πληροφοριακό, αλλά ΟΧΙ ανώνυμο — και η ανωνυμία ήταν η ποινή.
    const mark = lettermarkOf(COMPANY, '123');
    expect(mark.initials).toBe('');
    expect(mark.slot).toBeGreaterThanOrEqual(1);
  });
});

describe('Α21.2 — ΔΕΝ δανείζεται τον σπόρο του επισκέπτη', () => {
  it('🔴 το σήμα είναι ίδιο για ΚΑΘΕ επισκέπτη — αντίθετα από τον κλήρο της σειράς', () => {
    // Ο `lotOf` του agency-directory-order χασάρει `σπόρος + ταυτότητα` ΕΠΙΤΗΔΕΣ,
    // ώστε δύο επισκέπτες να βλέπουν άλλη σειρά. Εδώ η απαίτηση είναι ΑΝΤΙΘΕΤΗ.
    // Η άγκυρα το κάνει εκτελέσιμο: η συνάρτηση δέχεται ΔΥΟ ορίσματα, κανένα σπόρο.
    expect(lettermarkOf.length).toBe(2);
  });
});
