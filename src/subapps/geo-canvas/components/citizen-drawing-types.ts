/**
 * CITIZEN DRAWING INTERFACE - Types & Mock Components
 *
 * Type definitions and mock implementations for CitizenDrawingInterface
 *
 * @module geo-canvas/components/citizen-drawing-types
 * Extracted from CitizenDrawingInterface.tsx (ADR-065 Phase 3, #16)
 */

import * as React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  LIGHT: 'hover:bg-accent/30',
  SUCCESS: 'hover:bg-[hsl(var(--bg-success))]/80',
  DESTRUCTIVE: 'hover:bg-[hsl(var(--bg-error))]/80',
  WARNING_BUTTON: 'hover:bg-[hsl(var(--bg-warning))]/80',
  MUTED: 'hover:bg-muted'
};

export const INTERACTIVE_PATTERNS = {
  PRIMARY_HOVER: 'hover:bg-blue-700',
  SUBTLE_HOVER: 'hover:bg-slate-700/60'
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

export const AddressSearchPanel = ({ onClose }: AddressSearchPanelProps) => {
  const { t } = useTranslation('geo-canvas');
  return React.createElement('div', { className: 'p-4 bg-slate-800 border border-slate-700/50 rounded-lg' },
    React.createElement('p', { className: 'text-slate-200 text-sm' }, t('addressSearch.title')),
    React.createElement('button', { onClick: onClose, className: 'mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm' }, t('alertManagement.close'))
  );
};

export const AdminBoundaryDemo = () => {
  const { t } = useTranslation('geo-canvas');
  return React.createElement('div', { className: 'p-4 bg-slate-800 border border-slate-700/50 rounded-lg' },
    React.createElement('p', { className: 'text-slate-200 text-sm' }, t('adminBoundary.demoTitle'))
  );
};

export const BoundaryLayerControlPanel = ({ layers }: BoundaryLayerControlPanelProps) => {
  const { t } = useTranslation('geo-canvas');
  return React.createElement('div', { className: 'p-4 bg-slate-800 border border-slate-700/50 rounded-lg' },
    React.createElement('p', { className: 'text-slate-200 text-sm' }, t('boundaryLayer.title')),
    React.createElement('p', { className: 'text-sm text-slate-400' }, t('boundaryLayer.layersAvailableCount', { count: layers?.length || 0 }))
  );
};

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
