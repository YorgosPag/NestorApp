/**
 * Tool Hint Override Store
 *
 * Lightweight external store for dynamic tool hint text overrides.
 * Used by entity-picking tools (angle measurement, rotation, etc.)
 * to update the ToolbarStatusBar prompt WITHOUT prop drilling.
 *
 * Pattern: useSyncExternalStore — same as globalRulerStore
 *
 * @module hooks/toolHintOverrideStore
 */

let currentOverride: string | null = null;
const listeners = new Set<() => void>();

export const toolHintOverrideStore = {
  /** Read current override (useSyncExternalStore snapshot) */
  getSnapshot: (): string | null => currentOverride,

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
};
