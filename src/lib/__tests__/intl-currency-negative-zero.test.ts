/**
 * ΑΓΚΥΡΑ — **«γράφει ποτέ ο κεντρικός μορφοποιητής "-0 €";»** *(ADR-ACC-009 · ενημέρωση 2026-11-06)*
 *
 * Το γεγονός: η κάρτα «Εταιρικός Φόρος ΑΕ» στην παραγωγή έγραφε «Συνολικά έξοδα **-0 €**». Δύο αιτίες,
 * και φυλάγονται εδώ και οι δύο: (α) ο καλών κολλούσε «-» μπροστά στο ποσό· (β) το `Intl` γράφει πρόσημο στο
 * αρνητικό μηδέν **και** σε κάθε αρνητικό που στρογγυλεύεται σε μηδέν (`-0.004` → «-0,00 €»).
 *
 * ⛔ **ΜΗΝ** το ξαναγράψεις με `toBe('0 €')`: η προσδοκία παράγεται **από την ίδια μηχανή** (`format(0)`), ώστε
 * να μη δεθεί στα δεδομένα CLDR του Node (κενό διάστημα, σύμβολο) — ίδιο δόγμα με το `intl-long-date.test.ts`.
 */

import { formatCurrencyIn } from '@/lib/intl-formatting';

const LOCALES = ['el-GR', 'en-US'] as const;
const MINUS = /[-−]/;

describe('formatCurrencyIn — χωρίς «-0»', () => {
  describe.each(LOCALES)('%s', (locale) => {
    const zero = formatCurrencyIn(locale, 0);

    it('το αρνητικό μηδέν γράφεται όπως το μηδέν', () => {
      expect(formatCurrencyIn(locale, -0)).toBe(zero);
    });

    it('αρνητικό που στρογγυλεύεται σε μηδέν (2 δεκαδικά) γράφεται όπως το μηδέν', () => {
      expect(formatCurrencyIn(locale, -0.004)).toBe(zero);
      expect(formatCurrencyIn(locale, -0.0049)).toBe(zero);
    });

    it('με ακέραια μορφή, το -0.4 γράφεται όπως το μηδέν', () => {
      const wholeZero = formatCurrencyIn(locale, 0, 'EUR', { maximumFractionDigits: 0 });
      expect(formatCurrencyIn(locale, -0.4, 'EUR', { maximumFractionDigits: 0 })).toBe(wholeZero);
    });

    it('το μικρότερο αρνητικό που ΔΕΝ στρογγυλεύεται σε μηδέν κρατά το πρόσημο', () => {
      expect(formatCurrencyIn(locale, -0.005)).toMatch(MINUS);
    });

    it('αρνητικό ποσό κρατά το πρόσημο — η αφαίρεση γράφεται ως formatCurrency(-x)', () => {
      expect(formatCurrencyIn(locale, -1000)).toMatch(MINUS);
      expect(formatCurrencyIn(locale, 1000)).not.toMatch(MINUS);
    });
  });
});
