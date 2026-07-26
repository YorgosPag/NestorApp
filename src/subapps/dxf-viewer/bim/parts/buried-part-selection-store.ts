/**
 * buried-part-selection-store — SSoT για την επιλογή του **Τμήματος** (κοντόστυλο) μέσα σε
 * ΜΙΑ κολώνα (ADR-715 §3· Revit Parts / «click-into components»).
 *
 * Mirror του `stair-sub-element-selection-store` (ADR-358 Q19) και του
 * `railing-component-selection-store` (ADR-407 Φ8): η κολώνα μένει **ΕΝΑ** στοιχείο — δεν
 * σπάει ποτέ σε δύο οντότητες. Η επιλογή Τμήματος είναι αμιγώς **transient VIEW state**
 * («σε ποια ζώνη έχω μπει»)· η διαρκής πληροφορία ζει στο `ColumnParams.buriedWaterproofing`
 * και γράφεται μέσω του υπάρχοντος `UpdateColumnParamsCommand` SSoT.
 *
 * ### Γιατί ΜΟΝΟ low-frequency (και όχι δύο tiers όπως η σκάλα)
 * Η σκάλα κρατά ΚΑΙ hover cell σε μη-reactive singleton, επειδή έχει **2D καταναλωτή**: ο
 * `StairRenderer` ζωγραφίζει hover πάτημα στην κάτοψη, και ο 2D κάμβας ξαναζωγραφίζει on-demand
 * → χρειάζεται ρητό notify. Το κοντόστυλο **δεν έχει σήμερα 2D εκπροσώπηση**: η θαμμένη ζώνη
 * είναι διαχωρισμός **καθ' ύψος**, άρα σε κάτοψη ταυτίζεται με το περίγραμμα της κολώνας —
 * δεν υπάρχει τίποτα ξεχωριστό να φωτιστεί. Ένα hover tier θα ήταν νεκρός κώδικας με κόστος
 * συντήρησης. **Όταν** αποκτήσει 2D εκπροσώπηση (π.χ. τομή), προστίθεται τότε, κατά το
 * πρότυπο της σκάλας — όχι προληπτικά.
 *
 * Η επιλογή είναι **αμοιβαία αποκλειόμενη** με stair sub-element / railing component / per-face
 * (ένα drill-down τη φορά, Revit-grade). Την αποκλειστικότητα την επιβάλλει ΕΝΑ σημείο:
 * {@link exitSubElementSelections} — ώστε να μη μπορεί να ξεχαστεί κλάδος στο pointer handler.
 *
 * Καθαρίζεται όταν η host κολώνα βγει από την whole-entity επιλογή (lifecycle guard στο
 * `scene-manager-construct`, mirror σκάλας) και με **Esc** (ένα επίπεδο πάνω → η κολώνα).
 *
 * @see ./buried-part.ts — η ταυτότητα (`BuriedPartRef`, ids, στόχοι highlight)
 * @see ../stairs/stair-sub-element-selection-store.ts — το πρότυπο
 * @see docs/centralized-systems/reference/adrs/ADR-715-buried-part-independent-selection-and-waterproofing-catalog.md
 */

import { create } from 'zustand';
import type { BuriedPartRef } from './buried-part';

interface BuriedPartSelectionState {
  /** Το επιλεγμένο Τμήμα, ή `null` (ολόκληρη κολώνα / τίποτα). */
  readonly selected: BuriedPartRef | null;
  /** Μπες στο Τμήμα της `columnId` (κλικ στη θαμμένη ζώνη). */
  selectPart(columnId: string): void;
  /** Βγες από το Τμήμα (Esc ένα επίπεδο / αλλαγή whole-selection / άλλο drill-down). */
  clear(): void;
}

export const useBuriedPartSelectionStore = create<BuriedPartSelectionState>((set) => ({
  selected: null,
  // Κενό id δεν γίνεται ποτέ επιλογή: θα «κόλλαγε» ένα ανώνυμο Τμήμα που κανένα lifecycle
  // guard δεν μπορεί να αντιστοιχίσει σε host, άρα δεν θα καθαριζόταν ποτέ.
  selectPart: (columnId) => set(columnId ? { selected: { columnId } } : {}),
  clear: () => set({ selected: null }),
}));

/** Snapshot για event-time reads (ADR-040: ΠΟΤΕ React snapshot σε handler). */
export function getSelectedBuriedPart(): BuriedPartRef | null {
  return useBuriedPartSelectionStore.getState().selected;
}
