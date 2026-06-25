import type {
  SelectionState,
  FilterState
} from './config';
import type { RegionStatus, UnitType } from '../../types/overlay';

// Combined context state
// ADR-532: the entity selection set (universalSelection Map + primarySelectedId)
// moved OUT of this reducer into `SelectedEntitiesStore` (the SSoT). This reducer
// now owns only the legacy region/overlay selection + filters + view + edit flags.
export interface SelectionContextState extends SelectionState {
  filters: FilterState;
}

// Actions for reducer
export type SelectionAction =
  | { type: 'SELECT_REGIONS'; regionIds: string[] }
  | { type: 'SELECT_REGION'; regionId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'ADD_TO_SELECTION'; regionId: string }
  | { type: 'REMOVE_FROM_SELECTION'; regionId: string }
  | { type: 'TOGGLE_SELECTION'; regionId: string }
  | { type: 'SET_EDITING_REGION'; regionId: string | null }
  | { type: 'SET_DRAGGED_VERTEX'; index: number | null }
  | { type: 'SET_SHOW_HANDLES'; show: boolean }
  | { type: 'SET_SHOW_LABELS'; show: boolean }
  | { type: 'SET_GHOST_PREVIEW'; enabled: boolean }
  | { type: 'SET_STATUS_FILTER'; statuses: RegionStatus[] }
  | { type: 'SET_UNIT_TYPE_FILTER'; unitTypes: UnitType[] }
  | { type: 'TOGGLE_STATUS_FILTER'; status: RegionStatus }
  | { type: 'TOGGLE_UNIT_TYPE_FILTER'; unitType: UnitType }
  | { type: 'CLEAR_ALL_FILTERS' }
  // 🏢 ENTERPRISE (Phase 2): Enhanced selection actions
  | { type: 'SELECT_ALL_ENTITIES'; entityIds: string[] }
  | { type: 'SELECT_BY_LAYER'; layerId: string; entityIds: string[] }
  | { type: 'ADD_MULTIPLE_TO_SELECTION'; entityIds: string[] }

  // ADR-532: legacy mirror sync — applied by useSelectionActions after a
  // SelectedEntitiesStore mutation, to keep `selectedRegionIds` (overlay-only
  // projection) + region-edit flags following the store. Replaces the old
  // UNIVERSAL_* cases (the Map now lives in the store).
  | { type: 'SYNC_UNIVERSAL_LEGACY'; regionIds?: string[]; resetEditing: boolean };

// Selection reducer
export function selectionReducer(state: SelectionContextState, action: SelectionAction): SelectionContextState {
  switch (action.type) {
    case 'SELECT_REGIONS':
      return {
        ...state,
        selectedRegionIds: action.regionIds,
        editingRegionId: null,
        draggedVertexIndex: null,
      };
      
    case 'SELECT_REGION':
      return {
        ...state,
        selectedRegionIds: [action.regionId],
        editingRegionId: null,
        draggedVertexIndex: null,
      };
      
    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedRegionIds: [],
        editingRegionId: null,
        draggedVertexIndex: null,
      };
      
    case 'ADD_TO_SELECTION':
      if (state.selectedRegionIds.includes(action.regionId)) {
        return state;
      }
      return {
        ...state,
        selectedRegionIds: [...state.selectedRegionIds, action.regionId],
      };
      
    case 'REMOVE_FROM_SELECTION':
      return {
        ...state,
        selectedRegionIds: state.selectedRegionIds.filter(id => id !== action.regionId),
      };
      
    case 'TOGGLE_SELECTION':
      const isSelected = state.selectedRegionIds.includes(action.regionId);
      if (isSelected) {
        return {
          ...state,
          selectedRegionIds: state.selectedRegionIds.filter(id => id !== action.regionId),
        };
      } else {
        return {
          ...state,
          selectedRegionIds: [...state.selectedRegionIds, action.regionId],
        };
      }
      
    case 'SET_EDITING_REGION':
      return {
        ...state,
        editingRegionId: action.regionId,
        draggedVertexIndex: null,
      };
      
    case 'SET_DRAGGED_VERTEX':
      return {
        ...state,
        draggedVertexIndex: action.index,
      };
      
    case 'SET_SHOW_HANDLES':
      return {
        ...state,
        showHandles: action.show,
      };
      
    case 'SET_SHOW_LABELS':
      return {
        ...state,
        showLabels: action.show,
      };
      
    case 'SET_GHOST_PREVIEW':
      return {
        ...state,
        ghostPreview: action.enabled,
      };
      
    case 'SET_STATUS_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          visibleStatuses: new Set(action.statuses),
        },
      };

    case 'SET_UNIT_TYPE_FILTER':
      return {
        ...state,
        filters: {
          ...state.filters,
          visibleUnitTypes: new Set(action.unitTypes),
        },
      };
      
    case 'TOGGLE_STATUS_FILTER':
      const currentStatuses = state.filters.visibleStatuses;
      const statusExists = currentStatuses.has(action.status);

      const newStatuses = new Set(currentStatuses);
      if (statusExists) {
        newStatuses.delete(action.status);
      } else {
        newStatuses.add(action.status);
      }

      return {
        ...state,
        filters: {
          ...state.filters,
          visibleStatuses: newStatuses,
        },
      };
      
    case 'TOGGLE_UNIT_TYPE_FILTER':
      const currentUnitTypes = state.filters.visibleUnitTypes;
      const unitTypeExists = currentUnitTypes.has(action.unitType);

      const newUnitTypes = new Set(currentUnitTypes);
      if (unitTypeExists) {
        newUnitTypes.delete(action.unitType);
      } else {
        newUnitTypes.add(action.unitType);
      }

      return {
        ...state,
        filters: {
          ...state.filters,
          visibleUnitTypes: newUnitTypes,
        },
      };
      
    case 'CLEAR_ALL_FILTERS':
      return {
        ...state,
        filters: {
          visibleStatuses: new Set(),
          visibleUnitTypes: new Set(),
        },
      };

    // 🏢 ENTERPRISE (Phase 2): Select all entities
    case 'SELECT_ALL_ENTITIES':
      return {
        ...state,
        selectedRegionIds: action.entityIds,
        editingRegionId: null,
        draggedVertexIndex: null,
      };

    // 🏢 ENTERPRISE (Phase 2): Select entities by layer
    case 'SELECT_BY_LAYER':
      return {
        ...state,
        selectedRegionIds: action.entityIds,
        editingRegionId: null,
        draggedVertexIndex: null,
      };

    // 🏢 ENTERPRISE (Phase 2): Add multiple entities to selection
    case 'ADD_MULTIPLE_TO_SELECTION':
      const newIds = action.entityIds.filter(
        id => !state.selectedRegionIds.includes(id)
      );
      if (newIds.length === 0) {
        return state;
      }
      return {
        ...state,
        selectedRegionIds: [...state.selectedRegionIds, ...newIds],
      };

    // ADR-532: legacy mirror sync — keep selectedRegionIds (overlay-only) +
    // region-edit flags following a SelectedEntitiesStore mutation. `regionIds`
    // omitted → keep existing (dxf-entity-only change).
    case 'SYNC_UNIVERSAL_LEGACY': {
      const next: SelectionContextState = action.regionIds !== undefined
        ? { ...state, selectedRegionIds: action.regionIds }
        : { ...state };
      if (action.resetEditing) {
        next.editingRegionId = null;
        next.draggedVertexIndex = null;
      }
      return next;
    }

    default:
      return state;
  }
}