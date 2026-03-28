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

  // ---------------------------------------------------------------------------
  // LOAD EXISTING CONFIG
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadGeofence() {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_ROUTES.ATTENDANCE.GEOFENCE}?projectId=${projectId}`);
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

  // ---------------------------------------------------------------------------
  // SAVE CONFIG
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(API_ROUTES.ATTENDANCE.GEOFENCE, {
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
