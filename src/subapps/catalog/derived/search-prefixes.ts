/**
 * **Τα προθέματα αναζήτησης ενός SKU** — καθαρό, κοινό σε γραφέα και ερώτημα (ADR-923 §5.12 τμήμα 4).
 *
 * Η Firestore δεν έχει αναζήτηση κειμένου. Το `array-contains` πάνω σε προθέματα λέξεων βρίσκει και τη **δεύτερη** λέξη της
 * ετικέτας, κάτι που εύρος πάνω στο `derived.sortKey` δεν μπορεί: εκεί τα ψηφία είναι γεμισμένα με μηδενικά, άρα ούτε το
 * πρόθεμα «MFP 3» δεν θα ταίριαζε.
 *
 * 🔑 Τα προθέματα τα παράγει το **υπάρχον** SSoT (`generateSearchPrefixes`, 3 ως 5 χαρακτήρες). Το ερώτημα παίρνει ένα, και ο
 *    πλήρης όρος κρίνεται στη μνήμη πάνω στο ίδιο κανονικοποιημένο κείμενο.
 * ⚠️ Πεζά **πριν** από το SSoT, για τον λόγο που γράφει το `sort-key.ts`: το κεφαλαίο τελικό «Σ» αλλιώς δίνει άλλη κατάληξη.
 *
 * @module subapps/catalog/derived/search-prefixes
 */

import { generateSearchPrefixes, normalizeSearchText, SEARCH_WORD_SEPARATORS } from '@/lib/search/search';

/** Το μήκος που φτάνει να φτιάξει πρόθεμα: κάτω από αυτό ο όρος κρίνεται μόνο ως ακριβής κωδικός. */
const MIN_PREFIX_LENGTH = 3;
/** Ίδιο με το ανώτατο του `generateSearchPrefixes`: μακρύτερο πρόθεμα δεν υπάρχει στο έγγραφο. */
const MAX_PREFIX_LENGTH = 5;

/** Η μία κανονικοποίηση κειμένου για ευρετήριο και όρο. */
export const normalizedForSearch = (text: string): string => normalizeSearchText(text.toLowerCase());

/** Το κείμενο κρίσης SKU που δεν πέρασε ακόμη από τον επανυπολογισμό: ετικέτα και κωδικός. */
export function catalogSearchText(label: string | null, identifier: string | null): string {
  return normalizedForSearch([label, identifier].filter(Boolean).join(' '));
}

/** Από ήδη κανονικοποιημένο κείμενο. Ταξινομημένα, ώστε ίδιο SKU ⇒ ίδιος πίνακας: ο επανυπολογισμός γράφει μόνο ό,τι διαφέρει. */
export function catalogSearchPrefixes(text: string): readonly string[] {
  return generateSearchPrefixes(text).sort();
}

export interface CatalogSearchPlan {
  readonly tokens: readonly string[];
  /** Το πρόθεμα του ερωτήματος· `null` ⇒ καμία λέξη δεν φτάνει το ελάχιστο. */
  readonly seed: string | null;
}

/** Χωρίς στίξη στα άκρα, όπως κόβει τη λέξη και το `generateSearchPrefixes`: «(MFP» βρίσκει το «MFP». */
const bareToken = (word: string): string => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

/**
 * Όρος με διαχωριστικό και χωρίς ψηφία είναι λέξεις («fan-coil» βρίσκει και το «Fan coil»). Με ψηφία είναι κωδικός και μένει
 * ακέραιος: σπασμένο, το «099-01» θα έκρινε τα κομμάτια του χωριστά.
 */
const wordsOf = (token: string): readonly string[] =>
  /\p{N}/u.test(token) ? [token] : token.split(SEARCH_WORD_SEPARATORS).map(bareToken).filter(Boolean);

/** Ποιο πρόθεμα πάει στο ερώτημα: της **μακρύτερης** λέξης, γιατί στενεύει περισσότερο το παράθυρο. */
export function catalogSearchPlan(term: string): CatalogSearchPlan {
  const tokens = normalizedForSearch(term).split(' ').map(bareToken).filter(Boolean).flatMap(wordsOf);
  const longest = tokens.reduce((best, token) => (token.length > best.length ? token : best), '');
  return { tokens, seed: longest.length < MIN_PREFIX_LENGTH ? null : longest.slice(0, MAX_PREFIX_LENGTH) };
}

/** Περιέχει το κείμενο **κάθε** λέξη του όρου; */
export function matchesCatalogSearch(text: string, tokens: readonly string[]): boolean {
  return tokens.every((token) => text.includes(token));
}
