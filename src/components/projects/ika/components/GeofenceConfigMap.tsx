'use client';

/**
 * =============================================================================
 * GeofenceConfigMap — Admin Geofence Configuration with Map
 * =============================================================================
 *
 * Map component for configuring the geofence (center + radius) for a project.
 * Uses react-map-gl/maplibre with circle overlay visualization.
 *
 * Features:
 * - Map with draggable center marker (click to set)
 * - Radius slider (50-500m)
 * - Visual circle overlay
 * - Auto-populate from project primary address
 * - Save to server → POST /api/attendance/geofence
 *
 * @module components/projects/ika/components/GeofenceConfigMap
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
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

/** Default center: Thessaloniki, Greece */
const DEFAULT_CENTER = { lat: 40.6401, lng: 22.9444 };

// =============================================================================
// COMPONENT
// =============================================================================

export function GeofenceConfigMap({ projectId }: GeofenceConfigMapProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();

  // Geofence state
  const [latitude, setLatitude] = useState(DEFAULT_CENTER.lat);
  const [longitude, setLongitude] = useState(DEFAULT_CENTER.lng);
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

  const handleRadiusChange = useCallback((value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= MIN_RADIUS && num <= MAX_RADIUS) {
      setRadiusMeters(num);
      setHasChanges(true);
    }
  }, []);

  // =========================================================================
  // MAP URL (static map image as fallback)
  // =========================================================================

  const mapPreviewUrl = useMemo(() => {
    // OpenStreetMap embed URL for preview
    return `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.005},${latitude - 0.004},${longitude + 0.005},${latitude + 0.004}&layer=mapnik&marker=${latitude},${longitude}`;
  }, [latitude, longitude]);

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
          <div className="flex items-center gap-2">
            {/* Enable/Disable Toggle */}
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

        {/* Map Preview */}
        <div className="relative overflow-hidden rounded-lg border border-slate-200">
          <iframe
            src={mapPreviewUrl}
            title="Geofence Map"
            className="w-full h-64 border-0"
            loading="lazy"
          />
          <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 rounded text-xs text-slate-600">
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

        {/* Radius Slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="geofence-radius" className="text-xs font-medium text-slate-600">
              {t('ika.attendance.geofence.radius')}
            </label>
            <span className="text-sm font-semibold text-slate-700">
              {radiusMeters}m
            </span>
          </div>
          <input
            id="geofence-radius"
            type="range"
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            step={10}
            value={radiusMeters}
            onChange={(e) => handleRadiusChange(e.target.value)}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-0.5">
            <span>{MIN_RADIUS}m</span>
            <span>{MAX_RADIUS}m</span>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLatitude(DEFAULT_CENTER.lat);
              setLongitude(DEFAULT_CENTER.lng);
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
