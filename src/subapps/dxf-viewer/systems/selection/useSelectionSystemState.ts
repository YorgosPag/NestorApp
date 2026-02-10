import { useReducer, useMemo } from 'react';
import {
  type SelectionActions,
  type FilterActions,
  type ViewActions,
  type UniversalSelectionActions,
  DEFAULT_SELECTION_STATE,
  DEFAULT_FILTER_STATE
} from './config';
import { selectionReducer, type SelectionContextState } from './useSelectionReducer';
import { useSelectionActions } from './useSelectionActions';
import { useFilterActions } from './useFilterActions';
import { useViewActions } from './useViewActions';

/**
 * Combined Selection Context Type
 * 🏢 ENTERPRISE (2026-01-25): Extended with UniversalSelectionActions
 */
export interface SelectionContextType extends
  SelectionContextState,
  SelectionActions,
  FilterActions,
  ViewActions,
  UniversalSelectionActions {}

export interface SelectionSystemStateReturn {
  state: SelectionContextState;
  contextValue: SelectionContextType;
}

// Initial state
// 🏢 ENTERPRISE (2026-01-25): Extended with universal selection state
const initialState: SelectionContextState = {
  ...DEFAULT_SELECTION_STATE,
  filters: DEFAULT_FILTER_STATE,
  universalSelection: new Map(),
  primarySelectedId: null,
};

export function useSelectionSystemState(): SelectionSystemStateReturn {
  const [state, dispatch] = useReducer(selectionReducer, initialState);

  // Initialize individual action hooks
  const { selectionActions, universalActions } = useSelectionActions(state, dispatch);
  const { filterActions } = useFilterActions(state, dispatch);
  const { viewActions } = useViewActions(state, dispatch);

  // Combine state and actions
  // 🏢 ENTERPRISE (2026-01-25): Extended with universal selection actions
  const contextValue = useMemo((): SelectionContextType => ({
    ...state,
    ...selectionActions,
    ...filterActions,
    ...viewActions,
    ...universalActions,
  }), [state, selectionActions, filterActions, viewActions, universalActions]);

  return {
    state,
    contextValue
  };
}