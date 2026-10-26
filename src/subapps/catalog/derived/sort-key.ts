/**
 * **Το κλειδί ταξινόμησης** μοντέλων και SKU — καθαρό, κοινό σε οθόνη και διακομιστή (ADR-923 §5.10.4 Β2).
 *
 * Η Firestore ταξινομεί συμβολοσειρές **κατά bytes**: «Ά» μετά το «ω», «b» μετά το «Z», «MFP 10» πριν το «MFP 9».
 * Το Akeneo το λύνει με analyzer του Elasticsearch· εδώ με **παράγωγο** πεδίο που γράφει ο γραφέας του συνόλου:
 * - κείμενο κανονικοποιημένο από το **υπάρχον** SSoT αναζήτησης (`normalizeSearchText`: τόνοι, τελικό σίγμα, πεζά,
 *   κενά) — ό,τι βρίσκει η αναζήτηση, με την ίδια σειρά ταξινομείται;
 * - 🏆 **φυσική σειρά αριθμών**: κάθε ακολουθία ψηφίων γεμίζει με μηδενικά ως {@link SORT_KEY_DIGITS}, άρα
 *   «MFP 9» < «MFP 10» < «MFP 100» (Finder · Explorer· κανένας από τους μεγάλους PIM στη λίστα του).
 *
 * @module subapps/catalog/derived/sort-key
 */

import { normalizeSearchText } from '@/lib/search/search';

/** Πλάτος γεμίσματος των αριθμών — μεγαλύτερες ακολουθίες μένουν ως έχουν (σπάνιες: κωδικοί EAN). */
export const SORT_KEY_DIGITS = 12;
/** Ανώτατο μήκος — τα κλειδιά ευρετηρίου της Firestore έχουν όριο, και 120 χαρακτήρες αρκούν για σειρά. */
export const SORT_KEY_MAX_LENGTH = 120;

/** Το κλειδί ενός κειμένου. Κενό/απόν ⇒ `''` (πρώτο, ορατό — ποτέ δεν χάνεται από το `orderBy`). */
export function catalogSortKey(text: string | null | undefined): string {
  if (!text) return '';
  // ⚠️ Πεζά ΠΡΙΝ από το SSoT: το `normalizeSearchText` κάνει `ς→σ` και μετά `toLowerCase()`, και η JS γράφει το
  // κεφαλαίο τελικό «Σ» ως «ς» ⇒ «ΣΩΛΗΝΑΣ» → `σωληνας` ενώ «σωλήνας» → `σωληνασ`. Το σφάλμα του SSoT καταγράφηκε
  // (`.claude-rules/pending-ratchet-work.md`): η διόρθωσή του αλλάζει τα προθέματα του ευρετηρίου αναζήτησης που
  // γράφουν οι Functions (CHECK 3.93) ⇒ θέλει ανάπτυξη + επανευρετηρίαση, απόφαση Giorgio.
  return normalizeSearchText(text.toLowerCase())
    .replace(/\d+/g, (run) => run.replace(/^0+(?=\d)/, '').padStart(SORT_KEY_DIGITS, '0'))
    .slice(0, SORT_KEY_MAX_LENGTH);
}
