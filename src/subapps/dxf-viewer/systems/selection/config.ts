/**
 * SELECTION SYSTEM CONFIGURATION
 * Configuration options and constants for selection behavior
 *
 * 🏢 ENTERPRISE (2026-01-25): Extended with Universal Selection types
 * @see types.ts for Selectable interface and SelectionEntry
 */

import type { RegionStatus, UnitType } from '../../types/overlay';
import type { Point2D } from '../../rendering/types/Types';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { SelectableEntityType, SelectionEntry, SelectionPayload } from './types';

// Selection tolerance settings (imported from central config)
export const SELECTION_CONFIG = {
  DEFAULT_TOLERANCE: TOLERANCE_CONFIG.SELECTION_DEFAULT,
  MINIMUM_TOLERANCE: TOLERANCE_CONFIG.SELECTION_MIN,
  MAXIMUM_TOLERANCE: TOLERANCE_CONFIG.SELECTION_MAX,
  MARQUEE_MIN_SIZE: TOLERANCE_CONFIG.MARQUEE_MIN_SIZE,
  LASSO_MIN_POINTS: TOLERANCE_CONFIG.LASSO_MIN_POINTS,
} as const;

// Selection types
export type SelectionMode = 'point' | 'window' | 'crossing' | 'lasso';
export type MarqueeKind = 'window' | 'crossing';

// Selection state interfaces
export interface SelectionState {
  selectedRegionIds: string[];
  editingRegionId: string | null;
  draggedVertexIndex: number | null;
  showHandles: boolean;
  showLabels: boolean;
  ghostPreview: boolean;
}

export interface FilterState {
  visibleStatuses: Set<RegionStatus>;
  visibleUnitTypes: Set<UnitType>;
}

// Marquee selection state
export interface MarqueeState {
  active: boolean;
  start?: Point2D;
  end?: Point2D;
  kind?: MarqueeKind;
}

// Lasso selection state
export interface LassoState {
  active: boolean;
  points: Point2D[];
  startedAt?: number;
}

// Combined selection overlay state
export interface SelectionOverlayState {
  marquee: MarqueeState;
  lasso: LassoState;
}

// Selection actions interface
export interface SelectionActions {
  selectRegions: (regionIds: string[]) => void;
  selectRegion: (regionId: string) => void;
  clearSelection: () => void;
  addToSelection: (regionId: string) => void;
  removeFromSelection: (regionId: string) => void;
  toggleSelection: (regionId: string) => void;
  setEditingRegion: (regionId: string | null) => void;
  setDraggedVertex: (index: number | null) => void;
  isSelected: (regionId: string) => boolean;
  getSelectionCount: () => number;
  /**
   * 🏢 ENTERPRISE (Phase 2): Select all entities from provided IDs
   * Usage: selectAllEntities(getAllEntityIdsFromCurrentLevel())
   */
  selectAllEntities: (entityIds: string[]) => void;
  /**
   * 🏢 ENTERPRISE (Phase 2): Select entities by layer ID
   * Usage: selectByLayer(layerId, entitiesInLayer)
   */
  selectByLayer: (layerId: string, entityIds: string[]) => void;
  /**
   * 🏢 ENTERPRISE (Phase 2): Add multiple entities to selection
   * Usage: addMultipleToSelection(entityIds)
   */
  addMultipleToSelection: (entityIds: string[]) => void;
}

// Filter actions interface
export interface FilterActions {
  setStatusFilter: (statuses: RegionStatus[]) => void;
  setUnitTypeFilter: (unitTypes: UnitType[]) => void;
  toggleStatusFilter: (status: RegionStatus) => void;
  toggleUnitTypeFilter: (unitType: UnitType) => void;
  clearAllFilters: () => void;
  isStatusVisible: (status: RegionStatus) => boolean;
  isUnitTypeVisible: (unitType: UnitType) => boolean;
  // ✅ ENTERPRISE FIX: Added missing properties για SelectionContextType
  visibleStatuses?: RegionStatus[]; // Currently visible status filters
  visibleUnitTypes?: UnitType[]; // Currently visible unit type filters
}

// View actions interface
export interface ViewActions {
  setShowHandles: (show: boolean) => void;
  setShowLabels: (show: boolean) => void;
  setGhostPreview: (show: boolean) => void;
  toggleHandles: () => void;
  toggleLabels: () => void;
  toggleGhostPreview: () => void;
}

// Default selection state
export const DEFAULT_SELECTION_STATE: SelectionState = {
  selectedRegionIds: [],
  editingRegionId: null,
  draggedVertexIndex: null,
  showHandles: true,
  showLabels: true,
  ghostPreview: false,
};

// Default filter state (using valid PropertyStatus values)
const DEFAULT_VISIBLE_STATUSES: RegionStatus[] = ['for-sale', 'for-rent', 'reserved', 'sold', 'coming-soon', 'under-negotiation'];
const DEFAULT_VISIBLE_UNIT_TYPES: UnitType[] = ['studio', '1BR', '2BR', '3BR', 'maisonette', 'store', 'office', 'other'];

export const DEFAULT_FILTER_STATE: FilterState = {
  visibleStatuses: new Set(DEFAULT_VISIBLE_STATUSES),
  visibleUnitTypes: new Set(DEFAULT_VISIBLE_UNIT_TYPES),
};

// Selection preferences
export interface SelectionPreferences {
  tolerance: number;
  autoShowHandles: boolean;
  highlightOnHover: boolean;
  multiSelectEnabled: boolean;
  snapToVertices: boolean;
}

export const DEFAULT_SELECTION_PREFERENCES: SelectionPreferences = {
  tolerance: SELECTION_CONFIG.DEFAULT_TOLERANCE,
  autoShowHandles: true,
  highlightOnHover: true,
  multiSelectEnabled: true,
  snapToVertices: false,
};

// ============================================================================
// 🏢 ENTERPRISE (2026-01-25): Universal Selection Types
// Extends the selection system to support ALL entity types uniformly
// ============================================================================

/**
 * Universal Selection Actions Interface
 *
 * Provides a unified API for selecting ANY entity type:
 * - DXF entities, overlays, color layers, measurements, annotations
 *
 * This interface is the PRIMARY selection API going forward.
 * Legacy APIs (selectRegions, etc.) are mapped to these internally.
 */
export interface UniversalSelectionActions {
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIMARY UNIVERSAL API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Select a single entity by ID and type
   * Replaces current selection
   */
  selectEntity: (payload: SelectionPayload) => void;

  /**
   * Select multiple entities (replaces current selection)
   */
  selectEntities: (payloads: SelectionPayload[]) => void;

  /**
   * Add a single entity to current selection
   */
  addEntity: (payload: SelectionPayload) => void;

  /**
   * Add multiple entities to current selection
   */
  addEntities: (payloads: SelectionPayload[]) => void;

  /**
   * Remove an entity from selection by ID
   */
  deselectEntity: (id: string) => void;

  /**
   * Toggle entity selection state
   */
  toggleEntity: (payload: SelectionPayload) => void;

  /**
   * Clear all selections
   */
  clearAllSelections: () => void;

  /**
   * Clear selections of a specific entity type only
   */
  clearByType: (entityType: SelectableEntityType) => void;

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if an entity is selected by ID
   */
  isEntitySelected: (id: string) => boolean;

  /**
   * Get all selected entries
   */
  getSelectedEntries: () => SelectionEntry[];

  /**
   * Get selected entries filtered by entity type
   */
  getSelectedByType: (entityType: SelectableEntityType) => SelectionEntry[];

  /**
   * Get count of all selected entities
   */
  getUniversalSelectionCount: () => number;

  /**
   * Get count of selected entities of a specific type
   */
  getSelectionCountByType: (entityType: SelectableEntityType) => number;

  /**
   * Get all selected IDs (convenience method)
   */
  getSelectedIds: () => string[];

  /**
   * Get all selected IDs of a specific type (convenience method)
   */
  getSelectedIdsByType: (entityType: SelectableEntityType) => string[];
}