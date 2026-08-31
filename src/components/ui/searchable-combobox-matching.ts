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
 * ⚠️ Το `maxDisplayed` κόβει **μετά** το φιλτράρισμα: κόψιμο πριν θα έκρυβε ταιριάσματα
 * που υπάρχουν, και ο άνθρωπος θα συμπέραινε ότι δεν υπάρχει ο πελάτης του.
 */
export function filterOptions(
  options: readonly ComboboxOption[],
  query: string,
  maxDisplayed: number,
): ComboboxOption[] {
  if (!query.trim()) return options.slice(0, maxDisplayed);

  const normalizedQuery = normalizeForSearch(query);
  const matches = options.filter((option) => {
    const normalizedLabel = normalizeForSearch(option.label);
    const normalizedSecondary = option.secondaryLabel
      ? normalizeForSearch(option.secondaryLabel)
      : '';
    const normalizedValue = normalizeForSearch(option.value);
    return (
      normalizedLabel.includes(normalizedQuery) ||
      normalizedSecondary.includes(normalizedQuery) ||
      normalizedValue.includes(normalizedQuery)
    );
  });

  return matches.slice(0, maxDisplayed);
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
