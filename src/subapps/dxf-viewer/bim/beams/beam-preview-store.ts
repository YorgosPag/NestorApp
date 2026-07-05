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
import { createExternalStore } from '../../stores/createExternalStore';

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
  // ADR-398 §3.10 — οι face-snap στόχοι (column footprints + beam targets) ΜΕΤΑΚΙΝΗΘΗΚΑΝ στο
  // κοινό `sceneSnapTargetsStore` (bim/framing/scene-snap-targets.ts) — ΕΝΑ SSoT για όλα τα
  // placement tools. Αυτό το store κρατά πλέον ΜΟΝΟ το beam-tool FSM state.
}

const EMPTY: BeamPreviewState = Object.freeze({
  startPoint: null,
  endPoint: null,
  kind: 'straight' as BeamKind,
  overrides: Object.freeze({}) as BeamParamOverrides,
  startAnchored: false,
});

const store = createExternalStore<BeamPreviewState>(EMPTY);

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
  /** Writer — called by `useBeamTool` on every state transition (FSM state only). */
  set(next: Omit<BeamPreviewState, 'startAnchored'> & { startAnchored?: boolean }): void {
    const nextAnchored = next.startAnchored ?? false;
    const currentState = store.get();
    if (
      pointsEqual(currentState.startPoint, next.startPoint) &&
      pointsEqual(currentState.endPoint, next.endPoint) &&
      currentState.kind === next.kind &&
      currentState.startAnchored === nextAnchored &&
      overridesEqual(currentState.overrides, next.overrides)
    ) {
      return;
    }
    const nextState: BeamPreviewState = {
      startPoint: next.startPoint ? { x: next.startPoint.x, y: next.startPoint.y } : null,
      endPoint: next.endPoint ? { x: next.endPoint.x, y: next.endPoint.y } : null,
      kind: next.kind,
      overrides: { ...next.overrides },
      startAnchored: nextAnchored,
    };
    store.set(nextState);
  },
  /** Reset to empty (tool deactivated / committed / idle). */
  reset(): void {
    if (store.get() === EMPTY) return;
    store.set(EMPTY);
  },
  /** Non-React reader — for `updatePreview` consumer. */
  get(): BeamPreviewState {
    return store.get();
  },
};

/** React subscription. Returns the latest beam-preview state. */
export function useBeamPreview(): BeamPreviewState {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
