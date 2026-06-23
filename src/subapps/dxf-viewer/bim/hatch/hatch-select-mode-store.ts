/**
 * Hatch select-mode store (ADR-507 — «Επιλογή γραμμοσκίασης» / pick-existing).
 *
 * SSoT για το armed «διάλεξε υπάρχουσα γραμμοσκίαση» mode: όσο είναι armed, το
 * τοπικό κουμπί στο contextual tab μένει **πατημένο** (reactive — `useSyncExternalStore`)
 * και το επόμενο κλικ στον καμβά επιλέγει hatch-only (reuse του even-odd hit-test SSoT)·
 * μετά την επιλογή το mode κλείνει μόνο του (one-shot, AutoCAD-style).
 *
 * **Reuse του `createToggleStore` SSoT** (boolean toggle singleton· zero-React +
 * `useSyncExternalStore`-compatible) — μηδέν hand-rolled `_state`/`_subs`/`_notify`
 * boilerplate. Το `disarmHatchSelect` προσθέτει μόνο το καθάρισμα του status-hint.
 *
 * Καταναλωτές:
 *   - `useRibbonHatchBridge` — toggle κουμπί (πατημένο = armed) + arm/disarm.
 *   - `systems/cursor/mouse-handler-up` — authoritative hatch-only pick στο click.
 *
 * @see ../../stores/createToggleStore — boolean toggle SSoT factory
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import { createToggleStore } from '../../stores/createToggleStore';
import { toolHintOverrideStore } from '../../hooks/toolHintOverrideStore';

const store = createToggleStore();

/** `true` όσο περιμένουμε κλικ σε υπάρχουσα γραμμοσκίαση (event-time + snapshot read). */
export function isHatchSelectArmed(): boolean {
  return store.isOpen();
}

/** `useSyncExternalStore` subscribe (το toggle κουμπί δείχνει armed κατάσταση). */
export const subscribeHatchSelect = store.subscribe;

/** Οπλίζει το mode «διάλεξε υπάρχουσα». */
export function armHatchSelect(): void {
  store.open();
}

/** Κλείνει το mode + καθαρίζει το status-hint override (κάθε disarm path· null = μηδέν i18n). */
export function disarmHatchSelect(): void {
  if (!store.isOpen()) return;
  store.close();
  toolHintOverrideStore.setOverride(null);
}
