'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
// import Map, { MapRef, Marker, Source, Layer } from 'react-map-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';

import { useGeoTransform } from '../hooks/useGeoTransform';
import type { GeoCoordinate, DxfCoordinate, GeoControlPoint } from '../types';

// ============================================================================
// MOCK IMPLEMENTATIONS (για development χωρίς MapLibre dependencies)
// ============================================================================

// Mock Map component για development
const MockMap = ({ children, ...props }: any) => (
  <div className="w-full h-full bg-gray-800 relative" {...props}>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🗺️</div>
        <h3 className="text-xl font-bold text-blue-400 mb-2">Interactive Map</h3>
        <p className="text-gray-400">MapLibre GL JS Integration</p>
        <p className="text-sm text-yellow-400 mt-2">Dependencies loading...</p>
      </div>
    </div>
    {children}
  </div>
);

// Mock Marker component
const MockMarker = ({ longitude, latitude, children, ...props }: any) => (
  <div className="absolute pointer-events-none" {...props}>
    {children}
  </div>
);

// Use mock components during development
const Map = MockMap;
const Marker = MockMarker;

// ============================================================================
// INTERACTIVE MAP COMPONENT
// ============================================================================

export interface InteractiveMapProps {
  onCoordinateClick?: (coordinate: GeoCoordinate) => void;
  showControlPoints?: boolean;
  showTransformationPreview?: boolean;
  className?: string;
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
  className = ''
}: InteractiveMapProps) {
  const mapRef = useRef<any>(null);
  const [transformState] = useGeoTransform();
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

  // Accuracy visualization settings
  const [showAccuracyCircles, setShowAccuracyCircles] = useState(true);
  const [accuracyVisualizationMode, setAccuracyVisualizationMode] = useState<'circles' | 'heatmap' | 'zones'>('circles');

  // ========================================================================
  // MAP STYLE CONFIGURATION
  // ========================================================================

  const mapStyles = {
    osm: {
      version: 8,
      name: 'OpenStreetMap',
      sources: {
        'osm': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm-raster',
          type: 'raster',
          source: 'osm'
        }
      ]
    },
    satellite: {
      version: 8,
      name: 'Satellite Imagery',
      sources: {
        'satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            // Fallback servers
            'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
        }
      },
      layers: [
        {
          id: 'satellite-raster',
          type: 'raster',
          source: 'satellite'
        }
      ]
    },
    terrain: {
      version: 8,
      name: 'Terrain Map',
      sources: {
        'terrain': {
          type: 'raster',
          tiles: [
            'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png',
            // Fallback
            'https://tile.opentopomap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: 'Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL'
        }
      },
      layers: [
        {
          id: 'terrain-raster',
          type: 'raster',
          source: 'terrain'
        }
      ]
    },
    dark: {
      version: 8,
      name: 'Dark Mode',
      sources: {
        'dark': {
          type: 'raster',
          tiles: [
            'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
            // Fallback για dark theme
            'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          ],
          tileSize: 256,
          attribution: '© Stadia Maps, © OpenMapTiles © OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'dark-raster',
          type: 'raster',
          source: 'dark'
        }
      ]
    }
  } as const;

  // ========================================================================
  // MAP EVENT HANDLERS
  // ========================================================================

  const handleMapClick = useCallback((event: any) => {
    if (clickMode === 'off' || !onCoordinateClick) return;

    const { lng, lat } = event.lngLat || { lng: event.longitude, lat: event.latitude };
    const coordinate: GeoCoordinate = { lng, lat };

    onCoordinateClick(coordinate);
    setClickMode('off'); // Reset after click
  }, [clickMode, onCoordinateClick]);

  const handleMapMouseMove = useCallback((event: any) => {
    const { lng, lat } = event.lngLat || { lng: event.longitude, lat: event.latitude };
    setHoveredCoordinate({ lng, lat });
  }, []);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleMapStyleChange = useCallback((newStyle: 'osm' | 'satellite' | 'terrain' | 'dark') => {
    setCurrentMapStyle(newStyle);
    setMapLoaded(false); // Show loading while style changes

    // Simulate brief loading for style transition
    setTimeout(() => {
      setMapLoaded(true);
    }, 500);
  }, []);

  // ========================================================================
  // ACCURACY VISUALIZATION HELPERS
  // ========================================================================

  const getAccuracyLevel = (accuracy: number) => {
    if (accuracy <= 0.5) return { level: 'excellent', color: '#10B981', label: 'Excellent (≤0.5m)' };
    if (accuracy <= 1.0) return { level: 'good', color: '#3B82F6', label: 'Good (≤1.0m)' };
    if (accuracy <= 2.0) return { level: 'fair', color: '#F59E0B', label: 'Fair (≤2.0m)' };
    if (accuracy <= 5.0) return { level: 'poor', color: '#EF4444', label: 'Poor (≤5.0m)' };
    return { level: 'very_poor', color: '#9333EA', label: 'Very Poor (>5.0m)' };
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

    return transformState.controlPoints.map((cp) => (
      <Marker
        key={cp.id}
        longitude={cp.geoPoint.lng}
        latitude={cp.geoPoint.lat}
      >
        <div
          className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all ${
            transformState.selectedPointId === cp.id
              ? 'bg-blue-500 border-blue-300 scale-125'
              : 'bg-red-500 border-red-300 hover:scale-110'
          }`}
          title={`${cp.id} (±${cp.accuracy}m)`}
        />
      </Marker>
    ));
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
            longitude={cp.geoPoint.lng}
            latitude={cp.geoPoint.lat}
          >
            <div
              className="pointer-events-none flex items-center justify-center"
              style={{
                width: radius * 2,
                height: radius * 2,
                borderRadius: '50%',
                border: `2px solid ${accuracyInfo.color}`,
                backgroundColor: `${accuracyInfo.color}20`,
                transform: 'translate(-50%, -50%)',
                position: 'relative'
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
            longitude={cp.geoPoint.lng}
            latitude={cp.geoPoint.lat}
          >
            <div
              className="pointer-events-none flex items-center justify-center"
              style={{
                width: size,
                height: size,
                backgroundColor: `${accuracyInfo.color}40`,
                border: `2px solid ${accuracyInfo.color}`,
                borderRadius: accuracyInfo.level === 'excellent' ? '50%' :
                             accuracyInfo.level === 'good' ? '4px' : '0',
                transform: 'translate(-50%, -50%) rotate(45deg)'
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
                title={mapStyles[style].name}
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
              Lng: {hoveredCoordinate.lng.toFixed(6)}
            </div>
            <div className="font-mono">
              Lat: {hoveredCoordinate.lat.toFixed(6)}
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
      { level: 'excellent', color: '#10B981', label: 'Excellent (≤0.5m)' },
      { level: 'good', color: '#3B82F6', label: 'Good (≤1.0m)' },
      { level: 'fair', color: '#F59E0B', label: 'Fair (≤2.0m)' },
      { level: 'poor', color: '#EF4444', label: 'Poor (≤5.0m)' },
      { level: 'very_poor', color: '#9333EA', label: 'Very Poor (>5.0m)' }
    ];

    return (
      <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-90 text-white p-3 rounded-lg shadow-lg">
        <div className="text-sm">
          <div className="font-semibold mb-2 text-blue-400">📐 Accuracy Legend</div>

          {/* Visualization Mode Selector */}
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">Visualization:</div>
            <div className="flex space-x-1">
              <button
                onClick={() => setAccuracyVisualizationMode('circles')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  accuracyVisualizationMode === 'circles'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ○ Circles
              </button>
              <button
                onClick={() => setAccuracyVisualizationMode('zones')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  accuracyVisualizationMode === 'zones'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ◊ Zones
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
              {showAccuracyCircles ? '👁️ Hide Indicators' : '👁️ Show Indicators'}
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
            📍 Pick Geographic Point
          </button>

          <button
            onClick={stopCoordinatePicking}
            disabled={clickMode === 'off'}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
          >
            ✕ Cancel Picking
          </button>
        </div>
      </div>

      {/* Map Style Controls */}
      <div className="bg-gray-900 bg-opacity-90 rounded-lg p-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400">Map Style</div>
          <div className={`w-2 h-2 rounded-full ${mapLoaded ? 'bg-green-400' : 'bg-yellow-400'}`} />
        </div>
        <select
          value={currentMapStyle}
          onChange={(e) => handleMapStyleChange(e.target.value as 'osm' | 'satellite' | 'terrain' | 'dark')}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          disabled={!mapLoaded}
        >
          <option value="osm">🗺️ OpenStreetMap</option>
          <option value="satellite">🛰️ Satellite</option>
          <option value="terrain">🏔️ Terrain</option>
          <option value="dark">🌙 Dark Mode</option>
        </select>
        {currentMapStyle && (
          <div className="text-xs text-gray-500 mt-1">
            {mapStyles[currentMapStyle].name}
          </div>
        )}
      </div>
    </div>
  );

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
        mapStyle={mapStyles[currentMapStyle]}
        cursor={clickMode !== 'off' ? 'crosshair' : 'default'}
      >
        {/* Control Points */}
        {renderControlPoints()}

        {/* Transformation Preview */}
        {renderTransformationPreview()}

        {/* Accuracy Indicators */}
        {renderAccuracyIndicators()}
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
              <span>Map {mapLoaded ? 'Loaded' : 'Loading'}</span>
            </div>
            {transformState.isCalibrated && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Transformation Active</span>
              </div>
            )}
            <div className="text-xs text-gray-400">
              Points: {transformState.controlPoints.length}
            </div>
            {transformState.controlPoints.length > 0 && showAccuracyCircles && (
              <>
                <div className="text-xs text-gray-400 mt-1">
                  Avg Accuracy: ±{(transformState.controlPoints.reduce((sum, cp) => sum + cp.accuracy, 0) / transformState.controlPoints.length).toFixed(2)}m
                </div>
                <div className="text-xs text-gray-400">
                  Best: ±{Math.min(...transformState.controlPoints.map(cp => cp.accuracy)).toFixed(2)}m
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