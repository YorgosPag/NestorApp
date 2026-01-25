/**
 * USE SELECTION ACTIONS HOOK
 *
 * 🏢 ENTERPRISE (2026-01-25): React hook providing selection action creators
 *
 * Provides all selection operations:
 * - Basic: selectRegion, clearSelection, toggleSelection
 * - Multi-select: selectRegions, addToSelection, removeFromSelection
 * - 🆕 Phase 2: selectAllEntities, selectByLayer, addMultipleToSelection
 * - 🆕 Universal: selectEntity, selectEntities, deselectEntity, toggleEntity, etc.
 *
 * @see HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md
 * @see types.ts for Selectable interface and SelectionEntry
 */

import { useMemo } from 'react';
import type { SelectionActions, UniversalSelectionActions } from './config';
import type { SelectionAction, SelectionContextState } from './useSelectionReducer';
import type { SelectableEntityType, SelectionEntry, SelectionPayload } from './types';
import { matchesEntityType } from './types';

export interface SelectionActionsHook {
  selectionActions: SelectionActions;
  universalActions: UniversalSelectionActions;
}

export function useSelectionActions(
  state: SelectionContextState,
  dispatch: React.Dispatch<SelectionAction>
): SelectionActionsHook {
  const selectionActions = useMemo((): SelectionActions => ({
    // Basic selection operations
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

    // 🏢 ENTERPRISE (Phase 2): Enhanced selection actions
    /**
     * Select all entities from the provided IDs
     * Usage: selectAllEntities(getAllEntityIdsFromCurrentLevel())
     */
    selectAllEntities: (entityIds: string[]) =>
      dispatch({ type: 'SELECT_ALL_ENTITIES', entityIds }),

    /**
     * Select entities from a specific layer
     * Usage: selectByLayer('layer_1', entitiesInLayer)
     */
    selectByLayer: (layerId: string, entityIds: string[]) =>
      dispatch({ type: 'SELECT_BY_LAYER', layerId, entityIds }),

    /**
     * Add multiple entities to current selection
     * Usage: addMultipleToSelection(['entity_1', 'entity_2'])
     */
    addMultipleToSelection: (entityIds: string[]) =>
      dispatch({ type: 'ADD_MULTIPLE_TO_SELECTION', entityIds }),
  }), [state.selectedRegionIds, dispatch]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🏢 ENTERPRISE (2026-01-25): Universal Selection Actions
  // ═══════════════════════════════════════════════════════════════════════════

  const universalActions = useMemo((): UniversalSelectionActions => ({
    // Primary Selection API
    selectEntity: (payload: SelectionPayload) =>
      dispatch({ type: 'UNIVERSAL_SELECT_ENTITY', payload }),

    selectEntities: (payloads: SelectionPayload[]) =>
      dispatch({ type: 'UNIVERSAL_SELECT_ENTITIES', payloads }),

    addEntity: (payload: SelectionPayload) =>
      dispatch({ type: 'UNIVERSAL_ADD_ENTITY', payload }),

    addEntities: (payloads: SelectionPayload[]) =>
      dispatch({ type: 'UNIVERSAL_ADD_ENTITIES', payloads }),

    deselectEntity: (id: string) =>
      dispatch({ type: 'UNIVERSAL_DESELECT_ENTITY', id }),

    toggleEntity: (payload: SelectionPayload) =>
      dispatch({ type: 'UNIVERSAL_TOGGLE_ENTITY', payload }),

    clearAllSelections: () =>
      dispatch({ type: 'UNIVERSAL_CLEAR_ALL' }),

    clearByType: (entityType: SelectableEntityType) =>
      dispatch({ type: 'UNIVERSAL_CLEAR_BY_TYPE', entityType }),

    // Query Methods
    isEntitySelected: (id: string): boolean =>
      state.universalSelection.has(id),

    getSelectedEntries: (): SelectionEntry[] =>
      Array.from(state.universalSelection.values()),

    getSelectedByType: (entityType: SelectableEntityType): SelectionEntry[] =>
      Array.from(state.universalSelection.values())
        .filter(entry => matchesEntityType(entry.type, entityType)),

    getUniversalSelectionCount: (): number =>
      state.universalSelection.size,

    getSelectionCountByType: (entityType: SelectableEntityType): number =>
      Array.from(state.universalSelection.values())
        .filter(entry => matchesEntityType(entry.type, entityType))
        .length,

    getSelectedIds: (): string[] =>
      Array.from(state.universalSelection.keys()),

    getSelectedIdsByType: (entityType: SelectableEntityType): string[] =>
      Array.from(state.universalSelection.values())
        .filter(entry => matchesEntityType(entry.type, entityType))
        .map(entry => entry.id),
  }), [state.universalSelection, dispatch]);

  return {
    selectionActions,
    universalActions
  };
}