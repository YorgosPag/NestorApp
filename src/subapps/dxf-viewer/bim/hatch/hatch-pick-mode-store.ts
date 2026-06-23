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

/** Πώς δείχνει ο χρήστης την περιοχή της γραμμοσκίασης (AutoCAD BHATCH modes). */
export type HatchPickMode = 'pick-point' | 'boundary';

/** AutoCAD BHATCH ανοίγει σε «Pick Points» → default pick-point. */
const DEFAULT_HATCH_PICK_MODE: HatchPickMode = 'pick-point';

let state: HatchPickMode = DEFAULT_HATCH_PICK_MODE;
const listeners = new Set<() => void>();

/** Τρέχων τρόπος (stable — αλλάζει μόνο σε set). */
export function getHatchPickMode(): HatchPickMode {
  return state;
}

/**
 * SSoT predicate: `true` όταν είναι ενεργό το εργαλείο «Γραμμοσκίαση» σε pick-point
 * mode (Τρόπος Β). Κοινό για τη δρομολόγηση κλικ (`useCanvasClickHandler`) ΚΑΙ το
 * live hover preview (`useRegionPerimeterMouseMove`) → μηδέν διπλό inline predicate.
 */
export function isHatchPickPointActive(tool: string | null | undefined): boolean {
  return tool === 'hatch' && state === 'pick-point';
}

/** Ορισμός τρόπου + ειδοποίηση subscribers (no-op αν ίδιος). */
export function setHatchPickMode(mode: HatchPickMode): void {
  if (mode === state) return;
  state = mode;
  for (const l of listeners) l();
}

/** `useSyncExternalStore` subscribe. */
export function subscribeHatchPickMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Επαναφορά στον default (test helper). */
export function resetHatchPickMode(): void {
  state = DEFAULT_HATCH_PICK_MODE;
  for (const l of listeners) l();
}
