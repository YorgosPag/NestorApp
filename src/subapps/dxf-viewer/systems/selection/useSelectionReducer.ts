import type {
  SelectionState,
  FilterState
} from './config';
import type { RegionStatus, UnitType } from '../../types/overlay';
import type { SelectableEntityType, SelectionEntry, SelectionPayload } from './types';
import { createSelectionEntry, matchesEntityType } from './types';

// Combined context state
export interface SelectionContextState extends SelectionState {
  filters: FilterState;

  // 🏢 ENTERPRISE (2026-01-25): Universal selection state
  // Stores ALL selected entities regardless of type
  universalSelection: Map<string, SelectionEntry>;
  primarySelectedId: string | null;
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

  // 🏢 ENTERPRISE (2026-01-25): Universal Selection Actions
  // These actions work with ANY entity type via SelectionPayload
  | { type: 'UNIVERSAL_SELECT_ENTITY'; payload: SelectionPayload }
  | { type: 'UNIVERSAL_SELECT_ENTITIES'; payloads: SelectionPayload[] }
  | { type: 'UNIVERSAL_ADD_ENTITY'; payload: SelectionPayload }
  | { type: 'UNIVERSAL_ADD_ENTITIES'; payloads: SelectionPayload[] }
  | { type: 'UNIVERSAL_DESELECT_ENTITY'; id: string }
  | { type: 'UNIVERSAL_TOGGLE_ENTITY'; payload: SelectionPayload }
  | { type: 'UNIVERSAL_CLEAR_ALL' }
  | { type: 'UNIVERSAL_CLEAR_BY_TYPE'; entityType: SelectableEntityType };

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

    // ═══════════════════════════════════════════════════════════════════════════
    // 🏢 ENTERPRISE (2026-01-25): Universal Selection Actions
    // ═══════════════════════════════════════════════════════════════════════════

    case 'UNIVERSAL_SELECT_ENTITY': {
      const entry = createSelectionEntry(action.payload);
      const newUniversalSelection = new Map<string, SelectionEntry>();
      newUniversalSelection.set(entry.id, entry);

      // Also update legacy selectedRegionIds for backward compatibility
      const newSelectedRegionIds = (action.payload.type === 'overlay' || action.payload.type === 'region')
        ? [action.payload.id]
        : state.selectedRegionIds;

      return {
        ...state,
        universalSelection: newUniversalSelection,
        primarySelectedId: entry.id,
        selectedRegionIds: newSelectedRegionIds,
        editingRegionId: null,
        draggedVertexIndex: null,
      };
    }

    case 'UNIVERSAL_SELECT_ENTITIES': {
      const newUniversalSelection = new Map<string, SelectionEntry>();
      const regionIds: string[] = [];

      for (const payload of action.payloads) {
        const entry = createSelectionEntry(payload);
        newUniversalSelection.set(entry.id, entry);
        // Collect region IDs for backward compatibility
        if (payload.type === 'overlay' || payload.type === 'region') {
          regionIds.push(payload.id);
        }
      }

      const primaryId = action.payloads.length > 0 ? action.payloads[0].id : null;

      return {
        ...state,
        universalSelection: newUniversalSelection,
        primarySelectedId: primaryId,
        selectedRegionIds: regionIds.length > 0 ? regionIds : state.selectedRegionIds,
        editingRegionId: null,
        draggedVertexIndex: null,
      };
    }

    case 'UNIVERSAL_ADD_ENTITY': {
      const entry = createSelectionEntry(action.payload);
      const newUniversalSelection = new Map(state.universalSelection);
      newUniversalSelection.set(entry.id, entry);

      // Update legacy selectedRegionIds for backward compatibility
      const newSelectedRegionIds = (action.payload.type === 'overlay' || action.payload.type === 'region')
        ? [...state.selectedRegionIds.filter(id => id !== action.payload.id), action.payload.id]
        : state.selectedRegionIds;

      return {
        ...state,
        universalSelection: newUniversalSelection,
        primarySelectedId: entry.id,
        selectedRegionIds: newSelectedRegionIds,
      };
    }

    case 'UNIVERSAL_ADD_ENTITIES': {
      const newUniversalSelection = new Map(state.universalSelection);
      const regionIds = [...state.selectedRegionIds];

      for (const payload of action.payloads) {
        const entry = createSelectionEntry(payload);
        newUniversalSelection.set(entry.id, entry);
        // Collect region IDs for backward compatibility
        if ((payload.type === 'overlay' || payload.type === 'region') &&
            !regionIds.includes(payload.id)) {
          regionIds.push(payload.id);
        }
      }

      const primaryId = action.payloads.length > 0
        ? action.payloads[action.payloads.length - 1].id
        : state.primarySelectedId;

      return {
        ...state,
        universalSelection: newUniversalSelection,
        primarySelectedId: primaryId,
        selectedRegionIds: regionIds,
      };
    }

    case 'UNIVERSAL_DESELECT_ENTITY': {
      const newUniversalSelection = new Map(state.universalSelection);
      const removedEntry = newUniversalSelection.get(action.id);
      newUniversalSelection.delete(action.id);

      // Update primary if we removed it
      let newPrimaryId = state.primarySelectedId;
      if (state.primarySelectedId === action.id) {
        const remaining = Array.from(newUniversalSelection.keys());
        newPrimaryId = remaining.length > 0 ? remaining[0] : null;
      }

      // Update legacy selectedRegionIds for backward compatibility
      const newSelectedRegionIds = removedEntry &&
        (removedEntry.type === 'overlay' || removedEntry.type === 'region')
          ? state.selectedRegionIds.filter(id => id !== action.id)
          : state.selectedRegionIds;

      return {
        ...state,
        universalSelection: newUniversalSelection,
        primarySelectedId: newPrimaryId,
        selectedRegionIds: newSelectedRegionIds,
      };
    }

    case 'UNIVERSAL_TOGGLE_ENTITY': {
      const exists = state.universalSelection.has(action.payload.id);

      if (exists) {
        // Deselect - reuse the DESELECT logic
        const newUniversalSelection = new Map(state.universalSelection);
        const removedEntry = newUniversalSelection.get(action.payload.id);
        newUniversalSelection.delete(action.payload.id);

        let newPrimaryId = state.primarySelectedId;
        if (state.primarySelectedId === action.payload.id) {
          const remaining = Array.from(newUniversalSelection.keys());
          newPrimaryId = remaining.length > 0 ? remaining[0] : null;
        }

        const newSelectedRegionIds = removedEntry &&
          (removedEntry.type === 'overlay' || removedEntry.type === 'region')
            ? state.selectedRegionIds.filter(id => id !== action.payload.id)
            : state.selectedRegionIds;

        return {
          ...state,
          universalSelection: newUniversalSelection,
          primarySelectedId: newPrimaryId,
          selectedRegionIds: newSelectedRegionIds,
        };
      } else {
        // Add - reuse the ADD logic
        const entry = createSelectionEntry(action.payload);
        const newUniversalSelection = new Map(state.universalSelection);
        newUniversalSelection.set(entry.id, entry);

        const newSelectedRegionIds = (action.payload.type === 'overlay' || action.payload.type === 'region')
          ? [...state.selectedRegionIds.filter(id => id !== action.payload.id), action.payload.id]
          : state.selectedRegionIds;

        return {
          ...state,
          universalSelection: newUniversalSelection,
          primarySelectedId: entry.id,
          selectedRegionIds: newSelectedRegionIds,
        };
      }
    }

    case 'UNIVERSAL_CLEAR_ALL': {
      return {
        ...state,
        universalSelection: new Map(),
        primarySelectedId: null,
        selectedRegionIds: [],
        editingRegionId: null,
        draggedVertexIndex: null,
      };
    }

    case 'UNIVERSAL_CLEAR_BY_TYPE': {
      const newUniversalSelection = new Map<string, SelectionEntry>();
      const remainingRegionIds: string[] = [];

      // Keep entries that don't match the type being cleared
      for (const [id, entry] of state.universalSelection) {
        if (!matchesEntityType(entry.type, action.entityType)) {
          newUniversalSelection.set(id, entry);
          // Preserve region IDs that aren't being cleared
          if (entry.type === 'overlay' || entry.type === 'region') {
            remainingRegionIds.push(id);
          }
        }
      }

      // Update primary if it was of the cleared type
      let newPrimaryId = state.primarySelectedId;
      if (state.primarySelectedId) {
        const primaryEntry = state.universalSelection.get(state.primarySelectedId);
        if (primaryEntry && matchesEntityType(primaryEntry.type, action.entityType)) {
          const remaining = Array.from(newUniversalSelection.keys());
          newPrimaryId = remaining.length > 0 ? remaining[0] : null;
        }
      }

      // Update selectedRegionIds based on whether we cleared overlay/region types
      const newSelectedRegionIds = (action.entityType === 'overlay' || action.entityType === 'region')
        ? remainingRegionIds
        : state.selectedRegionIds;

      return {
        ...state,
        universalSelection: newUniversalSelection,
        primarySelectedId: newPrimaryId,
        selectedRegionIds: newSelectedRegionIds,
      };
    }

    default:
      return state;
  }
}