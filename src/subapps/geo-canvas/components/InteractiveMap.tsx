'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import MapComponent, { MapRef, Marker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, CORE_HOVER_TRANSFORMS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { portalComponentsExtended as portalComponents, getDynamicBackgroundClass, layoutUtilities, mapControlPointTokens, mapInteractionTokens } from '@/styles/design-tokens';
import { getDynamicTextClass } from '@/components/ui/utils/dynamic-styles';
import { interactiveMapStyles, getMapCursorStyle, getAccuracyLevelColor } from './InteractiveMap.styles';

// ✅ ENTERPRISE: Explicit reference για native Map to avoid naming conflicts
const NativeMap = globalThis.Map;

// ❌ ΑΦΑΙΡΕΘΗΚΕ: import { useGeoTransform } from '../hooks/useGeoTransform';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import type { GeoCoordinate, DxfCoordinate, GeoControlPoint } from '../types';

// ✅ ENTERPRISE: Centralized Polygon System Integration
import { useCentralizedPolygonSystem } from '../systems/polygon-system';
import type { PolygonType, UniversalPolygon } from '@geo-alert/core';

// ============================================================================
// MAPLIBRE GL JS - ENTERPRISE IMPLEMENTATION
// ============================================================================

// ============================================================================
// INTERACTIVE MAP COMPONENT
// ============================================================================

export interface InteractiveMapProps {
  onCoordinateClick?: (coordinate: GeoCoordinate) => void;
  showControlPoints?: boolean;
  showTransformationPreview?: boolean;
  isPickingCoordinates?: boolean;
  transformState: any; // ✅ REQUIRED - Always από parent
  className?: string;
  onPolygonComplete?: () => void; // ✅ NEW: Callback όταν κλείνει το πολύγωνο
  onMapReady?: (map: any) => void; // ✅ NEW: Callback when map is ready

  // ✅ NEW: Address Search Marker
  searchMarker?: {
    lat: number;
    lng: number;
    address?: string;
  } | null;

  // ✅ NEW: Universal Polygon System Props
  enablePolygonDrawing?: boolean;
  defaultPolygonMode?: PolygonType;
  onPolygonCreated?: (polygon: UniversalPolygon) => void;
  onPolygonModified?: (polygon: UniversalPolygon) => void;
  onPolygonDeleted?: (polygonId: string) => void;

  // ✅ NEW: Administrative Boundaries Props
  administrativeBoundaries?: {
    feature: GeoJSON.Feature | GeoJSON.FeatureCollection;
    visible: boolean;
    style?: {
      strokeColor?: string;
      strokeWidth?: number;
      strokeOpacity?: number;
      fillColor?: string;
      fillOpacity?: number;
    };
  }[];
}

// ========================================================================
// ELEVATION SERVICE (Open Elevation API)
// ========================================================================

/**
 * Fetch elevation data για συγκεκριμένες συντεταγμένες
 * Uses Open Elevation API (δωρεάν service)
 */
const fetchElevationData = async (lng: number, lat: number): Promise<number | null> => {
  try {
    const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
    console.log('🌐 Fetching elevation from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('📡 Elevation response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📊 Elevation API response:', data);

    if (data.results && data.results.length > 0) {
      const elevation = Math.round(data.results[0].elevation);
      console.log('🏔️ Elevation found:', elevation, 'meters');
      return elevation;
    }

    console.warn('⚠️ No elevation results in API response');
    return null;
  } catch (error) {
    console.warn('❌ Elevation fetch failed:', error);
    return null;
  }
};

/**
 * INTERACTIVE MAP COMPONENT
 * Enterprise MapLibre GL JS integration για visual georeferencing
 * Phase 3: Interactive coordinate picking και real-time preview
 */
export function InteractiveMap({
  onCoordinateClick,
  showControlPoints = true,
  showTransformationPreview = true,
  isPickingCoordinates = false,
  transformState, // ✅ ALWAYS από parent - NO FALLBACK!
  className = '',
  onPolygonComplete, // ✅ NEW: Polygon completion callback
  onMapReady, // ✅ NEW: Map ready callback

  // ✅ NEW: Address Search Marker
  searchMarker = null,

  // ✅ NEW: Universal Polygon System Props
  enablePolygonDrawing = false,
  defaultPolygonMode = 'simple',
  onPolygonCreated,
  onPolygonModified,
  onPolygonDeleted,

  // ✅ NEW: Administrative Boundaries Props
  administrativeBoundaries = []
}: InteractiveMapProps) {
  const { t, isLoading } = useTranslationLazy('geo-canvas');
  const mapRef = useRef<any>(null);

  // ✅ ENTERPRISE: Centralized Polygon System Integration
  const {
    polygons,
    stats,
    startDrawing,
    finishDrawing,
    cancelDrawing,
    clearAll,
    addPoint,
    setMapRef,
    exportAsGeoJSON,
    getCurrentDrawing,
    isDrawing: systemIsDrawing,
    currentRole,
    isPolygonComplete: systemIsPolygonComplete
  } = useCentralizedPolygonSystem();

  // ✅ ENTERPRISE: Single source of truth - NO duplicate hooks!

  // Force re-render when drawing state changes for live preview
  const [forceUpdate, setForceUpdate] = useState(0);
  useEffect(() => {
    if (systemIsDrawing) {
      const interval = setInterval(() => {
        setForceUpdate(prev => prev + 1);
      }, 100); // Update every 100ms during drawing
      return () => clearInterval(interval);
    }
  }, [systemIsDrawing]);

  // ✅ ENTERPRISE: Freehand drawing state management
  const [isDraggingFreehand, setIsDraggingFreehand] = useState(false);
  const [lastDragPoint, setLastDragPoint] = useState<{ lng: number, lat: number } | null>(null);

  // Helper function για να ελέγχω αν είμαστε σε freehand mode
  const isInFreehandMode = useCallback(() => {
    const currentDrawing = getCurrentDrawing();
    return systemIsDrawing && currentDrawing && currentDrawing.type === 'freehand';
  }, [systemIsDrawing, getCurrentDrawing]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [clickMode, setClickMode] = useState<'off' | 'add_dxf' | 'add_geo'>('off');
  const [hoveredCoordinate, setHoveredCoordinate] = useState<GeoCoordinate | null>(null);

  // ✅ NEW: Elevation data state και caching
  const [elevationCache, setElevationCache] = useState(() => new NativeMap<string, number>());
  const [elevationLoading, setElevationLoading] = useState<boolean>(false);

  // ✅ ENTERPRISE: Throttled elevation fetcher με caching
  const fetchElevationWithCache = useCallback(async (lng: number, lat: number) => {
    // Create cache key με 4 decimal precision (≈ 10m accuracy)
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

    // Check cache first
    if (elevationCache.has(cacheKey)) {
      const cachedElevation = elevationCache.get(cacheKey)!;
      console.log('🎯 Cache hit! Elevation:', cachedElevation, 'for key:', cacheKey);

      setHoveredCoordinate(prev => {
        if (!prev) return prev;

        const currentCacheKey = `${prev.lat.toFixed(4)},${prev.lng.toFixed(4)}`;
        console.log('📍 Updating from cache:', {
          currentKey: currentCacheKey,
          targetKey: cacheKey,
          matches: currentCacheKey === cacheKey,
          cachedElevation
        });

        return currentCacheKey === cacheKey
          ? { ...prev, alt: cachedElevation }
          : prev;
      });
      return;
    }

    // Prevent multiple simultaneous requests
    if (elevationLoading) return;

    setElevationLoading(true);

    try {
      const elevation = await fetchElevationData(lng, lat);

      if (elevation !== null) {
        console.log('💾 Caching elevation:', elevation, 'for key:', cacheKey);

        // Update cache
        setElevationCache(prev => new NativeMap(prev.set(cacheKey, elevation)));

        // Update current coordinate με elevation (using same precision as cache key)
        setHoveredCoordinate(prev => {
          if (!prev) return prev;

          const currentCacheKey = `${prev.lat.toFixed(4)},${prev.lng.toFixed(4)}`;
          const targetCacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

          console.log('🔄 Updating coordinate:', {
            currentKey: currentCacheKey,
            targetKey: targetCacheKey,
            matches: currentCacheKey === targetCacheKey,
            elevation
          });

          return currentCacheKey === targetCacheKey
            ? { ...prev, alt: elevation }
            : prev;
        });
      }
    } catch (error) {
      console.warn('Elevation fetch error:', error);
    } finally {
      setElevationLoading(false);
    }
  }, [elevationCache, elevationLoading]);

  // ✅ ENTERPRISE: Throttled elevation fetching για hover coordinates
  useEffect(() => {
    console.log('🔍 Elevation useEffect triggered:', {
      hoveredCoordinate,
      hasAlt: hoveredCoordinate?.alt !== undefined
    });

    if (!hoveredCoordinate || hoveredCoordinate.alt !== undefined) return;

    console.log('⏱️ Setting elevation timeout for:', hoveredCoordinate);

    // Throttle elevation requests (500ms delay)
    const timeoutId = setTimeout(() => {
      console.log('🚀 Calling fetchElevationWithCache for:', hoveredCoordinate);
      fetchElevationWithCache(hoveredCoordinate.lng, hoveredCoordinate.lat);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [hoveredCoordinate, fetchElevationWithCache]);

  // Map configuration
  const [viewState, setViewState] = useState({
    longitude: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE,
    latitude: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
    zoom: 8,
    bearing: 0,
    pitch: 0
  });

  // Map style configuration
  const [currentMapStyle, setCurrentMapStyle] = useState<'osm' | 'satellite' | 'terrain' | 'dark' | 'greece' | 'watercolor' | 'toner'>('osm');

  // Custom Greece-focused style
  const greeceCustomStyle = {
    version: 8,
    name: "Greece Focused",
    sources: {
      'osm': {
        type: 'raster' as const,
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'osm-raster',
        type: 'raster' as const,
        source: 'osm',
        paint: {
          'raster-saturation': 0.1, // Ελαφρά desaturation για καλύτερη ανάγνωση
          'raster-contrast': 0.2     // Ελαφρή αύξηση contrast
        }
      }
    ],
    // Greece-focused initial view
    center: [GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE, GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE],
    zoom: 6.5,
    bearing: 0,
    pitch: 0
  };

  // Enterprise MapLibre Style URLs
  const mapStyleUrls = {
    osm: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    satellite: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    terrain: {
      version: 8,
      name: "Terrain Style",
      sources: {
        'terrain-tiles': {
          type: 'raster' as const,
          tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 17,  // OpenTopoMap max zoom level
          attribution: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'terrain-raster',
          type: 'raster' as const,
          source: 'terrain-tiles'
        }
      ]
    },
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    greece: greeceCustomStyle,
    watercolor: {
      version: 8,
      name: "Watercolor Style",
      sources: {
        'watercolor-tiles': {
          type: 'raster' as const,
          tiles: ['https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg'],
          tileSize: 256,
          maxzoom: 16,  // Stamen Watercolor max zoom level
          attribution: '© Stadia Maps, Stamen Design, OpenMapTiles © OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'watercolor-raster',
          type: 'raster' as const,
          source: 'watercolor-tiles'
        }
      ]
    },
    toner: {
      version: 8,
      name: "Toner Style",
      sources: {
        'toner-tiles': {
          type: 'raster' as const,
          tiles: ['https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 18,  // Stamen Toner max zoom level
          attribution: '© Stadia Maps, Stamen Design, OpenMapTiles © OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'toner-raster',
          type: 'raster' as const,
          source: 'toner-tiles'
        }
      ]
    }
  };

  // Accuracy visualization settings
  const [showAccuracyCircles, setShowAccuracyCircles] = useState(true);
  const [accuracyVisualizationMode, setAccuracyVisualizationMode] = useState<'circles' | 'heatmap' | 'zones'>('circles');

  // ✅ ENTERPRISE: Combine local and centralized polygon state (LEGACY COMPATIBILITY)
  const [localIsPolygonComplete, setLocalIsPolygonComplete] = useState(false);
  const isPolygonComplete = localIsPolygonComplete || systemIsPolygonComplete;
  const [completedPolygon, setCompletedPolygon] = useState<GeoControlPoint[] | null>(null);

  // ========================================================================
  // MAP STYLE CONFIGURATION
  // ========================================================================

  const mapStyleNames = {
    osm: t('map.controls.openStreetMap'),
    satellite: t('map.controls.satellite'),
    terrain: t('map.controls.terrain'),
    dark: t('map.controls.darkMode'),
    greece: t('map.controls.greece'),
    watercolor: t('map.controls.watercolor'),
    toner: t('map.controls.toner')
  };

  // ========================================================================
  // MAP EVENT HANDLERS
  // ========================================================================

  const handleMapClick = useCallback((event: any) => {
    const { lng, lat } = event.lngLat || { lng: event.longitude, lat: event.latitude };
    const coordinate: GeoCoordinate = { lng, lat };

    // ✅ NEW: Universal Polygon System - Handle polygon drawing
    if (enablePolygonDrawing && systemIsDrawing) {
      // Skip click handling for freehand mode (handled by mouse drag)
      if (isInFreehandMode()) return;

      // Add point to polygon system using centralized method
      addPoint(lng, lat);

      // ✅ NEW: Check if this is point mode - automatically finish after first click
      const currentDrawing = getCurrentDrawing();
      if (currentDrawing?.config?.pointMode === true) {
        // For point mode, finish drawing immediately after first click
        setTimeout(() => {
          finishDrawing();
        }, 100); // Small delay to ensure point is added first
      }

      return;
    }

    // 🔒 ENTERPRISE: Handle coordinate picking for control points
    if (!isPickingCoordinates || !onCoordinateClick || isPolygonComplete) {
      if (isPolygonComplete) {
      }
      return;
    }

    onCoordinateClick(coordinate);
  }, [
    isPickingCoordinates,
    onCoordinateClick,
    isPolygonComplete,
    enablePolygonDrawing,
    systemIsDrawing,
    addPoint,
    getCurrentDrawing,
    finishDrawing,
    isInFreehandMode
  ]);

  const handleMapMouseMove = useCallback((event: any) => {
    const { lng, lat } = event.lngLat || { lng: event.longitude, lat: event.latitude };
    setHoveredCoordinate({ lng, lat });

    // ✅ ENTERPRISE: Freehand drawing during mouse move (when dragging)
    if (isDraggingFreehand && isInFreehandMode() && enablePolygonDrawing) {
      // Throttling: Προσθέτουμε point μόνο αν έχουμε μετακινηθεί αρκετά
      if (lastDragPoint) {
        const distance = Math.sqrt(
          Math.pow(lng - lastDragPoint.lng, 2) + Math.pow(lat - lastDragPoint.lat, 2)
        );

        // Minimum distance για smoother lines (0.0001 degrees ≈ 10 meters)
        if (distance > 0.0001) {
          addPoint(lng, lat);
          setLastDragPoint({ lng, lat });
        }
      }
    }

    // ✅ ENTERPRISE: Update live preview for point mode
    if (enablePolygonDrawing && systemIsDrawing) {
      const currentDrawing = getCurrentDrawing();
      if (currentDrawing?.config?.pointMode === true && currentDrawing.points.length === 0) {
        // Force re-render για live preview
        setForceUpdate(prev => prev + 1);
      }
    }
  }, [enablePolygonDrawing, systemIsDrawing, getCurrentDrawing, isDraggingFreehand, isInFreehandMode, addPoint, lastDragPoint]);

  // ✅ ENTERPRISE: Freehand drawing mouse handlers
  const handleMapMouseDown = useCallback((event: any) => {
    // Μόνο για freehand mode
    if (!isInFreehandMode() || !enablePolygonDrawing) return;

    const { lng, lat } = event.lngLat;
    setIsDraggingFreehand(true);
    setLastDragPoint({ lng, lat });

    // Ξεκινάει το freehand drawing με το πρώτο point
    addPoint(lng, lat);
  }, [isInFreehandMode, enablePolygonDrawing, addPoint]);


  const handleMapMouseUp = useCallback(() => {
    if (!isDraggingFreehand || !isInFreehandMode()) return;

    setIsDraggingFreehand(false);
    setLastDragPoint(null);

    // ✅ FIX: Validation - Τελειώνει το freehand drawing μόνο αν έχουμε αρκετά points
    const currentDrawing = getCurrentDrawing();
    if (currentDrawing && currentDrawing.points && currentDrawing.points.length >= 2) {
      finishDrawing();
    } else {
      // Cancel drawing αν δεν έχουμε αρκετά points
      cancelDrawing();
      console.log('🚫 Freehand drawing cancelled: Not enough points');
    }
  }, [isDraggingFreehand, isInFreehandMode, finishDrawing, getCurrentDrawing, cancelDrawing]);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);

    // Initialize polygon system with map instance
    if (enablePolygonDrawing && mapRef.current) {
      const map = mapRef.current.getMap?.();
      if (map) {
        // Note: We don't have a canvas here, so we initialize with map only
        // The canvas would be used for overlay drawing if needed
      }
    }

    // Notify parent that map is ready
    if (onMapReady && mapRef.current) {
      const map = mapRef.current.getMap?.();
      if (map) {
        // ✅ ENTERPRISE FIX: Pass mapRef to centralized polygon system
        if (enablePolygonDrawing) {
          setMapRef(mapRef);

          map._polygonSystem = {
            polygons,
            stats,
            startDrawing,
            finishDrawing,
            cancelDrawing,
            isDrawing: systemIsDrawing
          };
        }
        onMapReady(map);
      }
    }
  }, [onMapReady, enablePolygonDrawing, setMapRef]);

  // ✅ ENTERPRISE FIX: Handle MapLibre errors
  /**
   * ✅ ENTERPRISE: Enhanced map error handling with fallback cascade
   */
  const handleMapError = useCallback((error: any) => {
    console.error('🗺️ MapLibre GL JS Error:', error);

    // Log structured error for debugging
    const errorInfo = {
      type: 'MapLibre Error',
      error: error?.error || error,
      message: error?.message || 'Unknown MapLibre error',
      timestamp: Date.now(),
      currentStyle: currentMapStyle,
      failureReason: error?.message?.includes('Failed to fetch') ? 'Network/CORS' : 'Unknown'
    };

    console.error('🔍 MapLibre Error Details:', errorInfo);

    // 🔧 FIX: Don't fallback for tile loading errors (404s at high zoom)
    // These are normal when zoom level exceeds maxzoom
    const isTileError = error?.message?.includes('tile') || error?.error?.message?.includes('404') || error?.error?.status === 404;
    const isHighZoomError = error?.message?.includes('Failed to fetch') && error?.error?.url?.includes('/tile/');

    if (isTileError || isHighZoomError) {
      // Just log the error but don't change map style
      return;
    }

    // Don't crash the app - graceful degradation
    setMapLoaded(false);

    // ✅ ENHANCED: Fallback cascade only for serious style failures
    const fallbackOrder = {
      // If Stamen styles fail → fallback to CartoDB
      'terrain': 'osm',     // Stamen Terrain → CartoDB Positron
      'watercolor': 'osm',  // Stamen Watercolor → CartoDB Positron
      'toner': 'dark',      // Stamen Toner → CartoDB Dark Matter
      'greece': 'osm',      // Custom Greece → CartoDB Positron

      // If CartoDB styles fail → fallback to basic OSM
      'satellite': 'osm',   // CartoDB Voyager → Basic OSM
      'dark': 'osm',        // CartoDB Dark → Basic OSM
      'osm': null           // Basic OSM is final fallback
    };

    const fallbackStyle = fallbackOrder[currentMapStyle as keyof typeof fallbackOrder];

    if (fallbackStyle) {
      setTimeout(() => {
        setCurrentMapStyle(fallbackStyle as any);
        setMapLoaded(true); // Try to load immediately
      }, 1500);
    } else {
      // Final fallback failed - show user notification
      console.error('❌ All map styles failed. Using emergency fallback.');
      setTimeout(() => {
        // Emergency: Try to load with minimal OSM style
        setCurrentMapStyle('osm');
        setMapLoaded(true);
      }, 3000);
    }
  }, [currentMapStyle]);

  const handleMapStyleChange = useCallback((newStyle: 'osm' | 'satellite' | 'terrain' | 'dark' | 'greece' | 'watercolor' | 'toner') => {

    setCurrentMapStyle(newStyle);
    setMapLoaded(false); // Show loading while style changes

    // ✅ ENHANCED: Different timeout for different style types
    const loadingTimeout = {
      // Stamen styles might take longer to load
      'terrain': 2000,
      'watercolor': 2500,
      'toner': 1500,
      // Custom styles
      'greece': 1200,
      // CartoDB styles are usually faster
      'osm': 800,
      'satellite': 1000,
      'dark': 800
    };

    const timeout = loadingTimeout[newStyle] || 1000;

    // Set loading state with appropriate timeout
    setTimeout(() => {
      setMapLoaded(true);
    }, timeout);
  }, [currentMapStyle]);

  // ========================================================================
  // POLYGON CLOSURE HANDLER
  // ========================================================================

  const handleLegacyPolygonClosure = useCallback(() => {
    const currentPoints = transformState.controlPoints;

    if (currentPoints.length < 3) {
      console.warn('🚨 Cannot close polygon - need at least 3 points');
      return;
    }


    // 🔥 ENTERPRISE IMPLEMENTATION: Polygon closure με map-centered notification
    const notification = document.createElement('div');
    notification.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white p-6 rounded-lg shadow-2xl z-[10000] animate-pulse border-2 border-green-300';
    notification.innerHTML = `
      <div class="flex items-center space-x-3">
        <span class="text-2xl">🎯</span>
        <div>
          <div class="font-bold text-lg">Πολύγωνο Κλείστηκε!</div>
          <div class="text-sm opacity-90">${currentPoints.length} σημεία συνδέθηκαν επιτυχώς</div>
        </div>
      </div>
    `;

    // Add to map container instead of document body
    const mapContainer = document.querySelector('[data-testid="map-container"]') || document.querySelector('.maplibregl-map') || document.body;
    mapContainer.appendChild(notification);

    // Auto-remove notification after 3 seconds
    setTimeout(() => {
      if (mapContainer.contains(notification)) {
        notification.remove();
      }
    }, 3000);

    // ✅ ENTERPRISE: Complete polygon closure logic
    setIsPolygonComplete(true);
    setCompletedPolygon([...currentPoints]); // Save current polygon

    // ✅ ENTERPRISE: Notify parent about polygon completion
    if (onPolygonComplete) {
      onPolygonComplete();
    }

    // Note: Coordinate picking will be blocked by handleMapClick
  }, [transformState.controlPoints, onPolygonComplete]);

  // ========================================================================
  // UNIVERSAL POLYGON SYSTEM EFFECTS
  // ========================================================================

  // Handle polygon creation callback
  useEffect(() => {
    if (onPolygonCreated && polygons.length > 0) {
      // Get the latest polygon
      const latestPolygon = polygons[polygons.length - 1];

      // Check if this is a new polygon by checking if we've seen it before
      const polygonId = latestPolygon.id;
      // ✅ ENTERPRISE: Get polygon from centralized system
      const existingPolygon = polygons.find(p => p.id === polygonId);

      if (existingPolygon) {
        onPolygonCreated(latestPolygon);

        // Add polygon to map if it has geo coordinates
        if (latestPolygon.type === 'georeferencing' || latestPolygon.points.some(p => p.x && p.y)) {
          // ✅ ENTERPRISE: Polygon rendering handled by centralized system
        }
      }
    }
  }, [polygons.length, onPolygonCreated]);

  // Handle polygon system keyboard shortcuts
  useEffect(() => {
    if (!enablePolygonDrawing) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if polygon drawing is active
      if (!systemIsDrawing) return;

      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          const finishedPolygon = finishDrawing();
          if (finishedPolygon && onPolygonCreated) {
            onPolygonCreated(finishedPolygon);
          }
          break;

        case 'Escape':
          event.preventDefault();
          cancelDrawing();
          break;

        case 'Backspace':
          event.preventDefault();
          // This would be handled by the polygon system internally
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enablePolygonDrawing, systemIsDrawing, onPolygonCreated]);

  // ========================================================================
  // ACCURACY VISUALIZATION HELPERS
  // ========================================================================

  const getAccuracyLevel = (accuracy: number) => {
    if (accuracy <= 0.5) return { level: 'excellent', color: '#10B981', label: t('accuracy.levels.excellent') };
    if (accuracy <= 1.0) return { level: 'good', color: '#3B82F6', label: t('accuracy.levels.good') };
    if (accuracy <= 2.0) return { level: 'fair', color: '#F59E0B', label: t('accuracy.levels.fair') };
    if (accuracy <= 5.0) return { level: 'poor', color: '#EF4444', label: t('accuracy.levels.poor') };
    return { level: 'very_poor', color: '#9333EA', label: t('accuracy.levels.veryPoor') };
  };

  const calculateAccuracyCircleRadius = (accuracy: number, zoom: number): number => {
    // Convert accuracy (in meters) to screen pixels based on zoom level
    // At zoom level 15, 1 meter ≈ 1.2 pixels
    const baseScale = Math.pow(2, zoom - 15);
    const radiusInPixels = Math.max(accuracy * 1.2 * baseScale, 5); // Minimum 5px
    return Math.min(radiusInPixels, 100); // Maximum 100px
  };

  // ========================================================================
  // COORDINATE PICKING FUNCTIONS
  // ========================================================================

  const startCoordinatePicking = useCallback((mode: 'add_dxf' | 'add_geo') => {
    setClickMode(mode);
  }, []);

  const stopCoordinatePicking = useCallback(() => {
    setClickMode('off');
  }, []);

  // ========================================================================
  // RENDER CONTROL POINTS
  // ========================================================================

  const renderControlPoints = () => {
    if (!showControlPoints || !mapLoaded) return null;

    const points = transformState.controlPoints;
    const isFirstPointSpecial = points.length >= 3; // Highlight first point when 3+ points

    return points.map((cp, index) => {
      const isFirstPoint = index === 0;
      const shouldHighlightFirst = isFirstPointSpecial && isFirstPoint && !isPolygonComplete;

      return (
        <Marker
          key={cp.id}
          longitude={cp.geo.lng}
          latitude={cp.geo.lat}
        >
          <div
            className={`rounded-full border-2 transition-all relative z-50 ${
              mapControlPointTokens.getControlPointStyle(
                transformState.selectedPointId === cp.id, // isActive
                shouldHighlightFirst,                      // shouldHighlight
                isPolygonComplete                          // isCompleted
              ).classes
            }`}
            style={interactiveMapStyles.controlPoints.interaction(
              transformState.selectedPointId === cp.id,
              shouldHighlightFirst,
              isPolygonComplete
            )}
            title={
              isPolygonComplete
                ? `${cp.id} - ✅ ΚΛΕΙΣΤΟ Πολύγωνο (±${cp.accuracy}m)`
                : shouldHighlightFirst
                ? `${cp.id} - 🔄 Κάντε κλικ για ΚΛΕΙΣΙΜΟ πολυγώνου (±${cp.accuracy}m)`
                : `${cp.id} (±${cp.accuracy}m)`
            }
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();

              if (isPolygonComplete) {
                return;
              }

              if (shouldHighlightFirst) {
                handleLegacyPolygonClosure();
              }
            }}
          />
        </Marker>
      );
    });
  };

  // ========================================================================
  // RENDER POLYGON LINES
  // ========================================================================

  const renderPolygonLines = () => {
    if (!showControlPoints || !mapLoaded || transformState.controlPoints.length < 2) return null;

    const points = transformState.controlPoints;

    // 🔥 ENTERPRISE: Create coordinates - if polygon is complete, close it!
    const coordinates = points.map(cp => [cp.geo.lng, cp.geo.lat]);

    // ✅ POLYGON CLOSURE: Add first point to end if polygon is complete
    if (isPolygonComplete && coordinates.length >= 3) {
      coordinates.push(coordinates[0]); // Close the polygon
    }

    const lineGeoJSON = {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: coordinates
      },
      properties: {}
    };

    return (
      <Source id="polygon-lines" type="geojson" data={lineGeoJSON}>
        <Layer
          id="polygon-lines-layer"
          type="line"
          paint={{
            // ✅ ENTERPRISE: Different styles for complete vs incomplete polygon
            'line-color': isPolygonComplete ? '#10b981' : '#3b82f6', // Green when complete, blue when drawing
            'line-width': isPolygonComplete ? 3 : 2,
            'line-dasharray': isPolygonComplete ? [1, 0] : [2, 2] // Solid when complete, dashed when drawing
          }}
        />
      </Source>
    );
  };

  // ========================================================================
  // RENDER TRANSFORMATION PREVIEW
  // ========================================================================

  const renderTransformationPreview = () => {
    if (!showTransformationPreview || !transformState.isCalibrated || !mapLoaded) return null;

    // TODO: Add GeoJSON source/layer για transformed DXF entities
    // This would show the DXF content overlaid on the map
    return null;
  };

  // ========================================================================
  // RENDER ACCURACY VISUALIZATION
  // ========================================================================

  const renderAccuracyIndicators = () => {
    if (!mapLoaded || !showAccuracyCircles) return null;

    if (accuracyVisualizationMode === 'circles') {
      // Render enhanced accuracy circles
      return transformState.controlPoints.map((cp) => {
        const accuracyInfo = getAccuracyLevel(cp.accuracy);
        const radius = calculateAccuracyCircleRadius(cp.accuracy, viewState.zoom);

        return (
          <Marker
            key={`accuracy-${cp.id}`}
            longitude={cp.geo.lng}
            latitude={cp.geo.lat}
          >
            <div
              className="pointer-events-none flex items-center justify-center"
              style={interactiveMapStyles.accuracy.circle(
                radius,
                accuracyInfo.color,
                0.125
              )}
            >
              {/* Accuracy value label */}
              <div
                className="text-xs font-bold text-white bg-black bg-opacity-70 px-1 rounded"
                className={getDynamicTextClass(accuracyInfo.color)}
              >
                ±{cp.accuracy}m
              </div>
            </div>
          </Marker>
        );
      });
    }

    if (accuracyVisualizationMode === 'zones') {
      // Render accuracy zones με διαφορετικά shapes
      return transformState.controlPoints.map((cp) => {
        const accuracyInfo = getAccuracyLevel(cp.accuracy);
        const size = Math.max(cp.accuracy * 4, 16);

        return (
          <Marker
            key={`accuracy-zone-${cp.id}`}
            longitude={cp.geo.lng}
            latitude={cp.geo.lat}
          >
            <div
              className="pointer-events-none flex items-center justify-center"
              style={interactiveMapStyles.accuracy.zone(
                size,
                accuracyInfo.color,
                accuracyInfo.level
              )}
            >
              <div
                className="text-xs font-bold"
                className={`text-xs font-bold ${getDynamicTextClass(accuracyInfo.color)}`}
                style={interactiveMapStyles.accuracy.zoneIcon()}
              >
                {accuracyInfo.level === 'excellent' ? '✓' :
                 accuracyInfo.level === 'good' ? '○' :
                 accuracyInfo.level === 'fair' ? '△' : '✕'}
              </div>
            </div>
          </Marker>
        );
      });
    }

    return null;
  };

  // ========================================================================
  // RENDER COORDINATE DISPLAY
  // ========================================================================

  const renderCoordinateDisplay = () => (
    <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-90 text-white p-3 rounded-lg shadow-lg">
      <div className="text-sm space-y-1">
        {/* Quick Style Switcher */}
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-400">{t('map.styleSelector.style')}</span>
          <div className="flex space-x-1">
            {(['osm', 'satellite', 'terrain', 'dark', 'greece', 'watercolor', 'toner'] as const).map((style) => (
              <button
                key={style}
                onClick={() => handleMapStyleChange(style)}
                className={`w-6 h-6 rounded text-xs transition-colors ${
                  currentMapStyle === style
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}'
                }`}
                title={mapStyleNames[style]}
              >
                {style === 'osm' ? '🗺️' :
                 style === 'satellite' ? '🛰️' :
                 style === 'terrain' ? '🏔️' :
                 style === 'dark' ? '🌙' :
                 style === 'greece' ? '🇬🇷' :
                 style === 'watercolor' ? '🎨' : '⚫'}
              </button>
            ))}
          </div>
        </div>

        {/* Coordinate Display */}
        {hoveredCoordinate && (
          <>
            <div className="font-mono">
              Γεωγρ. Μήκος: {hoveredCoordinate.lng.toFixed(6)}
            </div>
            <div className="font-mono">
              Γεωγρ. Πλάτος: {hoveredCoordinate.lat.toFixed(6)}
            </div>
            <div className="font-mono">
              Ύψος: {
                hoveredCoordinate.alt !== undefined
                  ? `${hoveredCoordinate.alt}m`
                  : 'Φόρτωση...'
              }
            </div>
          </>
        )}
        {clickMode !== 'off' && (
          <div className="text-yellow-400 text-xs mt-2">
            Click to {clickMode === 'add_geo' ? 'add geographic' : 'add DXF'} coordinate
          </div>
        )}
      </div>
    </div>
  );

  // ========================================================================
  // RENDER ACCURACY LEGEND
  // ========================================================================

  const renderAccuracyLegend = () => {
    if (!showAccuracyCircles || transformState.controlPoints.length === 0) return null;

    const accuracyLevels = [
      { level: 'excellent', color: '#10B981', label: t('accuracy.levels.excellent') },
      { level: 'good', color: '#3B82F6', label: t('accuracy.levels.good') },
      { level: 'fair', color: '#F59E0B', label: t('accuracy.levels.fair') },
      { level: 'poor', color: '#EF4444', label: t('accuracy.levels.poor') },
      { level: 'very_poor', color: '#9333EA', label: t('accuracy.levels.veryPoor') }
    ];

    return (
      <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-90 text-white p-3 rounded-lg shadow-lg">
        <div className="text-sm">
          <div className="font-semibold mb-2 text-blue-400">{t('accuracy.legend')}</div>

          {/* Visualization Mode Selector */}
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">{t('accuracy.visualization')}</div>
            <div className="flex space-x-1">
              <button
                onClick={() => setAccuracyVisualizationMode('circles')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  accuracyVisualizationMode === 'circles'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}'
                }`}
              >
                {t('accuracy.types.circles')}
              </button>
              <button
                onClick={() => setAccuracyVisualizationMode('zones')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  accuracyVisualizationMode === 'zones'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}'
                }`}
              >
                {t('accuracy.types.zones')}
              </button>
            </div>
          </div>

          {/* Legend Items */}
          <div className="space-y-1">
            {accuracyLevels.map((level) => (
              <div key={level.level} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full border"
                  className={getDynamicBackgroundClass(`${level.color}40`)}
                  style={interactiveMapStyles.labels.legendItem(level.color)}
                />
                <span className="text-xs text-gray-300">{level.label}</span>
              </div>
            ))}
          </div>

          {/* Toggle Button */}
          <div className="mt-3 pt-2 border-t border-gray-700">
            <button
              onClick={() => setShowAccuracyCircles(!showAccuracyCircles)}
              className={`w-full px-2 py-1 text-xs rounded transition-colors ${
                showAccuracyCircles
                  ? `bg-green-600 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} text-white`
                  : `bg-gray-700 ${HOVER_BACKGROUND_EFFECTS.LIGHT} text-gray-300`
              }`}
            >
              {showAccuracyCircles ? t('accuracy.controls.hideIndicators') : t('accuracy.controls.showIndicators')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ========================================================================
  // RENDER MAP CONTROLS
  // ========================================================================

  const renderMapControls = () => (
    <div className="absolute bottom-4 left-4 space-y-2">
      <div className="bg-gray-900 bg-opacity-90 rounded-lg p-2">
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => startCoordinatePicking('add_geo')}
            disabled={clickMode === 'add_geo'}
            className={`px-3 py-2 rounded text-sm transition-colors ${
              clickMode === 'add_geo'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}'
            }`}
          >
            📍 {t('map.controls.pickGeographicPoint')}
          </button>

          <button
            onClick={stopCoordinatePicking}
            disabled={clickMode === 'off'}
            className={`px-3 py-2 bg-red-600 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors`}
          >
            ✕ {t('map.controls.cancelPicking')}
          </button>
        </div>
      </div>

      {/* Map Style Controls */}
      <div className="bg-gray-900 bg-opacity-90 rounded-lg p-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400">{t('map.controls.mapStyle')}</div>
          <div className={`w-2 h-2 rounded-full ${mapLoaded ? 'bg-green-400' : 'bg-yellow-400'}`} />
        </div>
        <select
          value={currentMapStyle}
          onChange={(e) => handleMapStyleChange(e.target.value as 'osm' | 'satellite' | 'terrain' | 'dark' | 'greece' | 'watercolor' | 'toner')}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          disabled={!mapLoaded}
        >
          <option value="osm">🗺️ {t('map.controls.openStreetMap')}</option>
          <option value="satellite">🛰️ {t('map.controls.satellite')}</option>
          <option value="terrain">🏔️ {t('map.controls.terrain')}</option>
          <option value="dark">🌙 {t('map.controls.darkMode')}</option>
          <option value="greece">🇬🇷 {t('map.controls.greece')}</option>
          <option value="watercolor">🎨 {t('map.controls.watercolor')}</option>
          <option value="toner">⚫ {t('map.controls.toner')}</option>
        </select>
        {currentMapStyle && (
          <div className="text-xs text-gray-500 mt-1">
            {mapStyleNames[currentMapStyle]}
          </div>
        )}
      </div>
    </div>
  );

  // ========================================================================
  // LIVE DRAWING PREVIEW RENDERING
  // ========================================================================

  const renderLiveDrawingPreview = () => {
    if (!enablePolygonDrawing || !systemIsDrawing) {
      return null;
    }

    const currentDrawing = getCurrentDrawing();

    // ✅ ENTERPRISE: Live preview για point mode πριν το πρώτο κλικ
    if (currentDrawing?.config?.pointMode === true && currentDrawing.points.length === 0 && hoveredCoordinate) {
      const pointRadius = currentDrawing.config?.radius || 100; // Default 100m radius

      // Validate hovered coordinates
      if (hoveredCoordinate.lat < -90 || hoveredCoordinate.lat > 90 ||
          hoveredCoordinate.lng < -180 || hoveredCoordinate.lng > 180) {
        return null;
      }

      // Calculate radius circle in degrees (approximation for visualization)
      const radiusInDegrees = pointRadius / 111000;
      const circleCoordinates = [];
      const numPoints = 32; // Lower resolution για smooth preview

      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        const lat = hoveredCoordinate.lat + radiusInDegrees * Math.cos(angle);
        const lng = hoveredCoordinate.lng + radiusInDegrees * Math.sin(angle) / Math.cos(hoveredCoordinate.lat * Math.PI / 180);
        circleCoordinates.push([lng, lat]);
      }
      // Close the circle
      circleCoordinates.push(circleCoordinates[0]);

      const circleFeature = {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [circleCoordinates]
        },
        properties: {
          id: 'point-mode-preview-circle'
        }
      };

      return (
        <React.Fragment>
          {/* Preview Radius Circle */}
          <Source
            id="point-preview-circle"
            type="geojson"
            data={circleFeature}
          >
            <Layer
              id="point-preview-circle-fill"
              type="fill"
              paint={{
                'fill-color': '#3b82f6',
                'fill-opacity': 0.05
              }}
            />
            <Layer
              id="point-preview-circle-stroke"
              type="line"
              paint={{
                'line-color': '#3b82f6',
                'line-opacity': 0.4,
                'line-width': 1,
                'line-dasharray': [8, 8]
              }}
            />
          </Source>

          {/* Preview Pin Marker (ghost πινέζα) */}
          <Marker
            longitude={hoveredCoordinate.lng}
            latitude={hoveredCoordinate.lat}
          >
            <div
              style={interactiveMapStyles.markers.pin(pointRadius, 0.7)}
              title={`Πινέζα Preview - Ακτίνα: ${pointRadius}m`}
            >
              {/* Pin center dot */}
              <div
                style={interactiveMapStyles.markers.centerDot()}
              />
            </div>
          </Marker>

          {/* Preview Radius Label */}
          <Marker
            longitude={hoveredCoordinate.lng}
            latitude={hoveredCoordinate.lat + radiusInDegrees * 0.7}
          >
            <div
              style={interactiveMapStyles.labels.previewLabel(0.8)}
            >
              {pointRadius}m
            </div>
          </Marker>
        </React.Fragment>
      );
    }

    // ✅ STANDARD: Current drawing points για non-point modes ή μετά το πρώτο κλικ
    if (!currentDrawing || !currentDrawing.points || currentDrawing.points.length === 0) {
      return null;
    }

    return (
      <React.Fragment>
        {/* Render current drawing points */}
        {currentDrawing.points.map((point, index) => {
          // Validate coordinates
          if (point.y < -90 || point.y > 90 || point.x < -180 || point.x > 180) {
            return null;
          }

          return (
            <Marker
              key={`preview-point-${index}`}
              longitude={point.x}
              latitude={point.y}
            >
              <div
                style={interactiveMapStyles.markers.drawingPoint(index)}
                title={`Point ${index + 1} (Drawing)`}
              />
            </Marker>
          );
        })}

        {/* Render lines between points */}
        {currentDrawing.points.length > 1 && (
          <Source
            id="preview-line"
            type="geojson"
            data={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: currentDrawing.points.map(p => [p.x, p.y])
              },
              properties: {}
            }}
          >
            <Layer
              id="preview-line-layer"
              type="line"
              paint={{
                'line-color': '#3b82f6',
                'line-width': 2,
                'line-dasharray': [4, 4],
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}
      </React.Fragment>
    );
  };

  // ========================================================================
  // UNIVERSAL POLYGON SYSTEM RENDERING
  // ========================================================================

  /**
   * Render Administrative Boundaries Layers
   */
  const renderAdministrativeBoundaries = () => {
    if (!administrativeBoundaries || administrativeBoundaries.length === 0) {
      return null;
    }

    return administrativeBoundaries.map((boundary, index) => {
      if (!boundary.visible) return null;

      const sourceId = `admin-boundary-${index}`;
      const lineLayerId = `admin-boundary-line-${index}`;
      const fillLayerId = `admin-boundary-fill-${index}`;

      // Default styles
      const defaultStyle = {
        strokeColor: '#2563eb',
        strokeWidth: 2,
        strokeOpacity: 0.8,
        fillColor: '#3b82f6',
        fillOpacity: 0.1
      };

      const style = { ...defaultStyle, ...boundary.style };

      return (
        <Source
          key={sourceId}
          id={sourceId}
          type="geojson"
          data={boundary.feature}
        >
          {/* Fill Layer (behind line) */}
          <Layer
            id={fillLayerId}
            type="fill"
            paint={{
              'fill-color': style.fillColor,
              'fill-opacity': style.fillOpacity
            }}
          />

          {/* Line Layer (on top) */}
          <Layer
            id={lineLayerId}
            type="line"
            paint={{
              'line-color': style.strokeColor,
              'line-width': style.strokeWidth,
              'line-opacity': style.strokeOpacity
            }}
            layout={{
              'line-join': 'round',
              'line-cap': 'round'
            }}
          />
        </Source>
      );
    }).filter(Boolean);
  };

  const renderPolygonSystemLayers = () => {
    if (!polygons || polygons.length === 0) {
      return null;
    }

    // ✅ ENTERPRISE: Get GeoJSON data from centralized system
    const geojsonData = exportAsGeoJSON();

    if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
      return null;
    }

    return geojsonData.features.map((feature, index) => {
      const polygon = polygons.find(p => p.id === feature.properties?.id);
      if (!polygon) {
        return null;
      }

      const sourceId = `polygon-${polygon.id}`;

      // ✅ ENTERPRISE: Check if this is a point mode polygon (πινέζα)
      const isPointMode = polygon.config?.pointMode === true;
      const pointRadius = polygon.config?.radius || 100; // Default 100m radius


      if (isPointMode && polygon.points.length === 1) {
        const point = polygon.points[0];

        // Validate coordinates before rendering
        if (point.y < -90 || point.y > 90 || point.x < -180 || point.x > 180) {
          return null;
        }

        // Calculate radius circle in degrees (approximation for visualization)
        // 1 degree ≈ 111km at equator, so radius in degrees = radius_meters / 111000
        const radiusInDegrees = pointRadius / 111000;
        const circleCoordinates = [];
        const numPoints = 64; // Circle resolution

        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * 2 * Math.PI;
          const lat = point.y + radiusInDegrees * Math.cos(angle);
          const lng = point.x + radiusInDegrees * Math.sin(angle) / Math.cos(point.y * Math.PI / 180);
          circleCoordinates.push([lng, lat]);
        }
        // Close the circle
        circleCoordinates.push(circleCoordinates[0]);

        const circleFeature = {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [circleCoordinates]
          },
          properties: {
            id: `${polygon.id}-radius-circle`
          }
        };

        return (
          <React.Fragment key={polygon.id}>
            {/* Radius Circle */}
            <Source
              id={`${sourceId}-circle`}
              type="geojson"
              data={circleFeature}
            >
              <Layer
                id={`${sourceId}-circle-fill`}
                type="fill"
                paint={{
                  'fill-color': polygon.style.fillColor,
                  'fill-opacity': 0.1
                }}
              />
              <Layer
                id={`${sourceId}-circle-stroke`}
                type="line"
                paint={{
                  'line-color': polygon.style.strokeColor,
                  'line-opacity': 0.6,
                  'line-width': 2,
                  'line-dasharray': [5, 5]
                }}
              />
            </Source>

            {/* Pin Marker (πινέζα) */}
            <Marker
              longitude={point.x}
              latitude={point.y}
            >
              <div
                style={interactiveMapStyles.markers.dynamicPin(
                  polygon.style.strokeColor,
                  polygon.style.fillColor
                )}
                title={`Πινέζα - Ακτίνα: ${pointRadius}m`}
              >
                {/* Pin center dot */}
                <div
                  style={interactiveMapStyles.markers.dynamicCenterDot()}
                />
              </div>
            </Marker>

            {/* Radius text label */}
            <Marker
              longitude={point.x}
              latitude={point.y + radiusInDegrees * 0.7}
            >
              <div
                style={interactiveMapStyles.labels.radiusLabel()}
              >
                {pointRadius}m
              </div>
            </Marker>
          </React.Fragment>
        );
      }

      // ✅ STANDARD: Regular polygon rendering for non-point modes
      return (
        <React.Fragment key={polygon.id}>
          {/* Polygon Fill Layer */}
          <Source
            id={sourceId}
            type="geojson"
            data={feature}
          >
            <Layer
              id={`${sourceId}-fill`}
              type="fill"
              paint={{
                'fill-color': polygon.style.fillColor,
                'fill-opacity': polygon.style.fillOpacity || 0.3  // ✅ FIX: Prevents MapLibre "number expected, undefined" errors
              }}
            />
            <Layer
              id={`${sourceId}-stroke`}
              type="line"
              paint={{
                'line-color': polygon.style.strokeColor,
                'line-opacity': polygon.style.strokeOpacity || 1.0,
                'line-width': polygon.style.strokeWidth || 2
              }}
            />
          </Source>

          {/* Polygon Points (vertices) */}
          {polygon.points.map((point, index) => {
            // Validate coordinates before rendering
            if (point.y < -90 || point.y > 90 || point.x < -180 || point.x > 180) {
              return null; // Skip invalid markers
            }

            return (
              <Marker
                key={`${polygon.id}-point-${index}`}
                longitude={point.x}
                latitude={point.y}
              >
              <div
                style={interactiveMapStyles.layout.polygonVertex(
                  polygon.style.pointRadius || 4,
                  polygon.style.pointColor || polygon.style.strokeColor,
                  polygon.style.strokeColor
                )}
                title={point.label || `Point ${index + 1}`}
              />
            </Marker>
            );
          })}
        </React.Fragment>
      );
    });
  };

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  return (
    <div className={`relative ${className}`}>
      <MapComponent
        ref={mapRef}
        {...viewState}
        onMove={(evt: any) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        onMouseMove={handleMapMouseMove}
        onMouseDown={handleMapMouseDown}
        onMouseUp={handleMapMouseUp}
        onLoad={handleMapLoad}
        onError={handleMapError}
        style={interactiveMapStyles.layout.mapContainer}
        mapStyle={mapStyleUrls[currentMapStyle] || mapStyleUrls.osm}
        cursor={mapInteractionTokens.getMapCursor(isPickingCoordinates, systemIsDrawing)}
        // ✅ ENTERPRISE: Disable map interactions when drawing (prevents map dragging during polygon drawing)
        dragPan={!systemIsDrawing}
        dragRotate={!systemIsDrawing}
        scrollZoom={!systemIsDrawing}
        touchZoom={!systemIsDrawing}
        doubleClickZoom={!systemIsDrawing}
        keyboard={!systemIsDrawing}
      >
        {/* Control Points */}
        {renderControlPoints()}

        {/* Polygon Lines */}
        {renderPolygonLines()}

        {/* Transformation Preview */}
        {renderTransformationPreview()}

        {/* Accuracy Indicators */}
        {renderAccuracyIndicators()}

        {/* ✅ NEW: Live Drawing Preview */}
        {renderLiveDrawingPreview()}

        {/* ✅ NEW: Universal Polygon System Layers */}
        {enablePolygonDrawing && renderPolygonSystemLayers()}

        {/* ✅ NEW: Administrative Boundaries Layers */}
        {renderAdministrativeBoundaries()}

        {/* ✅ NEW: Address Search Marker */}
        {searchMarker && (
          <Marker
            longitude={searchMarker.lng}
            latitude={searchMarker.lat}
          >
            <div className="relative flex items-center justify-center group">
              {/* Main Search Marker */}
              <div className="flex flex-col items-center">
                {/* Marker Icon */}
                <div className="w-8 h-8 bg-red-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center relative z-10">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
                {/* Pin Tip */}
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500 -mt-1 relative z-10"></div>
              </div>

              {/* Pulse Animation */}
              <div className="absolute w-12 h-12 bg-red-400 rounded-full opacity-30 animate-ping"></div>
              <div
                className="absolute w-16 h-16 bg-red-300 rounded-full opacity-20 animate-ping"
                style={interactiveMapStyles.layout.animationDelay(0.2)}
              ></div>

              {/* Address Tooltip */}
              {searchMarker.address && (
                <div className={`absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} transition-opacity duration-300 pointer-events-none z-20`}>
                  <div className="max-w-48 truncate">
                    {typeof searchMarker.address === 'string' ? searchMarker.address : 'Αναζητημένη θέση'}
                  </div>
                  {/* Tooltip Arrow */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black border-opacity-80"></div>
                </div>
              )}
            </div>
          </Marker>
        )}
      </MapComponent>

      {/* UI Overlays */}
      {renderAccuracyLegend()}
      {renderCoordinateDisplay()}
      {renderMapControls()}

      {/* Status Bar */}
      <div className="absolute bottom-4 right-4">
        <div className="bg-gray-900 bg-opacity-90 text-white p-3 rounded-lg shadow-lg">
          <div className="text-sm space-y-1">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${mapLoaded ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span>{mapLoaded ? t('map.status.mapLoaded') : t('map.status.mapLoading')}</span>
            </div>
            {transformState.isCalibrated && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Transformation Active</span>
              </div>
            )}
            {enablePolygonDrawing && (
              <>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${systemIsDrawing ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                  <span>Polygons: {stats.totalPolygons}</span>
                </div>
                {systemIsDrawing && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span>Drawing mode active...</span>
                  </div>
                )}
              </>
            )}
            <div className="text-xs text-gray-400">
              {t('map.status.points')}: {transformState.controlPoints.length}
            </div>
            {transformState.controlPoints.length > 0 && showAccuracyCircles && (
              <>
                <div className="text-xs text-gray-400 mt-1">
                  {t('accuracy.stats.avgAccuracy')} {t('accuracy.stats.format', { value: (transformState.controlPoints.reduce((sum, cp) => sum + cp.accuracy, 0) / transformState.controlPoints.length).toFixed(2) })}
                </div>
                <div className="text-xs text-gray-400">
                  {t('accuracy.stats.best')} {t('accuracy.stats.format', { value: Math.min(...transformState.controlPoints.map(cp => cp.accuracy)).toFixed(2) })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InteractiveMap;