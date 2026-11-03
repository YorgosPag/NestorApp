/**
 * @fileoverview **ΠΟΣΟ ΟΛΟΓΡΑΦΩΣ** — το SSoT της μετατροπής ποσού σε λέξεις (ADR-928 §5.10).
 * @module lib/money/amount-in-words/amount-in-words
 *
 * 🔑 **Είσοδος σε ακέραια λεπτά** (`MinorAmount`, `lib/money/money.ts`), ποτέ ευρώ με υποδιαστολή: το
 * `3.2` σε κινητή υποδιαστολή δεν είναι 3,20, και το ολογράφως είναι το **νομικά υπερισχύον** ποσό σε
 * συμφωνητικό. Ο καταναλωτής που έχει ευρώ περνά **μία** φορά από το `minorFromMajor`.
 *
 * 🔑 **Μητρώο ανά γλώσσα**: το `SPELLERS` είναι ολικό πάνω στο `AmountWordsLanguage`, άρα νέα γλώσσα
 * (π.χ. `sq`, `bg`, `ro` — ADR-928 §5.2.2) = ένα αρχείο + μία γραμμή, και ο μεταγλωττιστής δεν αφήνει
 * γλώσσα χωρίς συλλαβιστή.
 *
 * ⚖️ **Αποτυχία κλειστή**: μη έγκυρο ποσό (αρνητικό, κλασματικό, μη πεπερασμένο, εκτός ασφαλούς ακεραίου)
 * ⇒ `null`, όπως το `minorFromMajor`. Ποτέ λέξεις για ποσό που δεν υπάρχει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, ασφαλές σε server και browser.
 */

import { isMinorAmount, type MinorAmount } from '@/lib/money/money';
import { englishAmountWords } from './english-amount-words';
import { greekAmountWords } from './greek-amount-words';

type AmountSpeller = (euros: number, cents: number) => string;

export const AMOUNT_WORDS_LANGUAGES = ['el', 'en'] as const;

export type AmountWordsLanguage = (typeof AMOUNT_WORDS_LANGUAGES)[number];

/** Ολικό `Record`: γλώσσα στη λίστα χωρίς συλλαβιστή = σφάλμα μεταγλώττισης. */
const SPELLERS: Readonly<Record<AmountWordsLanguage, AmountSpeller>> = {
  el: greekAmountWords,
  en: englishAmountWords,
};

const CENTS_PER_EURO = 100;

/**
 * Ποσό σε λέξεις, π.χ. `amountInWords(320, 'el')` → «τρία ευρώ και είκοσι λεπτά».
 * Πεζά: η κεφαλαιοποίηση (και η αφαίρεση τόνων στα ελληνικά κεφαλαία) είναι θέμα παρουσίασης.
 */
export function amountInWords(minor: MinorAmount, language: AmountWordsLanguage): string | null {
  if (!isMinorAmount(minor)) return null;
  const euros = Math.floor(minor / CENTS_PER_EURO);
  const cents = minor % CENTS_PER_EURO;
  return SPELLERS[language](euros, cents);
}
