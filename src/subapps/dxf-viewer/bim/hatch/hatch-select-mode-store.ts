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
import { toolStateStore } from '../../stores/ToolStateStore';
import { pickTopHatchAt } from './hatch-pick-at';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';

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

/**
 * Ολοκλήρωση **επιτυχούς** pick υπάρχουσας γραμμοσκίασης: disarm + έξοδος από το
 * εργαλείο «Γραμμοσκίαση» πίσω σε `'select'` (canonical `toolStateStore.deselectTool`).
 *
 * **Γιατί χρειάζεται το deselect:** το armed pick γίνεται ενόσω είναι ενεργό το
 * hatch tool (pick-point mode). Χωρίς την έξοδο, μετά το disarm το `activeTool`
 * έμενε `'hatch'` → το επόμενο mousemove ξανάδειχνε το create-ghost (pick-point)
 * και το επόμενο κλικ δημιουργούσε νέα γραμμοσκίαση — ενώ ο χρήστης απλώς ήθελε να
 * δει/ρυθμίσει την επιλεγμένη. Το contextual tab παραμένει (selection-driven).
 *
 * SSoT για τα 2 intercept sites (`mouse-handler-up` + `useCanvasClickHandler`).
 */
export function finishHatchSelectPick(): void {
  disarmHatchSelect();
  toolStateStore.deselectTool();
}

/**
 * Εκτελεί **ΜΙΑ απόπειρα** armed pick υπάρχουσας γραμμοσκίασης — το ΕΝΑ authoritative
 * SSoT για τα **2 intercept sites** (`mouse-handler-up` event-path + `useCanvasClickHandler`
 * PRIORITY 0.6 belt-and-suspenders). Δεν διπλασιάζεται η ροή pick→select→finalize.
 *
 * Ροή: even-odd hatch hit-test (`pickTopHatchAt` SSoT) → αν βρεθεί γραμμοσκίαση,
 * `selectFn([id])` (ο caller δίνει το δικό του selection SSoT: `replaceEntitySelection`
 * ή το prop `onEntitiesSelected`) + `finishHatchSelectPick()` (disarm + έξοδος tool).
 * Σε αστοχία: **μένει armed** (forgiving — ξαναδοκιμάζεις).
 *
 * @returns `true` αν επιλέχθηκε γραμμοσκίαση. Ο caller **πάντα** καταναλώνει το click
 *          (armed → consume) ανεξάρτητα από το return — ΠΟΤΕ δημιουργία όσο armed.
 */
export function runArmedHatchPick(
  worldPoint: Point2D,
  entities: readonly Entity[],
  selectFn: (ids: string[]) => void,
): boolean {
  const hatchId = pickTopHatchAt(worldPoint, entities);
  if (!hatchId) return false;
  selectFn([hatchId]);
  finishHatchSelectPick();
  return true;
}
