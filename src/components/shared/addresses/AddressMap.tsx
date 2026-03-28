/* eslint-disable custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 🗺️ ADDRESS MAP COMPONENT
 * =============================================================================
 *
 * Enterprise map component για visualization of project addresses
 * Pattern: SAP Real Estate, Autodesk Construction Cloud, Procore
 *
 * Features:
 * - Automatic geocoding με AddressResolver
 * - Interactive markers με primary/secondary distinction
 * - Auto-fit bounds to markers
 * - Click-to-focus interaction
 * - Loading/Error states
 * - Caching for performance
 * - Draggable markers με reverse geocoding for address auto-fill
 *
 * Architecture:
 * AddressMap (Domain-specific) → InteractiveMap (Generic GeoCanvas)
 * Config/types extracted to: address-map-config.tsx
 * Geocoding logic extracted to: useAddressMapGeocoding.ts
 *
 * @file AddressMap.tsx
 * @created 2026-02-02
 * @updated 2026-02-16 - Added draggable markers + reverse geocoding (ADR-168)
 * @updated 2026-03-28 - SRP split: config → address-map-config.tsx, geocoding → useAddressMapGeocoding.ts
 */

'use client';

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { AlertTriangle, MapPin, Locate } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useNotifications } from '@/providers/NotificationProvider';
import { Marker as MapLibreMarker } from 'maplibre-gl';
// 🔧 FIX: MapLibre CSS required for Marker positioning — was missing, causing invisible pins
import 'maplibre-gl/dist/maplibre-gl.css';

import { InteractiveMap } from '@/subapps/geo-canvas/components/InteractiveMap';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import { PolygonSystemProvider } from '@/subapps/geo-canvas/systems/polygon-system';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import type { ProjectAddress } from '@/types/project/addresses';
import { getGeocodableAddresses } from '@/types/project/address-helpers';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ADDRESS_MAP_CONFIG } from '@/config/address-map-config';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { getStatusColor } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';

// Extracted modules (SRP split)
import {
  PIN_COLORS,
  AUTO_PAN,
  DraggableMarkerPin,
  type AddressMapProps,
} from '@/components/shared/addresses/address-map-config';
import {
  useAddressMapGeocoding,
  findReferencePosition,
} from '@/components/shared/addresses/useAddressMapGeocoding';

// Re-exports for backward compatibility
export { PIN_COLORS, BRANCH_PIN_COLORS, AUTO_PAN, DraggableMarkerPin } from '@/components/shared/addresses/address-map-config';
export type { AddressMapProps, GeocodingStatus, DragPosition } from '@/components/shared/addresses/address-map-config';
export { reverseResultToAddress, findReferencePosition } from '@/components/shared/addresses/useAddressMapGeocoding';

const logger = createModuleLogger('AddressMap');

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * AddressMap - Enterprise address visualization component
 * Wraps InteractiveMap με domain-specific address logic
 */
export const AddressMap: React.FC<AddressMapProps> = memo(({
  addresses,
  highlightPrimary: _highlightPrimary = true,
  showGeocodingStatus = true,
  heightPreset = ADDRESS_MAP_CONFIG.DEFAULT_HEIGHT_PRESET,
  enableClickToFocus: _enableClickToFocus = true,
  onMarkerClick,
  onGeocodingComplete,
  showLocateMe = true,
  draggableMarkers = false,
  onAddressDragUpdate,
  className = ''
}) => {
  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  const { t } = useTranslation('addresses');
  const semanticColors = useSemanticColors();
  const { error: notifyError } = useNotifications();

  // User location (GPS) — "Βρες τη θέση μου"
  const {
    position: userPosition,
    status: geoStatus,
    requestPosition,
  } = useGeolocation({ enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 });

  const [_selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const mapRef = useRef<MapInstance | null>(null);

  // Geocoding hook (extracted)
  const {
    geocodedAddresses,
    geocodingStatus,
    dragPositions,
    isReverseGeocoding,
    hasEverRendered,
    handleDragEnd,
    autoPanRafRef,
    autoPanDeltaRef,
    stopAutoPan,
    tickAutoPan,
  } = useAddressMapGeocoding({
    addresses,
    draggableMarkers,
    mapRef,
    mapReady,
    onGeocodingComplete,
    onAddressDragUpdate,
  });

  // ===========================================================================
  // USER LOCATION ERROR TOAST
  // ===========================================================================

  useEffect(() => {
    if (geoStatus === 'denied') {
      notifyError(t('map.locationDenied'));
    } else if (geoStatus === 'error') {
      notifyError(t('map.locationError'));
    }
  }, [geoStatus, t]);

  // ===========================================================================
  // FLY TO USER POSITION + NATIVE MARKER
  // ===========================================================================

  const userMarkerRef = useRef<MapLibreMarker | null>(null);

  useEffect(() => {
    if (!mapRef.current || !mapReady || !userPosition) return;

    const map = mapRef.current;

    map.flyTo({
      center: [userPosition.longitude, userPosition.latitude],
      zoom: 15,
      duration: 1000,
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const el = document.createElement('div');
    el.className = 'user-location-marker';
    // eslint-disable-next-line design-system/no-hardcoded-colors
    el.innerHTML = `
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center">
        <span style="position:absolute;inset:0;border-radius:50%;background:rgba(34,197,94,0.25);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></span>
        <span style="position:absolute;inset:4px;border-radius:50%;background:rgba(34,197,94,0.15)"></span>
        <span style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);position:relative"></span>
      </div>
    `;

    if (!document.getElementById('user-loc-keyframes')) {
      const style = document.createElement('style');
      style.id = 'user-loc-keyframes';
      style.textContent = '@keyframes ping{75%,100%{transform:scale(2);opacity:0}}';
      document.head.appendChild(style);
    }

    const marker = new MapLibreMarker({ element: el, anchor: 'center' })
      .setLngLat([userPosition.longitude, userPosition.latitude])
      .addTo(map);

    userMarkerRef.current = marker;

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [userPosition, mapReady]);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  const handleMapReady = useCallback((map: MapInstance) => {
    mapRef.current = map;
    setMapReady(true);

    const pinSVG = `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="20" cy="47" rx="8" ry="3" fill="${PIN_COLORS.shadow}"/>
        <path d="M 20 0 C 11.163 0 4 7.163 4 16 C 4 25 20 45 20 45 C 20 45 36 25 36 16 C 36 7.163 28.837 0 20 0 Z"
              fill="${PIN_COLORS.body}"
              stroke="${PIN_COLORS.stroke}"
              stroke-width="2"/>
        <circle cx="20" cy="16" r="6" fill="${PIN_COLORS.innerCircle}"/>
      </svg>
    `.trim();

    const pinImage = new Image(40, 50);
    pinImage.onload = () => {
      if (!map.hasImage('address-pin')) {
        map.addImage('address-pin', pinImage);
      }
      setMapLoaded(true);
    };
    pinImage.onerror = () => {
      logger.warn('Pin SVG image failed to load, using Marker component fallback');
      setMapLoaded(true);
    };
    pinImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSVG)}`;
  }, []);

  const handleMarkerClick = useCallback((address: ProjectAddress, index: number) => {
    setSelectedMarkerId(address.id);
    onMarkerClick?.(address, index);
    setTimeout(() => {
      setSelectedMarkerId(null);
    }, ADDRESS_MAP_CONFIG.ANIMATION.MARKER_HIGHLIGHT * 6);
  }, [onMarkerClick]);

  const handleAutoPan = useCallback((event: { lngLat: { lng: number; lat: number } }) => {
    const map = mapRef.current;
    if (!map) return;

    const point = map.project([event.lngLat.lng, event.lngLat.lat]);
    const container = map.getContainer();
    const width = container.clientWidth;
    const height = container.clientHeight;
    const { EDGE_THRESHOLD, PAN_SPEED } = AUTO_PAN;

    let dx = 0;
    let dy = 0;
    if (point.x < EDGE_THRESHOLD) dx = -PAN_SPEED;
    else if (point.x > width - EDGE_THRESHOLD) dx = PAN_SPEED;
    if (point.y < EDGE_THRESHOLD) dy = -PAN_SPEED;
    else if (point.y > height - EDGE_THRESHOLD) dy = PAN_SPEED;

    autoPanDeltaRef.current = { dx, dy };

    if (dx !== 0 || dy !== 0) {
      if (!autoPanRafRef.current) {
        autoPanRafRef.current = requestAnimationFrame(tickAutoPan);
      }
    } else {
      stopAutoPan();
    }
  }, [tickAutoPan, stopAutoPan]);

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  const heightClass = ADDRESS_MAP_CONFIG.HEIGHT_PRESETS[heightPreset]
    ?? ADDRESS_MAP_CONFIG.HEIGHT_PRESETS.viewerStandard;

  const isDraggableMode = draggableMarkers;

  // Loading state — only show spinner on FIRST load (before map has ever rendered)
  if (geocodingStatus === 'loading' && !isDraggableMode && !hasEverRendered) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg ${heightClass} ${className}`}
      >
        <div className="text-center space-y-3">
          <Spinner size="large" color="inherit" className="mx-auto text-primary" />
          <p className={cn("text-sm", semanticColors.text.muted)}>
            {t('map.loading')}
          </p>
        </div>
      </div>
    );
  }

  // Error state (skip for draggable mode — show map with default pin position)
  if (geocodingStatus === 'error' && !isDraggableMode && !hasEverRendered) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {t('map.error')}
        </AlertDescription>
      </Alert>
    );
  }

  const shouldRenderMap =
    isDraggableMode ||
    geocodingStatus === 'success' ||
    geocodingStatus === 'partial' ||
    hasEverRendered;

  const defaultCenter = {
    lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE,
    lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
  };

  return (
    <div className={`relative overflow-hidden ${heightClass} ${className}`}>
      <PolygonSystemProvider>
        <div className="absolute inset-0">
          {shouldRenderMap && (
            <InteractiveMap
              transformState={{
                controlPoints: [],
                isCalibrated: false,
                quality: null,
                rmsError: null,
                matrix: null
              }}
              onMapReady={handleMapReady}
              showStatusBar={false}
              showMapControls={false}
              className="w-full h-full rounded-lg overflow-hidden"
            >
              {/* Draggable Marker Mode */}
              {draggableMarkers && (() => {
                const refPos = findReferencePosition(addresses, dragPositions, geocodedAddresses)
                  ?? defaultCenter;
                return addresses.map((addr, index) => {
                  const geocoded = geocodedAddresses.get(addr.id);
                  const dragPos = dragPositions.get(addr.id);
                  const position = dragPos
                    ?? (geocoded ? { lng: geocoded.lng, lat: geocoded.lat } : null)
                    ?? { lng: refPos.lng - 0.003 * index, lat: refPos.lat + 0.003 * index };
                  const hasData = !!(dragPos || geocoded);

                  return (
                    <Marker
                      key={addr.id}
                      longitude={position.lng}
                      latitude={position.lat}
                      anchor="bottom"
                      draggable
                      onDragEnd={(e) => handleDragEnd(e, addr.id, index)}
                      onDrag={handleAutoPan}
                    >
                      <DraggableMarkerPin
                        isPrimary={addr.isPrimary}
                        pulsate={!hasData}
                        label={addr.label}
                      />
                    </Marker>
                  );
                });
              })()}
              {/* Fallback: single pin when no addresses exist in draggable mode */}
              {draggableMarkers && addresses.length === 0 && (
                <Marker
                  longitude={defaultCenter.lng}
                  latitude={defaultCenter.lat}
                  anchor="bottom"
                  draggable
                  onDragEnd={(e) => handleDragEnd(e, '__new__', 0)}
                  onDrag={handleAutoPan}
                >
                  <DraggableMarkerPin isPrimary pulsate />
                </Marker>
              )}

              {/* Read-only Mode */}
              {!draggableMarkers && mapLoaded && addresses.map((addr, index) => {
                const geocoded = geocodedAddresses.get(addr.id);
                if (!geocoded) return null;

                const translatedLabel = addr.label || t(`types.${addr.type}`);

                return (
                  <Marker
                    key={addr.id}
                    longitude={geocoded.lng}
                    latitude={geocoded.lat}
                    anchor="bottom"
                    onClick={() => handleMarkerClick(addr, index)}
                  >
                    <DraggableMarkerPin
                      isPrimary={addr.isPrimary}
                      label={translatedLabel}
                    />
                  </Marker>
                );
              })}
            </InteractiveMap>
          )}
        </div>

        {/* Locate Me Button */}
        {showLocateMe && (
          <button
            type="button"
            onClick={requestPosition}
            disabled={geoStatus === 'requesting'}
            className={`
              absolute bottom-3 right-3 z-10
              flex items-center justify-center
              w-9 h-9 rounded-lg shadow-md
              border border-border
              transition-colors duration-150
              disabled:opacity-60 disabled:cursor-not-allowed
              ${geoStatus === 'granted'
                ? `${getStatusColor('available', 'bg')}/10 ${getStatusColor('available', 'text')}`
                : `bg-background ${semanticColors.text.muted} hover:bg-accent hover:text-accent-foreground`}
            `}
            title={t('map.locateMe')}
            aria-label={t('map.locateMe')}
          >
            {geoStatus === 'requesting' ? (
              <Spinner size="small" />
            ) : (
              <Locate className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Drag hint badge */}
        {draggableMarkers && (
          <div className="absolute top-3 left-3 right-3 pointer-events-none">
            <Badge
              variant="secondary"
              className="shadow-md pointer-events-auto flex items-center gap-1.5 w-fit"
            >
              {isReverseGeocoding ? (
                <>
                  <Spinner size="small" />
                  {t('map.reverseGeocoding')}
                </>
              ) : (
                <>
                  <MapPin className="w-3 h-3" />
                  {t('map.dragHint')}
                </>
              )}
            </Badge>
          </div>
        )}

        {/* Geocoding Status Badge (read-only mode) */}
        {showGeocodingStatus && !draggableMarkers && geocodingStatus === 'partial' && (
          <div className="absolute top-4 right-4">
            <Badge variant="secondary" className="shadow-md">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {t('map.partialStatus', {
                count: geocodedAddresses.size,
                total: getGeocodableAddresses(addresses).length
              })}
            </Badge>
          </div>
        )}
      </PolygonSystemProvider>
    </div>
  );
});

AddressMap.displayName = 'AddressMap';

export default AddressMap;
