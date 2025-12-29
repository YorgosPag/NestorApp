import { useMemo } from 'react';
import type { FilterActions } from './config';
import type { RegionStatus, UnitType } from '../../types/overlay';
import type { SelectionAction, SelectionContextState } from './useSelectionReducer';

export interface FilterActionsHook {
  filterActions: FilterActions;
}

export function useFilterActions(
  state: SelectionContextState,
  dispatch: React.Dispatch<SelectionAction>
): FilterActionsHook {
  const filterActions = useMemo((): FilterActions => ({
    setStatusFilter: (statuses: RegionStatus[]) => 
      dispatch({ type: 'SET_STATUS_FILTER', statuses }),
    setUnitTypeFilter: (unitTypes: UnitType[]) => 
      dispatch({ type: 'SET_UNIT_TYPE_FILTER', unitTypes }),
    toggleStatusFilter: (status: RegionStatus) => 
      dispatch({ type: 'TOGGLE_STATUS_FILTER', status }),
    toggleUnitTypeFilter: (unitType: UnitType) => 
      dispatch({ type: 'TOGGLE_UNIT_TYPE_FILTER', unitType }),
    clearAllFilters: () => 
      dispatch({ type: 'CLEAR_ALL_FILTERS' }),
    isStatusVisible: (status: RegionStatus) =>
      state.filters.visibleStatuses.has(status), // ✅ ENTERPRISE FIX: Set.has() instead of Array.includes()
    isUnitTypeVisible: (unitType: UnitType) =>
      state.filters.visibleUnitTypes.has(unitType), // ✅ ENTERPRISE FIX: Set.has() instead of Array.includes()
  }), [state.filters.visibleStatuses, state.filters.visibleUnitTypes, dispatch]);

  return {
    filterActions
  };
}