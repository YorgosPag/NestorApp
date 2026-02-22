'use client';

/**
 * =============================================================================
 * LiveWorkerMap — Real-Time Worker Location Map Dashboard
 * =============================================================================
 *
 * Interactive map showing worker attendance markers in real-time.
 * Uses react-map-gl/maplibre (same infrastructure as GeofenceConfigMap).
 *
 * Features:
 * - Geofence circle overlay (read-only, from server config)
 * - Worker markers colored by status:
 *     Green  = checked-in, inside geofence
 *     Orange = checked-in, outside geofence
 *     Red    = checked-out
 * - Click marker → popup with name, time, distance
 * - Summary badges: "X inside", "Y outside"
 * - Toast alert when new event arrives outside geofence
 *
 * @module components/projects/ika/components/LiveWorkerMap
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Map, Marker, Popup, Source, Layer } from 'react-map-gl/maplibre';
import type { FillLayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MapPin,
  Radio,
  Loader2,
  Users,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import toast from 'react-hot-toast';
import type {
  AttendanceEvent,
  GeofenceConfig,
  ProjectWorker,
} from '../contracts';

// =============================================================================
// TYPES
// =============================================================================

interface LiveWorkerMapProps {
  /** Project ID for geofence fetch */
  projectId: string;
  /** Live attendance events (from useAttendanceLiveEvents) */
  events: AttendanceEvent[];
  /** Latest newly arrived event (for toast alerts) */
  latestEvent: AttendanceEvent | null;
  /** Whether the real-time listener is active */
  isLive: boolean;
  /** Workers linked to this project (for name resolution) */
  workers: ProjectWorker[];
}

/** Computed worker marker data */
interface WorkerMarkerData {
  contactId: string;
  name: string;
  lat: number;
  lng: number;
  status: 'inside' | 'outside' | 'checked_out';
  lastEventType: string;
  lastEventTime: string;
  distanceMeters: number | null;
}

interface GeofenceApiResponse {
  success: boolean;
  geofence: GeofenceConfig | null;
  error?: string;
}

/** Worker selected for popup display */
interface SelectedWorker {
  contactId: string;
  lat: number;
  lng: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAP_ZOOM = 15;

/** OSM raster tile style */
const MAP_STYLE = {
  version: 8 as const,
  name: 'Live Worker Map',
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

/** GeoJSON circle fill style (read-only geofence) */
const GEOFENCE_FILL_STYLE: FillLayerSpecification = {
  id: 'live-geofence-fill',
  type: 'fill',
  source: 'live-geofence-circle',
  paint: {
    'fill-color': '#3b82f6',
    'fill-opacity': 0.08,
  },
};

/** GeoJSON circle border style */
const GEOFENCE_LINE_STYLE: LineLayerSpecification = {
  id: 'live-geofence-line',
  type: 'line',
  source: 'live-geofence-circle',
  paint: {
    'line-color': '#2563eb',
    'line-width': 2,
    'line-dasharray': [4, 3],
  },
};

/** Earth's mean radius in meters (WGS-84) */
const EARTH_RADIUS_METERS = 6_371_008.8;

// =============================================================================
// HELPERS
// =============================================================================

/** Haversine distance between two GPS points (client-side, same formula as geofence-service) */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Generate GeoJSON polygon approximating a circle (Haversine-accurate) */
function generateCircleGeoJSON(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  points: number = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const latRad = (centerLat * Math.PI) / 180;
    const lngRad = (centerLng * Math.PI) / 180;
    const d = radiusMeters / EARTH_RADIUS_METERS;

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
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

/** Format ISO timestamp to HH:mm */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
}

/** Translate event type to Greek display label */
function eventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    check_in: 'Προσέλευση',
    check_out: 'Αποχώρηση',
    break_start: 'Διάλειμμα',
    break_end: 'Επιστροφή',
    left_site: 'Αποχώρηση',
    returned: 'Επιστροφή',
  };
  return labels[eventType] ?? eventType;
}

// =============================================================================
// MARKER PIN SVG COMPONENTS
// =============================================================================

function WorkerPin({ color }: { color: string }) {
  return (
    <svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="30" rx="5" ry="2" fill="rgba(0,0,0,0.15)" />
      <path
        d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z"
        fill={color}
        stroke="#fff"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="11" r="5" fill="#fff" fillOpacity="0.9" />
      <circle cx="12" cy="11" r="2.5" fill={color} />
    </svg>
  );
}

// =============================================================================
// STATUS COLORS
// =============================================================================

const STATUS_COLORS = {
  inside: '#16a34a',   // green-600
  outside: '#ea580c',  // orange-600
  checked_out: '#dc2626', // red-600
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function LiveWorkerMap({
  projectId,
  events,
  latestEvent,
  isLive,
  workers,
}: LiveWorkerMapProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();

  // Geofence config (loaded from server)
  const [geofence, setGeofence] = useState<GeofenceConfig | null>(null);
  const [geofenceLoading, setGeofenceLoading] = useState(true);

  // Popup state
  const [selectedWorker, setSelectedWorker] = useState<SelectedWorker | null>(null);

  // Track previous latestEvent to avoid duplicate toasts
  const prevLatestEventIdRef = useRef<string | null>(null);

  // =========================================================================
  // LOAD GEOFENCE CONFIG
  // =========================================================================

  useEffect(() => {
    async function loadGeofence() {
      try {
        setGeofenceLoading(true);
        const res = await fetch(`/api/attendance/geofence?projectId=${projectId}`);
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

  // =========================================================================
  // WORKER NAME LOOKUP
  // =========================================================================

  const workerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workers) {
      map.set(w.contactId, w.name);
    }
    return map;
  }, [workers]);

  // =========================================================================
  // COMPUTE WORKER MARKERS (latest event per worker)
  // =========================================================================

  const workerMarkers = useMemo((): WorkerMarkerData[] => {
    // Group events by contactId, keep latest
    const latestPerWorker = new Map<string, AttendanceEvent>();

    for (const event of events) {
      const existing = latestPerWorker.get(event.contactId);
      if (!existing || event.timestamp > existing.timestamp) {
        latestPerWorker.set(event.contactId, event);
      }
    }

    const markers: WorkerMarkerData[] = [];

    for (const [contactId, event] of latestPerWorker) {
      // Only show markers for events with coordinates
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

  // =========================================================================
  // SUMMARY COUNTS
  // =========================================================================

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

  // =========================================================================
  // TOAST ALERT — new event outside geofence
  // =========================================================================

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
      toast.error(
        `${name}: ${eventTypeLabel(latestEvent.eventType)} ${t('ika.attendance.liveMap.outsideAlert')} (${Math.round(distance)}m)`,
        { duration: 6000 }
      );
    }
  }, [latestEvent, geofence, workerNameMap, t]);

  // =========================================================================
  // MAP CENTER
  // =========================================================================

  const mapCenter = useMemo(() => {
    if (geofence) {
      return { latitude: geofence.latitude, longitude: geofence.longitude };
    }
    // Fallback: first worker with coordinates, or default
    const firstWithCoords = workerMarkers.find((m) => m.lat && m.lng);
    if (firstWithCoords) {
      return { latitude: firstWithCoords.lat, longitude: firstWithCoords.lng };
    }
    return {
      latitude: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
      longitude: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE,
    };
  }, [geofence, workerMarkers]);

  // =========================================================================
  // GEOFENCE GEOJSON
  // =========================================================================

  const circleGeoJSON = useMemo(() => {
    if (!geofence || !geofence.enabled) return null;
    return generateCircleGeoJSON(geofence.latitude, geofence.longitude, geofence.radiusMeters);
  }, [geofence]);

  // =========================================================================
  // POPUP CLOSE
  // =========================================================================

  const handleClosePopup = useCallback(() => {
    setSelectedWorker(null);
  }, []);

  // =========================================================================
  // FIND SELECTED MARKER DATA
  // =========================================================================

  const selectedMarkerData = useMemo(() => {
    if (!selectedWorker) return null;
    return workerMarkers.find((m) => m.contactId === selectedWorker.contactId) ?? null;
  }, [selectedWorker, workerMarkers]);

  // =========================================================================
  // RENDER
  // =========================================================================

  if (geofenceLoading) {
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
              <MapPin className={iconSizes.md} />
              {t('ika.attendance.liveMap.title')}
            </CardTitle>
            <CardDescription>
              {t('ika.attendance.liveMap.description')}
            </CardDescription>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2">
            {isLive && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <Radio className="h-3 w-3 mr-1 animate-pulse" />
                LIVE
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Summary Badges */}
        {workerMarkers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-green-700 bg-green-50">
              <Users className="h-3 w-3 mr-1" />
              {insideCount} {t('ika.attendance.liveMap.inside')}
            </Badge>
            {outsideCount > 0 && (
              <Badge variant="secondary" className="text-orange-700 bg-orange-50">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {outsideCount} {t('ika.attendance.liveMap.outside')}
              </Badge>
            )}
            {checkedOutCount > 0 && (
              <Badge variant="secondary" className="text-red-700 bg-red-50">
                <Clock className="h-3 w-3 mr-1" />
                {checkedOutCount} {t('ika.attendance.liveMap.checkedOut')}
              </Badge>
            )}
          </div>
        )}

        {/* Map */}
        <div className="relative overflow-hidden rounded-lg border border-slate-200">
          <Map
            initialViewState={{
              latitude: mapCenter.latitude,
              longitude: mapCenter.longitude,
              zoom: MAP_ZOOM,
            }}
            style={{ width: '100%', height: 380 }}
            mapStyle={MAP_STYLE}
            attributionControl={false}
          >
            {/* Geofence circle overlay (read-only) */}
            {circleGeoJSON && (
              <Source id="live-geofence-circle" type="geojson" data={circleGeoJSON}>
                <Layer {...GEOFENCE_FILL_STYLE} />
                <Layer {...GEOFENCE_LINE_STYLE} />
              </Source>
            )}

            {/* Worker markers */}
            {workerMarkers.map((marker) => (
              <Marker
                key={marker.contactId}
                longitude={marker.lng}
                latitude={marker.lat}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedWorker({
                    contactId: marker.contactId,
                    lat: marker.lat,
                    lng: marker.lng,
                  });
                }}
              >
                <WorkerPin color={STATUS_COLORS[marker.status]} />
              </Marker>
            ))}

            {/* Popup */}
            {selectedWorker && selectedMarkerData && (
              <Popup
                longitude={selectedWorker.lng}
                latitude={selectedWorker.lat}
                anchor="bottom"
                offset={[0, -32]}
                onClose={handleClosePopup}
                closeOnClick={false}
              >
                <article className="min-w-[180px]">
                  <h4 className="font-semibold text-sm text-slate-800">
                    {selectedMarkerData.name}
                  </h4>
                  <dl className="mt-1 space-y-0.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <dt>{t('ika.attendance.liveMap.popupEvent')}:</dt>
                      <dd className="font-medium">
                        {eventTypeLabel(selectedMarkerData.lastEventType)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>{t('ika.attendance.liveMap.popupTime')}:</dt>
                      <dd className="font-medium">
                        {formatTime(selectedMarkerData.lastEventTime)}
                      </dd>
                    </div>
                    {selectedMarkerData.distanceMeters !== null && (
                      <div className="flex justify-between">
                        <dt>{t('ika.attendance.liveMap.popupDistance')}:</dt>
                        <dd className={cn(
                          'font-medium',
                          selectedMarkerData.status === 'inside' ? 'text-green-600' : 'text-orange-600'
                        )}>
                          {selectedMarkerData.distanceMeters}m
                        </dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs',
                        selectedMarkerData.status === 'inside' && 'text-green-700 bg-green-50',
                        selectedMarkerData.status === 'outside' && 'text-orange-700 bg-orange-50',
                        selectedMarkerData.status === 'checked_out' && 'text-red-700 bg-red-50',
                      )}
                    >
                      {selectedMarkerData.status === 'inside' && t('ika.attendance.liveMap.statusInside')}
                      {selectedMarkerData.status === 'outside' && t('ika.attendance.liveMap.statusOutside')}
                      {selectedMarkerData.status === 'checked_out' && t('ika.attendance.liveMap.statusCheckedOut')}
                    </Badge>
                  </div>
                </article>
              </Popup>
            )}
          </Map>

          {/* No events overlay */}
          {workerMarkers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm pointer-events-none">
              <p className="text-sm text-muted-foreground">
                {t('ika.attendance.liveMap.noEvents')}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
