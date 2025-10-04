import { useReducer, useMemo } from 'react';
import { 
  type SelectionActions,
  type FilterActions,
  type ViewActions,
  DEFAULT_SELECTION_STATE, 
  DEFAULT_FILTER_STATE 
} from './config';
import { selectionReducer, type SelectionContextState, type SelectionAction } from './useSelectionReducer';
import { useSelectionActions } from './useSelectionActions';
import { useFilterActions } from './useFilterActions';
import { useViewActions } from './useViewActions';

export interface SelectionContextType extends SelectionContextState, SelectionActions, FilterActions, ViewActions {}

export interface SelectionSystemStateReturn {
  state: SelectionContextState;
  contextValue: SelectionContextType;
}

// Initial state
const initialState: SelectionContextState = {
  ...DEFAULT_SELECTION_STATE,
  filters: DEFAULT_FILTER_STATE,
};

export function useSelectionSystemState(): SelectionSystemStateReturn {
  const [state, dispatch] = useReducer(selectionReducer, initialState);

  // Initialize individual action hooks
  const { selectionActions } = useSelectionActions(state, dispatch);
  const { filterActions } = useFilterActions(state, dispatch);
  const { viewActions } = useViewActions(state, dispatch);

  // Combine state and actions
  const contextValue = useMemo((): SelectionContextType => ({
    ...state,
    ...selectionActions,
    ...filterActions,
    ...viewActions,
  }), [state, selectionActions, filterActions, viewActions]);

  return {
    state,
    contextValue
  };
}