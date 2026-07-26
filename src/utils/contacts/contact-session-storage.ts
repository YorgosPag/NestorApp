/**
 * @module contact-session-storage
 * @description SSoT για την **session-scoped κατάσταση φλοιού** της σελίδας Επαφών.
 *
 * ## Γιατί υπάρχει
 * Η επιλεγμένη επαφή ζει σε `useState` μέσα στο `useContactsPageState`. Μετρήθηκε
 * (2026-07-26, ADR-332) ότι το `<Suspense>` της σελίδας πετάει **ολόκληρο** το
 * υποδέντρο όταν οποιοσδήποτε απόγονος κάνει suspend — έστω για 51ms:
 *
 * ```
 * PAGE_STATE_UNMOUNT[sel=cont_54fa61f9-…]  @356122
 * PAGE_STATE_MOUNT  [sel=null]             @356173   ← 51ms, hmr: 0
 * ```
 *
 * Η κατάσταση **πετιέται**, δεν μηδενίζεται — σε καμία εκτέλεση δεν καταγράφηκε
 * σκόπιμο `setSelectedContact(null)`. Η λίστα επιβιώνει επειδή το `contactsCache`
 * είναι module-level (ADR-300)· η επιλογή όχι, επειδή είναι React state.
 *
 * Αυτό το module είναι η **δικλείδα**: ακόμη κι όταν συμβεί νόμιμο remount, ο
 * χρήστης δεν χάνει την καρτέλα που δούλευε — συμπεριφορά Revit/Figma, ο χώρος
 * εργασίας θυμάται τι είχες ανοιχτό. Η **κύρια διαδρομή** (στένεμα του Suspense
 * boundary) είναι ξεχωριστή διόρθωση· οι δύο είναι belt-and-suspenders (N.7.2 #4).
 *
 * ## Συμβόλαιο
 * - **ΕΝΑ** σημείο γραφής: ένα effect πάνω στο `selectedContact?.id`. Κάθε σκόπιμος
 *   μηδενισμός (νέα επαφή, καθαρισμός φίλτρου URL, διαγραφή, αρχειοθέτηση, κάδος)
 *   περνά από το ίδιο state ⇒ **κανένας handler δεν χρειάζεται αλλαγή**. Χωρίς αυτό,
 *   μια διαγραμμένη επαφή θα «επανερχόταν» — χειρότερο από το αρχικό ελάττωμα.
 * - **Καμία ανάκτηση από δίκτυο.** Η επαναφορά ψάχνει τη λίστα που ήδη υπάρχει στη
 *   μνήμη· αν δεν βρεθεί, επιστρέφει `null` (και το κλειδί καθαρίζεται από το effect
 *   γραφής). Ένα fetch εδώ θα προκαλούσε flash.
 * - Το `sessionStorage` μπορεί να πετάξει (ιδιωτική περιήγηση Safari, quota,
 *   απενεργοποιημένα cookies) ⇒ **κάθε πρόσβαση είναι φρουρημένη**. Αποτυχία
 *   persistence δεν επιτρέπεται ποτέ να ρίξει τη σελίδα.
 *
 * @see ADR-332 — Enterprise Address Editor System (D20)
 * @see ADR-300 — Stale Cache Factory SSoT (γιατί η λίστα επιβιώνει και η επιλογή όχι)
 */

/**
 * Κλειδί `sessionStorage` της επιλεγμένης επαφής.
 *
 * Ακολουθεί το σχήμα ονομασίας `contact-*` που καθιέρωσε το `contact-tab-<id>`
 * (ενεργή καρτέλα, `useContactDetailsController`). Ενιαίο πρόθεμα ⇒ ένα `grep`
 * βρίσκει όλη τη session κατάσταση των επαφών.
 */
const SELECTED_CONTACT_KEY = 'contact-selected';

/** Ελάχιστο σχήμα που χρειάζεται η επαναφορά — δεν δεσμεύει τον τύπο `Contact`. */
interface IdentifiableContact {
  id?: string;
}

/**
 * Διαβάζει το id της τελευταίας επιλεγμένης επαφής.
 *
 * @returns Το αποθηκευμένο id, ή `null` σε SSR / άδειο κλειδί / μη διαθέσιμο storage.
 */
export function readSelectedContactId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.sessionStorage.getItem(SELECTED_CONTACT_KEY);
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Γράφει — ή σβήνει — το id της επιλεγμένης επαφής.
 *
 * @param contactId - Το id προς διατήρηση, ή `null` για να καθαριστεί το κλειδί.
 *                    Το `null` είναι το **σκόπιμο** μονοπάτι: όταν ο χρήστης
 *                    αποεπιλέγει, διαγράφει ή αρχειοθετεί, η επιλογή δεν πρέπει
 *                    να επιβιώσει.
 */
export function writeSelectedContactId(contactId: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (contactId) {
      window.sessionStorage.setItem(SELECTED_CONTACT_KEY, contactId);
    } else {
      window.sessionStorage.removeItem(SELECTED_CONTACT_KEY);
    }
  } catch {
    // Το persistence είναι βελτίωση, όχι απαίτηση — η σελίδα συνεχίζει κανονικά.
  }
}

/**
 * Επαναφέρει την επιλεγμένη επαφή από τη λίστα **που ήδη υπάρχει στη μνήμη**.
 *
 * Προορίζεται για αρχικοποιητή `useState` (τρέχει μία φορά ανά mount, πριν από
 * κάθε render) ⇒ μηδέν flash, μηδέν επιπλέον render.
 *
 * @param contacts - Η λίστα υποψηφίων (τυπικά το περιεχόμενο του module cache).
 * @returns Η επαφή που αντιστοιχεί στο αποθηκευμένο id, αλλιώς `null` — και όταν
 *          το κλειδί δείχνει σε επαφή που δεν υπάρχει πια (σκουπίδι) και όταν η
 *          λίστα δεν έχει φορτώσει ακόμη.
 */
export function restoreSelectedContact<T extends IdentifiableContact>(
  contacts: readonly T[],
): T | null {
  const storedId = readSelectedContactId();
  if (!storedId) return null;

  return contacts.find(contact => contact.id === storedId) ?? null;
}
