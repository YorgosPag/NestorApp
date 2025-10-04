import { useMemo } from 'react';
import type { SelectionActions } from './config';
import type { SelectionAction, SelectionContextState } from './useSelectionReducer';

export interface SelectionActionsHook {
  selectionActions: SelectionActions;
}

export function useSelectionActions(
  state: SelectionContextState,
  dispatch: React.Dispatch<SelectionAction>
): SelectionActionsHook {
  const selectionActions = useMemo((): SelectionActions => ({
    selectRegions: (regionIds: string[]) => 
      dispatch({ type: 'SELECT_REGIONS', regionIds }),
    selectRegion: (regionId: string) => 
      dispatch({ type: 'SELECT_REGION', regionId }),
    clearSelection: () => 
      dispatch({ type: 'CLEAR_SELECTION' }),
    addToSelection: (regionId: string) => 
      dispatch({ type: 'ADD_TO_SELECTION', regionId }),
    removeFromSelection: (regionId: string) => 
      dispatch({ type: 'REMOVE_FROM_SELECTION', regionId }),
    toggleSelection: (regionId: string) => 
      dispatch({ type: 'TOGGLE_SELECTION', regionId }),
    setEditingRegion: (regionId: string | null) => 
      dispatch({ type: 'SET_EDITING_REGION', regionId }),
    setDraggedVertex: (index: number | null) => 
      dispatch({ type: 'SET_DRAGGED_VERTEX', index }),
    isSelected: (regionId: string) => 
      state.selectedRegionIds.includes(regionId),
    getSelectionCount: () => 
      state.selectedRegionIds.length,
  }), [state.selectedRegionIds, dispatch]);

  return {
    selectionActions
  };
}