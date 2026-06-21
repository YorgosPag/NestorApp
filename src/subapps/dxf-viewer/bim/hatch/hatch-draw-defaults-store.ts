/**
 * Hatch draw-defaults store (ADR-507 S2 / Φ1b).
 *
 * SSoT για τις προεπιλεγμένες ιδιότητες που εφαρμόζονται στην ΕΠΟΜΕΝΗ
 * γραμμοσκίαση που σχεδιάζει ο χρήστης (Revit «διάλεξε μοτίβο → σχεδίασε»).
 * Καταναλωτές:
 *   - `createEntityFromTool` (`case 'hatch'`) — διαβάζει τα defaults τη στιγμή
 *     της δημιουργίας του `HatchEntity` (mirror του `getXLineModeState`).
 *   - `useRibbonHatchBridge` — όταν δεν υπάρχει επιλεγμένο hatch (tool-active),
 *     το contextual panel «Γραμμοσκίαση» διαβάζει/γράφει αυτά τα defaults.
 *
 * Zero-React imperative store + `useSyncExternalStore`-συμβατό `subscribe`/
 * `getSnapshot` (low-frequency — user edits μόνο, ADR-040-safe).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { HatchEntity } from '../../types/entities';

/** Οι ρυθμίσεις σχεδίασης που κουβαλάει μια νέα γραμμοσκίαση. */
export interface HatchDrawDefaults {
  /** 'solid' = συμπαγές γέμισμα· 'user-defined' = παράλληλες γραμμές. */
  readonly fillType: NonNullable<HatchEntity['fillType']>;
  /** Χρώμα γεμίσματος/γραμμών (hex). */
  readonly fillColor: string;
  /** Γωνία γραμμών (μοίρες) — μόνο user-defined. */
  readonly lineAngle: number;
  /** Κάθετη απόσταση γραμμών (mm) — μόνο user-defined. */
  readonly lineSpacing: number;
  /** Διπλή (σταυρωτή) γραμμοσκίαση — μόνο user-defined. */
  readonly doubleCrossHatch: boolean;
  /** Island detection style (DXF code 75). */
  readonly islandStyle: NonNullable<HatchEntity['islandStyle']>;
}

/** Εργοστασιακές προεπιλογές — συμπαγής γκρι poché (η συνηθέστερη χρήση). */
const DEFAULT_HATCH_DRAW_DEFAULTS: HatchDrawDefaults = {
  fillType: 'solid',
  fillColor: '#808080',
  lineAngle: 45,
  lineSpacing: 100,
  doubleCrossHatch: false,
  islandStyle: 'normal',
};

let state: HatchDrawDefaults = DEFAULT_HATCH_DRAW_DEFAULTS;
const listeners = new Set<() => void>();

/** Τρέχοντα defaults (stable reference — αλλάζει μόνο σε set). */
export function getHatchDrawDefaults(): HatchDrawDefaults {
  return state;
}

/** Patch ενός ή περισσότερων default πεδίων + ειδοποίηση subscribers. */
export function setHatchDrawDefaults(patch: Partial<HatchDrawDefaults>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/** `useSyncExternalStore` subscribe. */
export function subscribeHatchDrawDefaults(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Επαναφορά στις εργοστασιακές (test helper). */
export function resetHatchDrawDefaults(): void {
  state = DEFAULT_HATCH_DRAW_DEFAULTS;
  for (const l of listeners) l();
}
