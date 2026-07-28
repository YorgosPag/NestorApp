/**
 * ADR-723 — Ορατότητα της παλέτας «Διαχειριστής Στρώσεων». Singleton, μηδέν React.
 *
 * ── ΓΙΑΤΙ ΜΕΤΟΝΟΜΑΣΤΗΚΕ ΑΠΟ `AdminLayerManagerDialogStore` (ADR-391 → ADR-723) ──
 *
 * Ο Διαχειριστής έπαψε να είναι modal dialog και έγινε **παλέτα**: μένει ανοιχτός ενώ ο χρήστης
 * σχεδιάζει, δεν δεσμεύει την εστίαση, δεν έχει backdrop, δεν κλείνει σε κλικ εκτός. Η λέξη
 * «Dialog» στο όνομα θα ήταν ενεργά παραπλανητική — ο επόμενος αναγνώστης θα υπέθετε modal
 * σημασιολογία (παγίδα εστίασης, μπλοκαρισμένος καμβάς) και θα έγραφε κώδικα πάνω σε λάθος
 * μοντέλο.
 *
 * ── ΓΙΑΤΙ ΤΩΡΑ ΜΕΣΩ `createToggleStore` ──
 *
 * Το προηγούμενο αρχείο έγραφε **με το χέρι** open/close/toggle/isOpen/subscribe/getSnapshot
 * πάνω σε `createExternalStore` — ακριβώς το boilerplate που ο SSoT factory
 * {@link createToggleStore} υπάρχει για να εξαλείψει. Η τεκμηρίωση του factory ονόμαζε ρητά
 * αυτό το store ως έναν από τους λόγους ύπαρξής του, αλλά η μετανάστευση δεν είχε γίνει ποτέ.
 * Έγινε τώρα (κανόνας N.0.2 — Boy Scout: το αγγίζεις, το τακτοποιείς).
 *
 * @see ../ui/components/AdminLayerManagerPalette — ο μοναδικός αναγνώστης της ορατότητας
 */

import { createToggleStore } from './createToggleStore';

export const LayerManagerPaletteStore = createToggleStore();

export type { ToggleStoreState as LayerManagerPaletteState } from './createToggleStore';
