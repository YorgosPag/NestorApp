'use client';

/**
 * =============================================================================
 * GeofenceConfigMap — Admin Geofence Configuration with Interactive Map
 * =============================================================================
 *
 * Interactive map component for configuring the geofence (center + radius).
 * Uses react-map-gl/maplibre (already installed in the project).
 *
 * Features:
 * - Click on map → sets geofence center
 * - Draggable center marker
 * - Visual circle overlay (GeoJSON polygon, scales with zoom)
 * - Radix Slider for radius (50-500m)
 * - Save to server → POST /api/attendance/geofence
 *
 * @module components/projects/ika/components/GeofenceConfigMap
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Map, Marker, Source, Layer } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import type { FillLayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MapPin,
  Save,
  Loader2,
  AlertCircle,
  CircleDot,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import type { GeofenceConfig } from '../contracts';

// =============================================================================
// TYPES
// =============================================================================

interface GeofenceConfigMapProps {
  projectId: string;
}

interface GeofenceApiResponse {
  success: boolean;
  geofence: GeofenceConfig | null;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_RADIUS = 50;
const MAX_RADIUS = 500;
const DEFAULT_RADIUS = 200;
const MAP_ZOOM = 15;

/** OSM raster tile style (same as geo-canvas DEVELOPMENT style) */
const MAP_STYLE = {
  version: 8 as const,
  name: 'Geofence Map',
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm-raster',
      type: 'raster' as const,
      source: 'osm',
    },
  ],
};

/** GeoJSON circle fill style */
const CIRCLE_FILL_STYLE: FillLayerSpecification = {
  id: 'geofence-fill',
  type: 'fill',
  source: 'geofence-circle',
  paint: {
    'fill-color': '#3b82f6',
    'fill-opacity': 0.15,
  },
};

/** GeoJSON circle border style */
const CIRCLE_LINE_STYLE: LineLayerSpecification = {
  id: 'geofence-line',
  type: 'line',
  source: 'geofence-circle',
  paint: {
    'line-color': '#2563eb',
    'line-width': 2,
    'line-dasharray': [3, 2],
  },
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a GeoJSON polygon approximating a circle.
 * Uses Haversine-based bearing calculation for accurate meter-based radius.
 */
function generateCircleGeoJSON(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  points: number = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const EARTH_RADIUS = 6_371_008.8;
  const coords: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const latRad = (centerLat * Math.PI) / 180;
    const lngRad = (centerLng * Math.PI) / 180;
    const d = radiusMeters / EARTH_RADIUS;

    const newLat = Math.asin(
      Math.sin(latRad) * Math.cos(d) +
      Math.cos(latRad) * Math.sin(d) * Math.cos(angle)
    );
    const newLng = lngRad + Math.atan2(
      Math.sin(angle) * Math.sin(d) * Math.cos(latRad),
      Math.cos(d) - Math.sin(latRad) * Math.sin(newLat)
    );

    coords.push([
      (newLng * 180) / Math.PI,
      (newLat * 180) / Math.PI,
    ]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}

// =============================================================================
// MARKER PIN
// =============================================================================

function GeofenceMarkerPin() {
  return (
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="40" rx="6" ry="2" fill="rgba(0,0,0,0.2)" />
      <path
        d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z"
        fill="#dc2626"
        stroke="#fff"
        strokeWidth="1.5"
      />
      <circle cx="16" cy="15" r="6" fill="#fff" />
      <circle cx="16" cy="15" r="3" fill="#dc2626" />
    </svg>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function GeofenceConfigMap({ projectId }: GeofenceConfigMapProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();

  // Geofence state
  const [latitude, setLatitude] = useState(GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE);
  const [longitude, setLongitude] = useState(GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE);
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS);
  const [enabled, setEnabled] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // =========================================================================
  // LOAD EXISTING CONFIG
  // =========================================================================

  useEffect(() => {
    async function loadGeofence() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/attendance/geofence?projectId=${projectId}`);
        const data = (await res.json()) as GeofenceApiResponse;

        if (data.success && data.geofence) {
          setLatitude(data.geofence.latitude);
          setLongitude(data.geofence.longitude);
          setRadiusMeters(data.geofence.radiusMeters);
          setEnabled(data.geofence.enabled);
        }
      } catch {
        // Not configured yet — use defaults
      } finally {
        setIsLoading(false);
      }
    }

    loadGeofence();
  }, [projectId]);

  // =========================================================================
  // SAVE CONFIG
  // =========================================================================

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/attendance/geofence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          latitude,
          longitude,
          radiusMeters,
          enabled,
        }),
      });

      const data = (await res.json()) as GeofenceApiResponse;

      if (data.success) {
        setSaveSuccess(true);
        setHasChanges(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError(data.error ?? t('ika.attendance.geofence.saveError'));
      }
    } catch {
      setError(t('ika.attendance.geofence.networkError'));
    } finally {
      setIsSaving(false);
    }
  }, [projectId, latitude, longitude, radiusMeters, enabled, t]);

  // =========================================================================
  // MAP INTERACTION HANDLERS
  // =========================================================================

  const handleMapClick = useCallback((event: MapLayerMouseEvent) => {
    setLatitude(event.lngLat.lat);
    setLongitude(event.lngLat.lng);
    setHasChanges(true);
  }, []);

  const handleMarkerDragEnd = useCallback((event: { lngLat: { lat: number; lng: number } }) => {
    setLatitude(event.lngLat.lat);
    setLongitude(event.lngLat.lng);
    setHasChanges(true);
  }, []);

  // =========================================================================
  // COORDINATE INPUT HANDLERS
  // =========================================================================

  const handleLatChange = useCallback((value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= -90 && num <= 90) {
      setLatitude(num);
      setHasChanges(true);
    }
  }, []);

  const handleLngChange = useCallback((value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= -180 && num <= 180) {
      setLongitude(num);
      setHasChanges(true);
    }
  }, []);

  const handleRadiusSliderChange = useCallback((values: number[]) => {
    const value = values[0];
    if (value >= MIN_RADIUS && value <= MAX_RADIUS) {
      setRadiusMeters(value);
      setHasChanges(true);
    }
  }, []);

  // =========================================================================
  // GEOJSON CIRCLE (reactive)
  // =========================================================================

  const circleGeoJSON = useMemo(
    () => generateCircleGeoJSON(latitude, longitude, radiusMeters),
    [latitude, longitude, radiusMeters]
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CircleDot className={iconSizes.md} />
              {t('ika.attendance.geofence.title')}
            </CardTitle>
            <CardDescription>
              {t('ika.attendance.geofence.description')}
            </CardDescription>
          </div>
          <Button
            variant={enabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setEnabled(!enabled);
              setHasChanges(true);
            }}
          >
            {enabled
              ? t('ika.attendance.geofence.enabled')
              : t('ika.attendance.geofence.disabled')
            }
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className={iconSizes.sm} />
            {error}
          </div>
        )}

        {/* Save Success */}
        {saveSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Save className={iconSizes.sm} />
            {t('ika.attendance.geofence.saved')}
          </div>
        )}

        {/* Interactive Map */}
        <div className="relative overflow-hidden rounded-lg border border-slate-200">
          <Map
            initialViewState={{
              latitude,
              longitude,
              zoom: MAP_ZOOM,
            }}
            style={{ width: '100%', height: 320 }}
            mapStyle={MAP_STYLE}
            onClick={handleMapClick}
            cursor="crosshair"
            attributionControl={false}
          >
            {/* Geofence radius circle */}
            <Source id="geofence-circle" type="geojson" data={circleGeoJSON}>
              <Layer {...CIRCLE_FILL_STYLE} />
              <Layer {...CIRCLE_LINE_STYLE} />
            </Source>

            {/* Draggable center marker */}
            <Marker
              longitude={longitude}
              latitude={latitude}
              anchor="bottom"
              draggable
              onDragEnd={handleMarkerDragEnd}
            >
              <GeofenceMarkerPin />
            </Marker>
          </Map>

          {/* Coordinate overlay badge */}
          <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-slate-600 pointer-events-none">
            <MapPin className="h-3 w-3 inline mr-1" />
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
        </div>

        {/* Coordinate Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="geofence-lat" className="block text-xs font-medium text-slate-600 mb-1">
              {t('ika.attendance.geofence.latitude')}
            </label>
            <input
              id="geofence-lat"
              type="number"
              step="0.000001"
              min="-90"
              max="90"
              value={latitude}
              onChange={(e) => handleLatChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="geofence-lng" className="block text-xs font-medium text-slate-600 mb-1">
              {t('ika.attendance.geofence.longitude')}
            </label>
            <input
              id="geofence-lng"
              type="number"
              step="0.000001"
              min="-180"
              max="180"
              value={longitude}
              onChange={(e) => handleLngChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Radius Slider (Radix) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-600">
              {t('ika.attendance.geofence.radius')}
            </label>
            <span className="text-sm font-semibold text-slate-700">
              {radiusMeters}m
            </span>
          </div>
          <Slider
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            step={10}
            value={[radiusMeters]}
            onValueChange={handleRadiusSliderChange}
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{MIN_RADIUS}m</span>
            <span>{MAX_RADIUS}m</span>
          </div>
        </div>

        {/* Save / Reset Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLatitude(GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE);
              setLongitude(GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE);
              setRadiusMeters(DEFAULT_RADIUS);
              setHasChanges(true);
            }}
          >
            <RotateCcw className={cn(iconSizes.sm, 'mr-2')} />
            {t('ika.attendance.geofence.reset')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            size="sm"
          >
            {isSaving ? (
              <Loader2 className={cn(iconSizes.sm, 'mr-2 animate-spin')} />
            ) : (
              <Save className={cn(iconSizes.sm, 'mr-2')} />
            )}
            {t('ika.attendance.geofence.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
