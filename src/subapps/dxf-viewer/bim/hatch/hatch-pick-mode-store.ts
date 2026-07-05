/**
 * Hatch pick-mode store (ADR-507 Φ3 — Τρόπος Β / pick-point).
 *
 * SSoT για τον ΤΡΟΠΟ με τον οποίο ο χρήστης δείχνει την περιοχή της επόμενης
 * γραμμοσκίασης, ενόσω είναι ενεργό το εργαλείο «Γραμμοσκίαση» (AutoCAD BHATCH):
 *   - `'pick-point'` (default) → ΕΝΑ κλικ ΜΕΣΑ σε κλειστή περιοχή· το όριο (+ νησιά)
 *     ανιχνεύεται αυτόματα μέσω του `auto-area-hit` SSoT (Τρόπος Β).
 *   - `'boundary'` → N-click κλειστό όριο + Enter (Τρόπος Α, Φ1 — unified drawing).
 *
 * Καταναλωτές:
 *   - `useCanvasClickHandler` / `canvas-click-tool-handlers` — δρομολόγηση κλικ.
 *   - `useAutoAreaMouseMove` — live ghost preview μόνο σε pick-point.
 *   - `useRibbonHatchBridge` — το contextual panel «Μέθοδος» διαβάζει/γράφει εδώ.
 *
 * Zero-React imperative store + `useSyncExternalStore`-συμβατό (low-frequency —
 * user toggle μόνο, ADR-040-safe). Mirror του `hatch-draw-defaults-store`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import { createExternalStore } from '../../stores/createExternalStore';

/** Πώς δείχνει ο χρήστης την περιοχή της γραμμοσκίασης (AutoCAD BHATCH modes). */
export type HatchPickMode = 'pick-point' | 'boundary';

/** AutoCAD BHATCH ανοίγει σε «Pick Points» → default pick-point. */
const DEFAULT_HATCH_PICK_MODE: HatchPickMode = 'pick-point';

// Plain store· το `set` κρατά δικό του guard (γιατί το reset notify-άρει, το set όχι).
const store = createExternalStore<HatchPickMode>(DEFAULT_HATCH_PICK_MODE);

/** Τρέχων τρόπος (stable — αλλάζει μόνο σε set). */
export function getHatchPickMode(): HatchPickMode {
  return store.get();
}

/**
 * SSoT predicate: `true` όταν είναι ενεργό το εργαλείο «Γραμμοσκίαση» σε pick-point
 * mode (Τρόπος Β). Κοινό για τη δρομολόγηση κλικ (`useCanvasClickHandler`) ΚΑΙ το
 * live hover preview (`useRegionPerimeterMouseMove`) → μηδέν διπλό inline predicate.
 */
export function isHatchPickPointActive(tool: string | null | undefined): boolean {
  return tool === 'hatch' && store.get() === 'pick-point';
}

/** Ορισμός τρόπου + ειδοποίηση subscribers (no-op αν ίδιος). */
export function setHatchPickMode(mode: HatchPickMode): void {
  if (mode === store.get()) return;
  store.set(mode);
}

/** `useSyncExternalStore` subscribe. */
export function subscribeHatchPickMode(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Επαναφορά στον default (test helper). Notify-άρει (mirror του παλιού). */
export function resetHatchPickMode(): void {
  store.set(DEFAULT_HATCH_PICK_MODE);
}
