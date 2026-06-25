import { useReducer, useMemo, useEffect } from 'react';
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
import { SelectedEntitiesStore } from './SelectedEntitiesStore';
import type { SelectionEntry } from './types';

/**
 * Combined Selection Context Type
 * 🏢 ENTERPRISE (2026-01-25): Extended with UniversalSelectionActions
 * ADR-532: `universalSelection` / `primarySelectedId` are no longer reducer
 * state — they live in SelectedEntitiesStore and are exposed here via live
 * getters on the context value (back-compat for the few raw-Map readers).
 */
export interface SelectionContextType extends
  SelectionContextState,
  SelectionActions,
  FilterActions,
  ViewActions,
  UniversalSelectionActions {
  readonly universalSelection: Map<string, SelectionEntry>;
  readonly primarySelectedId: string | null;
}

export interface SelectionSystemStateReturn {
  state: SelectionContextState;
  contextValue: SelectionContextType;
}

// Initial state (ADR-532: entity selection set moved to SelectedEntitiesStore)
const initialState: SelectionContextState = {
  ...DEFAULT_SELECTION_STATE,
  filters: DEFAULT_FILTER_STATE,
};

export function useSelectionSystemState(): SelectionSystemStateReturn {
  const [state, dispatch] = useReducer(selectionReducer, initialState);

  // Initialize individual action hooks
  const { selectionActions, universalActions } = useSelectionActions(state, dispatch);
  const { filterActions } = useFilterActions(state, dispatch);
  const { viewActions } = useViewActions(state, dispatch);

  // ADR-532 Stage B: register the store-owned legacy sink. The SelectedEntitiesStore
  // calls this after EVERY mutation, so the overlay-only `selectedRegionIds`
  // projection + region-edit flags stay in sync no matter who mutates (action
  // wrapper OR an orchestrator calling the store imperatively). The guard mirrors
  // the old `applyMirror` — NO_MIRROR (dxf-only / skip-if-unchanged) never dispatches.
  // `dispatch` is reducer-stable → registered once.
  useEffect(() => {
    SelectedEntitiesStore.registerLegacySink((m) => {
      if (!m.regionIdsChanged && !m.resetEditing) return;
      dispatch({
        type: 'SYNC_UNIVERSAL_LEGACY',
        regionIds: m.regionIdsChanged ? m.regionIds : undefined,
        resetEditing: m.resetEditing,
      });
    });
    return () => { SelectedEntitiesStore.registerLegacySink(null); };
  }, [dispatch]);

  // Combine state and actions.
  // ADR-532: universalSelection/primarySelectedId are live getters onto the
  // store (never stale) — they intentionally do NOT trigger contextValue
  // re-memo, so the selection set no longer broadcasts through React Context.
  const contextValue = useMemo((): SelectionContextType => ({
    ...state,
    ...selectionActions,
    ...filterActions,
    ...viewActions,
    ...universalActions,
    get universalSelection(): Map<string, SelectionEntry> { return SelectedEntitiesStore.getMap(); },
    get primarySelectedId(): string | null { return SelectedEntitiesStore.getPrimaryId(); },
  }), [state, selectionActions, filterActions, viewActions, universalActions]);

  return {
    state,
    contextValue
  };
}