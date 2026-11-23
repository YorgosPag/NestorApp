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
import { useMapPinImage } from '@/components/shared/addresses/useMapPinImage';
/*
  🔴 ΕΔΩ ΕΙΧΕ ΗΔΗ ΠΛΗΡΩΘΕΙ Η ΙΔΙΑ ΒΛΑΒΗ, ΜΙΑ ΦΟΡΑ: η γραμμή που έφυγε από εδώ έγραφε
  «*MapLibre CSS required for Marker positioning — was missing, causing invisible pins*».
  Δηλαδή κάποιος **είχε ήδη μετρήσει** ότι χωρίς το φύλλο στυλ οι πινέζες γίνονται
  αόρατες, και το διόρθωσε **τοπικά** — σε ένα από τα τέσσερα αρχεία που το εισήγαγαν
  χειρόγραφα. Ο κοινός χάρτης έμεινε ακάλυπτος και η **ίδια** αιτία ξαναχτύπησε στο
  `/search/results`, δύο μήνες μετά, με άλλο πρόσωπο (ADR-777 §8.56).
  Πλέον το φύλλο στυλ έρχεται **μαζί** με τα σύμβολα, από το σύνορο.
*/
import { Marker, MapLibreMarker } from '@/lib/maps/maplibre';
import { AlertTriangle, MapPin, Locate } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useNotifications } from '@/providers/NotificationProvider';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { InteractiveMap } from '@/subapps/geo-canvas/components/InteractiveMap';
import { PolygonSystemProvider } from '@/subapps/geo-canvas/systems/polygon-system';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import type { ProjectAddress } from '@/types/project/addresses';
import { getGeocodableAddresses } from '@/types/project/address-helpers';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ADDRESS_MAP_CONFIG } from '@/config/address-map-config';
import { cameraFlight } from '@/lib/geo/camera-motion';
import { createUserLocationMarkerElement } from './user-location-marker';
import { getStatusSurfaceClass } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { renderStoredAddressLabel } from '@/components/contacts/addresses/contactAddressLabel';
import { cn } from '@/lib/utils';

// Extracted modules (SRP split)
import {
  AUTO_PAN,
  DraggableMarkerPin,
  type AddressMapProps,
} from '@/components/shared/addresses/address-map-config';
import { useAddressMapGeocoding } from '@/components/shared/addresses/useAddressMapGeocoding';
import { AddressMapStatusChip } from '@/components/shared/addresses/AddressMapStatusChip';

// Re-exports for backward compatibility
export { PIN_COLORS, BRANCH_PIN_COLORS, AUTO_PAN, DraggableMarkerPin } from '@/components/shared/addresses/address-map-config';
export type { AddressMapProps, GeocodingStatus, DragPosition } from '@/components/shared/addresses/address-map-config';
export { reverseResultToAddress, findReferencePosition } from '@/components/shared/addresses/useAddressMapGeocoding';

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
  readOnlyAddressIds,
  dragResetKey,
  activeEditingAddressId,
  overlay,
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
  const { mapRef, mapReady, mapLoaded, handleMapReady } = useMapPinImage();

  // Geocoding hook (extracted)
  const {
    geocodedAddresses,
    geocodingStatus,
    isReverseGeocoding,
    hasEverRendered,
    pins,
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
    dragResetKey,
    readOnlyAddressIds,
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

    /*
      Ο άνθρωπος **κοιτούσε** τον χάρτη όταν πάτησε «Εντοπισμός»: υπάρχει «από», άρα
      αξίζει πτήση. ⚠️ Η διάρκεια **δεν** γράφεται — ο van Wijk τη βγάζει από την
      απόσταση, και εδώ η απόσταση είναι απρόβλεπτη εξ ορισμού *(ο άνθρωπος μπορεί να
      είναι δίπλα ή σε άλλη ήπειρο)*. Τα παλιά `1000 ms` ήταν σταθερά **ακριβώς εκεί
      που η σταθερά έχει το λιγότερο νόημα**.

      🔑 Και το ζουμ έπαψε να είναι σκέτο `15`: το `DEFAULT_ZOOM` υπήρχε ήδη στο
      `ADDRESS_MAP_CONFIG` με **μηδέν καταναλωτές**, ενώ δίπλα του γραφόταν ο ίδιος
      αριθμός στο χέρι.
    */
    map.flyTo({
      center: [userPosition.longitude, userPosition.latitude],
      zoom: ADDRESS_MAP_CONFIG.DEFAULT_ZOOM,
      ...cameraFlight('travel'),
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const el = createUserLocationMarkerElement();

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
              /*
               * `embedded`: **εσωτερική** οθόνη. Οι συντεταγμένες μένουν — εκεί είναι
               * **εργαλείο** του επαγγελματία, όχι θόρυβος (ADR-777 §2.2). Ταυτόσημο
               * με τις δύο σημαίες που αντικατέστησε.
               */
              chrome="embedded"
              className="w-full h-full rounded-lg overflow-hidden"
            >
              {/*
                ADR-948 §8.7.3 — ΜΙΑ πηγή θέσης (`address-map-pins`): ό,τι ζωγραφίζεται εδώ είναι ακριβώς
                ό,τι καδράρει η κάμερα. Πριν, ο κανόνας της ζωγραφικής και του καδραρίσματος ήταν δύο, και η
                εφεδρική πινέζα του άδειου χάρτη έμενε εκτός κάδρου.
              */}
              {(draggableMarkers || mapLoaded) && pins.map((pin) => {
                const label = pin.address
                  ? renderStoredAddressLabel(pin.address.label, t) ?? t(`types.${pin.address.type}`)
                  : undefined;
                const isPrimary = pin.address?.isPrimary ?? true;
                const pinAddress = pin.address;

                // ADR-318: παράγωγη διεύθυνση (ή χάρτης προβολής) — ποτέ συρόμενη.
                if (!pin.draggable) {
                  return (
                    <Marker
                      key={pin.id}
                      longitude={pin.point.lng}
                      latitude={pin.point.lat}
                      anchor="bottom"
                      onClick={pinAddress ? () => handleMarkerClick(pinAddress, pin.index) : undefined}
                    >
                      <DraggableMarkerPin isPrimary={isPrimary} label={label} />
                    </Marker>
                  );
                }

                return (
                  <Marker
                    key={pin.id}
                    longitude={pin.point.lng}
                    latitude={pin.point.lat}
                    anchor="bottom"
                    draggable
                    onDragEnd={(e) => handleDragEnd(e, pin.id, pin.index)}
                    onDrag={handleAutoPan}
                  >
                    <DraggableMarkerPin
                      isPrimary={isPrimary}
                      pulsate={pin.anchor !== 'located'}
                      isEditing={activeEditingAddressId === pin.id}
                      label={label}
                    />
                  </Marker>
                );
              })}
              {/* ADR-332 D26 — ό,τι ζωγραφίζεται στον ίδιο χάρτη χωρίς να είναι διεύθυνση. */}
              {overlay}
            </InteractiveMap>
          )}
        </div>

        {/* Locate Me Button */}
        {showLocateMe && (
          <Tooltip>
            <TooltipTrigger asChild>
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
                    ? getStatusSurfaceClass('available')
                    : `bg-background ${semanticColors.text.muted} hover:bg-accent hover:text-accent-foreground`}
                `}
                aria-label={t('map.locateMe')}
              >
                {geoStatus === 'requesting' ? (
                  <Spinner size="small" />
                ) : (
                  <Locate className="w-4 h-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('map.locateMe')}</TooltipContent>
          </Tooltip>
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

        {/* Live status chip — Google-style real-time feedback (idle/loading/
            partial/error). Bottom-left avoids the InteractiveMap
            top-right control cluster + the bottom-right "Locate me" button. */}
        {showGeocodingStatus && (
          <div className="absolute bottom-3 left-3 z-10">
            <AddressMapStatusChip
              status={geocodingStatus}
              geocodedCount={geocodedAddresses.size}
              geocodableTotal={getGeocodableAddresses(addresses).length}
            />
          </div>
        )}
      </PolygonSystemProvider>
    </div>
  );
});

AddressMap.displayName = 'AddressMap';

export default AddressMap;
