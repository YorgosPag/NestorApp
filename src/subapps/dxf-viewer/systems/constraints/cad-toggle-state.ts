/**
 * Subscribable in-memory SSoT for the ORTHO (F8) / POLAR (F10) / SNAP-MODE (F9)
 * CAD toggle state.
 *
 * WHY a shared store (2026-06-12): `useCadToggles` is a plain React hook with
 * its own `useState`, so every call site (`CadStatusBar`, `useDrawingHandlers`,
 * `useMirrorTool`, the dynamic-input overlays, …) used to hold an *independent*
 * copy of the toggle state. Those copies were reconciled **only** through the
 * Firestore round-trip — so toggling ORTHO in the status bar (one instance)
 * never reached the drawing consumer (another instance) when unauthenticated /
 * before the ~500 ms debounce landed. Symptom: the F8 switch turned green but
 * the rubber-band line never locked. This module is now the single live truth:
 * every `useCadToggles` instance reads ortho/polar from here via
 * `useSyncExternalStore`, and writers push synchronously on click → all
 * instances are instantly consistent, with Firestore demoted to persistence.
 *
 * It also remains the ADR-040-style immediate store for the non-React,
 * event-time consumers (BIM commit path in `useCanvasClickHandler`, the 2D
 * grip-drag commit/preview path) that cannot subscribe to a React hook and read
 * the live value synchronously via the getters.
 *
 * Mutual exclusion (ortho XOR polar) is enforced upstream in `useCadToggles`;
 * this store merely mirrors whatever it is told, so both flags are written
 * together to stay consistent.
 *
 * @see hooks/common/useCadToggles.ts — writer + React subscriber
 * @see hooks/drawing/bim-ortho-reference.ts — event-time reader (BIM commit path)
 * @see bim/grips/grip-step-quantize.ts — snap-mode reader (grip-drag step snap)
 * @see systems/constraints/polar-tracking-store.ts — same subscribable pattern
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

type Listener = () => void;

let orthoOn = false;
let polarOn = false;
let snapOn = false;
let snapStep = 0;

const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach(fn => fn());
}

export const cadToggleState = {
  /**
   * Writer — called by `useCadToggles` synchronously on every ortho/polar
   * change (local toggle or Firestore hydrate). No-op (no notify) when the
   * value is unchanged, so redundant pushes from the ~5 live hook instances
   * never spuriously re-render subscribers.
   */
  set(ortho: boolean, polar: boolean): void {
    if (ortho === orthoOn && polar === polarOn) return;
    orthoOn = ortho;
    polarOn = polar;
    // TEMP DIAGNOSTIC (2026-06-12 ORTHO debug) — remove after root cause found.
    console.log('[ORTHO-DBG] cadToggleState.set → ortho=%s polar=%s | listeners=%d', ortho, polar, listeners.size);
    notify();
  },
  /**
   * Writer — called by `CadStatusBar` (sole writer) on every SNAP-MODE (F9)
   * change. `step` is the increment in **mm** (0 / negative ⇒ no quantization);
   * the grip path converts it to scene units via `immediateSceneScale`.
   */
  setSnap(on: boolean, step: number): void {
    if (on === snapOn && step === snapStep) return;
    snapOn = on;
    snapStep = step;
    notify();
  },
  /** F8 ORTHO live state. */
  isOrthoOn(): boolean {
    return orthoOn;
  },
  /** F10 POLAR live state. */
  isPolarOn(): boolean {
    return polarOn;
  },
  /** F9 SNAP-MODE live state. */
  isSnapOn(): boolean {
    return snapOn;
  },
  /** Snap-mode increment step (mm — converted to scene units by the reader). */
  getSnapStep(): number {
    return snapStep;
  },
  /**
   * Subscribe to ortho/polar/snap changes (for `useSyncExternalStore`).
   * The getter snapshots (`isOrthoOn`/`isPolarOn`) return primitives, so React
   * bails out via `Object.is` when the value did not actually change.
   */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
