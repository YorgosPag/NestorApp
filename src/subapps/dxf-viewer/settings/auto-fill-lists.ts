/**
 * 🔴 ADR-828 Φ4β — **Ο ΕΝΑΣ ΤΟΠΟΣ ΠΟΥ ΞΕΡΕΙ ΟΤΙ ΟΙ ΛΙΣΤΕΣ ΕΙΝΑΙ ΡΥΘΜΙΣΗ ΧΡΗΣΤΗ.**
 *
 * Κάθε στάθμη κάτω από εδώ (ανίχνευση, γεννήτορας, σχέδιο) δέχεται τις λίστες ως **όρισμα**
 * και μένει καθαρή. Κάθε στάθμη πάνω από εδώ (λαβή, κουμπί, μενού, ταξινόμηση) ρωτά **αυτή τη
 * μία συνάρτηση**. Έτσι το «πού ζουν οι λίστες» απαντιέται σε ένα αρχείο και η αλλαγή του δεν
 * αγγίζει τίποτε άλλο.
 *
 * ## 🔑 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ STORE ΕΔΩ
 * Ο πειρασμός είναι εύλογος: ο ανιχνευτής είναι καθαρός και ο καλών πρέπει να διαβάσει τις
 * λίστες **τη στιγμή της χειρονομίας**, όχι από στιγμιότυπο render (ADR-040 κανόνας #2).
 * Αλλά η σύγχρονη ανάγνωση **υπάρχει ήδη**: το `userSettingsRepository.getSlice()` είναι
 * ρητά *«synchronous read of the last known value»*. Ένα δεύτερο store θα ήταν **δεύτερη
 * αλήθεια** για δεδομένα που ζουν στο Firestore — και θα χρειαζόταν δικό του συγχρονισμό,
 * δηλαδή δικό του τρόπο να μείνει πίσω.
 *
 * ## Γιατί οι λίστες του χρήστη μπαίνουν ΠΡΩΤΕΣ
 * Η σειρά **είναι** ο κανόνας προτεραιότητας (δες {@link matchNameList}): ο άνθρωπος που
 * δήλωσε λίστα το έκανε ρητά, ενώ η ενσωματωμένη είναι προεπιλογή. Οι ενσωματωμένες δεν
 * μπαίνουν εδώ καθόλου — τις προσθέτει ο ίδιος ο ανιχνευτής, ώστε να μην μπορεί κανένας
 * καλών να τις ξεχάσει κατά λάθος.
 *
 * @module subapps/dxf-viewer/settings/auto-fill-lists
 * @see lib/string/name-list-match.ts — τι κάνει το ταίριασμα με αυτές
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §4
 */

import { userSettingsRepository } from '@/services/user-settings';
import type { AutoFillList } from '@/services/user-settings';
import type { NameListCandidate } from '@/lib/string/name-list-match';

/** Το πρόθεμα κλειδιού που ξεχωρίζει λίστα ανθρώπου από ενσωματωμένη, σε κάθε διάγνωση. */
const USER_LIST_KEY_PREFIX = 'user:';

/**
 * Οι αποθηκευμένες λίστες → υποψήφιες του ταιριάσματος. **Καθαρή**, ώστε να ελέγχεται χωρίς
 * Firestore.
 *
 * ⚠️ Οι λίστες με λιγότερες από δύο εγγραφές **πέφτουν έξω** αντί να περάσουν: μια λίστα με
 * ένα όνομα δεν έχει «επόμενο», και η αναδίπλωσή της θα έγραφε την ίδια λέξη σε κάθε κελί —
 * δηλαδή αντιγραφή μεταμφιεσμένη σε σειρά. Το σχήμα το απαγορεύει ήδη στην εγγραφή
 * (`AUTO_FILL_LIST_LIMITS.minEntries`)· ο φρουρός εδώ υπάρχει για ό,τι γράφτηκε **πριν** από
 * το σχήμα ή εκτός εφαρμογής, και για να αποδεικνύεται ο τύπος της μη-κενής πλειάδας.
 */
export function toNameListCandidates(
  lists: readonly AutoFillList[],
): readonly NameListCandidate[] {
  const out: NameListCandidate[] = [];
  for (const list of lists) {
    const [first, ...rest] = list.entries;
    if (first === undefined || rest.length === 0) continue;
    out.push({ key: `${USER_LIST_KEY_PREFIX}${list.name}`, entries: [first, ...rest] });
  }
  return out;
}

/**
 * Οι λίστες **αυτή τη στιγμή** — για κλήση μέσα σε χειριστή συμβάντος.
 *
 * ⚠️ Σκόπιμα **δεν** επιστρέφει υπόσχεση και **δεν** είναι hook: ο καλών βρίσκεται στη μέση
 * μιας χειρονομίας (απελευθέρωση λαβής, πάτημα κουμπιού) όπου δεν υπάρχει «μετά». Ο άνθρωπος
 * μπορεί να έχει προσθέσει λίστα πριν από ένα δευτερόλεπτο, και το slice έχει ήδη
 * ενημερωθεί τοπικά — δεν περιμένουμε γύρο Firestore για να το μάθουμε.
 */
export function autoFillListCandidates(): readonly NameListCandidate[] {
  const slice = userSettingsRepository.getSlice('dxfViewer.autoFillLists');
  return slice === undefined ? [] : toNameListCandidates(slice.lists);
}
