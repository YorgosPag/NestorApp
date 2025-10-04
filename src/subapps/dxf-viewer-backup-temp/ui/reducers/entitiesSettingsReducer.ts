/**
 * ENTITIES SETTINGS REDUCER
 *
 * Unified state management για το πολύπλοκο tab state στο EntitiesSettings component
 * Αντικαθιστά 6+ useState hooks με ένα centralized reducer για καλύτερη performance
 */

export interface EntitiesSettingsState {
  // Primary tool selection
  selectedTool: string | null;

  // Tab management
  activeLineTab: string | null;
  activeSpecificTab: 'drawing' | 'measurements';

  // Sub-tab management (για κάθε line tab type)
  activeDraftSubTab: string | null;
  activeCompletionSubTab: string | null;
  activeHoverSubTab: string | null;
  activeSelectionSubTab: string | null;
}

export type EntitiesSettingsAction =
  | { type: 'SET_SELECTED_TOOL'; payload: string | null }
  | { type: 'SET_ACTIVE_LINE_TAB'; payload: string | null }
  | { type: 'SET_ACTIVE_SPECIFIC_TAB'; payload: 'drawing' | 'measurements' }
  | { type: 'SET_ACTIVE_DRAFT_SUB_TAB'; payload: string | null }
  | { type: 'SET_ACTIVE_COMPLETION_SUB_TAB'; payload: string | null }
  | { type: 'SET_ACTIVE_HOVER_SUB_TAB'; payload: string | null }
  | { type: 'SET_ACTIVE_SELECTION_SUB_TAB'; payload: string | null }
  | { type: 'RESET_ALL_TABS' }
  | { type: 'RESET_SUB_TABS' }
  | { type: 'BATCH_UPDATE'; payload: Partial<EntitiesSettingsState> };

export const initialEntitiesSettingsState: EntitiesSettingsState = {
  selectedTool: null,
  activeLineTab: null,
  activeSpecificTab: 'drawing',
  activeDraftSubTab: null,
  activeCompletionSubTab: null,
  activeHoverSubTab: null,
  activeSelectionSubTab: null,
};

export function entitiesSettingsReducer(
  state: EntitiesSettingsState,
  action: EntitiesSettingsAction
): EntitiesSettingsState {
  switch (action.type) {
    case 'SET_SELECTED_TOOL':
      return {
        ...state,
        selectedTool: action.payload,
      };

    case 'SET_ACTIVE_LINE_TAB':
      return {
        ...state,
        activeLineTab: action.payload,
        // Reset όλα τα sub-tabs όταν αλλάζει το main tab
        activeDraftSubTab: null,
        activeCompletionSubTab: null,
        activeHoverSubTab: null,
        activeSelectionSubTab: null,
      };

    case 'SET_ACTIVE_SPECIFIC_TAB':
      return {
        ...state,
        activeSpecificTab: action.payload,
      };

    case 'SET_ACTIVE_DRAFT_SUB_TAB':
      return {
        ...state,
        activeDraftSubTab: action.payload,
        // Ensure που μόνο ένα sub-tab είναι ενεργό τη φορά
        activeCompletionSubTab: action.payload ? null : state.activeCompletionSubTab,
        activeHoverSubTab: action.payload ? null : state.activeHoverSubTab,
        activeSelectionSubTab: action.payload ? null : state.activeSelectionSubTab,
      };

    case 'SET_ACTIVE_COMPLETION_SUB_TAB':
      return {
        ...state,
        activeCompletionSubTab: action.payload,
        // Ensure που μόνο ένα sub-tab είναι ενεργό τη φορά
        activeDraftSubTab: action.payload ? null : state.activeDraftSubTab,
        activeHoverSubTab: action.payload ? null : state.activeHoverSubTab,
        activeSelectionSubTab: action.payload ? null : state.activeSelectionSubTab,
      };

    case 'SET_ACTIVE_HOVER_SUB_TAB':
      return {
        ...state,
        activeHoverSubTab: action.payload,
        // Ensure που μόνο ένα sub-tab είναι ενεργό τη φορά
        activeDraftSubTab: action.payload ? null : state.activeDraftSubTab,
        activeCompletionSubTab: action.payload ? null : state.activeCompletionSubTab,
        activeSelectionSubTab: action.payload ? null : state.activeSelectionSubTab,
      };

    case 'SET_ACTIVE_SELECTION_SUB_TAB':
      return {
        ...state,
        activeSelectionSubTab: action.payload,
        // Ensure που μόνο ένα sub-tab είναι ενεργό τη φορά
        activeDraftSubTab: action.payload ? null : state.activeDraftSubTab,
        activeCompletionSubTab: action.payload ? null : state.activeCompletionSubTab,
        activeHoverSubTab: action.payload ? null : state.activeHoverSubTab,
      };

    case 'RESET_ALL_TABS':
      return {
        ...initialEntitiesSettingsState,
        selectedTool: state.selectedTool, // Keep selected tool
      };

    case 'RESET_SUB_TABS':
      return {
        ...state,
        activeDraftSubTab: null,
        activeCompletionSubTab: null,
        activeHoverSubTab: null,
        activeSelectionSubTab: null,
      };

    case 'BATCH_UPDATE':
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
}

// Action creators για easier usage
export const entitiesSettingsActions = {
  setSelectedTool: (tool: string | null): EntitiesSettingsAction => ({
    type: 'SET_SELECTED_TOOL',
    payload: tool,
  }),

  setActiveLineTab: (tab: string | null): EntitiesSettingsAction => ({
    type: 'SET_ACTIVE_LINE_TAB',
    payload: tab,
  }),

  setActiveSpecificTab: (tab: 'drawing' | 'measurements'): EntitiesSettingsAction => ({
    type: 'SET_ACTIVE_SPECIFIC_TAB',
    payload: tab,
  }),

  setActiveDraftSubTab: (subTab: string | null): EntitiesSettingsAction => ({
    type: 'SET_ACTIVE_DRAFT_SUB_TAB',
    payload: subTab,
  }),

  setActiveCompletionSubTab: (subTab: string | null): EntitiesSettingsAction => ({
    type: 'SET_ACTIVE_COMPLETION_SUB_TAB',
    payload: subTab,
  }),

  setActiveHoverSubTab: (subTab: string | null): EntitiesSettingsAction => ({
    type: 'SET_ACTIVE_HOVER_SUB_TAB',
    payload: subTab,
  }),

  setActiveSelectionSubTab: (subTab: string | null): EntitiesSettingsAction => ({
    type: 'SET_ACTIVE_SELECTION_SUB_TAB',
    payload: subTab,
  }),

  resetAllTabs: (): EntitiesSettingsAction => ({
    type: 'RESET_ALL_TABS',
  }),

  resetSubTabs: (): EntitiesSettingsAction => ({
    type: 'RESET_SUB_TABS',
  }),

  batchUpdate: (updates: Partial<EntitiesSettingsState>): EntitiesSettingsAction => ({
    type: 'BATCH_UPDATE',
    payload: updates,
  }),
};

// Custom hook που wrapaρει το reducer με useful utilities - optimized για performance
export function useEntitiesSettingsReducer() {
  const [state, dispatch] = React.useReducer(entitiesSettingsReducer, initialEntitiesSettingsState);

  // Memoized action dispatchers
  const actions = React.useMemo(() => ({
    setSelectedTool: (tool: string | null) => dispatch(entitiesSettingsActions.setSelectedTool(tool)),
    setActiveLineTab: (tab: string | null) => dispatch(entitiesSettingsActions.setActiveLineTab(tab)),
    setActiveSpecificTab: (tab: 'drawing' | 'measurements') => dispatch(entitiesSettingsActions.setActiveSpecificTab(tab)),
    setActiveDraftSubTab: (subTab: string | null) => dispatch(entitiesSettingsActions.setActiveDraftSubTab(subTab)),
    setActiveCompletionSubTab: (subTab: string | null) => dispatch(entitiesSettingsActions.setActiveCompletionSubTab(subTab)),
    setActiveHoverSubTab: (subTab: string | null) => dispatch(entitiesSettingsActions.setActiveHoverSubTab(subTab)),
    setActiveSelectionSubTab: (subTab: string | null) => dispatch(entitiesSettingsActions.setActiveSelectionSubTab(subTab)),
    resetAllTabs: () => dispatch(entitiesSettingsActions.resetAllTabs()),
    resetSubTabs: () => dispatch(entitiesSettingsActions.resetSubTabs()),
    batchUpdate: (updates: Partial<EntitiesSettingsState>) => dispatch(entitiesSettingsActions.batchUpdate(updates)),
  }), []);

  // Computed values - optimized με selective state dependencies
  const computed = React.useMemo(() => {
    const subTabs = [
      state.activeDraftSubTab,
      state.activeCompletionSubTab,
      state.activeHoverSubTab,
      state.activeSelectionSubTab
    ];

    return {
      hasActiveSubTab: subTabs.some(Boolean),
      activeSubTabCount: subTabs.filter(Boolean).length,
      activeSubTabs: subTabs.filter(Boolean),
    };
  }, [state.activeDraftSubTab, state.activeCompletionSubTab, state.activeHoverSubTab, state.activeSelectionSubTab]);

  return {
    state,
    actions,
    computed,
    dispatch, // Direct access για custom actions
  };
}

// Μόνο το import για React.useReducer και React.useMemo
import React from 'react';