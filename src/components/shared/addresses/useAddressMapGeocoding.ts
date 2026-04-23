/* eslint-disable custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 🗺️ ADDRESS MAP — Geocoding Hook
 * =============================================================================
 *
 * Extracted from AddressMap.tsx for Google SRP compliance (<500 lines).
 * Contains: geocoding logic, reverse geocoding helper, auto-fit bounds effect,
 * and all geocoding-related state management.
 *
 * @file useAddressMapGeocoding.ts
 * @created 2026-03-28
 * @see AddressMap.tsx
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { LngLatBounds } from 'maplibre-gl';

import type { ProjectAddress, PartialProjectAddress } from '@/types/project/addresses';
import {
  formatAddressForGeocoding,
  getGeocodableAddresses,
} from '@/types/project/address-helpers';
import {
  geocodeAddress,
  reverseGeocode,
  type GeocodingServiceResult,
  type ReverseGeocodingResult,
} from '@/lib/geocoding/geocoding-service';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import { ADDRESS_MAP_CONFIG } from '@/config/address-map-config';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeocodingStatus, DragPosition } from '@/components/shared/addresses/address-map-config';

const logger = createModuleLogger('AddressMapGeocoding');

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Map ReverseGeocodingResult to partial address data for form population.
 *
 * ADR-277: keep `street` and `number` separate so downstream consumers
 * (`handleDragUpdate`) don't have to re-split a pre-concatenated string.
 * The server already returns Nominatim's `addr.road` / `addr.house_number`
 * as distinct fields; the client preserves that split.
 */
export function reverseResultToAddress(result: ReverseGeocodingResult): Partial<PartialProjectAddress> {
  return {
    street: result.street,
    number: result.number || undefined,
    city: result.city,
    neighborhood: result.neighborhood || undefined,
    postalCode: result.postalCode,
    region: result.region || undefined,
    country: result.country || GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
    coordinates: { lat: result.lat, lng: result.lng },
  };
}

// =============================================================================
// HOOK INTERFACE
// =============================================================================

interface UseAddressMapGeocodingParams {
  addresses: ProjectAddress[];
  draggableMarkers: boolean;
  mapRef: React.RefObject<MapInstance | null>;
  mapReady: boolean;
  onGeocodingComplete?: (results: Map<string, GeocodingServiceResult>) => void;
  onAddressDragUpdate?: (addressData: Partial<PartialProjectAddress>, addressIndex: number) => void;
}

interface UseAddressMapGeocodingReturn {
  geocodedAddresses: Map<string, GeocodingServiceResult>;
  geocodingStatus: GeocodingStatus;
  dragPositions: Map<string, DragPosition>;
  isReverseGeocoding: boolean;
  hasEverRendered: boolean;
  handleDragEnd: (
    event: { lngLat: { lng: number; lat: number } },
    addressId: string,
    addressIndex: number,
  ) => Promise<void>;
  autoPanRafRef: React.MutableRefObject<number | null>;
  autoPanDeltaRef: React.MutableRefObject<{ dx: number; dy: number }>;
  stopAutoPan: () => void;
  tickAutoPan: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Custom hook encapsulating all geocoding logic for AddressMap.
 * Handles: forward geocoding, reverse geocoding on drag, auto-fit bounds,
 * drag position tracking, and auto-pan during drag.
 */
export function useAddressMapGeocoding({
  addresses,
  draggableMarkers,
  mapRef,
  mapReady,
  onGeocodingComplete,
  onAddressDragUpdate,
}: UseAddressMapGeocodingParams): UseAddressMapGeocodingReturn {
  const [geocodedAddresses, setGeocodedAddresses] = useState<Map<string, GeocodingServiceResult>>(new Map());
  const [geocodingStatus, setGeocodingStatus] = useState<GeocodingStatus>('idle');
  const [dragPositions, setDragPositions] = useState<Map<string, DragPosition>>(new Map());
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Track if map has ever rendered successfully (prevents unmount during re-geocoding)
  const hasEverRenderedRef = useRef(false);

  if (geocodingStatus === 'success' || geocodingStatus === 'partial') {
    hasEverRenderedRef.current = true;
  }

  // ===========================================================================
  // GEOCODING EFFECT
  // ===========================================================================

  useEffect(() => {
    const geocodeAllAddresses = async () => {
      if (addresses.length === 0) {
        setGeocodingStatus('idle');
        setGeocodedAddresses(new Map());
        setDragPositions(new Map());
        return;
      }

      const currentIds = new Set(addresses.map(a => a.id));
      setGeocodedAddresses(prev => {
        const next = new Map<string, GeocodingServiceResult>();
        prev.forEach((v, id) => { if (currentIds.has(id)) next.set(id, v); });
        return next;
      });
      setDragPositions(prev => {
        const next = new Map<string, DragPosition>();
        prev.forEach((v, id) => { if (currentIds.has(id)) next.set(id, v); });
        return next;
      });

      setGeocodingStatus('loading');

      try {
        const geocodable = getGeocodableAddresses(addresses);

        if (geocodable.length === 0) {
          setGeocodingStatus('idle');
          setGeocodedAddresses(new Map());
          setDragPositions(new Map());
          return;
        }

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

        logger.info('Geocoding complete', { data: {
          totalAddresses: addresses.length,
          geocodableAddresses: geocodable.length,
          successCount,
        } });

        if (successCount === 0) {
          setGeocodingStatus('error');
        } else if (successCount < geocodable.length) {
          setGeocodingStatus('partial');
        } else {
          setGeocodingStatus('success');
        }

        onGeocodingComplete?.(geocodedMap);

        // For draggable mode: initialize drag positions from geocoded results
        if (draggableMarkers && successCount > 0) {
          setDragPositions(prev => {
            const next = new Map(prev);
            geocodedMap.forEach((result, id) => {
              if (!next.has(id)) {
                next.set(id, { lng: result.lng, lat: result.lat });
              }
            });
            return next;
          });
        }
      } catch (error) {
        logger.error('Geocoding failed:', { error });
        setGeocodingStatus('error');
      }
    };

    geocodeAllAddresses();
  }, [addresses, onGeocodingComplete]);

  // ===========================================================================
  // FIT BOUNDS — SSoT helper + two triggers
  // ===========================================================================

  /**
   * Zoom the map so every pin (geocoded + drag-pending + unrendered fallback)
   * is visible. Single source of truth for bounds composition.
   */
  const runFitBounds = useCallback(() => {
    if (!mapRef.current || !mapReady) return;
    try {
      const bounds = new LngLatBounds();
      geocodedAddresses.forEach(result => bounds.extend([result.lng, result.lat]));
      if (draggableMarkers) {
        dragPositions.forEach(pos => bounds.extend([pos.lng, pos.lat]));
        const refPos = findReferencePosition(addresses, dragPositions, geocodedAddresses);
        for (let i = 0; i < addresses.length; i++) {
          const addr = addresses[i];
          if (!dragPositions.has(addr.id) && !geocodedAddresses.has(addr.id) && refPos) {
            bounds.extend([refPos.lng - 0.003 * i, refPos.lat + 0.003 * i]);
          }
        }
      }
      if (bounds.isEmpty()) return;
      mapRef.current.fitBounds(bounds, {
        padding: ADDRESS_MAP_CONFIG.FIT_BOUNDS_PADDING,
        maxZoom: ADDRESS_MAP_CONFIG.DEFAULT_MAX_ZOOM,
        duration: ADDRESS_MAP_CONFIG.ANIMATION.FIT_BOUNDS,
      });
    } catch (error) {
      logger.error('fitBounds failed:', { error });
    }
  }, [geocodedAddresses, mapReady, draggableMarkers, dragPositions, addresses]);

  // Trigger 1 — View mode: auto-fit whenever the geocoded set changes. Skipped
  // in edit mode so a careful zoom-in + drag is not immediately reversed by
  // an auto-fit triggered by the new drag position or freshly geocoded entry.
  useEffect(() => {
    if (draggableMarkers) return;
    runFitBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodedAddresses, mapReady, draggableMarkers]);

  // Trigger 2 — Entry into edit mode or initial mount in edit mode: fit once
  // so all pins are visible, then hold the user's zoom until they exit edit.
  const lastEditFitRef = useRef(false);
  useEffect(() => {
    if (!draggableMarkers) {
      lastEditFitRef.current = false;
      return;
    }
    if (lastEditFitRef.current) return;
    runFitBounds();
    lastEditFitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggableMarkers, mapReady]);

  // ===========================================================================
  // AUTO-PAN DURING DRAG
  // ===========================================================================

  const autoPanRafRef = useRef<number | null>(null);
  const autoPanDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const stopAutoPan = useCallback(() => {
    if (autoPanRafRef.current) {
      cancelAnimationFrame(autoPanRafRef.current);
      autoPanRafRef.current = null;
    }
    autoPanDeltaRef.current = { dx: 0, dy: 0 };
  }, []);

  const tickAutoPan = useCallback(() => {
    const map = mapRef.current;
    const { dx, dy } = autoPanDeltaRef.current;
    if (map && (dx !== 0 || dy !== 0)) {
      map.panBy([dx, dy], { duration: 0 });
    }
    autoPanRafRef.current = requestAnimationFrame(tickAutoPan);
  }, []);

  // ===========================================================================
  // DRAG END — Reverse Geocode
  // ===========================================================================

  const handleDragEnd = useCallback(async (
    event: { lngLat: { lng: number; lat: number } },
    addressId: string,
    addressIndex: number,
  ) => {
    stopAutoPan();
    const { lng, lat } = event.lngLat;
    setDragPositions(prev => {
      const next = new Map(prev);
      next.set(addressId, { lng, lat });
      return next;
    });
    setIsReverseGeocoding(true);

    try {
      const result = await reverseGeocode(lat, lng);
      if (result && onAddressDragUpdate) {
        onAddressDragUpdate(reverseResultToAddress(result), addressIndex);
      } else if (!result) {
        logger.warn('Reverse geocoding returned no result', { data: { lat, lng } });
      }
    } catch (error) {
      logger.error('Reverse geocoding failed', { error: String(error) });
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [onAddressDragUpdate, stopAutoPan]);

  return {
    geocodedAddresses,
    geocodingStatus,
    dragPositions,
    isReverseGeocoding,
    hasEverRendered: hasEverRenderedRef.current,
    handleDragEnd,
    autoPanRafRef,
    autoPanDeltaRef,
    stopAutoPan,
    tickAutoPan,
  };
}

// =============================================================================
// UTILITY
// =============================================================================

/** Find the first available reference position from addresses (drag > geocoded) */
export function findReferencePosition(
  addresses: ProjectAddress[],
  dragPositions: Map<string, DragPosition>,
  geocodedAddresses: Map<string, GeocodingServiceResult>,
): DragPosition | null {
  for (const addr of addresses) {
    const dp = dragPositions.get(addr.id);
    if (dp) return dp;
    const gc = geocodedAddresses.get(addr.id);
    if (gc) return { lng: gc.lng, lat: gc.lat };
  }
  return null;
}
