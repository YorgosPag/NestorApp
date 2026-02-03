/**
 * USEFLOATINGPANELSTATE HOOK
 * Extracted from FloatingPanelContainer.tsx for ΒΗΜΑ 1 refactoring
 * Enhanced with useReducer for ΒΗΜΑ 12 performance optimization
 */

import { useFloatingPanelReducer, type PanelType } from '../reducers/floatingPanelReducer';

export type { PanelType };

/**
 * Return type for the useFloatingPanelState hook
 */
export interface FloatingPanelState {
  // State values
  /** Currently active panel type */
  activePanel: PanelType;
  /** Set of expanded tree node keys */
  expandedKeys: Set<string>;

  // State setters (backwards compatibility)
  /** Set the active panel */
  setActivePanel: (panel: PanelType) => void;
  /** Set the expanded keys */
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Enhanced actions from reducer
  /** Add a key to the expanded set */
  addExpandedKey: (key: string) => void;
  /** Remove a key from the expanded set */
  removeExpandedKey: (key: string) => void;
  /** Toggle a key in the expanded set */
  toggleExpandedKey: (key: string) => void;
  /** Clear all expanded keys */
  clearExpandedKeys: () => void;
  /** Reset to initial state */
  resetToDefaults: () => void;

  // Computed values for performance
  /** Array representation of expanded keys */
  expandedKeysArray: string[];
  /** Number of expanded keys */
  expandedKeysCount: number;
  /** Whether any keys are expanded */
  hasExpandedKeys: boolean;
}

/**
 * Enhanced Floating Panel State Hook
 *
 * Custom hook that manages floating panel state using useReducer for better performance.
 * Provides backwards compatibility with the original useState-based interface while
 * adding new optimized features and computed values.
 *
 * @returns {FloatingPanelState} Complete panel state and actions
 *
 * @example
 * ```tsx
 * const {
 *   activePanel,
 *   expandedKeys,
 *   setActivePanel,
 *   toggleExpandedKey,
 *   hasExpandedKeys
 * } = useFloatingPanelState();
 * ```
 *
 * Features:
 * - useReducer-based state management for better performance
 * - Backwards compatibility with existing useState interface
 * - Enhanced actions for expanded keys management
 * - Computed values to avoid recalculations
 * - Memoized dispatchers to prevent unnecessary re-renders
 *
 * @since ΒΗΜΑ 12 του FloatingPanelContainer refactoring
 */
export function useFloatingPanelState(): FloatingPanelState {
  // ✅ Enhanced with useReducer for better performance (ΒΗΜΑ 12)
  const reducerResult = useFloatingPanelReducer();

  return {
    // Backwards compatibility interface
    activePanel: reducerResult.activePanel,
    expandedKeys: reducerResult.expandedKeys,
    setActivePanel: reducerResult.setActivePanel,
    setExpandedKeys: reducerResult.setExpandedKeys,

    // Enhanced actions
    addExpandedKey: reducerResult.actions.addExpandedKey,
    removeExpandedKey: reducerResult.actions.removeExpandedKey,
    toggleExpandedKey: reducerResult.actions.toggleExpandedKey,
    clearExpandedKeys: reducerResult.actions.clearExpandedKeys,
    resetToDefaults: reducerResult.actions.resetToDefaults,

    // Computed values
    expandedKeysArray: reducerResult.computed.expandedKeysArray,
    expandedKeysCount: reducerResult.computed.expandedKeysCount,
    hasExpandedKeys: reducerResult.computed.hasExpandedKeys,
  };
}
