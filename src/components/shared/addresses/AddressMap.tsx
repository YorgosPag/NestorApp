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
 *
 * @file AddressMap.tsx
 * @created 2026-02-02
 * @updated 2026-02-16 - Added draggable markers + reverse geocoding (ADR-168)
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/maplibre';
import { Loader2, AlertTriangle, MapPin, Locate } from 'lucide-react';
import toast from 'react-hot-toast';
import { LngLatBounds } from 'maplibre-gl';
import type * as GeoJSON from 'geojson';

import { InteractiveMap } from '@/subapps/geo-canvas/components/InteractiveMap';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import { PolygonSystemProvider } from '@/subapps/geo-canvas/systems/polygon-system';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import type { ProjectAddress, PartialProjectAddress } from '@/types/project/addresses';
import {
  formatAddressForGeocoding,
  getGeocodableAddresses
} from '@/types/project/address-helpers';
import {
  geocodeAddress,
  reverseGeocode,
  type GeocodingServiceResult,
  type ReverseGeocodingResult
} from '@/lib/geocoding/geocoding-service';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ADDRESS_MAP_CONFIG, type AddressMapHeightPreset } from '@/config/address-map-config';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { colors } from '@/styles/design-tokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('AddressMap');

/** Map pin SVG colors — SSoT: design-tokens */
const PIN_COLORS = {
  body: colors.blue['500'],          // #3b82f6 — primary brand
  stroke: colors.background.primary, // white
  innerCircle: colors.background.primary, // white
  shadow: 'rgba(0,0,0,0.3)',         // subtle shadow
} as const;

/** Map text layer colors — SSoT: design-tokens */
const MAP_TEXT_COLORS = {
  label: colors.text.primary,        // #1e293b — slate-800
  halo: colors.background.primary,   // white
} as const;

// =============================================================================
// COMPONENT INTERFACE
// =============================================================================

export interface AddressMapProps {
  /** Addresses to display on map */
  addresses: ProjectAddress[];

  /** Highlight primary address με larger marker */
  highlightPrimary?: boolean;

  /** Show geocoding status badges */
  showGeocodingStatus?: boolean;

  /** Map container height preset (centralized layout tokens) */
  heightPreset?: AddressMapHeightPreset;

  /** Enable click-to-focus interaction */
  enableClickToFocus?: boolean;

  /** Marker click callback */
  onMarkerClick?: (address: ProjectAddress, index: number) => void;

  /** Geocoding complete callback */
  onGeocodingComplete?: (results: Map<string, GeocodingServiceResult>) => void;

  /** Show "Locate me" button for user GPS position (default: true) */
  showLocateMe?: boolean;

  /** Enable draggable markers (for add/edit mode) */
  draggableMarkers?: boolean;

  /** Callback when user drags a marker — provides reverse-geocoded address data */
  onAddressDragUpdate?: (addressData: Partial<PartialProjectAddress>) => void;

  /** Additional CSS classes */
  className?: string;
}

type AddressFeatureProperties = {
  id?: string;
  street?: string;
  city?: string;
  isPrimary?: boolean;
  label: string;
};

// =============================================================================
// DRAGGABLE MARKER PIN — Inline SVG component (same design as symbol layer pin)
// =============================================================================

interface DraggableMarkerPinProps {
  isPrimary?: boolean;
}

function DraggableMarkerPin({ isPrimary }: DraggableMarkerPinProps) {
  const size = isPrimary ? 40 : 32;
  const viewBoxHeight = Math.round(size * 1.25);
  return (
    <svg
      width={size}
      height={viewBoxHeight}
      viewBox={`0 0 40 50`}
      xmlns="http://www.w3.org/2000/svg"
      className="cursor-grab active:cursor-grabbing drop-shadow-md"
    >
      <ellipse cx="20" cy="47" rx="8" ry="3" fill={PIN_COLORS.shadow} />
      <path
        d="M 20 0 C 11.163 0 4 7.163 4 16 C 4 25 20 45 20 45 C 20 45 36 25 36 16 C 36 7.163 28.837 0 20 0 Z"
        fill={PIN_COLORS.body}
        stroke={PIN_COLORS.stroke}
        strokeWidth="2"
      />
      <circle cx="20" cy="16" r="6" fill={PIN_COLORS.innerCircle} />
    </svg>
  );
}

// =============================================================================
// USER LOCATION PIN — Green pulsating dot ("My Location" pattern)
// =============================================================================

function UserLocationPin() {
  return (
    <div className="relative flex items-center justify-center w-8 h-8">
      {/* Pulsating accuracy ring */}
      <span className="absolute inset-0 rounded-full bg-green-500/25 animate-ping" />
      {/* Static semi-transparent ring */}
      <span className="absolute inset-1 rounded-full bg-green-500/15" />
      {/* Solid center dot */}
      <span className="relative w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white shadow-md" />
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

/** Map ReverseGeocodingResult to partial address data for form population */
function reverseResultToAddress(result: ReverseGeocodingResult): Partial<PartialProjectAddress> {
  return {
    street: result.number
      ? `${result.street} ${result.number}`
      : result.street,
    city: result.city,
    neighborhood: result.neighborhood || undefined,
    postalCode: result.postalCode,
    region: result.region || undefined,
    country: result.country || GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
    coordinates: { lat: result.lat, lng: result.lng },
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * AddressMap - Enterprise address visualization component
 * Wraps InteractiveMap με domain-specific address logic
 */
export const AddressMap: React.FC<AddressMapProps> = memo(({
  addresses,
  highlightPrimary = true,
  showGeocodingStatus = true,
  heightPreset = ADDRESS_MAP_CONFIG.DEFAULT_HEIGHT_PRESET,
  enableClickToFocus = true,
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

  // User location (GPS) — "Βρες τη θέση μου"
  const {
    position: userPosition,
    status: geoStatus,
    requestPosition,
  } = useGeolocation({ enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 });

  const [geocodedAddresses, setGeocodedAddresses] = useState<Map<string, GeocodingServiceResult>>(new Map());
  const [geocodingStatus, setGeocodingStatus] = useState<'idle' | 'loading' | 'success' | 'partial' | 'error'>('idle');
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Draggable marker state — position of the single draggable pin
  const [dragMarkerPosition, setDragMarkerPosition] = useState<{ lng: number; lat: number } | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  const mapRef = useRef<MapInstance | null>(null);

  // ===========================================================================
  // USER LOCATION ERROR TOAST
  // ===========================================================================

  useEffect(() => {
    if (geoStatus === 'denied') {
      toast.error(t('map.locationDenied'));
    } else if (geoStatus === 'error') {
      toast.error(t('map.locationError'));
    }
  }, [geoStatus, t]);

  // ===========================================================================
  // FLY TO USER POSITION (when obtained via "Locate Me")
  // ===========================================================================

  useEffect(() => {
    if (!mapRef.current || !mapReady || !userPosition) return;

    mapRef.current.flyTo({
      center: [userPosition.longitude, userPosition.latitude],
      zoom: 15,
      duration: 1000,
    });
  }, [userPosition, mapReady]);

  // ===========================================================================
  // GEOCODING EFFECT
  // ===========================================================================

  /**
   * Geocode all addresses on mount/change
   * Uses AddressResolver με caching για performance
   */
  useEffect(() => {
    const geocodeAllAddresses = async () => {
      if (addresses.length === 0) {
        setGeocodingStatus('idle');
        return;
      }

      setGeocodingStatus('loading');

      try {
        // Filter geocodable addresses (have street + city)
        const geocodable = getGeocodableAddresses(addresses);

        if (geocodable.length === 0) {
          setGeocodingStatus('error');
          return;
        }

        // Resolve addresses via server-side geocoding service
        const geocodedMap = new Map<string, GeocodingServiceResult>();
        let successCount = 0;

        for (let i = 0; i < geocodable.length; i++) {
          try {
            const query = formatAddressForGeocoding(geocodable[i]);
            const result = await geocodeAddress(query);
            if (result) {
              geocodedMap.set(geocodable[i].id, result);
              successCount++;
            }
          } catch {
            logger.warn('Geocoding failed for address', { data: { id: geocodable[i].id } });
          }
        }

        setGeocodedAddresses(geocodedMap);

        logger.info('AddressMap: Geocoding complete', { data: {
          totalAddresses: addresses.length,
          geocodableAddresses: geocodable.length,
          successCount,
        } });

        // Determine status
        if (successCount === 0) {
          setGeocodingStatus('error');
        } else if (successCount < geocodable.length) {
          setGeocodingStatus('partial');
        } else {
          setGeocodingStatus('success');
        }

        // Notify parent
        if (onGeocodingComplete) {
          onGeocodingComplete(geocodedMap);
        }

        // For draggable mode + existing address: set marker at first geocoded position
        if (draggableMarkers && successCount > 0 && !dragMarkerPosition) {
          const firstResult = geocodedMap.values().next().value as GeocodingServiceResult;
          setDragMarkerPosition({ lng: firstResult.lng, lat: firstResult.lat });
        }
      } catch (error) {
        logger.error('Geocoding failed:', { error: error });
        setGeocodingStatus('error');
      }
    };

    geocodeAllAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, onGeocodingComplete]);

  // ===========================================================================
  // FIT BOUNDS EFFECT
  // ===========================================================================

  /**
   * Auto-fit map bounds to include all markers
   * Runs when geocoding completes και map is ready
   */
  useEffect(() => {
    if (!mapRef.current || !mapReady || geocodedAddresses.size === 0) {
      return;
    }

    try {
      const bounds = new LngLatBounds();

      geocodedAddresses.forEach(result => {
        bounds.extend([result.lng, result.lat]);
      });

      // Only fit bounds if we have valid bounds
      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, {
          padding: ADDRESS_MAP_CONFIG.FIT_BOUNDS_PADDING,
          maxZoom: ADDRESS_MAP_CONFIG.DEFAULT_MAX_ZOOM,
          duration: ADDRESS_MAP_CONFIG.ANIMATION.FIT_BOUNDS
        });
      }
    } catch (error) {
      logger.error('fitBounds failed:', { error: error });
    }
  }, [geocodedAddresses, mapReady]);

  // ===========================================================================
  // GEOJSON DATA (for read-only Source+Layer mode)
  // ===========================================================================

  /**
   * Create GeoJSON FeatureCollection from geocoded addresses
   * Used ONLY when draggableMarkers=false (performance optimization)
   */
  const markersGeoJSON = useMemo(() => {
    if (draggableMarkers) return null;

    const features = addresses
      .map((address): GeoJSON.Feature<GeoJSON.Point, AddressFeatureProperties> | null => {
        const geocoded = geocodedAddresses.get(address.id);
        if (!geocoded) return null;

        const translatedLabel = address.label || t(`types.${address.type}`);

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [geocoded.lng, geocoded.lat]
          },
          properties: {
            id: address.id,
            street: address.street,
            city: address.city,
            isPrimary: address.isPrimary,
            label: translatedLabel
          }
        };
      })
      .filter((feature): feature is GeoJSON.Feature<GeoJSON.Point, AddressFeatureProperties> => feature !== null);

    return {
      type: 'FeatureCollection' as const,
      features
    };
  }, [addresses, geocodedAddresses, t, draggableMarkers]);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handle map ready event
   * Enterprise pattern: Load custom marker icon into map sprite
   */
  const handleMapReady = useCallback((map: MapInstance) => {
    mapRef.current = map;
    setMapReady(true);

    // Load custom pin marker icon — needed for non-draggable Source+Layer mode
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
    pinImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSVG)}`;
  }, []);

  /**
   * Handle marker click (read-only mode)
   */
  const handleMarkerClick = useCallback((address: ProjectAddress, index: number) => {
    setSelectedMarkerId(address.id);

    if (onMarkerClick) {
      onMarkerClick(address, index);
    }

    // Auto-deselect after animation duration
    setTimeout(() => {
      setSelectedMarkerId(null);
    }, ADDRESS_MAP_CONFIG.ANIMATION.MARKER_HIGHLIGHT * 6);
  }, [onMarkerClick]);

  /**
   * Handle drag end — reverse geocode the new position
   */
  const handleDragEnd = useCallback(async (event: { lngLat: { lng: number; lat: number } }) => {
    const { lng, lat } = event.lngLat;
    setDragMarkerPosition({ lng, lat });
    setIsReverseGeocoding(true);

    try {
      const result = await reverseGeocode(lat, lng);
      if (result && onAddressDragUpdate) {
        onAddressDragUpdate(reverseResultToAddress(result));
      } else if (!result) {
        logger.warn('Reverse geocoding returned no result', { data: { lat, lng } });
      }
    } catch (error) {
      logger.error('Reverse geocoding failed', { error: String(error) });
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [onAddressDragUpdate]);

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  const heightClass = ADDRESS_MAP_CONFIG.HEIGHT_PRESETS[heightPreset]
    ?? ADDRESS_MAP_CONFIG.HEIGHT_PRESETS.viewerStandard;

  // For draggable mode: Always render map (no geocoding needed for new addresses)
  const isDraggableNewAddress = draggableMarkers && addresses.length === 0;

  // Loading state (skip for draggable new address mode)
  if (geocodingStatus === 'loading' && !isDraggableNewAddress) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg ${heightClass} ${className}`}
      >
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">
            {t('map.loading')}
          </p>
        </div>
      </div>
    );
  }

  // Error state (skip for draggable new address mode)
  if (geocodingStatus === 'error' && !isDraggableNewAddress) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {t('map.error')}
        </AlertDescription>
      </Alert>
    );
  }

  // Determine if map should render
  const shouldRenderMap =
    isDraggableNewAddress ||
    geocodingStatus === 'success' ||
    geocodingStatus === 'partial';

  // Default position for new address draggable pin (center of Greece)
  const defaultDragPosition = dragMarkerPosition ?? {
    lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE,
    lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
  };

  return (
    <div className={`relative overflow-hidden ${heightClass} ${className}`}>
      <PolygonSystemProvider>
        {/* Keep map absolutely bounded to prevent attribution panel from affecting layout height */}
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
              {/* Draggable Marker Mode — <Marker> components */}
              {draggableMarkers && mapReady && (
                <Marker
                  longitude={defaultDragPosition.lng}
                  latitude={defaultDragPosition.lat}
                  anchor="bottom"
                  draggable
                  onDragEnd={handleDragEnd}
                >
                  <DraggableMarkerPin isPrimary />
                </Marker>
              )}

              {/* Read-only Mode — Source+Layer for performance */}
              {!draggableMarkers && mapLoaded && markersGeoJSON && markersGeoJSON.features.length > 0 && (
                <Source
                  id="address-markers"
                  type="geojson"
                  data={markersGeoJSON}
                >
                  <Layer
                    id="address-markers-symbols"
                    type="symbol"
                    layout={{
                      'icon-image': 'address-pin',
                      'icon-size': 1,
                      'icon-anchor': 'bottom',
                      'icon-allow-overlap': true,
                      'text-field': ['get', 'label'],
                      'text-size': 12,
                      'text-anchor': 'top',
                      'text-offset': [0, 0.5],
                      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular']
                    }}
                    paint={{
                      'text-color': MAP_TEXT_COLORS.label,
                      'text-halo-color': MAP_TEXT_COLORS.halo,
                      'text-halo-width': 2
                    }}
                  />
                </Source>
              )}

              {/* User Location Marker — green pulsating dot */}
              {showLocateMe && mapReady && userPosition && (
                <Marker
                  longitude={userPosition.longitude}
                  latitude={userPosition.latitude}
                  anchor="center"
                >
                  <UserLocationPin />
                </Marker>
              )}
            </InteractiveMap>
          )}
        </div>

        {/* Locate Me Button — bottom-right corner */}
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
                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'}
            `}
            title={t('map.locateMe')}
            aria-label={t('map.locateMe')}
          >
            {geoStatus === 'requesting' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
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
                  <Loader2 className="w-3 h-3 animate-spin" />
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
