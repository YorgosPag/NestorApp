'use client';

/**
 * ADR-364 §10.15 — **η ΜΙΑ δήλωση** ότι ένα Radix dismissable layer κατέχει νόμιμα το `Esc`.
 *
 * ## Το πρόβλημα, μετρημένο και όχι συναγόμενο
 * Ο έλεγχος ESC (`escape-dev-audit`) κρίνει `shadow-owner` κάθε `Esc` που καταναλώθηκε χωρίς slot
 * του `EscapeCommandBus`. **Μετρήθηκε 2026-08-10** ότι ένας απλός `<Dialog>` και ένα απλό
 * `<Popover>` του αποθετηρίου παράγουν `verdict = 'shadow-owner'` με `defaultPrevented = true` —
 * δηλαδή **κάθε** διάλογος και **κάθε** αναδυόμενο της εφαρμογής τυπώνει σφάλμα σε dev, όσο ο
 * viewer τρέχει.
 *
 * Και όμως **δεν είναι απόκλιση συμβολαίου**: το αποθετήριο δηλώνει **γραπτά** σε δύο σημεία
 * (`DimStyleCreateDialog.tsx:67`, `LayerStateDropdown.tsx:147`, με ρητή αναφορά ADR-364) ότι για
 * τα Radix modals το `Esc` το κατέχει το Radix. Το `ESC_PRIORITY.MODAL_DIALOG` υπάρχει για τα
 * **μη-Radix** modals. Δηλαδή ο νόμιμος ιδιοκτήτης απλώς δεν είχε **τρόπο να το πει**.
 *
 * ## 🔑 Γιατί δήλωση και όχι σιωπή — και γιατί ΕΝΑ αρχείο και όχι οκτώ
 * Η φθηνή διόρθωση («μη κρίνεις shadow-owner όταν υπάρχει ανοιχτό modal») θα ευλογούσε **σιωπηλά**
 * και κάθε **ωμό, αδήλωτο** ιδιοκτήτη στην ίδια κατάσταση — θα τύφλωνε τον έλεγχο ακριβώς εκεί που
 * τον χρειάζεσαι. Με τη δήλωση, ο νόμιμος γίνεται **ορατός** (`local:<id>`) και ο αδήλωτος
 * εξακολουθεί να βγαίνει `shadow-owner`.
 *
 * Και ζει **εδώ**, σε ένα module, όχι αντιγραμμένη σε κάθε wrapper: μια απάντηση γραμμένη οκτώ
 * φορές είναι οκτώ απαντήσεις που θα αποκλίνουν την ημέρα που κάποιος αλλάξει τη μία. Δευτερευόντως
 * — αλλά όχι ασήμαντα — **αυτό είναι το μόνο αρχείο του `components/ui` που φτάνει στο υποσύστημα
 * του viewer** γι' αυτό τον σκοπό· τα wrappers μένουν καθαρά.
 *
 * ⚠️ Μηδέν κόστος σε παραγωγή: η {@link noteLocalEscapeOwner} κάνει early-return όταν
 * `NODE_ENV === 'production'`, και επίσης όταν η σεντινέλα δεν είδε το συμβάν (δηλαδή όταν ο bus
 * δεν τρέχει καθόλου — κάθε σελίδα εκτός viewer).
 *
 * @see @/subapps/dxf-viewer/systems/escape-bus/escape-dev-audit — ο έλεγχος και η κατηγορία Κ3
 * @see ./__tests__/radix-escape-ownership.test.tsx — `Κ0` = η απόδειξη ζωής
 */

import { noteLocalEscapeOwner } from '@/subapps/dxf-viewer/systems/escape-bus/escape-dev-audit';

/**
 * Συνθέτει τον handler `onEscapeKeyDown` ενός Radix `Content`: δηλώνει τον τοπικό ιδιοκτήτη και
 * **μετά** καλεί ό,τι πέρασε ο καλών.
 *
 * ⚠️ **Συνθέτει, δεν παρακάμπτει.** Ο καλών εξακολουθεί να μπορεί να καλέσει `preventDefault()`
 * και να **ακυρώσει το κλείσιμο** (άγκυρα `Κ4`) — η δήλωση είναι παρατήρηση, όχι απόφαση. Η σειρά
 * είναι σημαντική: η δήλωση πρώτη, ώστε να καταγραφεί ακόμη κι αν ο handler του καλούντα πετάξει.
 *
 * @param ownerId Σταθερό αναγνωριστικό, ίδια σύμβαση με τα `EscapeHandler.id` (π.χ. `ui/dialog-content`).
 * @param callerHandler Ο `onEscapeKeyDown` που έδωσε ο καλών, αν έδωσε.
 */
export function withRadixEscapeOwner(
  ownerId: string,
  callerHandler?: (event: KeyboardEvent) => void,
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent): void => {
    noteLocalEscapeOwner(event, ownerId);
    callerHandler?.(event);
  };
}
