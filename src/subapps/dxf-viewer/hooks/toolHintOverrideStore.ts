/**
 * Tool Hint Override Store
 *
 * Lightweight external store for dynamic tool hint text overrides.
 * Used by entity-picking tools (angle measurement, rotation, etc.)
 * to update the ToolbarStatusBar prompt WITHOUT prop drilling.
 *
 * Also supports step override for tools that don't use DrawingStateMachine
 * (e.g., guide tools with their own step state in CanvasSection).
 *
 * Pattern: useSyncExternalStore — same as globalRulerStore
 *
 * @module hooks/toolHintOverrideStore
 */

import { createExternalStore } from '../stores/createExternalStore';

interface ToolHintOverrideState {
  readonly override: string | null;
  readonly step: number | null;
}

// Object wrapper (2 ανεξάρτητα πεδία) + field-compare equals → διατηρεί το per-field
// `if (x === current) return` guard (κάθε setter notify-άρει μόνο αν το ΔΙΚΟ του πεδίο άλλαξε).
const store = createExternalStore<ToolHintOverrideState>(
  { override: null, step: null },
  { equals: (a, b) => a.override === b.override && a.step === b.step },
);

export const toolHintOverrideStore = {
  /** Read current text override (useSyncExternalStore snapshot) */
  getSnapshot: (): string | null => store.get().override,

  /** Read current step override (useSyncExternalStore snapshot) */
  getStepSnapshot: (): number | null => store.get().step,

  /** Subscribe to changes (useSyncExternalStore subscription) */
  subscribe: (listener: () => void): (() => void) => store.subscribe(listener),

  /** Set override text (null = clear override, use default hint) */
  setOverride: (text: string | null): void => {
    store.set({ ...store.get(), override: text });
  },

  /**
   * Set step override for tools that manage their own step state.
   * When set, useToolHints uses this instead of DrawingStateMachine pointCount.
   * (null = use default pointCount from DrawingStateMachine)
   */
  setStepOverride: (step: number | null): void => {
    store.set({ ...store.get(), step });
  },
};
