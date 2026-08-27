/**
 * ΑΓΚΥΡΕΣ — **Ο ΤΟΚΕΝΙΣΤΗΣ ESCO, ΚΑΙ ΤΑ ΔΥΟ ΑΚΡΑ ΤΟΥ ΕΥΡΕΤΗΡΙΟΥ** (ADR-132).
 *
 * 🔑 Η βλάβη που φυλάνε **δεν παράγει σφάλμα**: αν η πλευρά **γραφής**
 * *(εισαγωγέας → `searchTokens*`)* και η πλευρά **ανάγνωσης** *(υπηρεσία →
 * `array-contains`)* κανονικοποιήσουν διαφορετικά, η αναζήτηση επιστρέφει
 * **άδεια λίστα**, που στην οθόνη διαβάζεται ως «δεν υπάρχει τέτοιο επάγγελμα».
 *
 * Γι' αυτό η κεντρική άγκυρα εδώ **δεν** ελέγχει τιμές· ελέγχει το
 * **συμβόλαιο υποσυνόλου** ανάμεσα στις δύο συναρτήσεις, πάνω σε πραγματικά
 * ελληνικά και αγγλικά.
 */

import {
  ESCO_MIN_TOKEN_LENGTH,
  normalizeEscoText,
  escoQueryTokens,
  escoIndexTokens,
} from '../search-tokens';

const CORPUS = [
  'Πολιτικός Μηχανικός',
  'φαρμακοποιός',
  'Civil Engineer',
  'Δικηγόρος (νομικός σύμβουλος)',
  'τεχνίτης κρεάτων/αλλαντικών',
  'ΜΗΧΑΝΟΛΟΓΟΣ ΜΗΧΑΝΙΚΟΣ',
];

describe('Α. κανονικοποίηση', () => {
  it('αφαιρεί τόνους, πεζοποιεί, κόβει άκρα', () => {
    expect(normalizeEscoText('  Ελαιοχρωματιστής  ')).toBe('ελαιοχρωματιστης');
    expect(normalizeEscoText('ΜΑΓΕΙΡΑΣ')).toBe('μαγειρας');
    expect(normalizeEscoText('Τεχνίτης')).toBe('τεχνιτης');
    expect(normalizeEscoText('')).toBe('');
  });
});

describe('Β. πλευρά ανάγνωσης', () => {
  it('δίνει ολόκληρες λέξεις, με ελάχιστο μήκος', () => {
    expect(escoQueryTokens('τεχνίτης κρεάτων')).toEqual(['τεχνιτης', 'κρεατων']);
    expect(escoQueryTokens('a b cd')).toEqual(['cd']);
    expect(escoQueryTokens('')).toEqual([]);
  });

  it('κόβει στα ίδια διαχωριστικά με την πλευρά γραφής', () => {
    expect(escoQueryTokens('one,two-three/four')).toEqual(['one', 'two', 'three', 'four']);
  });
});

describe('Γ. πλευρά γραφής', () => {
  it('παράγει ΟΛΑ τα προθέματα από 2 χαρακτήρες και πάνω', () => {
    expect(escoIndexTokens('φαρμακοποιός')).toEqual(
      expect.arrayContaining(['φα', 'φαρ', 'φαρμ', 'φαρμακοποιος']),
    );
    expect(escoIndexTokens('φαρμακοποιός')).not.toContain('φ');
  });

  it('ενσωματώνει τα συνώνυμα στο ΙΔΙΟ σύνολο', () => {
    const tokens = escoIndexTokens('Πολιτικός Μηχανικός', ['Δομοστατικός']);
    expect(tokens).toEqual(expect.arrayContaining(['δομ', 'δομοστατικος', 'πολ', 'μηχ']));
  });

  it('δεν επαναλαμβάνει πρόθεμα που εμφανίζεται δύο φορές', () => {
    const tokens = escoIndexTokens('μηχανικος μηχανικος');
    expect(new Set(tokens).size).toBe(tokens.length);
  });
});

// ============================================================================
// Δ. 🔴 ΤΟ ΣΥΜΒΟΛΑΙΟ — η ερώτηση ΠΡΕΠΕΙ να είναι υποσύνολο του ευρετηρίου
// ============================================================================

describe('Δ. συμβόλαιο υποσυνόλου γραφής ↔ ανάγνωσης', () => {
  it.each(CORPUS)('κάθε πρόθεμα του «%s» βρίσκει την ετικέτα', (label) => {
    const index = new Set(escoIndexTokens(label));
    const words = normalizeEscoText(label)
      .split(/[\s,.\-/()]+/)
      .filter((word) => word.length >= ESCO_MIN_TOKEN_LENGTH);

    expect(words.length).toBeGreaterThan(0);
    for (const word of words) {
      for (let length = ESCO_MIN_TOKEN_LENGTH; length <= word.length; length += 1) {
        const typed = word.slice(0, length);
        for (const token of escoQueryTokens(typed)) {
          expect(index.has(token)).toBe(true);
        }
      }
    }
  });

  it('🔑 ερώτημα ΜΕ τόνο βρίσκει ευρετήριο ΧΩΡΙΣ τόνο, και αντίστροφα', () => {
    const index = new Set(escoIndexTokens('Πολιτικός Μηχανικός'));

    expect(escoQueryTokens('Μηχανικός').every((t) => index.has(t))).toBe(true);
    expect(escoQueryTokens('ΜΗΧΑΝΙΚΟΣ').every((t) => index.has(t))).toBe(true);
    expect(escoQueryTokens('μηχανικ').every((t) => index.has(t))).toBe(true);
  });

  it('⚠️ ερώτημα κάτω από το ελάχιστο δεν παράγει token — και στα δύο άκρα', () => {
    expect(escoQueryTokens('μ')).toEqual([]);
    expect(escoIndexTokens('μ')).toEqual([]);
  });
});
