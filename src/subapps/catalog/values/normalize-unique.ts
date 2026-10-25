/**
 * =============================================================================
 * ΤΟ ΚΛΕΙΔΙ ΜΟΝΑΔΙΚΟΤΗΤΑΣ ΜΙΑΣ ΤΙΜΗΣ — ΜΙΑ συνάρτηση (ADR-923 §5.10 Δ3)
 * =============================================================================
 *
 * «Είναι το `016-15-001` ίδιο με το ` 016–15–001 `;» Η απάντηση χρειάζεται σε **τρία** σημεία
 * και πρέπει να είναι **η ίδια**: η κράτηση `catalog_unique_values` του γραφέα (Δ3), ο κανόνας
 * συνέπειας `unique` της οικογένειας (`rules/evaluate-consistency.ts`) και η ιδεμπότητη
 * αναζήτηση της εισαγωγής (Φάση 4). Αν δύο από αυτά κανονικοποιούσαν διαφορετικά, ο κανόνας θα
 * έλεγε «μοναδικό» και η κράτηση «διπλό» — ή, χειρότερα, το αντίστροφο.
 *
 * Κείμενο — **Unicode identifier caseless match** (Unicode §3.13, `NFKC_Casefold`) συν δύο
 * διορθώσεις που μετρήθηκαν στη Φάση 0 (§21.2: κείμενο από PDF/AI):
 *   1. **NFKC**: πλήρους πλάτους «０１６» = «016», `NBSP` = κενό, συνδέσεις (ligatures) σπάνε.
 *   2. **Χαρακτήρες μορφοποίησης** (`\p{Cf}`: μηδενικού πλάτους, soft hyphen, BOM) αφαιρούνται —
 *      είναι αόρατοι, άρα δύο κωδικοί που **φαίνονται** ίδιοι δεν μπορεί να είναι «διαφορετικοί».
 *   3. **Παύλες** (`\p{Pd}` + U+2212 «−») → `-`: το PDF γράφει «016–15–001» με en dash.
 *   4. Κενά: trim + ένα κενό στη θέση κάθε ακολουθίας.
 *   5. **Case folding**: `toUpperCase().toLowerCase()` (πιάνει και το «ß» → «ss») + τελικό «ς» → «σ».
 *
 * ⚠️ **ΟΧΙ σκελετός UTS #39** (`lib/unicode/skeleton.ts`, ελληνικό «Α» ≡ λατινικό «A»): εκείνος
 * θα έκανε το «I1» και το «11» **ίδιο κωδικό** και θα **απέρριπτε** νόμιμους κωδικούς προμηθευτή.
 * Η ομοιότητα σχήματος είναι **προειδοποίηση** («μοιάζει με υπάρχοντα»), όχι ταυτότητα — και ζει
 * στον διακομιστή (ο πίνακας είναι `server-only`, ~80 KB) στη Φάση 2β, όχι εδώ.
 *
 * Αριθμός — το κλειδί ισότητας του κανονικού ποσού («1.50» ≡ «1.5»).
 *
 * @module subapps/catalog/values/normalize-unique
 */

import type { AttributeValue } from '../types/product';
import { amountIdentityKey } from './decimal-amount';

const FORMAT_CHARACTERS = /\p{Cf}/gu;
const DASHES = /[\p{Pd}−]/gu;
const WHITESPACE_RUN = /\s+/gu;

/** Το κλειδί ταυτότητας ενός κειμένου-αναγνωριστικού. **Ποτέ** προς εμφάνιση. */
export function normalizeUniqueText(text: string): string {
  const folded = text
    .normalize('NFKC')
    .replace(FORMAT_CHARACTERS, '')
    .replace(DASHES, '-')
    .replace(WHITESPACE_RUN, ' ')
    .trim()
    .toUpperCase()
    .toLowerCase()
    .replace(/ς/g, 'σ');
  return folded.normalize('NFKC');
}

/**
 * Το κλειδί μοναδικότητας μιας τιμής ιδιότητας `unique` (μόνο `text`/`number` —
 * `UNIQUE_CAPABLE_ATTRIBUTE_TYPES`). `null` για κενή τιμή ή τύπο που δεν είναι μοναδικός.
 */
export function uniqueValueKey(value: AttributeValue): string | null {
  if (value.type === 'text') {
    const key = normalizeUniqueText(value.text);
    return key === '' ? null : key;
  }
  if (value.type === 'number') return value.amount === '' ? null : amountIdentityKey(value.amount);
  return null;
}
