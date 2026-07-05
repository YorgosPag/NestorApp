/**
 * Non-React SSoT for the user-selected display unit (ADR-357 Phase 2b → ADR-462).
 *
 * WHY a shared store: the display-unit preference must be read by BOTH the React
 * status-bar selector AND the non-React canvas render path (dimension pills, the
 * live move readout, ruler/measurement labels, drag-measurements). A plain React
 * hook (`useState` + localStorage) cannot be read synchronously at render time by
 * the canvas pipeline. This module is the single live truth: the selector writes
 * via `setUnit`, every reader (`useDisplayUnit` via `useSyncExternalStore`, and the
 * render-path formatter `formatLengthMm`) reads the same value.
 *
 * Mirrors the `cadToggleState` pattern (subscribable in-memory store, primitive
 * snapshot so React bails out via `Object.is`). localStorage is demoted to
 * persistence — the in-memory value is authoritative within a session.
 *
 * @see config/units.ts — mm ↔ unit conversion + constants (pure)
 * @see config/display-length-format.ts — the render-path formatter that reads this
 * @see hooks/common/useDisplayUnit.ts — React binding (useSyncExternalStore)
 * @see systems/constraints/cad-toggle-state.ts — same subscribable pattern
 */

import {
  type DisplayUnit,
  DEFAULT_DISPLAY_UNIT,
  DISPLAY_UNIT_STORAGE_KEY,
  isValidDisplayUnit,
} from './units';
import { createExternalStore } from '../stores/createExternalStore';

type Listener = () => void;

function readInitialUnit(): DisplayUnit {
  if (typeof window === 'undefined') return DEFAULT_DISPLAY_UNIT;
  const stored = window.localStorage.getItem(DISPLAY_UNIT_STORAGE_KEY);
  return isValidDisplayUnit(stored) ? stored : DEFAULT_DISPLAY_UNIT;
}

// SSoT pub/sub via createExternalStore (WAVE 2.6). `equals: Object.is` mirrors
// the hand-rolled guard; `setUnit` ALSO keeps its own manual pre-check because
// the localStorage persist must run ONLY on an actual change (same order as
// the original: guard → mutate → persist → notify).
const store = createExternalStore<DisplayUnit>(readInitialUnit(), { equals: Object.is });

export const displayUnitState = {
  /** Live display unit — read synchronously by the canvas render path. */
  getUnit(): DisplayUnit {
    return store.get();
  },

  /**
   * Writer — sole caller is the React `useDisplayUnit` setter (status-bar
   * selector). Persists to localStorage and notifies subscribers. No-op (no
   * notify) when unchanged, so redundant pushes never re-render subscribers.
   */
  setUnit(unit: DisplayUnit): void {
    if (unit === store.get()) return;
    store.set(unit);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISPLAY_UNIT_STORAGE_KEY, unit);
    }
  },

  /** Subscribe to unit changes (for `useSyncExternalStore`). */
  subscribe(fn: Listener): () => void {
    return store.subscribe(fn);
  },
};
