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
import { flushSync } from 'react-dom';
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
} from '@/lib/geocoding/geocoding-service';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import { ADDRESS_MAP_CONFIG } from '@/config/address-map-config';
import { createModuleLogger } from '@/lib/telemetry';
import {
  type GeocodingStatus,
  type DragPosition,
} from '@/components/shared/addresses/address-map-config';
import {
  reverseResultToAddress,
  findReferencePosition,
  snapshotFields,
  fieldsEqual,
  type AddressFieldsSnapshot,
} from '@/components/shared/addresses/useAddressMapGeocoding.helpers';

// Re-export for backward compatibility — original module surface
export { reverseResultToAddress, findReferencePosition };

const logger = createModuleLogger('AddressMapGeocoding');

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
  /** Address ids whose cached coords are stale (user edited a geocoding field). */
  staleAddressIds: ReadonlySet<string>;
  /** Bypass cached coords on next run for stale ids — Google-style "force refresh". */
  forceRegeocodeAll: () => void;
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
  const [staleAddressIds, setStaleAddressIds] = useState<Set<string>>(new Set());

  // Snapshot of geocoding-relevant fields per address from the previous render.
  // Used to flag addresses as `stale` when the user edits a relevant field on
  // an address that already carries cached `coordinates`.
  const fieldsSnapshotRef = useRef<Map<string, AddressFieldsSnapshot>>(new Map());

  // Force-regeocode trigger: set of ids that must bypass the cached-coordinates
  // shortcut on the next geocoding run, plus a counter to re-trigger the effect
  // even when `addresses` reference is unchanged.
  const bypassCacheIdsRef = useRef<Set<string>>(new Set());
  const [forceTick, setForceTick] = useState(0);

  // Track if map has ever rendered successfully (prevents unmount during re-geocoding)
  const hasEverRenderedRef = useRef(false);

  if (geocodingStatus === 'success' || geocodingStatus === 'partial') {
    hasEverRenderedRef.current = true;
  }

  // ===========================================================================
  // STALE DETECTION — Track field changes on addresses with cached coordinates
  // ===========================================================================
  //
  // When an address already has `coordinates` (set from a previous geocoding
  // run or by the user) and one of the geocoding-relevant fields changes,
  // mark it as stale. The map keeps showing the OLD pin until the user hits
  // the "force re-geocode" button — Google-style explicit feedback rather
  // than silent ignore.
  useEffect(() => {
    const prevSnapshots = fieldsSnapshotRef.current;
    const nextSnapshots = new Map<string, AddressFieldsSnapshot>();
    const newlyStale = new Set<string>(staleAddressIds);

    for (const addr of addresses) {
      const snap = snapshotFields(addr);
      nextSnapshots.set(addr.id, snap);

      const prev = prevSnapshots.get(addr.id);
      const hasCoords = !!(addr.coordinates?.lat && addr.coordinates?.lng);
      if (prev && hasCoords && !fieldsEqual(prev, snap)) {
        newlyStale.add(addr.id);
      }
    }

    // Drop ids that no longer exist
    const currentIds = new Set(addresses.map((a) => a.id));
    for (const id of newlyStale) {
      if (!currentIds.has(id)) newlyStale.delete(id);
    }

    fieldsSnapshotRef.current = nextSnapshots;

    // Avoid infinite loops: only setState if Set actually changed
    if (
      newlyStale.size !== staleAddressIds.size ||
      [...newlyStale].some((id) => !staleAddressIds.has(id))
    ) {
      setStaleAddressIds(newlyStale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses]);

  // ===========================================================================
  // FORCE RE-GEOCODE — User-triggered "refresh stale pins" action
  // ===========================================================================
  const forceRegeocodeAll = useCallback(() => {
    if (staleAddressIds.size === 0) return;
    bypassCacheIdsRef.current = new Set(staleAddressIds);
    setForceTick((n) => n + 1);
  }, [staleAddressIds]);

  // ===========================================================================
  // GEOCODING EFFECT
  // ===========================================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      const geocodeAllAddresses = async () => {
        const bypassIds = bypassCacheIdsRef.current;

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
            const addr = geocodable[i];
            try {
              // Use stored coordinates UNLESS this id is flagged for force re-geocode.
              if (
                addr.coordinates?.lat &&
                addr.coordinates?.lng &&
                !bypassIds.has(addr.id)
              ) {
                geocodedMap.set(addr.id, {
                  lat: addr.coordinates.lat,
                  lng: addr.coordinates.lng,
                  accuracy: 'exact',
                  confidence: 1,
                  displayName: [addr.street, addr.number, addr.city].filter(Boolean).join(' '),
                });
                successCount++;
                continue;
              }
              const query = formatAddressForGeocoding(addr);
              const result = await geocodeAddress(query);
              if (result) {
                geocodedMap.set(addr.id, result);
                successCount++;
              }
            } catch {
              logger.warn('Geocoding failed for address', { data: { id: addr.id } });
            }
          }

          // Reset stale flags + bypass set for the ids we just refreshed
          if (bypassIds.size > 0) {
            setStaleAddressIds((prev) => {
              const next = new Set(prev);
              for (const id of bypassIds) next.delete(id);
              return next;
            });
            bypassCacheIdsRef.current = new Set();
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
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, onGeocodingComplete, forceTick]);

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

  // Trigger 2 — Edit mode: fit on entry + re-fit when pin count CHANGES
  // (added pin, deleted pin, pending pin appended/removed). Does NOT re-fit
  // on drag or repeated calls with same counts — that would fight the user
  // dragging or panning the map.
  const lastEditFitRef = useRef(false);
  const lastGeocodedCountRef = useRef(0);
  const lastAddressCountRef = useRef(0);
  useEffect(() => {
    if (!draggableMarkers) {
      lastEditFitRef.current = false;
      lastGeocodedCountRef.current = 0;
      lastAddressCountRef.current = 0;
      return;
    }
    const geocodedCount = geocodedAddresses.size;
    const addressCount = addresses.length;
    const countChanged =
      geocodedCount !== lastGeocodedCountRef.current ||
      addressCount !== lastAddressCountRef.current;
    lastGeocodedCountRef.current = geocodedCount;
    lastAddressCountRef.current = addressCount;
    if (lastEditFitRef.current && !countChanged) return;
    runFitBounds();
    lastEditFitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggableMarkers, mapReady, geocodedAddresses, addresses]);

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
    // flushSync: commit dragPositions synchronously BEFORE maplibre's moveend
    // event triggers a MapContext re-render with old longitude/latitude props,
    // which would cause a visible pin snap-back to the previous position.
    flushSync(() => {
      setDragPositions(prev => {
        const next = new Map(prev);
        next.set(addressId, { lng, lat });
        return next;
      });
      setIsReverseGeocoding(true);
    });

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

  // Stale takes precedence over success/partial in the surfaced status, so the
  // chip can prompt the user to refresh. Loading and error keep their priority.
  const surfacedStatus: GeocodingStatus =
    geocodingStatus === 'loading' || geocodingStatus === 'error'
      ? geocodingStatus
      : staleAddressIds.size > 0
      ? 'stale'
      : geocodingStatus;

  return {
    geocodedAddresses,
    geocodingStatus: surfacedStatus,
    dragPositions,
    isReverseGeocoding,
    hasEverRendered: hasEverRenderedRef.current,
    staleAddressIds,
    forceRegeocodeAll,
    handleDragEnd,
    autoPanRafRef,
    autoPanDeltaRef,
    stopAutoPan,
    tickAutoPan,
  };
}

