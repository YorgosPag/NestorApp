/**
 * SSoT — οι επιλογές του «Βήμα πλέγματος» της καρτέλας «Κίνηση» (ADR-366 §C.1.b).
 *
 * ## Γιατί ΠΑΡΑΓΟΝΤΑΙ και δεν γράφονται
 * Η λίστα ήταν γραμμένη **δύο** φορές: χειρόγραφη στο `contextual-animation-tab.ts` (η στατική
 * δήλωση) και παραγόμενη στο `useRibbonCommands` (η δυναμική κατάσταση). Δύο απαντήσεις στο
 * «ποια βήματα υπάρχουν» — και η μία θα έμενε πίσω την ημέρα που θα άλλαζε το
 * {@link SNAP_STEP_PRESETS}, με το dropdown να προσφέρει τιμή που ο κβαντιστής δεν ξέρει.
 * Ίδιο σκεπτικό με το `TABLE_TEXT_HEIGHT_SCALE_MM` (ADR-739 §52.1).
 *
 * ## 🔴 ΤΟ SLUG ΔΕΝ ΕΙΝΑΙ ΚΑΛΛΩΠΙΣΜΟΣ — ΕΙΝΑΙ Η ΠΡΟΣΒΑΣΙΜΟΤΗΤΑ ΤΟΥ ΚΛΕΙΔΙΟΥ
 * Τα κλειδιά ήταν `animation.snapStepOptions.0.1`. Το i18next σπάει το κλειδί στον
 * `keySeparator` (**προεπιλογή `'.'`**, δεν ρυθμίζεται αλλιώς στο `i18n/config.ts`), άρα έψαχνε
 * `animation → snapStepOptions → 0 → 1` — διαδρομή που **δεν υπάρχει**. Τα τρία δεκαδικά βήματα
 * ήταν **δομικά ανεπίλυτα**: θα έβγαζαν ωμό κλειδί ακόμα και με σωστό namespace και σωστή
 * μετάφραση. Τα `1`/`2` δούλευαν κατά τύχη — ένα τμήμα το καθένα (ADR-739 §52.3).
 *
 * ⚠️ Αν αλλάξεις το slug, άλλαξε **και** τα φύλλα του `animation.snapStepOptions` σε
 * `locales/{el,en}/dxf-viewer-shell.json`. Το `ribbon-label-key-coverage.test.ts` το πιάνει.
 *
 * @see ../../../bim-3d/animation/snap-quantizer — `SNAP_STEP_PRESETS` (η αυθεντία)
 */

import { SNAP_STEP_PRESETS } from '../../../bim-3d/animation/snap-quantizer';
import type { RibbonComboboxOption } from '../types/ribbon-types';

/** `0.25` → `'s0_25'` — τελεία στο φύλλο = ανεπίλυτο κλειδί (δες την κεφαλίδα). */
function snapStepLabelKey(step: number): string {
  return `animation.snapStepOptions.s${String(step).replace('.', '_')}`;
}

/** Τα βήματα του κβαντιστή ως επιλογές combobox — μία λίστα, δύο καταναλωτές. */
export const SNAP_STEP_COMBOBOX_OPTIONS: readonly RibbonComboboxOption[] =
  SNAP_STEP_PRESETS.map((step) => ({
    value: String(step),
    labelKey: snapStepLabelKey(step),
  }));
