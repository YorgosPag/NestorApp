/**
 * =============================================================================
 * useGeofenceConfig — State & Handlers for Geofence Configuration
 * =============================================================================
 *
 * Manages geofence state (center, radius, enabled), loads existing config
 * from the API, and provides save/reset/interaction handlers.
 *
 * @module components/projects/ika/hooks/useGeofenceConfig
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { generateCircleGeoJSON } from '../map-shared/geo-math';
import type { GeofenceApiResponse } from '../map-shared/geofence-api-types';
import { saveGeofenceConfigWithPolicy } from '@/services/ika/ika-mutation-gateway';
import { createStaleCache } from '@/lib/stale-cache';

interface GeofenceCachedConfig {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  enabled: boolean;
}

const geofenceConfigCache = createStaleCache<GeofenceCachedConfig>('geofence-config');

// =============================================================================
// CONSTANTS
// =============================================================================

export const MIN_RADIUS = 50;
export const MAX_RADIUS = 500;
export const DEFAULT_RADIUS = 200;

// =============================================================================
// HOOK
// =============================================================================

export function useGeofenceConfig(projectId: string, t: (key: string) => string) {
  const _cachedGeofence = geofenceConfigCache.get(projectId);

  // Geofence state — seeded from cache on re-navigation
  const [latitude, setLatitude] = useState(_cachedGeofence?.latitude ?? GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE);
  const [longitude, setLongitude] = useState(_cachedGeofence?.longitude ?? GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE);
  const [radiusMeters, setRadiusMeters] = useState(_cachedGeofence?.radiusMeters ?? DEFAULT_RADIUS);
  const [enabled, setEnabled] = useState(_cachedGeofence?.enabled ?? false);

  // UI state
  const [isLoading, setIsLoading] = useState(!geofenceConfigCache.hasLoaded(projectId));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // ---------------------------------------------------------------------------
  // LOAD EXISTING CONFIG
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadGeofence() {
      try {
        if (!geofenceConfigCache.hasLoaded(projectId)) setIsLoading(true);
        const res = await fetch(`${API_ROUTES.ATTENDANCE.GEOFENCE}?projectId=${projectId}`);
        const data = (await res.json()) as GeofenceApiResponse;

        if (data.success && data.geofence) {
          setLatitude(data.geofence.latitude);
          setLongitude(data.geofence.longitude);
          setRadiusMeters(data.geofence.radiusMeters);
          setEnabled(data.geofence.enabled);
          geofenceConfigCache.set({
            latitude: data.geofence.latitude,
            longitude: data.geofence.longitude,
            radiusMeters: data.geofence.radiusMeters,
            enabled: data.geofence.enabled,
          }, projectId);
        } else {
          // No config yet — mark as loaded with defaults
          geofenceConfigCache.set({
            latitude: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
            longitude: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE,
            radiusMeters: DEFAULT_RADIUS,
            enabled: false,
          }, projectId);
        }
      } catch {
        // Not configured yet — use defaults
      } finally {
        setIsLoading(false);
      }
    }

    loadGeofence();
  }, [projectId]);

  // ---------------------------------------------------------------------------
  // SAVE CONFIG
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const data = await saveGeofenceConfigWithPolicy({
        projectId,
        latitude,
        longitude,
        radiusMeters,
        enabled,
      });

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

  // ---------------------------------------------------------------------------
  // MAP INTERACTION HANDLERS
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // COORDINATE INPUT HANDLERS
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // RESET
  // ---------------------------------------------------------------------------

  const handleReset = useCallback(() => {
    setLatitude(GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE);
    setLongitude(GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE);
    setRadiusMeters(DEFAULT_RADIUS);
    setHasChanges(true);
  }, []);

  // ---------------------------------------------------------------------------
  // TOGGLE ENABLED
  // ---------------------------------------------------------------------------

  const handleToggleEnabled = useCallback(() => {
    setEnabled(prev => !prev);
    setHasChanges(true);
  }, []);

  // ---------------------------------------------------------------------------
  // GEOJSON CIRCLE (reactive memo)
  // ---------------------------------------------------------------------------

  const circleGeoJSON = useMemo(
    () => generateCircleGeoJSON(latitude, longitude, radiusMeters),
    [latitude, longitude, radiusMeters]
  );

  return {
    // State
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

    // Handlers
    handleSave,
    handleMapClick,
    handleMarkerDragEnd,
    handleLatChange,
    handleLngChange,
    handleRadiusSliderChange,
    handleReset,
    handleToggleEnabled,
  };
}
