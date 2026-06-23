/**
 * Hatch select-mode flag (ADR-507 — «Επιλογή γραμμοσκίασης» / pick-existing).
 *
 * SSoT για το one-shot «διάλεξε υπάρχουσα γραμμοσκίαση» mode: όταν είναι armed, το
 * επόμενο κλικ στον καμβά κάνει hit-test μόνο σε `HatchEntity` (reuse του
 * `performDetailedHitTest` even-odd SSoT) και επιλέγει τη γραμμοσκίαση — ώστε ο
 * χρήστης να ρυθμίσει τις ιδιότητές της χωρίς να φύγει από το contextual tab.
 *
 * One-shot (AutoCAD-style): μετά την πρώτη επιλογή (ή αστοχία) το mode κλείνει μόνο
 * του (`disarmHatchSelect`). Το disarm καθαρίζει και το status-hint override.
 *
 * **Σκόπιμα plain imperative flag, ΟΧΙ listener-store/`createToggleStore`:** το flag
 * διαβάζεται ΜΟΝΟ imperative στο click-time (`useCanvasClickHandler`, ADR-040
 * event-time read) — κανείς δεν το subscribe-άρει για re-render. Άρα δεν χρειάζεται
 * το subscribe/getSnapshot boilerplate που εξαλείφει το `createToggleStore` (αντίθετα
 * με το αδελφό `hatch-pick-mode-store`, που ΟΝΤΩΣ subscribe-άρεται από το bridge).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import { toolHintOverrideStore } from '../../hooks/toolHintOverrideStore';

let armed = false;

/** `true` όταν περιμένουμε κλικ σε υπάρχουσα γραμμοσκίαση (one-shot). */
export function isHatchSelectArmed(): boolean {
  return armed;
}

/** Οπλίζει το mode «διάλεξε υπάρχουσα». */
export function armHatchSelect(): void {
  armed = true;
}

/** Κλείνει το mode + καθαρίζει το status-hint override (κάθε disarm path· null = μηδέν i18n). */
export function disarmHatchSelect(): void {
  if (!armed) return;
  armed = false;
  toolHintOverrideStore.setOverride(null);
}
