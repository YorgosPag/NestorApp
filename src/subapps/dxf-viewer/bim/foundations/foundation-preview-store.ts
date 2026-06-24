/**
 * ADR-436 Slice 2 — Foundation line-tool live-preview store.
 *
 * Mirror of `bim/beams/beam-preview-store.ts` (ADR-363 Phase 5.5P): οι line-based
 * foundation εντολές (strip / tie-beam) τρέχουν δικό τους FSM στο
 * `useFoundationTool` (startPoint / endPoint / kind / overrides) που ΔΕΝ
 * δρομολογείται μέσω `useUnifiedDrawing.machineContext.points`. Συνέπεια: το
 * `updatePreview` διαβάζει πάντα-άδειο `tempPoints` και ο rubber-band ghost δεν
 * εμφανίζεται.
 *
 * Fix — single-writer, multi-reader module-level store:
 * `useFoundationTool` γράφει σε κάθε state transition·
 * `drawing-preview-tool-points` διαβάζει via `foundationPreviewStore.get()` και
 * ανακατασκευάζει `tempPoints` για το `generateFoundationPreview`. Μηδέν
 * cross-hook dependency, μηδέν `useSyncExternalStore` σε high-frequency stores,
 * ADR-040-safe.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4
 * @see bim/beams/beam-preview-store.ts — πρότυπο
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { FoundationKind } from '../types/foundation-types';
import type { FoundationParamOverrides } from '../../hooks/drawing/foundation-completion';

export interface FoundationPreviewState {
  readonly startPoint: Point2D | null;
  readonly endPoint: Point2D | null;
  readonly kind: FoundationKind;
  readonly overrides: FoundationParamOverrides;
}

const EMPTY: FoundationPreviewState = Object.freeze({
  startPoint: null,
  endPoint: null,
  kind: 'strip' as FoundationKind,
  overrides: Object.freeze({}) as FoundationParamOverrides,
});

type Listener = () => void;

let currentState: FoundationPreviewState = EMPTY;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): FoundationPreviewState {
  return currentState;
}

function getServerSnapshot(): FoundationPreviewState {
  return EMPTY;
}

function pointsEqual(a: Point2D | null, b: Point2D | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

function overridesEqual(a: FoundationParamOverrides, b: FoundationParamOverrides): boolean {
  if (a === b) return true;
  // ADR-514 Φ6c — `length` + `anchor` συμμετέχουν: το live pad ghost αλλάζει σχήμα/θέση όταν αλλάζει
  // η διάσταση μήκους ή η λαβή (Tab anchor cycle) → χωρίς αυτά το ghost θα έμενε stale.
  return (
    a.kind === b.kind &&
    a.width === b.width &&
    a.length === b.length &&
    a.thicknessMm === b.thicknessMm &&
    a.anchor === b.anchor &&
    a.rotation === b.rotation
  );
}

export const foundationPreviewStore = {
  /** Writer — called by `useFoundationTool` on every line-FSM transition. */
  set(next: FoundationPreviewState): void {
    if (
      pointsEqual(currentState.startPoint, next.startPoint) &&
      pointsEqual(currentState.endPoint, next.endPoint) &&
      currentState.kind === next.kind &&
      overridesEqual(currentState.overrides, next.overrides)
    ) {
      return;
    }
    currentState = {
      startPoint: next.startPoint ? { x: next.startPoint.x, y: next.startPoint.y } : null,
      endPoint: next.endPoint ? { x: next.endPoint.x, y: next.endPoint.y } : null,
      kind: next.kind,
      overrides: { ...next.overrides },
    };
    for (const l of listeners) l();
  },
  /** Reset to empty (tool deactivated / committed / idle). */
  reset(): void {
    if (currentState === EMPTY) return;
    currentState = EMPTY;
    for (const l of listeners) l();
  },
  /** Non-React reader — for `drawing-preview-tool-points` consumer. */
  get(): FoundationPreviewState {
    return currentState;
  },
};

/** React subscription. Returns the latest foundation-preview state. */
export function useFoundationPreview(): FoundationPreviewState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
