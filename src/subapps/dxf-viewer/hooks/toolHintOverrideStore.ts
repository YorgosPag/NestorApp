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

let currentOverride: string | null = null;
let currentStepOverride: number | null = null;
const listeners = new Set<() => void>();

export const toolHintOverrideStore = {
  /** Read current text override (useSyncExternalStore snapshot) */
  getSnapshot: (): string | null => currentOverride,

  /** Read current step override (useSyncExternalStore snapshot) */
  getStepSnapshot: (): number | null => currentStepOverride,

  /** Subscribe to changes (useSyncExternalStore subscription) */
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  /** Set override text (null = clear override, use default hint) */
  setOverride: (text: string | null): void => {
    if (text === currentOverride) return;
    currentOverride = text;
    listeners.forEach(fn => fn());
  },

  /**
   * Set step override for tools that manage their own step state.
   * When set, useToolHints uses this instead of DrawingStateMachine pointCount.
   * (null = use default pointCount from DrawingStateMachine)
   */
  setStepOverride: (step: number | null): void => {
    if (step === currentStepOverride) return;
    currentStepOverride = step;
    listeners.forEach(fn => fn());
  },
};
