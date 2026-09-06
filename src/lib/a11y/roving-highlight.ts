/**
 * @fileoverview **Ο ΔΕΙΚΤΗΣ ΠΟΥ ΠΕΡΙΦΕΡΕΤΑΙ ΣΕ ΜΙΑ ΛΙΣΤΑ** — η αριθμητική, μία φορά.
 * @related WAI-ARIA APG (Combobox · Listbox) · lib/a11y/reveal-in-scroll.ts · CHECK 3.28
 * @module lib/a11y/roving-highlight
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΕΝΝΗΘΗΚΕ ΕΠΕΙΔΗ ΤΟ CHECK 3.28 ΜΕΤΡΗΣΕ **ΤΕΣΣΕΡΑ** ΔΙΔΥΜΑ ΣΕ ΕΝΑ COMMIT
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το «κατέβα ένα, και κύκλωσε στην κορυφή» ήταν γραμμένο **δύο φορές ανά αρχείο**
 * *(μία για κάθε βέλος)* σε **τέσσερα** χειριστήρια — `searchable-combobox` ·
 * `enterprise-contact-dropdown` · `usePhaseNameCombobox` · `ServicePresetCombobox`.
 * Το jscpd τα είδε τη στιγμή που στάλθηκαν μαζί.
 *
 * ⚠️ **Και τα αντίγραφα ΔΕΝ ήταν ταυτόσημα**: άλλο κρατούσε `filtered.length`, άλλο
 * `searchResults.length`, άλλο `totalItems` — η **ίδια** αριθμητική με τρία ονόματα,
 * δηλαδή τρεις ευκαιρίες να γραφτεί το `>=` αντί για `>`.
 *
 * 🔑 **Η κυκλικότητα δεν είναι διακοσμητική**: το WAI-ARIA APG την ορίζει ρητά για
 * combobox *(«Down Arrow στο τελευταίο → πρώτο»)*. Ένα χειριστήριο που κολλάει στο
 * τέλος και ένα που κυκλώνει είναι **δύο διαφορετικές υποσχέσεις** στον ίδιο χρήστη.
 */

/** Πού πάει ο δείκτης: **κάτω** (+1) ή **πάνω** (−1). Ποτέ ωμός αριθμός στον καλούντα. */
export type RovingDirection = 'next' | 'previous';

/**
 * **Ο επόμενος δείκτης, κυκλικά.**
 *
 * ⚠️ **`total <= 0` ⇒ `-1` («κανένας»), ποτέ σφάλμα**: η λίστα μπορεί να αδειάσει
 * ανάμεσα στο πάτημα και στην απόδοση *(φιλτράρισμα καθώς πληκτρολογεί ο χρήστης)*,
 * και ένα βέλος σε άδεια λίστα δεν είναι εξαίρεση — είναι **τίποτα να διαλέξεις**.
 *
 * 🔑 **Ξεκινά από την αρχή όταν δεν υπάρχει τρέχων** (`current < 0`): `next` δίνει το
 * **πρώτο**, `previous` το **τελευταίο** — η συμπεριφορά που περιγράφει το APG για
 * combobox χωρίς ενεργή επιλογή.
 */
export function nextRovingIndex(
  current: number,
  total: number,
  direction: RovingDirection,
): number {
  if (total <= 0) return -1;

  if (direction === 'next') {
    return current < total - 1 ? current + 1 : 0;
  }
  return current > 0 ? current - 1 : total - 1;
}

/**
 * **Είναι αυτό το πλήκτρο κίνηση του δείκτη — και προς τα πού;** `null` = δεν είναι.
 *
 * 🔑 **Γιατί ΑΥΤΟ και όχι ένας πλήρης χειριστής πληκτρολογίου**: το `Enter` και το
 * `Escape` **αποκλίνουν** νόμιμα ανά χειριστήριο *(ένα ελέγχει `disabled`, άλλο
 * καθαρίζει το κείμενο, άλλο κλείνει διάλογο)*. Κοινός χειριστής θα τα ισοπέδωνε ή θα
 * γέμιζε με σημαίες. Τα **βέλη**, αντίθετα, δεν έχουν λόγο να διαφέρουν ποτέ — και
 * μετρήθηκαν **ταυτόσημα** σε τέσσερα αρχεία *(CHECK 3.28)*.
 *
 * @example
 * const direction = rovingArrowDirection(e.key);
 * if (direction !== null) {
 *   e.preventDefault();
 *   setHighlightedIndex((prev) => nextRovingIndex(prev, total, direction));
 *   return;
 * }
 */
export function rovingArrowDirection(key: string): RovingDirection | null {
  if (key === 'ArrowDown') return 'next';
  if (key === 'ArrowUp') return 'previous';
  return null;
}

/**
 * **Ολόκληρη η πράξη του βέλους** — «ήταν βέλος; τότε το χειρίστηκα.»
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΚΑΙ ΤΡΙΤΟ ΕΠΙΠΕΔΟ, ΚΑΙ ΤΟ ΜΕΤΡΗΣΕ Η ΠΥΛΗ**: με μόνο τα δύο
 * προηγούμενα, το **σημείο κλήσης** έμενε ταυτόσημο σε δύο αρχεία *(6 γραμμές — το
 * `rovingArrowDirection` + `preventDefault` + `nextRovingIndex` + `return`)* και το
 * CHECK 3.28 **σωστά** το ξαναπιάνει: μια κεντρικοποίηση που αφήνει το ίδιο κάλεσμα
 * αντιγραμμένο δεν έλυσε το πρόβλημα, **το μετακίνησε**.
 *
 * ⚠️ **Το `setIndex` δέχεται ΣΥΝΑΡΤΗΣΗ ενημέρωσης, ποτέ τιμή**: ο δείκτης διαβάζεται
 * και γράφεται μέσα στον ίδιο χειριστή, και μια τιμή κλεισμένη σε closure θα ήταν
 * **μπαγιάτικη** σε γρήγορα διαδοχικά πατήματα.
 *
 * @returns `true` αν το πλήκτρο ήταν βέλος — ο καλών **σταματά** εκεί.
 */
export function applyRovingArrowKey(
  event: Pick<KeyboardEvent, 'key'> & { preventDefault(): void },
  total: number,
  setIndex: (updater: (previous: number) => number) => void,
): boolean {
  const direction = rovingArrowDirection(event.key);
  if (direction === null) return false;

  event.preventDefault();
  setIndex((previous) => nextRovingIndex(previous, total, direction));
  return true;
}
