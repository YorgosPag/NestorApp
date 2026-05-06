/**
 * useLinkedSpacesData - Data fetching hook for LinkedSpacesCard
 *
 * Extracted from LinkedSpacesCard.tsx for SRP compliance (ADR-065)
 * Loads parking options, storage options, and occupied space IDs
 *
 * @module features/property-details/components/useLinkedSpacesData
 * @version 2.0.0 — Google-level request deduplication (module-level cache)
 */

import { useState, useEffect, useRef } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type { UnitsApiData, ParkingApiData, StoragesApiData } from '@/types/api/building-spaces.api.types';

const logger = createModuleLogger('useLinkedSpacesData');

// ============================================================================
// Types
// ============================================================================

export interface ParkingOption {
  id: string;
  number: string;
  type?: string;
  status?: string;
  floor?: string;
}

export interface StorageOption {
  id: string;
  name: string;
  type?: string;
  status?: string;
  floor?: string;
  area?: number;
}

interface LinkedSpacesDataResult {
  parkingOptions: ParkingOption[];
  storageOptions: StorageOption[];
  occupiedSpaceIds: Set<string>;
  loadingParking: boolean;
  loadingStorage: boolean;
}

// ============================================================================
// Module-level request deduplication cache (Google in-flight dedup pattern)
// Multiple component instances sharing the same buildingId share one Promise.
// Resolved data is kept for CACHE_TTL_MS to avoid refetch on re-mount.
// ============================================================================

const CACHE_TTL_MS = 30_000;

interface CacheEntry<T> {
  promise: Promise<T>;
  resolvedAt?: number;
}

function makeCache<T>() {
  const store = new Map<string, CacheEntry<T>>();

  return function get(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = store.get(key);
    if (existing) {
      const isStale = existing.resolvedAt !== undefined && Date.now() - existing.resolvedAt > CACHE_TTL_MS;
      if (!isStale) return existing.promise;
      store.delete(key);
    }
    const promise = fetcher().then(data => {
      const entry = store.get(key);
      if (entry) entry.resolvedAt = Date.now();
      return data;
    }).catch(err => {
      store.delete(key);
      throw err;
    });
    store.set(key, { promise });
    return promise;
  };
}

const propertiesCache = makeCache<UnitsApiData>();
const parkingCache    = makeCache<ParkingApiData>();
const storagesCache   = makeCache<StoragesApiData>();

// ============================================================================
// Hook
// ============================================================================

/**
 * Fetches parking options, storage options, and occupied space IDs for a building.
 * Occupied spaces are those linked to OTHER units (not the current propertyId).
 *
 * Uses module-level deduplication: 6 simultaneous instances for the same
 * buildingId issue only 3 network requests (one per endpoint).
 */
export function useLinkedSpacesData(
  buildingId: string | undefined,
  propertyId: string
): LinkedSpacesDataResult {
  const [parkingOptions, setParkingOptions]   = useState<ParkingOption[]>([]);
  const [storageOptions, setStorageOptions]   = useState<StorageOption[]>([]);
  const [loadingParking, setLoadingParking]   = useState(false);
  const [loadingStorage, setLoadingStorage]   = useState(false);
  const [occupiedSpaceIds, setOccupiedSpaceIds] = useState<Set<string>>(new Set());

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Single coordinated effect — all three fetches in parallel
  useEffect(() => {
    if (!buildingId) {
      setParkingOptions([]);
      setStorageOptions([]);
      setOccupiedSpaceIds(new Set());
      return;
    }

    setLoadingParking(true);
    setLoadingStorage(true);

    const fetchProperties = propertiesCache(
      buildingId,
      () => apiClient.get<UnitsApiData>(`${API_ROUTES.PROPERTIES.LIST}?buildingId=${buildingId}`)
    );

    const fetchParking = parkingCache(
      buildingId,
      () => apiClient.get<ParkingApiData>(`${API_ROUTES.PARKING.LIST}?buildingId=${buildingId}`)
    );

    const fetchStorages = storagesCache(
      buildingId,
      () => apiClient.get<StoragesApiData>(`${API_ROUTES.STORAGES.LIST}?buildingId=${buildingId}`)
    );

    Promise.allSettled([fetchProperties, fetchParking, fetchStorages]).then(
      ([propertiesResult, parkingResult, storagesResult]) => {
        if (!mountedRef.current) return;

        // Occupied spaces
        if (propertiesResult.status === 'fulfilled') {
          const occupied = new Set<string>();
          for (const unit of propertiesResult.value?.units ?? []) {
            if (unit.id === propertyId) continue;
            for (const ls of unit.linkedSpaces ?? []) occupied.add(ls.spaceId);
          }
          setOccupiedSpaceIds(occupied);
          logger.info(`[useLinkedSpacesData] Found ${occupied.size} spaces occupied by other units`);
        } else {
          setOccupiedSpaceIds(new Set());
        }

        // Parking
        if (parkingResult.status === 'fulfilled') {
          const spots = parkingResult.value?.parkingSpots ?? [];
          setParkingOptions(spots);
          logger.info(`[useLinkedSpacesData] Loaded ${spots.length} parking spots`);
        } else {
          const err = parkingResult.reason;
          if (ApiClientError.isApiClientError(err) && (err.statusCode === 403 || err.statusCode === 404)) {
            logger.info(`[useLinkedSpacesData] No parking data (${err.statusCode})`);
          } else {
            logger.warn('[useLinkedSpacesData] Error loading parking:', { data: err });
          }
          setParkingOptions([]);
        }
        setLoadingParking(false);

        // Storages
        if (storagesResult.status === 'fulfilled') {
          const stores = storagesResult.value?.storages ?? [];
          setStorageOptions(stores);
          logger.info(`[useLinkedSpacesData] Loaded ${stores.length} storages`);
        } else {
          const err = storagesResult.reason;
          if (ApiClientError.isApiClientError(err) && (err.statusCode === 403 || err.statusCode === 404)) {
            logger.info(`[useLinkedSpacesData] No storage data (${err.statusCode})`);
          } else {
            logger.warn('[useLinkedSpacesData] Error loading storages:', { data: err });
          }
          setStorageOptions([]);
        }
        setLoadingStorage(false);
      }
    );
  }, [buildingId, propertyId]);

  return {
    parkingOptions,
    storageOptions,
    occupiedSpaceIds,
    loadingParking,
    loadingStorage,
  };
}
