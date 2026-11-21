/**
 * @fileoverview **ΠΟΙΑ ΕΠΙΛΟΓΗ ΕΝΝΟΕΙ Ο ΑΝΘΡΩΠΟΣ** — οι δύο καθαρές ερωτήσεις του combobox.
 * @related ADR-834 §6.5.στ · components/ui/searchable-combobox.tsx
 * @module components/ui/searchable-combobox-matching
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `searchable-combobox.tsx` κρατά **κατάσταση, εστίαση και απόδοση**. Αυτές οι δύο
 * συναρτήσεις δεν κρατούν τίποτα: δέχονται επιλογές και κείμενο, και απαντούν *«ποιες
 * ταιριάζουν;»* και *«ποια εννοείται;»*. Είναι **η ίδια ευθύνη** — ταύτιση — και ζουν
 * μαζί ώστε δύο απαντήσεις στο ίδιο ερώτημα να μη γεννηθούν σε δύο αρχεία.
 *
 * ⚠️ **Η αφορμή ήταν το όριο των 500 γραμμών (N.7.1), αλλά ο διαχωρισμός δεν είναι
 * λογιστικός**: το αρχείο του component είχε **τρεις** ευθύνες και τώρα έχει δύο. Το
 * κριτήριο ταύτισης γίνεται δοκιμάσιμο **χωρίς DOM**.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, καμία εξάρτηση από React.
 */

import { normalizeForSearch } from '@/utils/greek-text';
import type { ComboboxOption } from './searchable-combobox-types';

/**
 * **Ποιες επιλογές ταιριάζουν στο κείμενο** — ετικέτα, δευτερεύον κείμενο, ή τιμή.
 *
 * 🔑 **Και τα τρία, όχι μόνο η ετικέτα**: ο μεσίτης πληκτρολογεί το **email** του πελάτη
 * του τόσο συχνά όσο το όνομα, και μια επαφή **χωρίς όνομα** δεν βρίσκεται με τίποτα
 * άλλο (ADR-834 §6.5.στ). Η τιμή μπαίνει γιατί είναι το μόνο σταθερό αναγνωριστικό.
 *
 * ⚠️ Το `maxDisplayed` κόβει **μετά** το φιλτράρισμα **και την κατάταξη**: κόψιμο πριν
 * θα έκρυβε ταιριάσματα που υπάρχουν, και ο άνθρωπος θα συμπέραινε ότι δεν υπάρχει ο
 * πελάτης του.
 *
 * 🔴 **ΚΑΤΑΤΑΞΗ ΠΡΙΝ ΤΟ ΚΟΨΙΜΟ (ADR-372 §8.5 b3)**: χωρίς αυτήν, η σειρά ήταν η σειρά
 * του καταλόγου. Για το «4100» στους ~10.000 ΚΑΔ, γραμμές με το `4100` στη ΜΕΣΗ του
 * 8ψήφιου ΓΕΜΗ (π.χ. `01.11.41` → `01114100`) γέμιζαν τις 30 θέσεις, και το `41.00`
 * δεν φαινόταν ποτέ. Μοντέλο match-sorter: καλύτερη βαθμίδα πρώτα, **σταθερή** σειρά
 * μέσα στη βαθμίδα. Το ΣΥΝΟΛΟ των ταιριασμάτων μένει ίδιο — αλλάζει μόνο η σειρά.
 */
export function filterOptions(
  options: readonly ComboboxOption[],
  query: string,
  maxDisplayed: number,
): ComboboxOption[] {
  if (!query.trim()) return options.slice(0, maxDisplayed);

  const normalizedQuery = normalizeForSearch(query);
  const ranked: { option: ComboboxOption; rank: number; index: number }[] = [];
  options.forEach((option, index) => {
    const rank = rankOptionMatch(option, normalizedQuery);
    if (rank !== null) ranked.push({ option, rank, index });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);

  return ranked.slice(0, maxDisplayed).map((entry) => entry.option);
}

/**
 * Οι βαθμίδες ταιριάσματος, από την καλύτερη. Τα κείμενα συγκρίνονται στη μορφή του
 * `normalizeForSearch` (χωρίς τόνους, πεζά, χωρίς τελείες), όπως και το φιλτράρισμα.
 */
export const OPTION_MATCH_RANK = {
  VALUE_EQUALS: 0,
  LABEL_EQUALS: 1,
  VALUE_STARTS: 2,
  LABEL_STARTS: 3,
  SECONDARY_STARTS: 4,
  LABEL_WORD_STARTS: 5,
  CONTAINS: 6,
} as const;

/**
 * **Πόσο καλά ταιριάζει μια επιλογή στο κείμενο** — βαθμίδα του `OPTION_MATCH_RANK`, ή
 * `null` αν δεν ταιριάζει καθόλου (ίδιο κριτήριο ύπαρξης με το παλιό substring).
 *
 * @param normalizedQuery Το κείμενο, ήδη περασμένο από `normalizeForSearch`.
 */
export function rankOptionMatch(option: ComboboxOption, normalizedQuery: string): number | null {
  const value = normalizeForSearch(option.value);
  const label = normalizeForSearch(option.label);
  const secondary = option.secondaryLabel ? normalizeForSearch(option.secondaryLabel) : '';

  if (value === normalizedQuery) return OPTION_MATCH_RANK.VALUE_EQUALS;
  if (label === normalizedQuery) return OPTION_MATCH_RANK.LABEL_EQUALS;
  if (value.startsWith(normalizedQuery)) return OPTION_MATCH_RANK.VALUE_STARTS;
  if (label.startsWith(normalizedQuery)) return OPTION_MATCH_RANK.LABEL_STARTS;
  if (secondary.startsWith(normalizedQuery) && secondary !== '') return OPTION_MATCH_RANK.SECONDARY_STARTS;
  if (label.split(/\s+/).some((word) => word.startsWith(normalizedQuery))) {
    return OPTION_MATCH_RANK.LABEL_WORD_STARTS;
  }
  const contains =
    label.includes(normalizedQuery) || secondary.includes(normalizedQuery) || value.includes(normalizedQuery);
  return contains ? OPTION_MATCH_RANK.CONTAINS : null;
}

/**
 * **Ποια επιλογή εννοεί το κείμενο του πεδίου** — με τον **κάτοχο** να έχει προτεραιότητα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΤΑΥΤΟΤΗΤΑ ΑΠΟΦΑΣΙΖΕΤΑΙ ΑΠΟ ΤΗΝ **ΤΙΜΗ**, ΤΟ ΚΕΙΜΕΝΟ ΜΟΝΟ ΛΥΝΕΙ Ο,ΤΙ Η ΤΙΜΗ
 * ΔΕΝ ΕΧΕΙ ΗΔΗ ΛΥΣΕΙ (ADR-834 §6.5.στ)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ήταν σκέτο `options.find(label === typed)`. Όταν **δύο** επιλογές μοιράζονται ετικέτα,
 * εκείνο επέστρεφε πάντα την **πρώτη** — άρα ο χρήστης διάλεγε τη δεύτερη, έφευγε από το
 * πεδίο, και το blur **του άλλαζε σιωπηλά την επιλογή**. Καμία ένδειξη· η φόρμα
 * υποβαλλόταν με **άλλον άνθρωπο**.
 *
 * ⚠️ **Δεν είναι υποθετικό**: μετρήθηκε ζωντανά 2026-08-31 στον επιλογέα πελάτη, όπου η
 * ανώνυμη επαφή έδινε ετικέτα `''` και το κλικ πάνω της προσγειωνόταν σε **άλλη** επαφή.
 * Και είναι **προϋπόθεση** της άλλης θεραπείας: μόλις οι ανώνυμες επαφές πάρουν
 * ονομασμένη ετικέτα («Επαφή χωρίς όνομα»), **δύο** από αυτές γίνονται ταυτόσημες.
 *
 * 🔑 **Ο κάτοχος κερδίζει ΜΟΝΟ όταν ταιριάζει κιόλας.** Αν ο άνθρωπος πληκτρολόγησε κάτι
 * άλλο, η αναζήτηση με ετικέτα δουλεύει **ακριβώς όπως πριν** — για μοναδικές ετικέτες η
 * συμπεριφορά είναι **ταυτόσημη** με την προηγούμενη. Ένα «κράτα πάντα τον κάτοχο» θα
 * έκανε το πεδίο να αγνοεί την πληκτρολόγηση.
 *
 * @param value Η **τρέχουσα** επιλογή — ο «κάτοχος» του πεδίου.
 */
export function resolveOptionByText(
  options: readonly ComboboxOption[],
  value: string,
  typedText: string,
): { readonly incumbent: ComboboxOption | undefined; readonly match: ComboboxOption | undefined } {
  const typed = normalizeForSearch(typedText);
  const incumbent = options.find((o) => o.value === value);

  const match =
    incumbent && normalizeForSearch(incumbent.label) === typed
      ? incumbent
      : options.find((o) => normalizeForSearch(o.label) === typed);

  return { incumbent, match };
}

/**
 * **Ποια ΝΕΑ επιλογή προσφέρεται για το κείμενο** — ή `null` αν δεν προσφέρεται καμία.
 *
 * Το ερώτημα είναι το ίδιο με τις δύο συναρτήσεις πιο πάνω: *«υπάρχει ήδη αυτό που
 * πληκτρολόγησε ο άνθρωπος;»* Αν **όχι**, το combobox προσφέρει να το φτιάξει, ως
 * **τελευταία επιλογή του καταλόγου** (ADR-841 §7 Α19.4δ).
 *
 * 🔑 **Κριτήριο των μεγάλων**: react-select *Creatable* (`isValidNewOption`), MUI
 * Autocomplete `freeSolo` («Add "x"»). Κενό κείμενο ⇒ τίποτα να φτιαχτεί. **Ίδια ετικέτα**
 * ήδη στις επιλογές ⇒ τίποτα να φτιαχτεί, γιατί η προσφορά θα γεννούσε **διπλότυπο**.
 * Η σύγκριση γίνεται με το **ίδιο** `normalizeForSearch` που χρησιμοποιεί το
 * `resolveOptionByText`. Έτσι το «υπάρχει ήδη» και το «εννοείς αυτό» δεν μπορούν να
 * διαφωνήσουν: «Κουμπαρος» και «Κουμπάρος» είναι **μία** επιλογή, όχι δύο.
 *
 * ⚠️ Ελέγχει **όλες** τις επιλογές, όχι μόνο τις φιλτραρισμένες. Το `maxDisplayed` κόβει
 * τι **φαίνεται**, όχι τι **υπάρχει**.
 *
 * @returns Το κείμενο **χωρίς κενά στα άκρα**: αυτό παραδίδεται στο `onAddNew`.
 */
export function resolveAddNewLabel(
  options: readonly ComboboxOption[],
  query: string,
): string | null {
  const label = query.trim();
  if (!label) return null;

  const normalized = normalizeForSearch(label);
  const exists = options.some((option) => normalizeForSearch(option.label) === normalized);
  return exists ? null : label;
}
