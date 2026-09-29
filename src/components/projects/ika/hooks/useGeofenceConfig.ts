/**
 * =============================================================================
 * useGeofenceConfig — State & Handlers for Geofence Configuration
 * =============================================================================
 *
 * Manages the geofence DRAFT (center, radius, enabled) and provides save/reset/interaction
 * handlers. The SAVED config is read from — and published to — `project-geofence-store`,
 * the single source shared with LiveWorkerMap (ADR-891 §10.3).
 *
 * @module components/projects/ika/hooks/useGeofenceConfig
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { generateCircleGeoJSON } from '../map-shared/geo-math';
import { publishProjectGeofence, useProjectGeofence } from '../map-shared/project-geofence-store';
import { saveGeofenceConfigWithPolicy } from '@/services/ika/ika-mutation-gateway';
import type { CoordinatePoint } from '@/utils/address/address-list-center';

// =============================================================================
// CONSTANTS
// =============================================================================

export const MIN_RADIUS = 50;
export const MAX_RADIUS = 500;
export const DEFAULT_RADIUS = 200;

// =============================================================================
// HOOK
// =============================================================================

/**
 * @param siteCenter - Το σημείο του εργοταξίου (`addressListCenter` των διευθύνσεων του έργου).
 *   Είναι ο σπόρος όταν δεν υπάρχει αποθηκευμένη ζώνη, και ο στόχος της «Επαναφοράς»· η Αθήνα
 *   του `GEOGRAPHIC_CONFIG` μένει **μόνο** για έργο χωρίς καμία θέση (ADR-891 §10.3).
 */
export function useGeofenceConfig(
  projectId: string,
  t: (key: string) => string,
  siteCenter?: CoordinatePoint,
) {
  // Η ΑΠΟΘΗΚΕΥΜΕΝΗ ζώνη ζει στο κατάστημα (ΜΙΑ αλήθεια με τον LiveWorkerMap)· εδώ ζει μόνο το ΠΡΟΧΕΙΡΟ.
  const { geofence: saved, hasLoaded } = useProjectGeofence(projectId);
  const seedLat = siteCenter?.lat ?? GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE;
  const seedLng = siteCenter?.lng ?? GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE;

  const [latitude, setLatitude] = useState(saved?.latitude ?? seedLat);
  const [longitude, setLongitude] = useState(saved?.longitude ?? seedLng);
  const [radiusMeters, setRadiusMeters] = useState(saved?.radiusMeters ?? DEFAULT_RADIUS);
  const [enabled, setEnabled] = useState(saved?.enabled ?? false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // ---------------------------------------------------------------------------
  // SYNC DRAFT ← SAVED (μόνο όταν ο άνθρωπος δεν έχει αναποθήκευτες αλλαγές)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!hasLoaded || hasChanges) return;
    setLatitude(saved?.latitude ?? seedLat);
    setLongitude(saved?.longitude ?? seedLng);
    setRadiusMeters(saved?.radiusMeters ?? DEFAULT_RADIUS);
    setEnabled(saved?.enabled ?? false);
  }, [saved, hasLoaded, hasChanges, seedLat, seedLng]);

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
        // Η απάντηση του διακομιστή γίνεται η αλήθεια για ΚΑΘΕ αναγνώστη (LiveWorkerMap στην ίδια οθόνη).
        if (data.geofence) publishProjectGeofence(projectId, data.geofence);
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
    setLatitude(seedLat);
    setLongitude(seedLng);
    setRadiusMeters(DEFAULT_RADIUS);
    setHasChanges(true);
  }, [seedLat, seedLng]);

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
    isLoading: !hasLoaded,
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
