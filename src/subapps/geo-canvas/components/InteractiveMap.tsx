'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Map, { MapRef, Marker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// ❌ ΑΦΑΙΡΕΘΗΚΕ: import { useGeoTransform } from '../hooks/useGeoTransform';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import type { GeoCoordinate, DxfCoordinate, GeoControlPoint } from '../types';

// ✅ NEW: Universal Polygon System Integration (CENTRALIZED PACKAGE)
import { usePolygonSystem } from '@geo-alert/core';
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

  // ✅ NEW: Universal Polygon System Props
  enablePolygonDrawing?: boolean;
  defaultPolygonMode?: PolygonType;
  onPolygonCreated?: (polygon: UniversalPolygon) => void;
  onPolygonModified?: (polygon: UniversalPolygon) => void;
  onPolygonDeleted?: (polygonId: string) => void;
}

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

  // ✅ NEW: Universal Polygon System Props
  enablePolygonDrawing = false,
  defaultPolygonMode = 'simple',
  onPolygonCreated,
  onPolygonModified,
  onPolygonDeleted
}: InteractiveMapProps) {
  const { t, isLoading } = useTranslationLazy('geo-canvas');
  const mapRef = useRef<any>(null);

  // ✅ NEW: Universal Polygon System Integration
  const polygonSystem = usePolygonSystem({
    defaultMode: defaultPolygonMode,
    autoSave: true,
    storageKey: 'geo-canvas-polygons',
    debug: true
  });

  // ✅ ENTERPRISE: Single source of truth - NO duplicate hooks!
  console.log('🎯 InteractiveMap using transformState:', {
    controlPointsCount: transformState?.controlPoints?.length || 0,
    controlPoints: transformState?.controlPoints || [],
    isCalibrated: transformState?.isCalibrated || false
  });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [clickMode, setClickMode] = useState<'off' | 'add_dxf' | 'add_geo'>('off');
  const [hoveredCoordinate, setHoveredCoordinate] = useState<GeoCoordinate | null>(null);

  // Map configuration
  const [viewState, setViewState] = useState({
    longitude: 23.7275, // Athens, Greece
    latitude: 37.9755,
    zoom: 8,
    bearing: 0,
    pitch: 0
  });

  // Map style configuration
  const [currentMapStyle, setCurrentMapStyle] = useState<'osm' | 'satellite' | 'terrain' | 'dark'>('osm');

  // Enterprise MapLibre Style URLs
  const mapStyleUrls = {
    osm: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    satellite: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    terrain: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  };

  // Accuracy visualization settings
  const [showAccuracyCircles, setShowAccuracyCircles] = useState(true);
  const [accuracyVisualizationMode, setAccuracyVisualizationMode] = useState<'circles' | 'heatmap' | 'zones'>('circles');

  // Polygon completion state
  const [isPolygonComplete, setIsPolygonComplete] = useState(false);
  const [completedPolygon, setCompletedPolygon] = useState<GeoControlPoint[] | null>(null);

  // ========================================================================
  // MAP STYLE CONFIGURATION
  // ========================================================================

  const mapStyleNames = {
    osm: t('map.controls.openStreetMap'),
    satellite: t('map.controls.satellite'),
    terrain: t('map.controls.terrain'),
    dark: t('map.controls.darkMode')
  };

  // ========================================================================
  // MAP EVENT HANDLERS
  // ========================================================================

  const handleMapClick = useCallback((event: any) => {
    const { lng, lat } = event.lngLat || { lng: event.longitude, lat: event.latitude };
    const coordinate: GeoCoordinate = { lng, lat };

    // ✅ NEW: Universal Polygon System - Handle polygon drawing
    if (enablePolygonDrawing && polygonSystem.isDrawing) {
      // Add point to polygon system
      const point = polygonSystem.addPoint(lng, lat, { lng, lat });

      if (point) {
        console.log('🎨 Added polygon point:', point);
      }
      return;
    }

    // 🔒 ENTERPRISE: Handle coordinate picking for control points
    if (!isPickingCoordinates || !onCoordinateClick || isPolygonComplete) {
      if (isPolygonComplete) {
        console.log('🔒 Coordinate picking blocked - polygon is complete');
      }
      return;
    }

    console.log('🗺️ Map clicked:', coordinate);
    onCoordinateClick(coordinate);
  }, [
    isPickingCoordinates,
    onCoordinateClick,
    isPolygonComplete,
    enablePolygonDrawing,
    polygonSystem.isDrawing,
    polygonSystem.addPoint
  ]);

  const handleMapMouseMove = useCallback((event: any) => {
    const { lng, lat } = event.lngLat || { lng: event.longitude, lat: event.latitude };
    setHoveredCoordinate({ lng, lat });
  }, []);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);

    // Initialize polygon system with map instance
    if (enablePolygonDrawing && mapRef.current) {
      const map = mapRef.current.getMap?.();
      if (map && !polygonSystem.manager) {
        // Note: We don't have a canvas here, so we initialize with map only
        // The canvas would be used for overlay drawing if needed
        console.log('🎨 Initializing polygon system with map');
      }
    }

    // Notify parent that map is ready
    if (onMapReady && mapRef.current) {
      const map = mapRef.current.getMap?.();
      if (map) {
        console.log('🗺️ Map loaded - calling onMapReady');
        onMapReady(map);
      }
    }
  }, [onMapReady, enablePolygonDrawing, polygonSystem.manager]);

  const handleMapStyleChange = useCallback((newStyle: 'osm' | 'satellite' | 'terrain' | 'dark') => {
    setCurrentMapStyle(newStyle);
    setMapLoaded(false); // Show loading while style changes

    // Simulate brief loading for style transition
    setTimeout(() => {
      setMapLoaded(true);
    }, 500);
  }, []);

  // ========================================================================
  // POLYGON CLOSURE HANDLER
  // ========================================================================

  const handlePolygonClosure = useCallback(() => {
    const currentPoints = transformState.controlPoints;

    if (currentPoints.length < 3) {
      console.warn('🚨 Cannot close polygon - need at least 3 points');
      return;
    }

    console.log('✅ Polygon closure initiated!', {
      pointsCount: currentPoints.length,
      firstPoint: currentPoints[0],
      lastPoint: currentPoints[currentPoints.length - 1]
    });

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
      console.log('📞 Parent notified about polygon completion');
    }

    // Note: Coordinate picking will be blocked by handleMapClick
    console.log('✅ Polygon successfully closed and saved!', {
      isComplete: true,
      polygonPoints: currentPoints.length,
      coordinatePickingBlocked: true,
      parentNotified: !!onPolygonComplete
    });
  }, [transformState.controlPoints, onPolygonComplete]);

  // ========================================================================
  // UNIVERSAL POLYGON SYSTEM EFFECTS
  // ========================================================================

  // Handle polygon creation callback
  useEffect(() => {
    if (onPolygonCreated && polygonSystem.polygons.length > 0) {
      // Get the latest polygon
      const latestPolygon = polygonSystem.polygons[polygonSystem.polygons.length - 1];

      // Check if this is a new polygon by checking if we've seen it before
      const polygonId = latestPolygon.id;
      const existingPolygon = polygonSystem.getPolygon(polygonId);

      if (existingPolygon) {
        console.log('🎨 Polygon created:', latestPolygon);
        onPolygonCreated(latestPolygon);

        // Add polygon to map if it has geo coordinates
        if (latestPolygon.type === 'georeferencing' || latestPolygon.points.some(p => p.x && p.y)) {
          polygonSystem.addPolygonToMap(latestPolygon);
        }
      }
    }
  }, [polygonSystem.polygons.length, onPolygonCreated, polygonSystem]);

  // Handle polygon system keyboard shortcuts
  useEffect(() => {
    if (!enablePolygonDrawing) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if polygon drawing is active
      if (!polygonSystem.isDrawing) return;

      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          const finishedPolygon = polygonSystem.finishDrawing();
          if (finishedPolygon && onPolygonCreated) {
            onPolygonCreated(finishedPolygon);
          }
          break;

        case 'Escape':
          event.preventDefault();
          polygonSystem.cancelDrawing();
          break;

        case 'Backspace':
          event.preventDefault();
          // This would be handled by the polygon system internally
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enablePolygonDrawing, polygonSystem.isDrawing, polygonSystem, onPolygonCreated]);

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
    console.log('🎯 Rendering control points:', {
      showControlPoints,
      mapLoaded,
      controlPointsCount: transformState.controlPoints.length,
      controlPoints: transformState.controlPoints
    });

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
              isPolygonComplete
                ? 'w-4 h-4 bg-green-500 border-green-300 cursor-default' // Complete polygon - all points green
                : transformState.selectedPointId === cp.id
                ? 'w-5 h-5 bg-blue-500 border-blue-300 scale-125 cursor-pointer'
                : shouldHighlightFirst
                ? 'w-8 h-8 bg-green-400 border-green-200 scale-125 animate-bounce shadow-lg shadow-green-500/50 cursor-pointer'
                : 'w-4 h-4 bg-red-500 border-red-300 hover:scale-110 cursor-pointer'
            }`}
            style={{
              zIndex: 99999,
              pointerEvents: 'auto',
              cursor: shouldHighlightFirst ? 'pointer' : (isPolygonComplete ? 'default' : 'pointer')
            }}
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
              console.log('🎯 Control point clicked!', { cp: cp.id, shouldHighlightFirst, isPolygonComplete });

              if (isPolygonComplete) {
                console.log('🔒 Polygon is complete - click ignored');
                return;
              }

              if (shouldHighlightFirst) {
                console.log('🔴 Polygon closure clicked! Closing polygon...');
                handlePolygonClosure();
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
    console.log('🔴 Rendering polygon lines:', {
      showControlPoints,
      mapLoaded,
      controlPointsCount: transformState.controlPoints.length,
      controlPoints: transformState.controlPoints,
      isPolygonComplete
    });

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
              className="pointer-events-none flex items-center justify-center absolute"
              style={{
                width: radius * 2,
                height: radius * 2,
                borderRadius: '50%',
                border: `2px solid ${accuracyInfo.color}`,
                backgroundColor: `${accuracyInfo.color}20`,
                transform: 'translate(-50%, -50%)',
                left: '50%',
                top: '50%',
                zIndex: 10
              }}
            >
              {/* Accuracy value label */}
              <div
                className="text-xs font-bold text-white bg-black bg-opacity-70 px-1 rounded"
                style={{ color: accuracyInfo.color }}
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
              className="pointer-events-none flex items-center justify-center absolute"
              style={{
                width: size,
                height: size,
                backgroundColor: `${accuracyInfo.color}40`,
                border: `2px solid ${accuracyInfo.color}`,
                borderRadius: accuracyInfo.level === 'excellent' ? '50%' :
                             accuracyInfo.level === 'good' ? '4px' : '0',
                transform: 'translate(-50%, -50%) rotate(45deg)',
                left: '50%',
                top: '50%',
                zIndex: 10
              }}
            >
              <div
                className="text-xs font-bold"
                style={{
                  color: accuracyInfo.color,
                  transform: 'rotate(-45deg)'
                }}
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
          <span className="text-xs text-gray-400">Style:</span>
          <div className="flex space-x-1">
            {(['osm', 'satellite', 'terrain', 'dark'] as const).map((style) => (
              <button
                key={style}
                onClick={() => handleMapStyleChange(style)}
                className={`w-6 h-6 rounded text-xs transition-colors ${
                  currentMapStyle === style
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
                title={mapStyleNames[style]}
              >
                {style === 'osm' ? '🗺️' : style === 'satellite' ? '🛰️' : style === 'terrain' ? '🏔️' : '🌙'}
              </button>
            ))}
          </div>
        </div>

        {/* Coordinate Display */}
        {hoveredCoordinate && (
          <>
            <div className="font-mono">
              {t('map.coordinates.lng')}: {hoveredCoordinate.lng.toFixed(6)}
            </div>
            <div className="font-mono">
              {t('map.coordinates.lat')}: {hoveredCoordinate.lat.toFixed(6)}
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
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {t('accuracy.types.circles')}
              </button>
              <button
                onClick={() => setAccuracyVisualizationMode('zones')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  accuracyVisualizationMode === 'zones'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
                  style={{
                    backgroundColor: `${level.color}40`,
                    borderColor: level.color
                  }}
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
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
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
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📍 {t('map.controls.pickGeographicPoint')}
          </button>

          <button
            onClick={stopCoordinatePicking}
            disabled={clickMode === 'off'}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
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
          onChange={(e) => handleMapStyleChange(e.target.value as 'osm' | 'satellite' | 'terrain' | 'dark')}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          disabled={!mapLoaded}
        >
          <option value="osm">🗺️ {t('map.controls.openStreetMap')}</option>
          <option value="satellite">🛰️ {t('map.controls.satellite')}</option>
          <option value="terrain">🏔️ {t('map.controls.terrain')}</option>
          <option value="dark">🌙 {t('map.controls.darkMode')}</option>
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
  // UNIVERSAL POLYGON SYSTEM RENDERING
  // ========================================================================

  const renderPolygonSystemLayers = () => {
    if (!polygonSystem.polygons || polygonSystem.polygons.length === 0) {
      return null;
    }

    return polygonSystem.polygons.map((polygon) => {
      // Convert polygon to GeoJSON for MapLibre
      const geojsonData = polygonSystem.exportAsGeoJSON();

      // Filter to current polygon
      const polygonFeature = geojsonData.features.find(
        (feature) => feature.properties?.id === polygon.id
      );

      if (!polygonFeature) return null;

      const sourceId = `polygon-${polygon.id}`;

      return (
        <React.Fragment key={polygon.id}>
          {/* Polygon Fill Layer */}
          <Source
            id={sourceId}
            type="geojson"
            data={polygonFeature}
          >
            <Layer
              id={`${sourceId}-fill`}
              type="fill"
              paint={{
                'fill-color': polygon.style.fillColor,
                'fill-opacity': polygon.style.fillOpacity
              }}
            />
            <Layer
              id={`${sourceId}-stroke`}
              type="line"
              paint={{
                'line-color': polygon.style.strokeColor,
                'line-opacity': polygon.style.strokeOpacity,
                'line-width': polygon.style.strokeWidth
              }}
            />
          </Source>

          {/* Polygon Points (vertices) */}
          {polygon.points.map((point, index) => (
            <Marker
              key={`${polygon.id}-point-${index}`}
              longitude={point.x}
              latitude={point.y}
            >
              <div
                style={{
                  width: (polygon.style.pointRadius || 4) * 2,
                  height: (polygon.style.pointRadius || 4) * 2,
                  backgroundColor: polygon.style.pointColor || polygon.style.strokeColor,
                  borderRadius: '50%',
                  border: `1px solid ${polygon.style.strokeColor}`,
                  transform: 'translate(-50%, -50%)',
                  cursor: 'pointer'
                }}
                title={point.label || `Point ${index + 1}`}
              />
            </Marker>
          ))}
        </React.Fragment>
      );
    });
  };

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  return (
    <div className={`relative ${className}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt: any) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        onMouseMove={handleMapMouseMove}
        onLoad={handleMapLoad}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyleUrls[currentMapStyle]}
        cursor={isPickingCoordinates ? 'crosshair' : 'default'}
      >
        {/* Control Points */}
        {renderControlPoints()}

        {/* Polygon Lines */}
        {renderPolygonLines()}

        {/* Transformation Preview */}
        {renderTransformationPreview()}

        {/* Accuracy Indicators */}
        {renderAccuracyIndicators()}

        {/* ✅ NEW: Universal Polygon System Layers */}
        {enablePolygonDrawing && renderPolygonSystemLayers()}
      </Map>

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
                  <div className={`w-2 h-2 rounded-full ${polygonSystem.isDrawing ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                  <span>Polygons: {polygonSystem.stats.totalPolygons}</span>
                </div>
                {polygonSystem.isDrawing && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span>Drawing {polygonSystem.currentMode}...</span>
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