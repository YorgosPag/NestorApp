/**
 * ADR-745 Φ3β — Ορατότητα της παλέτας «Σύνδεση Πινακίδας». Singleton, μηδέν React.
 *
 * **Παλέτα, όχι βήμα εισαγωγής**, για τον ίδιο δομικό λόγο με τις «Εξωτερικές Αναφορές»
 * (ADR-736): η ανάγνωση της πινακίδας πρέπει να μπορεί να **ξανατρέξει**. Το ίδιο το ADR-745
 * §10 (#4) το ζητά ρητά ως δίχτυ ασφαλείας — *«κύρια διαδρομή: wizard εισαγωγής· δίχτυ: ενέργεια
 * ξανα-ανάλυση πινακίδας από το UI»*. Και υπάρχει τρίτος λόγος που τα ξεπερνά και τους δύο:
 * **η βάση αλλάζει**. Η επαφή που σήμερα δεν υπάρχει, αύριο υπάρχει· ένα βήμα wizard θα είχε
 * απαντήσει «δεν βρέθηκε» μία φορά και ποτέ ξανά.
 *
 * @see ./ExternalReferencesPaletteStore — ο αδελφός, ίδιο ακριβώς σχήμα
 */

import { createToggleStore } from './createToggleStore';

export const TitleBlockBindingPaletteStore = createToggleStore();

export type { ToggleStoreState as TitleBlockBindingPaletteState } from './createToggleStore';
