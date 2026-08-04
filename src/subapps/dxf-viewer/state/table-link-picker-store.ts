/**
 * 🔴 ADR-751 Φ8.γ — **«ποιον σύνδεσμο εννοούσες;»** ως SSoT μηδενικής κατάστασης React.
 *
 * Αδελφός του `SelectionCyclingStore` (ADR-357 Φ15) και του `table-cell-link-hover-store` —
 * ίδιο μοτίβο, γιατί απαντά την ίδια **κατηγορία** ερώτησης: υπάρχουν πολλοί υποψήφιοι και
 * ο χρήστης πρέπει να διαλέξει.
 *
 * ## Γιατί ΔΕΝ κρατά συντεταγμένες οθόνης
 * Το `SelectionCyclingStore` κρατά `clientX/clientY` **και σωστά**: εκείνο γεννιέται από
 * χειρονομία **ποντικιού** πάνω σε στοίβα οντοτήτων, οπότε η λίστα οφείλει να εμφανιστεί
 * ακριβώς εκεί που κοιτά ο χρήστης.
 *
 * Εδώ οι δύο πηγές είναι **και οι δύο πληκτρολόγιο**: το `Alt+Enter` σε κελί με πολλαπλές
 * διευθύνσεις και η λίστα ολόκληρου του πίνακα. Καμία δεν έχει σημείο. Μια «άγκυρα» θα ήταν
 * επινοημένη — και θα έβαζε τη λίστα σε τυχαία γωνία αντί εκεί που την ψάχνει το μάτι. Η
 * απάντηση των VS Code / Figma / Ctrl+K παντού είναι η ίδια: **κεντραρισμένη επιλογή**.
 *
 * @module subapps/dxf-viewer/state/table-link-picker-store
 * @see systems/selection/SelectionCyclingStore.ts — ο αδελφός της ίδιας ερώτησης, με ποντίκι
 */

import { createExternalStore } from '../stores/createExternalStore';

import type { TableCellLinkEntry } from '../bim/table/table-cell-link-index';

/** Η ανοιχτή επιλογή· `null` όταν δεν ρωτάμε τίποτα. */
export interface TableLinkPickerState {
  /**
   * Οι υποψήφιοι, **σε σειρά ανάγνωσης** (την παράγει το `collectTableCellLinks`).
   *
   * Ποτέ κενός πίνακας: «καμία διεύθυνση» δεν είναι ερώτηση, είναι σιωπή. Ο καλών ελέγχει
   * πριν ανοίξει — αλλιώς ο χρήστης θα έβλεπε άδειο παράθυρο ως απάντηση σε συντόμευση.
   */
  readonly links: readonly TableCellLinkEntry[];
  /**
   * Ο τίτλος λέει **τι ρωτάμε**: όλος ο πίνακας ή ένα κελί με πολλές διευθύνσεις.
   *
   * Ταξιδεύει ως ταυτότητα εμβέλειας και όχι ως έτοιμο κείμενο, ώστε η μετάφραση να ζει στο
   * component μαζί με κάθε άλλη συμβολοσειρά (N.11) — το store δεν ξέρει γλώσσα.
   */
  readonly scope: 'table' | 'cell';
}

const store = createExternalStore<TableLinkPickerState | null>(null);

/** Άνοιξε την επιλογή. Κενή λίστα ⇒ **δεν** ανοίγει: δες το {@link TableLinkPickerState.links}. */
export function openTableLinkPicker(state: TableLinkPickerState): void {
  if (state.links.length === 0) return;
  store.set(state);
}

export function closeTableLinkPicker(): void {
  store.set(null);
}

export function getTableLinkPicker(): TableLinkPickerState | null {
  return store.get();
}

export function subscribeTableLinkPicker(cb: () => void): () => void {
  return store.subscribe(cb);
}
