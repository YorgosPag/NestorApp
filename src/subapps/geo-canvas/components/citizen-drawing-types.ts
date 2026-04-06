/**
 * CITIZEN DRAWING INTERFACE - Types & Mock Components
 *
 * Type definitions and mock implementations for CitizenDrawingInterface
 *
 * @module geo-canvas/components/citizen-drawing-types
 * Extracted from CitizenDrawingInterface.tsx (ADR-065 Phase 3, #16)
 */

import * as React from 'react';

// ============================================================================
// MAP TYPES
// ============================================================================

export interface MapboxMapRef {
  getCenter?: () => { lat: number; lng: number };
  setCenter?: (center: { lat: number; lng: number }) => void;
  getZoom?: () => number;
  setZoom?: (zoom: number) => void;
}

export type MapboxMap = MapboxMapRef;

// ============================================================================
// POLYGON TYPES
// ============================================================================

export interface PolygonPoint {
  x?: number;
  y?: number;
  lat?: number;
  lng?: number;
}

export interface PolygonConfig {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  pointMode?: boolean;
  radius?: number;
}

export interface UniversalPolygon {
  id: string;
  points: PolygonPoint[];
  config?: PolygonConfig;
  timestamp?: number;
}

export type RealEstatePolygon = {
  id: string;
  polygon: Array<[number, number]>;
  settings: Record<string, unknown>;
  createdAt: string;
  type?: string;
  alertSettings?: {
    enabled: boolean;
    priceRange: { min: number; max: number };
    propertyTypes: string[];
    includeExclude: 'include' | 'exclude';
  };
};

export interface RealEstateStats {
  totalPolygons: number;
  totalAlerts: number;
  activeAlerts: number;
  totalMatches?: number;
}

// ============================================================================
// BOUNDARY TYPES
// ============================================================================

export type BoundaryLayerStyle = Record<string, string | number | boolean>;

export interface BoundaryLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  style: BoundaryLayerStyle;
}

export interface BoundaryLayerControlPanelProps {
  layers: BoundaryLayer[];
  onLayerToggle: (layerId: string, visible: boolean) => void;
  onLayerOpacityChange: (layerId: string, opacity: number) => void;
  onLayerStyleChange: (layerId: string, style: Partial<BoundaryLayerStyle>) => void;
  onLayerRemove: (layerId: string) => void;
  onAddNewBoundary: () => void;
}

// ============================================================================
// MOCK EFFECTS (compilation stubs)
// ============================================================================

export const HOVER_BACKGROUND_EFFECTS = {
  LIGHT: 'hover:bg-opacity-10',
  SUCCESS: 'hover:bg-green-600',
  DESTRUCTIVE: 'hover:bg-red-600',
  WARNING_BUTTON: 'hover:bg-yellow-600',
  MUTED: 'hover:bg-gray-300'
};

export const INTERACTIVE_PATTERNS = {
  PRIMARY_HOVER: 'hover:bg-blue-700',
  SUBTLE_HOVER: 'hover:bg-gray-100'
};

export const HOVER_SHADOWS = {
  ENHANCED: 'hover:shadow-lg'
};

export const TRANSITION_PRESETS = {
  STANDARD_COLORS: 'transition-colors duration-200'
};

// ============================================================================
// MOCK COMPONENTS
// ============================================================================

interface AddressSearchPanelProps {
  onLocationSelected: (lat: number, lng: number, address?: Record<string, unknown>) => void;
  onAdminBoundarySelected?: (boundary: GeoJSON.Feature | GeoJSON.FeatureCollection, result: Record<string, unknown>) => void;
  onClose: () => void;
}

export const AddressSearchPanel = ({ onClose }: AddressSearchPanelProps) => (
  React.createElement('div', { className: 'p-4 bg-blue-50 rounded-md' },
    React.createElement('p', null, 'Address Search Panel - Mock Implementation'),
    React.createElement('button', { onClick: onClose, className: 'mt-2 px-3 py-1 bg-blue-500 text-white rounded' }, 'Close')
  )
);

export const AdminBoundaryDemo = () => (
  React.createElement('div', { className: 'p-4 bg-green-50 rounded-md' },
    React.createElement('p', null, 'Admin Boundary Demo - Mock Implementation')
  )
);

export const BoundaryLayerControlPanel = ({ layers }: BoundaryLayerControlPanelProps) => (
  React.createElement('div', { className: 'p-4 bg-purple-50 rounded-md' },
    React.createElement('p', null, 'Boundary Layer Control Panel - Mock Implementation'),
    React.createElement('p', { className: 'text-sm text-gray-600' }, `${layers?.length || 0} layers available`)
  )
);

// ============================================================================
// MOCK HOOKS
// ============================================================================

export const useCentralizedPolygonSystem = () => ({
  polygons: [] as UniversalPolygon[],
  stats: { totalPolygons: 0, activePolygons: 0 },
  startDrawing: (_mode: string, _config?: PolygonConfig) => {},
  finishDrawing: () => null as UniversalPolygon | null,
  cancelDrawing: () => {},
  clearAll: () => {},
  isDrawing: false,
  currentRole: 'citizen' as const,
  updatePolygonConfig: (_id: string, _config: PolygonConfig) => {}
});

export const useMockRealEstateService = () => ({
  addRealEstatePolygon: (_polygon: RealEstatePolygon) => {},
  getRealEstateAlerts: () => [] as RealEstatePolygon[],
  getStatistics: (): RealEstateStats => ({ totalPolygons: 0, totalAlerts: 0, activeAlerts: 0, totalMatches: 0 })
});
