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

import React from 'react';
import { Map, Marker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MapPin,
  Save,
  AlertCircle,
  CircleDot,
  RotateCcw,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import { OSM_MAP_STYLE, MAP_ZOOM, createGeofenceLayerStyles } from '../map-shared';
import { GeofenceMarkerPin } from './GeofenceMarkerPin';
import { useGeofenceConfig, MIN_RADIUS, MAX_RADIUS } from '../hooks/useGeofenceConfig';

// =============================================================================
// CONSTANTS
// =============================================================================

const GEOFENCE_SOURCE_ID = 'geofence-circle';
const { fill: CIRCLE_FILL, line: CIRCLE_LINE } = createGeofenceLayerStyles(
  GEOFENCE_SOURCE_ID,
  'geofence'
);

// =============================================================================
// PROPS
// =============================================================================

interface GeofenceConfigMapProps {
  projectId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function GeofenceConfigMap({ projectId }: GeofenceConfigMapProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const typography = useTypography();

  const {
    latitude,
    longitude,
    radiusMeters,
    enabled,
    isLoading,
    isSaving,
    error,
    saveSuccess,
    hasChanges,
    circleGeoJSON,
    handleSave,
    handleMapClick,
    handleMarkerDragEnd,
    handleLatChange,
    handleLngChange,
    handleRadiusSliderChange,
    handleReset,
    handleToggleEnabled,
  } = useGeofenceConfig(projectId, t);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner size="large" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className={cn(typography.card.title, 'flex items-center gap-2')}>
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
            onClick={handleToggleEnabled}
          >
            {enabled
              ? t('ika.attendance.geofence.enabled')
              : t('ika.attendance.geofence.disabled')
            }
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Error */}
        {error && (
          <div className={cn("flex items-center gap-2", typography.body.sm, getStatusColor('error', 'text'))}>
            <AlertCircle className={iconSizes.sm} />
            {error}
          </div>
        )}

        {/* Save Success */}
        {saveSuccess && (
          <div className={cn("flex items-center gap-2", typography.body.sm, getStatusColor('active', 'text'))}>
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
            mapStyle={OSM_MAP_STYLE}
            onClick={handleMapClick}
            cursor="crosshair"
            attributionControl={false}
          >
            <Source id={GEOFENCE_SOURCE_ID} type="geojson" data={circleGeoJSON}>
              <Layer {...CIRCLE_FILL} />
              <Layer {...CIRCLE_LINE} />
            </Source>

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

          <div className={cn("absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded pointer-events-none", typography.body.xs, 'text-slate-600')}>
            <MapPin className="h-3 w-3 inline mr-1" />
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
        </div>

        {/* Coordinate Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="geofence-lat" className={cn('block mb-1', typography.label.xs, 'text-slate-600')}>
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
              className={cn('w-full px-2 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500', typography.body.sm)}
            />
          </div>
          <div>
            <label htmlFor="geofence-lng" className={cn('block mb-1', typography.label.xs, 'text-slate-600')}>
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
              className={cn('w-full px-2 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500', typography.body.sm)}
            />
          </div>
        </div>

        {/* Radius Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={cn(typography.label.xs, 'text-slate-600')}>
              {t('ika.attendance.geofence.radius')}
            </label>
            <span className={cn(typography.heading.sm, 'text-slate-700')}>
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
          <div className={cn("flex justify-between mt-1", typography.body.xs, 'text-slate-400')}>
            <span>{MIN_RADIUS}m</span>
            <span>{MAX_RADIUS}m</span>
          </div>
        </div>

        {/* Save / Reset Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className={cn(iconSizes.sm, 'mr-2')} />
            {t('ika.attendance.geofence.reset')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="sm">
            {isSaving ? (
              <Spinner size="small" color="inherit" className="mr-2" />
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
