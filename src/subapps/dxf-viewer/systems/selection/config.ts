/**
 * SELECTION SYSTEM CONFIGURATION
 * Configuration options and constants for selection behavior
 */

import type { RegionStatus, UnitType } from '../../types/overlay';
import type { Point2D } from '../../rendering/types/Types';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';

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