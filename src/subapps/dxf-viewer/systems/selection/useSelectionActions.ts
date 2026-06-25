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
import type { SelectableEntityType, SelectionPayload } from './types';
import { SelectedEntitiesStore } from './SelectedEntitiesStore';

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

  // ADR-532 Stage B: universal actions are thin bridges over SelectedEntitiesStore
  // (the SSoT). The store now OWNS the legacy mirror — every mutator notifies the
  // provider-registered legacy sink (see `useSelectionSystemState` /
  // `SelectedEntitiesStore.registerLegacySink`), which dispatches the one
  // `SYNC_UNIVERSAL_LEGACY` action keeping `selectedRegionIds` + region-edit flags
  // in sync. So these wrappers just call the store (no applyMirror) — and an
  // orchestrator calling `SelectedEntitiesStore.X()` directly gets the identical
  // mirror. Query methods read the store live. Deps `[dispatch]` only → ref-stable.
  const universalActions = useMemo((): UniversalSelectionActions => {
    return {
      // Primary Selection API → store (mirror applied by the store-owned sink)
      selectEntity: (payload: SelectionPayload) => {
        SelectedEntitiesStore.selectEntity(payload);
      },

      selectEntities: (payloads: SelectionPayload[]) => {
        SelectedEntitiesStore.selectEntities(payloads);
      },

      addEntity: (payload: SelectionPayload) => {
        SelectedEntitiesStore.addEntity(payload);
      },

      addEntities: (payloads: SelectionPayload[]) => {
        SelectedEntitiesStore.addEntities(payloads);
      },

      deselectEntity: (id: string) => {
        SelectedEntitiesStore.deselectEntity(id);
      },

      toggleEntity: (payload: SelectionPayload) => {
        SelectedEntitiesStore.toggleEntity(payload);
      },

      clearAllSelections: () => {
        SelectedEntitiesStore.clearAll();
      },

      clearByType: (entityType: SelectableEntityType) => {
        SelectedEntitiesStore.clearByType(entityType);
      },

      // Query Methods → store (live)
      isEntitySelected: (id: string) => SelectedEntitiesStore.isSelected(id),
      getSelectedEntries: () => SelectedEntitiesStore.getEntries(),
      getSelectedByType: (entityType: SelectableEntityType) =>
        SelectedEntitiesStore.getByType(entityType),
      getUniversalSelectionCount: () => SelectedEntitiesStore.count(),
      getSelectionCountByType: (entityType: SelectableEntityType) =>
        SelectedEntitiesStore.countByType(entityType),
      getSelectedIds: () => SelectedEntitiesStore.getIds(),
      getSelectedIdsByType: (entityType: SelectableEntityType) =>
        SelectedEntitiesStore.getIdsByType(entityType),
    };
  }, [dispatch]);

  return {
    selectionActions,
    universalActions
  };
}