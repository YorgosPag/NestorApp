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
 * - Worker markers colored by status (green/orange/red)
 * - Click marker → popup with name, time, distance
 * - Summary badges: "X inside", "Y outside"
 * - Toast alert when new event arrives outside geofence
 *
 * @module components/projects/ika/components/LiveWorkerMap
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import React from 'react';
import { Map as MapGL, Marker, Popup, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MapPin,
  Radio,
  Users,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import { OSM_MAP_STYLE, MAP_ZOOM, createGeofenceLayerStyles } from '../map-shared';
import { WorkerPin, WORKER_STATUS_COLORS } from './WorkerPin';
import { formatTime, eventTypeLabel } from './live-worker-helpers';
import { useLiveWorkerMap } from '../hooks/useLiveWorkerMap';
import type { AttendanceEvent, ProjectWorker } from '../contracts';

// =============================================================================
// CONSTANTS
// =============================================================================

const LIVE_SOURCE_ID = 'live-geofence-circle';
const { fill: GEOFENCE_FILL, line: GEOFENCE_LINE } = createGeofenceLayerStyles(
  LIVE_SOURCE_ID,
  'live-geofence',
  { fillOpacity: 0.08, lineDashArray: [4, 3] }
);

// =============================================================================
// PROPS
// =============================================================================

interface LiveWorkerMapProps {
  projectId: string;
  events: AttendanceEvent[];
  latestEvent: AttendanceEvent | null;
  isLive: boolean;
  workers: ProjectWorker[];
}

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
  const typography = useTypography();

  const {
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
  } = useLiveWorkerMap(projectId, events, latestEvent, workers, t);

  if (geofenceLoading) {
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
              <MapPin className={iconSizes.md} />
              {t('ika.attendance.liveMap.title')}
            </CardTitle>
            <CardDescription>
              {t('ika.attendance.liveMap.description')}
            </CardDescription>
          </div>

          {isLive && (
            <Badge variant="outline" className={cn(getStatusColor('active', 'text'), getStatusColor('active', 'border'))}>
              <Radio className="h-3 w-3 mr-1 animate-pulse" />
              {t('ika.attendance.eventTypes.live')}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Summary Badges */}
        {workerMarkers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className={cn(getStatusColor('active', 'text'), getStatusColor('active', 'bg'), 'bg-opacity-10')}>
              <Users className="h-3 w-3 mr-1" />
              {insideCount} {t('ika.attendance.liveMap.inside')}
            </Badge>
            {outsideCount > 0 && (
              <Badge variant="secondary" className={cn(getStatusColor('construction', 'text'), getStatusColor('construction', 'bg'), 'bg-opacity-10')}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                {outsideCount} {t('ika.attendance.liveMap.outside')}
              </Badge>
            )}
            {checkedOutCount > 0 && (
              <Badge variant="secondary" className={cn(getStatusColor('error', 'text'), getStatusColor('error', 'bg'), 'bg-opacity-10')}>
                <Clock className="h-3 w-3 mr-1" />
                {checkedOutCount} {t('ika.attendance.liveMap.checkedOut')}
              </Badge>
            )}
          </div>
        )}

        {/* Map */}
        <div className="relative overflow-hidden rounded-lg border border-slate-200">
          <MapGL
            initialViewState={{
              latitude: mapCenter.latitude,
              longitude: mapCenter.longitude,
              zoom: MAP_ZOOM,
            }}
            style={{ width: '100%', height: 380 }}
            mapStyle={OSM_MAP_STYLE}
            attributionControl={false}
          >
            {/* Geofence circle overlay (read-only) */}
            {circleGeoJSON && (
              <Source id={LIVE_SOURCE_ID} type="geojson" data={circleGeoJSON}>
                <Layer {...GEOFENCE_FILL} />
                <Layer {...GEOFENCE_LINE} />
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
                <WorkerPin color={WORKER_STATUS_COLORS[marker.status]} />
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
                  <h4 className={cn(typography.heading.sm, 'text-slate-800')}>
                    {selectedMarkerData.name}
                  </h4>
                  <dl className={cn('mt-1 space-y-0.5', typography.body.xs, 'text-slate-600')}>
                    <div className="flex justify-between">
                      <dt>{t('ika.attendance.liveMap.popupEvent')}:</dt>
                      <dd className={typography.label.xs}>
                        {eventTypeLabel(selectedMarkerData.lastEventType, t)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>{t('ika.attendance.liveMap.popupTime')}:</dt>
                      <dd className={typography.label.xs}>
                        {formatTime(selectedMarkerData.lastEventTime)}
                      </dd>
                    </div>
                    {selectedMarkerData.distanceMeters !== null && (
                      <div className="flex justify-between">
                        <dt>{t('ika.attendance.liveMap.popupDistance')}:</dt>
                        <dd className={cn(
                          typography.label.xs,
                          selectedMarkerData.status === 'inside' ? getStatusColor('active', 'text') : getStatusColor('construction', 'text')
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
                        typography.body.xs,
                        selectedMarkerData.status === 'inside' && cn(getStatusColor('active', 'text'), getStatusColor('active', 'bg'), 'bg-opacity-10'),
                        selectedMarkerData.status === 'outside' && cn(getStatusColor('construction', 'text'), getStatusColor('construction', 'bg'), 'bg-opacity-10'),
                        selectedMarkerData.status === 'checked_out' && cn(getStatusColor('error', 'text'), getStatusColor('error', 'bg'), 'bg-opacity-10'),
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
          </MapGL>

          {/* No events overlay */}
          {workerMarkers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm pointer-events-none">
              <p className={typography.special.secondary}>
                {t('ika.attendance.liveMap.noEvents')}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
