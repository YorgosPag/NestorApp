/**
 * exit-sub-element-selections — ΤΟ ΕΝΑ σημείο που βγάζει από **κάθε** drill-down (ADR-715 Φ2).
 *
 * Το 3D έχει πλέον **τρία** αμοιβαία αποκλειόμενα «click-into» drill-downs πάνω από την
 * whole-entity επιλογή:
 *
 *   | drill-down | store | ADR |
 *   |---|---|---|
 *   | υποενότητα σκάλας (πάτημα/ρίχτι/πλατύσκαλο/πλάκα) | `stair-sub-element-selection-store` | ADR-358 Q19 |
 *   | component κιγκλιδώματος (κουπαστή/κάγκελα/κολόνα) | `railing-component-selection-store` | ADR-407 Φ8 |
 *   | **Τμήμα** κολώνας (κοντόστυλο) | `buried-part-selection-store` | ADR-715 |
 *
 * ### Γιατί helper και όχι τρεις κλήσεις ανά κλάδο (N.0.2)
 * Πριν από αυτό, το `use-bim3d-pointer-handlers` καθάριζε τα stores **χειροκίνητα σε 7
 * ξεχωριστούς κλάδους** (faced pick, stair pick, railing pick, miss, entity pick, DXF pick,
 * empty space) — με ασύμμετρα ζευγάρια σε κάθε έναν («εδώ καθάρισε το rail, εκεί το sub»).
 * Το σχήμα αυτό είναι O(κλάδοι × stores) και αστοχεί **σιωπηλά**: ένα ξεχασμένο ζευγάρι δεν
 * ρίχνει σφάλμα — απλώς αφήνει δύο drill-downs ζωντανά ταυτόχρονα, οπότε το swatch routing
 * (`PolygonMaterialPanel.apply`, first-match-wins) βάφει **άλλο** πράγμα από ό,τι βλέπει
 * φωτισμένο ο χρήστης. Με την προσθήκη του τρίτου store το πρόβλημα γινόταν βέβαιο.
 *
 * Εδώ γίνεται O(1) ανά κλάδο: **βγες από όλα**, μετά μπες σε ένα. Νέο drill-down στο μέλλον →
 * μία γραμμή εδώ και **όλοι** οι κλάδοι το τιμούν αυτόματα.
 *
 * ### Γιατί ζει στο `bim-3d/systems/selection` και όχι στο `bim/`
 * Και οι τρεις stores ζουν στο domain layer (`bim/`) ώστε 2D και 3D να μη εξαρτώνται μεταξύ
 * τους. Ο **συντονισμός** τους όμως έχει σήμερα αποκλειστικά 3D καταναλωτές (pointer handler,
 * Esc ladder, lifecycle guard): το 2D `stair-click-into-2d` ξέρει μόνο από σκάλες. Αν ποτέ
 * εμφανιστεί 2D καταναλωτής, το module μετακομίζει στο `bim/` — τα stores δεν χρειάζεται να
 * μετακινηθούν.
 *
 * Event-time `getState()` παντού (ADR-040: ΠΟΤΕ React snapshot σε handler).
 */

import { useStairSubElementSelectionStore } from '../../../bim/stairs/stair-sub-element-selection-store';
import { useRailingComponentSelectionStore } from '../../../bim/railings/railing-component-selection-store';
import { useBuriedPartSelectionStore } from '../../../bim/parts/buried-part-selection-store';

/**
 * Βγες από ΚΑΘΕ sub-element drill-down (σκάλα / κιγκλίδωμα / Τμήμα κολώνας).
 *
 * Idempotent: κλήση σε καθαρή κατάσταση είναι no-op ανά store (τα zustand `set` με ίδια τιμή
 * δεν αλλάζουν αναφορά state στα leaves που κάνουν equality guard). Κλήσε το **πριν** μπεις σε
 * νέο drill-down, ώστε να μην υπάρξει ποτέ στιγμή με δύο ενεργά.
 */
export function exitSubElementSelections(): void {
  useStairSubElementSelectionStore.getState().clear();
  useRailingComponentSelectionStore.getState().clear();
  useBuriedPartSelectionStore.getState().clear();
}

/**
 * True όταν **οποιοδήποτε** drill-down είναι ενεργό. Χρήσιμο για gates που πρέπει να ξέρουν
 * «είμαστε μέσα σε υπο-στοιχείο;» χωρίς να απαριθμούν τα stores (π.χ. hint κειμένου, Esc gate).
 */
export function hasSubElementSelection(): boolean {
  return (
    useStairSubElementSelectionStore.getState().selected !== null ||
    useRailingComponentSelectionStore.getState().selected !== null ||
    useBuriedPartSelectionStore.getState().selected !== null
  );
}
