import { useMemo } from 'react';
import type { ViewActions } from './config';
import type { SelectionAction, SelectionContextState } from './useSelectionReducer';

export interface ViewActionsHook {
  viewActions: ViewActions;
}

export function useViewActions(
  state: SelectionContextState,
  dispatch: React.Dispatch<SelectionAction>
): ViewActionsHook {
  const viewActions = useMemo((): ViewActions => ({
    setShowHandles: (show: boolean) => 
      dispatch({ type: 'SET_SHOW_HANDLES', show }),
    setShowLabels: (show: boolean) => 
      dispatch({ type: 'SET_SHOW_LABELS', show }),
    setGhostPreview: (show: boolean) => 
      dispatch({ type: 'SET_GHOST_PREVIEW', enabled: show }),
    toggleHandles: () => 
      dispatch({ type: 'SET_SHOW_HANDLES', show: !state.showHandles }),
    toggleLabels: () => 
      dispatch({ type: 'SET_SHOW_LABELS', show: !state.showLabels }),
    toggleGhostPreview: () => 
      dispatch({ type: 'SET_GHOST_PREVIEW', enabled: !state.ghostPreview }),
  }), [state.showHandles, state.showLabels, state.ghostPreview, dispatch]);

  return {
    viewActions
  };
}