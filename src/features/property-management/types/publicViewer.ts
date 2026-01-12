// ============================================================================
// 🏢 ENTERPRISE: Public Viewer Types
// Using centralized types from @/types/* (ADR-compliant)
// ============================================================================

import type { Property, FilterState } from '@/types/property-viewer';
import type { Connection, PropertyGroup } from '@/types/connections';
import type { Floor } from '@/types/building/contracts';

/**
 * 🏢 ENTERPRISE: Polygon event arguments for create/update operations
 */
export interface PolygonEventArgs {
  id?: string;
  vertices?: Array<{ x: number; y: number }>;
  properties?: Partial<Property>;
}

/**
 * 🏢 ENTERPRISE: Suggestion display data structure
 */
export interface SuggestionDisplay {
  type: 'info' | 'warning' | 'action';
  message: string;
  propertyId?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * 🏢 ENTERPRISE: Props passed to the viewer components
 */
export type ViewerProps = {
  properties: Property[];
  setProperties: (v: Property[]) => void;
  selectedPropertyIds: string[];
  hoveredPropertyId: string | null;
  selectedFloorId: string | null;
  onHoverProperty: (id?: string | null) => void;
  onSelectFloor: (floorId: string | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setSelectedProperties: (ids: string[]) => void;
  floors: Floor[];
  currentFloor: PublicFloorView | null;
  activeTool?: string | null;
  setActiveTool?: (t: string | null) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;
  gridSize: number;
  setGridSize: (v: number) => void;
  showMeasurements: boolean;
  setShowMeasurements: (v: boolean) => void;
  scale: number;
  setScale: (v: number) => void;
  handlePolygonSelect: (id: string | null) => void;
  handlePolygonCreated: (args: PolygonEventArgs) => void;
  handlePolygonUpdated: (args: PolygonEventArgs) => void;
  handleDuplicate: (propertyIds: string[]) => void;
  handleDelete: (propertyIds: string[]) => void;
  suggestionToDisplay: SuggestionDisplay | null;
  connections: Connection[];
  setConnections: (v: Connection[]) => void;
  groups: PropertyGroup[];
  setGroups: (v: PropertyGroup[]) => void;
  isConnecting: boolean;
  setIsConnecting: (v: boolean) => void;
  firstConnectionPoint: Property | null;
  setFirstConnectionPoint: (v: Property | null) => void;
  isReadOnly: true;
};

/**
 * 🏢 ENTERPRISE: Dashboard statistics for public viewer
 * Matches the exact return type from usePublicPropertyViewer hook
 */
export interface PublicDashboardStats {
  totalProperties: number;
  availableProperties: number;
  soldProperties: number;
  totalValue: number;
  totalArea: number;
  averagePrice: number;
  propertiesByStatus: Record<string, number>;
  propertiesByType: Record<string, number>;
  propertiesByFloor: Record<string, number>;
  totalStorageUnits: number;
  availableStorageUnits: number;
  soldStorageUnits: number;
  uniqueBuildings: number;
  reserved: number;
}

/**
 * 🏢 ENTERPRISE: Floor with filtered properties for public viewer
 * Note: Uses Property from property-viewer (not building/contracts)
 */
export interface PublicFloorView {
  id: string;
  buildingId: string;
  name: string;
  level: number;
  area: number;
  properties: Property[];
}

/**
 * 🏢 ENTERPRISE: Public viewer hook return type
 * Exact shape returned by usePublicPropertyViewer hook
 */
export type PublicViewerHookShape = {
  // data
  properties: Property[];
  filteredProperties: Property[];
  dashboardStats: PublicDashboardStats;
  floors: Floor[];
  isLoading: boolean;

  // selection (read-only surface kept)
  selectedPropertyIds: string[];
  hoveredPropertyId: string | null;
  selectedFloorId: string | null;
  selectedUnit: Property | null;
  currentFloor: PublicFloorView | null;

  // display modes
  viewMode: 'list' | 'grid';
  setViewMode: (v: 'list' | 'grid') => void;
  showDashboard: boolean;
  setShowDashboard: (v: boolean) => void;

  // filters
  filters: FilterState;
  handleFiltersChange: (f: Partial<FilterState>) => void;

  // display settings
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  showMeasurements: boolean;
  scale: number;
  setScale: (v: number) => void;

  // handlers (read-only)
  onHoverProperty: (propertyId: string | null) => void;
  onSelectFloor: (floorId: string | null) => void;
  handleSelectUnit: (unit: Property) => void;
  handlePolygonSelect: (propertyId: string, isShiftClick: boolean) => void;
  setSelectedProperties: (ids: string[]) => void;

  // disabled handlers (read-only mode - no-op functions)
  handlePolygonCreated: () => void;
  handlePolygonUpdated: () => void;
  handleDuplicate: () => void;
  handleDelete: () => void;
  setProperties: () => void;
  undo: () => void;
  redo: () => void;
  setActiveTool: () => void;
  setShowGrid: () => void;
  setSnapToGrid: () => void;
  setGridSize: () => void;
  setShowMeasurements: () => void;
  setConnections: () => void;
  setGroups: () => void;
  setIsConnecting: () => void;
  setFirstConnectionPoint: () => void;
  onShowHistory: () => void;

  // disabled state
  canUndo: false;
  canRedo: false;
  activeTool: null;
  showHistoryPanel: false;
  setShowHistoryPanel: () => void;
  suggestionToDisplay: null;
  setSuggestionToDisplay: () => void;
  connections: Connection[];
  groups: PropertyGroup[];
  isConnecting: false;
  firstConnectionPoint: null;

  // read-only marker
  isReadOnly: true;
};
