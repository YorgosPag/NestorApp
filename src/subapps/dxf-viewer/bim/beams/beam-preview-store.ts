/**
 * ADR-363 Phase 5.5P — Beam tool live-preview store.
 *
 * Mirror of `bim/walls/wall-preview-store.ts` (Phase 1C) and
 * `bim/slabs/slab-preview-store.ts` (Phase 6.5.B): the beam tool
 * maintains its own FSM in `useBeamTool` (startPoint / endPoint / kind /
 * overrides) which is NOT routed through `useUnifiedDrawing.machineContext.points`.
 * Consequence: `updatePreview` reads an always-empty `tempPoints` for
 * `tool === 'beam'` and the rubber-band ghost never surfaces.
 *
 * Fix — single-writer, multi-reader module-level store:
 * `useBeamTool` writes on every state transition;
 * `updatePreview` reads via `beamPreviewStore.get()` and reconstructs
 * `tempPoints` for `generateBeamPreview`. Zero cross-hook dependency,
 * zero `useSyncExternalStore` on high-frequency stores, ADR-040-safe.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5.5P
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { BeamKind } from '../../bim/types/beam-types';
import type { BeamParamOverrides } from '../../hooks/drawing/beam-completion';
import type { BeamSnapTarget } from './beam-beam-face-snap';

export interface BeamPreviewState {
  readonly startPoint: Point2D | null;
  readonly endPoint: Point2D | null;
  readonly kind: BeamKind;
  readonly overrides: BeamParamOverrides;
  /**
   * ADR-398 §Smart beam ghost (2026-06-20) — `true` όταν το `startPoint` κλειδώθηκε
   * από **face-snap** σε κολόνα (το ghost-before-click κούμπωσε σε παρειά). Τότε το
   * `startPoint` είναι ΗΔΗ το τελικό centerline → το awaitingEnd preview/commit
   * χρησιμοποιεί `buildDefaultBeamParams` (centerline mode), ΟΧΙ το location-line
   * auto-flush (`buildAnchoredBeamParams`) που θα ξανα-μετατόπιζε το start ±width/2.
   * `false` (default) → υπάρχουσα location-line συμπεριφορά (ADR-363 §5.7).
   */
  readonly startAnchored: boolean;
  /**
   * ADR-458 (2026-06-17) — column footprints (2Δ) της σκηνής, ώστε το WYSIWYG
   * preview να εφαρμόζει το ΙΔΙΟ beam-to-column cutback (frame-into) με το committed
   * δοκάρι. Γράφεται από το `useBeamTool` (`setColumns`, on activate)· διατηρείται
   * μέσα από τα `set()` transitions (αλλάζει σπάνια). `[]` = καμία κολόνα.
   */
  readonly columnFootprints: readonly (readonly Point2D[])[];
  /**
   * ADR-398 §beam-to-beam framing (2026-06-20) — τα υφιστάμενα δοκάρια (axis + outline,
   * scene units) ώστε το ghost-before-click να κουμπώνει ΚΑΙ πάνω σε δοκάρι (κάθετο
   * Τ-framing 🟢 / συγγραμμική κοντή άκρη 🔴). Γράφεται από `useBeamTool` (`setBeams`,
   * on activate / κάθε 1ο κλικ)· διατηρείται μέσα από τα `set()` transitions. `[]` = κανένα.
   */
  readonly beamTargets: readonly BeamSnapTarget[];
}

const EMPTY: BeamPreviewState = Object.freeze({
  startPoint: null,
  endPoint: null,
  kind: 'straight' as BeamKind,
  overrides: Object.freeze({}) as BeamParamOverrides,
  startAnchored: false,
  columnFootprints: Object.freeze([]) as readonly (readonly Point2D[])[],
  beamTargets: Object.freeze([]) as readonly BeamSnapTarget[],
});

type Listener = () => void;

let currentState: BeamPreviewState = EMPTY;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): BeamPreviewState {
  return currentState;
}

function getServerSnapshot(): BeamPreviewState {
  return EMPTY;
}

function pointsEqual(a: Point2D | null, b: Point2D | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

function overridesEqual(a: BeamParamOverrides, b: BeamParamOverrides): boolean {
  if (a === b) return true;
  return a.kind === b.kind && a.width === b.width && a.depth === b.depth;
}

export const beamPreviewStore = {
  /**
   * Writer — called by `useBeamTool` on every state transition. Το
   * `columnFootprints` ΔΕΝ περνά εδώ (αλλάζει σπάνια) — διατηρείται από το
   * `currentState` (set via `setColumns`).
   */
  set(next: Omit<BeamPreviewState, 'columnFootprints' | 'beamTargets' | 'startAnchored'> & { startAnchored?: boolean }): void {
    const nextAnchored = next.startAnchored ?? false;
    if (
      pointsEqual(currentState.startPoint, next.startPoint) &&
      pointsEqual(currentState.endPoint, next.endPoint) &&
      currentState.kind === next.kind &&
      currentState.startAnchored === nextAnchored &&
      overridesEqual(currentState.overrides, next.overrides)
    ) {
      return;
    }
    currentState = {
      startPoint: next.startPoint ? { x: next.startPoint.x, y: next.startPoint.y } : null,
      endPoint: next.endPoint ? { x: next.endPoint.x, y: next.endPoint.y } : null,
      kind: next.kind,
      overrides: { ...next.overrides },
      startAnchored: nextAnchored,
      columnFootprints: currentState.columnFootprints,
      beamTargets: currentState.beamTargets,
    };
    for (const l of listeners) l();
  },
  /**
   * ADR-458 — set the scene column footprints για το preview cutback. Idempotent
   * επί ίδιου reference· notify μόνο όταν αλλάζει. Called από `useBeamTool` on activate.
   */
  setColumns(footprints: readonly (readonly Point2D[])[]): void {
    if (currentState.columnFootprints === footprints) return;
    currentState = { ...currentState, columnFootprints: footprints };
    for (const l of listeners) l();
  },
  /**
   * ADR-398 §beam-to-beam framing — set τα υφιστάμενα δοκάρια-στόχους για το ghost
   * face-snap. Idempotent επί ίδιου reference· notify μόνο όταν αλλάζει. Called από
   * `useBeamTool` μαζί με το `setColumns` (on activate / κάθε 1ο κλικ).
   */
  setBeams(targets: readonly BeamSnapTarget[]): void {
    if (currentState.beamTargets === targets) return;
    currentState = { ...currentState, beamTargets: targets };
    for (const l of listeners) l();
  },
  /** Reset to empty (tool deactivated / committed / idle). */
  reset(): void {
    if (currentState === EMPTY) return;
    currentState = EMPTY;
    for (const l of listeners) l();
  },
  /** Non-React reader — for `updatePreview` consumer. */
  get(): BeamPreviewState {
    return currentState;
  },
};

/** React subscription. Returns the latest beam-preview state. */
export function useBeamPreview(): BeamPreviewState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
