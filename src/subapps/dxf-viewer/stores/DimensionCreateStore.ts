'use client';

/**
 * ADR-362 Phase D1 — DimensionCreateStore (external SSoT, ADR-040 micro-leaf).
 *
 * Hand-rolled `useSyncExternalStore` store — same shape as `ToolStateStore` and
 * `HoverStore`. Lives outside React so the orchestrator (`useDrawingHandlers`,
 * `CanvasSection`) never re-renders when state machine ticks; Phase E1+ leaves
 * (ribbon contextual tab "Διάσταση", status-bar prompt, dynamic-input tooltip)
 * subscribe to selective slices via `useSyncExternalStoreWithSelector`-style
 * leaf hooks (added per consumer).
 *
 * Why a global store (per Q-A 2026-05-17, see [[project_adr362_dimension_system]]):
 *   - 6/6 CAD majors converge on global active-command state (AutoCAD, Revit,
 *     Rhino, BricsCAD, SketchUp, OnShape).
 *   - Phase E surfaces (ribbon, status bar, dynamic input) all need to read
 *     `currentType` / `clickIndex` without prop-drilling through CanvasSection.
 *   - Keyboard dispatch (Tab/Space/Escape) must reach the store even when
 *     focus is on the ribbon, not the canvas.
 *
 * Pure dispatch on top of `dimensionCreateReducer`. Side-effect work
 * (enterprise-id generation, scene commit) lives in `useDimensionCreate`.
 */

import { useSyncExternalStore } from 'react';
import type { DimensionType } from '../types/dimension';
import {
  dimensionCreateReducer,
  initialDimensionCreateState,
  type DimensionCreateAction,
  type DimensionCreateMode,
  type DimensionCreateState,
} from '../hooks/dimensions/dimension-create-state';

// ──────────────────────────────────────────────────────────────────────────────
// Module-scoped state + listener set
// ──────────────────────────────────────────────────────────────────────────────

let current: DimensionCreateState = initialDimensionCreateState;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((cb) => cb());
}

function applyAction(action: DimensionCreateAction): void {
  const next = dimensionCreateReducer(current, action);
  if (next === current) return;
  current = next;
  notify();
}

// ──────────────────────────────────────────────────────────────────────────────
// Store object (mirrors ToolStateStore shape)
// ──────────────────────────────────────────────────────────────────────────────

export const dimensionCreateStore = {
  /** Snapshot getter — stable reference until next mutation. */
  get(): DimensionCreateState {
    return current;
  },

  /** Subscribe to every state mutation (returns unsubscribe). */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Dispatch a raw action — escape hatch for tests + advanced consumers. */
  dispatch(action: DimensionCreateAction): void {
    applyAction(action);
  },

  // ── Convenience action creators ────────────────────────────────────────────

  start(params: {
    mode: DimensionCreateMode;
    styleId: string;
    manualOverride?: DimensionType;
  }): void {
    applyAction({
      kind: 'start',
      mode: params.mode,
      styleId: params.styleId,
      manualOverride: params.manualOverride,
    });
  },

  cursorMove(action: Omit<Extract<DimensionCreateAction, { kind: 'cursorMove' }>, 'kind'>): void {
    applyAction({ kind: 'cursorMove', ...action });
  },

  click(action: Omit<Extract<DimensionCreateAction, { kind: 'click' }>, 'kind'>): void {
    // [DIM-DIAG R3] TEMPORARY — verify every click that lands in the store with stack trace.
    // eslint-disable-next-line no-console
    console.warn(
      `[DIM-DIAG R3] store.click world=(${action.world.x.toFixed(2)},${action.world.y.toFixed(2)}) ` +
        `clicksBefore=${current.clicks.length} cursorWorldBefore=${
          current.cursorWorld
            ? `(${current.cursorWorld.x.toFixed(2)},${current.cursorWorld.y.toFixed(2)})`
            : 'null'
        }`,
      new Error().stack?.split('\n').slice(1, 5).join(' | '),
    );
    applyAction({ kind: 'click', ...action });
  },

  pressTab(): void {
    applyAction({ kind: 'pressTab' });
  },

  pressSpace(): void {
    applyAction({ kind: 'pressSpace' });
  },

  setParent(parentDimensionId: string): void {
    applyAction({ kind: 'setParent', parentDimensionId });
  },

  cancel(): void {
    applyAction({ kind: 'cancel' });
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// React adapter (selective subscription for ADR-040 micro-leaves)
// ──────────────────────────────────────────────────────────────────────────────

/** Subscribe a React component to the full DimensionCreateState snapshot. */
export function useDimensionCreateState(): DimensionCreateState {
  return useSyncExternalStore(
    dimensionCreateStore.subscribe,
    dimensionCreateStore.get,
    dimensionCreateStore.get,
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Test-only reset helper
// ──────────────────────────────────────────────────────────────────────────────

/** Test-only — restore the module-scoped store to its initial state. */
export function __resetDimensionCreateStoreForTests(): void {
  current = initialDimensionCreateState;
  listeners.clear();
}
