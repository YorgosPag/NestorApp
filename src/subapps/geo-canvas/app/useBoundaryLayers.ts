/**
 * useBoundaryLayers — Custom hook for administrative boundary layer management.
 * Extracts all boundary state + handlers from GeoCanvasContent.
 *
 * @see GeoCanvasContent.tsx — main component
 */

import { useState, useCallback } from 'react';
import { GEO_COLORS } from '../config/color-config';
import { generateLayerId } from '@/services/enterprise-id.service';
import type { MapInstance } from '../hooks/map/useMapInteractions';

// ============================================================================
// Types
// ============================================================================

export interface BoundaryLayerStyle {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
}

export interface AdminBoundaryResult {
  name: string;
  adminLevel: number;
  [key: string]: unknown;
}

export interface BoundaryLayer {
  id: string;
  name: string;
  type: 'region' | 'municipality' | 'municipal_unit' | 'community';
  visible: boolean;
  opacity: number;
  style: BoundaryLayerStyle;
  boundary: {
    feature: GeoJSON.Feature | GeoJSON.FeatureCollection;
    result: AdminBoundaryResult;
  };
}

export interface AdministrativeBoundaryEntry {
  feature: GeoJSON.Feature | GeoJSON.FeatureCollection;
  visible: boolean;
  style?: {
    strokeColor?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    fillColor?: string;
    fillOpacity?: number;
  };
}

export interface SearchMarker {
  lat: number;
  lng: number;
  address?: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useBoundaryLayers(mapRef: React.RefObject<MapInstance | null>) {
  const [searchMarker, setSearchMarker] = useState<SearchMarker | null>(null);
  const [administrativeBoundaries, setAdministrativeBoundaries] = useState<AdministrativeBoundaryEntry[]>([]);
  const [boundaryLayers, setBoundaryLayers] = useState<BoundaryLayer[]>([]);
  const [selectedBoundaryResult, setSelectedBoundaryResult] = useState<AdminBoundaryResult | null>(null);

  // --- Location Selection ---

  const handleLocationSelected = useCallback((
    lat: number,
    lng: number,
    address?: string | { fullAddress?: string; street?: string; number?: string; area?: string; municipality?: string; display_name?: string }
  ) => {
    let displayAddress = 'Αναζητημένη θέση';
    if (typeof address === 'string') {
      displayAddress = address;
    } else if (address && typeof address === 'object') {
      if (address.fullAddress) {
        displayAddress = address.fullAddress;
      } else if (address.street) {
        const parts = [address.street, address.number, address.area, address.municipality].filter(Boolean);
        displayAddress = parts.join(' ') || 'Αναζητημένη θέση';
      } else {
        displayAddress = address.display_name || 'Αναζητημένη θέση';
      }
    }

    setSearchMarker({ lat, lng, address: displayAddress });
    setTimeout(() => setSearchMarker(null), 30000);

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 16, duration: 2000, essential: true });
    }
  }, [mapRef]);

  // --- Boundary Selection ---

  const handleAdminBoundarySelected = useCallback((
    boundary: GeoJSON.Feature | GeoJSON.FeatureCollection,
    result: Record<string, unknown>
  ) => {
    const boundaryResult = result as AdminBoundaryResult;
    setSelectedBoundaryResult(boundaryResult);

    let type: BoundaryLayer['type'];
    let defaultStyle: BoundaryLayerStyle;

    if (boundaryResult.adminLevel === 4) {
      type = 'region';
      defaultStyle = { strokeColor: GEO_COLORS.POLYGON.ADMINISTRATIVE, strokeWidth: 3, fillColor: GEO_COLORS.POLYGON.ADMINISTRATIVE, fillOpacity: 0.15 };
    } else if (boundaryResult.adminLevel === 8) {
      type = 'municipality';
      defaultStyle = { strokeColor: GEO_COLORS.POLYGON.DRAFT, strokeWidth: 2, fillColor: GEO_COLORS.POLYGON.DRAFT, fillOpacity: 0.1 };
    } else if (boundaryResult.adminLevel === 9) {
      type = 'municipal_unit';
      defaultStyle = { strokeColor: GEO_COLORS.POLYGON.COMPLETED, strokeWidth: 2, fillColor: GEO_COLORS.POLYGON.COMPLETED, fillOpacity: 0.1 };
    } else {
      type = 'community';
      defaultStyle = { strokeColor: GEO_COLORS.POLYGON.WARNING, strokeWidth: 2, fillColor: GEO_COLORS.POLYGON.WARNING, fillOpacity: 0.1 };
    }

    const layerId = generateLayerId();
    setBoundaryLayers(prev => [...prev, {
      id: layerId,
      name: typeof boundaryResult.name === 'string' ? boundaryResult.name : 'Unknown',
      type, visible: true, opacity: 1.0, style: defaultStyle,
      boundary: { feature: boundary, result: boundaryResult },
    }]);

    setAdministrativeBoundaries(prev => [...prev, {
      feature: boundary, visible: true,
      style: { strokeColor: defaultStyle.strokeColor, strokeWidth: defaultStyle.strokeWidth, strokeOpacity: 0.8, fillColor: defaultStyle.fillColor, fillOpacity: defaultStyle.fillOpacity },
    }]);

    // Center map on boundary
    if (mapRef.current && boundary) {
      try {
        let center: [number, number] | null = null;
        let zoom = 10;

        const extractCenter = (coords: [number, number][]): [number, number] | null => {
          if (coords.length === 0) return null;
          const avgLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
          const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
          return [avgLng, avgLat];
        };

        if (boundary.type === 'Feature' && boundary.geometry?.type === 'Polygon' && boundary.geometry.coordinates?.[0]) {
          center = extractCenter(boundary.geometry.coordinates[0] as [number, number][]);
          zoom = boundaryResult.adminLevel === 4 ? 8 : 12;
        } else if (boundary.type === 'FeatureCollection' && boundary.features.length > 0) {
          const first = boundary.features[0];
          if (first.geometry?.type === 'Polygon' && first.geometry.coordinates?.[0]) {
            center = extractCenter(first.geometry.coordinates[0] as [number, number][]);
          }
        }

        if (center) {
          mapRef.current.flyTo({ center, zoom, duration: 2000, essential: true });
        }
      } catch (error) {
        console.warn('Failed to center map on boundary:', error);
      }
    }
  }, [mapRef]);

  // --- Layer Control Handlers ---

  const syncAdministrativeBoundaries = useCallback((layers: BoundaryLayer[]) => {
    const visible = layers.filter(l => l.visible);
    setAdministrativeBoundaries(visible.map(l => ({
      feature: l.boundary.feature, visible: l.visible,
      style: { strokeColor: l.style.strokeColor, strokeWidth: l.style.strokeWidth, strokeOpacity: l.opacity, fillColor: l.style.fillColor, fillOpacity: l.style.fillOpacity * l.opacity },
    })));
  }, []);

  const handleLayerToggle = useCallback((layerId: string, visible: boolean) => {
    setBoundaryLayers(prev => {
      const updated = prev.map(l => l.id === layerId ? { ...l, visible } : l);
      syncAdministrativeBoundaries(updated);
      return updated;
    });
  }, [syncAdministrativeBoundaries]);

  const handleLayerOpacityChange = useCallback((layerId: string, opacity: number) => {
    setBoundaryLayers(prev => {
      const updated = prev.map(l => l.id === layerId ? { ...l, opacity } : l);
      syncAdministrativeBoundaries(updated);
      return updated;
    });
  }, [syncAdministrativeBoundaries]);

  const handleLayerStyleChange = useCallback((layerId: string, styleChanges: Partial<BoundaryLayerStyle>) => {
    setBoundaryLayers(prev => {
      const updated = prev.map(l => l.id === layerId ? { ...l, style: { ...l.style, ...styleChanges } } : l);
      syncAdministrativeBoundaries(updated);
      return updated;
    });
  }, [syncAdministrativeBoundaries]);

  const handleLayerRemove = useCallback((layerId: string) => {
    setBoundaryLayers(prev => {
      const updated = prev.filter(l => l.id !== layerId);
      syncAdministrativeBoundaries(updated);
      return updated;
    });
  }, [syncAdministrativeBoundaries]);

  const handleAddNewBoundary = useCallback(() => {
    console.debug('Add new boundary requested');
  }, []);

  return {
    searchMarker,
    administrativeBoundaries,
    boundaryLayers,
    selectedBoundaryResult,
    handleLocationSelected,
    handleAdminBoundarySelected,
    handleLayerToggle,
    handleLayerOpacityChange,
    handleLayerStyleChange,
    handleLayerRemove,
    handleAddNewBoundary,
  };
}
