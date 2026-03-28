/**
 * =============================================================================
 * useLiveWorkerMap — State & Computation for Live Worker Map
 * =============================================================================
 *
 * Manages geofence loading, worker marker computation, summary counts,
 * toast alerts for out-of-bounds events, and popup state.
 *
 * @module components/projects/ika/hooks/useLiveWorkerMap
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useNotifications } from '@/providers/NotificationProvider';
import { haversineDistance, generateCircleGeoJSON } from '../map-shared/geo-math';
import type { GeofenceApiResponse } from '../map-shared/geofence-api-types';
import { eventTypeLabel } from '../components/live-worker-helpers';
import type {
  AttendanceEvent,
  GeofenceConfig,
  ProjectWorker,
} from '../contracts';

// =============================================================================
// TYPES
// =============================================================================

export interface WorkerMarkerData {
  contactId: string;
  name: string;
  lat: number;
  lng: number;
  status: 'inside' | 'outside' | 'checked_out';
  lastEventType: string;
  lastEventTime: string;
  distanceMeters: number | null;
}

export interface SelectedWorker {
  contactId: string;
  lat: number;
  lng: number;
}

// =============================================================================
// HOOK
// =============================================================================

export function useLiveWorkerMap(
  projectId: string,
  events: AttendanceEvent[],
  latestEvent: AttendanceEvent | null,
  workers: ProjectWorker[],
  t: (key: string) => string
) {
  // Geofence config (loaded from server)
  const [geofence, setGeofence] = useState<GeofenceConfig | null>(null);
  const [geofenceLoading, setGeofenceLoading] = useState(true);

  // Popup state
  const [selectedWorker, setSelectedWorker] = useState<SelectedWorker | null>(null);

  // Track previous latestEvent to avoid duplicate toasts
  const prevLatestEventIdRef = useRef<string | null>(null);
  const { error: showError } = useNotifications();

  // ---------------------------------------------------------------------------
  // LOAD GEOFENCE CONFIG
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadGeofence() {
      try {
        setGeofenceLoading(true);
        const res = await fetch(`${API_ROUTES.ATTENDANCE.GEOFENCE}?projectId=${projectId}`);
        const data = (await res.json()) as GeofenceApiResponse;
        if (data.success && data.geofence) {
          setGeofence(data.geofence);
        }
      } catch {
        // Geofence not configured — map still works without it
      } finally {
        setGeofenceLoading(false);
      }
    }

    loadGeofence();
  }, [projectId]);

  // ---------------------------------------------------------------------------
  // WORKER NAME LOOKUP
  // ---------------------------------------------------------------------------

  const workerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workers) {
      map.set(w.contactId, w.name);
    }
    return map;
  }, [workers]);

  // ---------------------------------------------------------------------------
  // COMPUTE WORKER MARKERS (latest event per worker)
  // ---------------------------------------------------------------------------

  const workerMarkers = useMemo((): WorkerMarkerData[] => {
    const latestPerWorker = new Map<string, AttendanceEvent>();

    for (const event of events) {
      const existing = latestPerWorker.get(event.contactId);
      if (!existing || event.timestamp > existing.timestamp) {
        latestPerWorker.set(event.contactId, event);
      }
    }

    const markers: WorkerMarkerData[] = [];

    for (const [contactId, event] of latestPerWorker) {
      if (!event.coordinates) continue;

      const isCheckedOut = event.eventType === 'check_out';

      let distanceMeters: number | null = null;
      let isInside = true;

      if (geofence && geofence.enabled) {
        distanceMeters = Math.round(
          haversineDistance(
            event.coordinates.lat,
            event.coordinates.lng,
            geofence.latitude,
            geofence.longitude
          )
        );
        isInside = distanceMeters <= geofence.radiusMeters;
      }

      const status: WorkerMarkerData['status'] = isCheckedOut
        ? 'checked_out'
        : isInside
          ? 'inside'
          : 'outside';

      markers.push({
        contactId,
        name: workerNameMap.get(contactId) ?? contactId,
        lat: event.coordinates.lat,
        lng: event.coordinates.lng,
        status,
        lastEventType: event.eventType,
        lastEventTime: event.timestamp,
        distanceMeters,
      });
    }

    return markers;
  }, [events, geofence, workerNameMap]);

  // ---------------------------------------------------------------------------
  // SUMMARY COUNTS
  // ---------------------------------------------------------------------------

  const { insideCount, outsideCount, checkedOutCount } = useMemo(() => {
    let inside = 0;
    let outside = 0;
    let checkedOut = 0;

    for (const m of workerMarkers) {
      if (m.status === 'inside') inside++;
      else if (m.status === 'outside') outside++;
      else checkedOut++;
    }

    return { insideCount: inside, outsideCount: outside, checkedOutCount: checkedOut };
  }, [workerMarkers]);

  // ---------------------------------------------------------------------------
  // TOAST ALERT — new event outside geofence
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!latestEvent || !geofence || !geofence.enabled) return;
    if (latestEvent.id === prevLatestEventIdRef.current) return;

    prevLatestEventIdRef.current = latestEvent.id;

    if (!latestEvent.coordinates) return;

    const distance = haversineDistance(
      latestEvent.coordinates.lat,
      latestEvent.coordinates.lng,
      geofence.latitude,
      geofence.longitude
    );

    if (distance > geofence.radiusMeters) {
      const name = workerNameMap.get(latestEvent.contactId) ?? latestEvent.contactId;
      showError(
        `${name}: ${eventTypeLabel(latestEvent.eventType, t)} ${t('ika.attendance.liveMap.outsideAlert')} (${Math.round(distance)}m)`
      );
    }
  }, [latestEvent, geofence, workerNameMap, t, showError]);

  // ---------------------------------------------------------------------------
  // MAP CENTER
  // ---------------------------------------------------------------------------

  const mapCenter = useMemo(() => {
    if (geofence) {
      return { latitude: geofence.latitude, longitude: geofence.longitude };
    }
    const firstWithCoords = workerMarkers.find((m) => m.lat && m.lng);
    if (firstWithCoords) {
      return { latitude: firstWithCoords.lat, longitude: firstWithCoords.lng };
    }
    return {
      latitude: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
      longitude: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE,
    };
  }, [geofence, workerMarkers]);

  // ---------------------------------------------------------------------------
  // GEOFENCE GEOJSON
  // ---------------------------------------------------------------------------

  const circleGeoJSON = useMemo(() => {
    if (!geofence || !geofence.enabled) return null;
    return generateCircleGeoJSON(geofence.latitude, geofence.longitude, geofence.radiusMeters);
  }, [geofence]);

  // ---------------------------------------------------------------------------
  // POPUP
  // ---------------------------------------------------------------------------

  const handleClosePopup = useCallback(() => {
    setSelectedWorker(null);
  }, []);

  const selectedMarkerData = useMemo(() => {
    if (!selectedWorker) return null;
    return workerMarkers.find((m) => m.contactId === selectedWorker.contactId) ?? null;
  }, [selectedWorker, workerMarkers]);

  return {
    geofenceLoading,
    workerMarkers,
    insideCount,
    outsideCount,
    checkedOutCount,
    mapCenter,
    circleGeoJSON,
    selectedWorker,
    setSelectedWorker,
    selectedMarkerData,
    handleClosePopup,
  };
}
