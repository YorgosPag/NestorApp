/**
 * FLOATING PANEL REDUCER
 *
 * Unified state management για το FloatingPanelContainer state
 * Αντικαθιστά τα useState hooks στο useFloatingPanelState με useReducer για optimization
 */

import React from 'react';
// 🏢 ENTERPRISE: Import from Single Source of Truth
import {
  type FloatingPanelType,
  DEFAULT_PANEL,
} from '../../types/panel-types';

// 🏢 ENTERPRISE: Re-export for backwards compatibility
export type { FloatingPanelType };

/**
 * @deprecated Use FloatingPanelType instead. Alias for backwards compatibility.
 */
export type PanelType = FloatingPanelType;

export interface FloatingPanelState {
  activePanel: PanelType;
  expandedKeys: Set<string>;
}

export type FloatingPanelAction =
  | { type: 'SET_ACTIVE_PANEL'; payload: PanelType }
  | { type: 'SET_EXPANDED_KEYS'; payload: Set<string> }
  | { type: 'ADD_EXPANDED_KEY'; payload: string }
  | { type: 'REMOVE_EXPANDED_KEY'; payload: string }
  | { type: 'TOGGLE_EXPANDED_KEY'; payload: string }
  | { type: 'CLEAR_EXPANDED_KEYS' }
  | { type: 'RESET_TO_DEFAULTS' };

export const initialFloatingPanelState: FloatingPanelState = {
  activePanel: DEFAULT_PANEL,
  expandedKeys: new Set<string>(),
};

export function floatingPanelReducer(
  state: FloatingPanelState,
  action: FloatingPanelAction
): FloatingPanelState {
  switch (action.type) {
    case 'SET_ACTIVE_PANEL':
      return {
        ...state,
        activePanel: action.payload,
      };

    case 'SET_EXPANDED_KEYS':
      return {
        ...state,
        expandedKeys: new Set(action.payload),
      };

    case 'ADD_EXPANDED_KEY':
      return {
        ...state,
        expandedKeys: new Set([...state.expandedKeys, action.payload]),
      };

    case 'REMOVE_EXPANDED_KEY': {
      const newExpandedKeys = new Set(state.expandedKeys);
      newExpandedKeys.delete(action.payload);
      return {
        ...state,
        expandedKeys: newExpandedKeys,
      };
    }

    case 'TOGGLE_EXPANDED_KEY': {
      const newExpandedKeys = new Set(state.expandedKeys);
      if (newExpandedKeys.has(action.payload)) {
        newExpandedKeys.delete(action.payload);
      } else {
        newExpandedKeys.add(action.payload);
      }
      return {
        ...state,
        expandedKeys: newExpandedKeys,
      };
    }

    case 'CLEAR_EXPANDED_KEYS':
      return {
        ...state,
        expandedKeys: new Set<string>(),
      };

    case 'RESET_TO_DEFAULTS':
      return { ...initialFloatingPanelState };

    default:
      return state;
  }
}

// Action creators
export const floatingPanelActions = {
  setActivePanel: (panel: PanelType): FloatingPanelAction => ({
    type: 'SET_ACTIVE_PANEL',
    payload: panel,
  }),

  setExpandedKeys: (keys: Set<string>): FloatingPanelAction => ({
    type: 'SET_EXPANDED_KEYS',
    payload: keys,
  }),

  addExpandedKey: (key: string): FloatingPanelAction => ({
    type: 'ADD_EXPANDED_KEY',
    payload: key,
  }),

  removeExpandedKey: (key: string): FloatingPanelAction => ({
    type: 'REMOVE_EXPANDED_KEY',
    payload: key,
  }),

  toggleExpandedKey: (key: string): FloatingPanelAction => ({
    type: 'TOGGLE_EXPANDED_KEY',
    payload: key,
  }),

  clearExpandedKeys: (): FloatingPanelAction => ({
    type: 'CLEAR_EXPANDED_KEYS',
  }),

  resetToDefaults: (): FloatingPanelAction => ({
    type: 'RESET_TO_DEFAULTS',
  }),
};

// Enhanced custom hook με optimizations
export function useFloatingPanelReducer() {
  const [state, dispatch] = React.useReducer(floatingPanelReducer, initialFloatingPanelState);

  // Memoized action dispatchers για performance
  const actions = React.useMemo(() => ({
    setActivePanel: (panel: PanelType) => dispatch(floatingPanelActions.setActivePanel(panel)),
    setExpandedKeys: (keys: Set<string>) => dispatch(floatingPanelActions.setExpandedKeys(keys)),
    addExpandedKey: (key: string) => dispatch(floatingPanelActions.addExpandedKey(key)),
    removeExpandedKey: (key: string) => dispatch(floatingPanelActions.removeExpandedKey(key)),
    toggleExpandedKey: (key: string) => dispatch(floatingPanelActions.toggleExpandedKey(key)),
    clearExpandedKeys: () => dispatch(floatingPanelActions.clearExpandedKeys()),
    resetToDefaults: () => dispatch(floatingPanelActions.resetToDefaults()),
  }), []);

  // Computed values για performance optimization - enhanced με deep equality check
  const computed = React.useMemo(() => ({
    expandedKeysArray: Array.from(state.expandedKeys),
    expandedKeysCount: state.expandedKeys.size,
    hasExpandedKeys: state.expandedKeys.size > 0,
  }), [state.expandedKeys]);

  const setExpandedKeys = React.useCallback((value: React.SetStateAction<Set<string>>) => {
    const nextKeys = typeof value === 'function' ? value(state.expandedKeys) : value;
    actions.setExpandedKeys(nextKeys);
  }, [actions.setExpandedKeys, state.expandedKeys]);

  // Backwards compatibility interface - optimized
  const compatibility = React.useMemo(() => ({
    // Old useState-style setters για easy migration
    setActivePanel: actions.setActivePanel,
    setExpandedKeys,
  }), [actions.setActivePanel, setExpandedKeys]);

  return {
    // New reducer interface
    state,
    actions,
    computed,
    dispatch, // Direct access για custom actions

    // Backwards compatibility
    ...compatibility,
    activePanel: state.activePanel,
    expandedKeys: state.expandedKeys,
  };
}
