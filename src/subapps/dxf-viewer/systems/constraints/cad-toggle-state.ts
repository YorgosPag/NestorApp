/**
 * Subscribable in-memory SSoT for the ORTHO (F8) / POLAR (F10) / SNAP-MODE (F9)
 * / DYNAMIC INPUT (Dyn) CAD toggle state.
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

import { createExternalStore } from '../../stores/createExternalStore';

type Listener = () => void;

interface CadToggleSnapshot {
  readonly orthoOn: boolean;
  readonly polarOn: boolean;
  readonly snapOn: boolean;
  readonly snapStep: number;
  readonly dynInputOn: boolean;
}

const INITIAL_TOGGLE_STATE: CadToggleSnapshot = {
  orthoOn: false,
  polarOn: false,
  snapOn: false,
  snapStep: 0,
  dynInputOn: false,
};

// SSoT pub/sub via createExternalStore (WAVE 2.6). The 5 loose module-level
// `let`s are now one snapshot object; no `equals` on the store itself — each
// writer below keeps its OWN manual pre-check (comparing only the field-pair it
// owns), matching the hand-rolled store's unconditional notify after an
// accepted mutation.
const store = createExternalStore<CadToggleSnapshot>(INITIAL_TOGGLE_STATE);

export const cadToggleState = {
  /**
   * Writer — called by `useCadToggles` synchronously on every ortho/polar
   * change (local toggle or Firestore hydrate). No-op (no notify) when the
   * value is unchanged, so redundant pushes from the ~5 live hook instances
   * never spuriously re-render subscribers.
   */
  set(ortho: boolean, polar: boolean): void {
    const cur = store.get();
    if (ortho === cur.orthoOn && polar === cur.polarOn) return;
    store.set({ ...cur, orthoOn: ortho, polarOn: polar });
  },
  /**
   * Writer — called by `CadStatusBar` (sole writer) on every SNAP-MODE (F9)
   * change. `step` is the increment in **mm** (0 / negative ⇒ no quantization);
   * the grip path converts it to scene units via `immediateSceneScale`.
   */
  setSnap(on: boolean, step: number): void {
    const cur = store.get();
    if (on === cur.snapOn && step === cur.snapStep) return;
    store.set({ ...cur, snapOn: on, snapStep: step });
  },
  /**
   * Writer — called by `useCadToggles` synchronously on every DYNAMIC INPUT
   * change (local toggle or Firestore hydrate). Mirrors the ortho/polar fix:
   * `dynInput` is read by a SEPARATE hook instance (`DynamicInputSubscriber`)
   * than the one that toggles it (`CadStatusBar`); without this shared store the
   * toggle turned green but the overlay/ring never activated (it waited on the
   * Firestore echo, which never lands unauthenticated). No-op when unchanged.
   */
  setDynInput(on: boolean): void {
    const cur = store.get();
    if (on === cur.dynInputOn) return;
    store.set({ ...cur, dynInputOn: on });
  },
  /** F8 ORTHO live state. */
  isOrthoOn(): boolean {
    return store.get().orthoOn;
  },
  /** Dynamic Input live state. */
  isDynInputOn(): boolean {
    return store.get().dynInputOn;
  },
  /** F10 POLAR live state. */
  isPolarOn(): boolean {
    return store.get().polarOn;
  },
  /** F9 SNAP-MODE live state. */
  isSnapOn(): boolean {
    return store.get().snapOn;
  },
  /** Snap-mode increment step (mm — converted to scene units by the reader). */
  getSnapStep(): number {
    return store.get().snapStep;
  },
  /**
   * Subscribe to ortho/polar/snap changes (for `useSyncExternalStore`).
   * The getter snapshots (`isOrthoOn`/`isPolarOn`) return primitives, so React
   * bails out via `Object.is` when the value did not actually change.
   */
  subscribe(fn: Listener): () => void {
    return store.subscribe(fn);
  },
};
