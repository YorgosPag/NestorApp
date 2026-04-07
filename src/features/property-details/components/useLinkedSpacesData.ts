/**
 * useLinkedSpacesData - Data fetching hook for LinkedSpacesCard
 *
 * Extracted from LinkedSpacesCard.tsx for SRP compliance (ADR-065)
 * Loads parking options, storage options, and occupied space IDs
 *
 * @module features/property-details/components/useLinkedSpacesData
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

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
// Hook
// ============================================================================

/**
 * Fetches parking options, storage options, and occupied space IDs for a building.
 * Occupied spaces are those linked to OTHER units (not the current propertyId).
 */
export function useLinkedSpacesData(
  buildingId: string | undefined,
  propertyId: string
): LinkedSpacesDataResult {
  const [parkingOptions, setParkingOptions] = useState<ParkingOption[]>([]);
  const [storageOptions, setStorageOptions] = useState<StorageOption[]>([]);
  const [loadingParking, setLoadingParking] = useState(false);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [occupiedSpaceIds, setOccupiedSpaceIds] = useState<Set<string>>(new Set());

  // Load occupied spaces (spaces linked to OTHER units)
  useEffect(() => {
    const loadOccupiedSpaces = async () => {
      if (!buildingId) {
        setOccupiedSpaceIds(new Set());
        return;
      }

      try {
        interface PropertiesApiResponse {
          units?: Array<{ id: string; linkedSpaces?: Array<{ spaceId: string }> }>;
        }
        const result = await apiClient.get<PropertiesApiResponse>(
          `${API_ROUTES.PROPERTIES.LIST}?buildingId=${buildingId}`
        );
        const occupied = new Set<string>();
        for (const unit of result?.units ?? []) {
          if (unit.id === propertyId) continue;
          for (const ls of unit.linkedSpaces ?? []) {
            occupied.add(ls.spaceId);
          }
        }
        setOccupiedSpaceIds(occupied);
        logger.info(`[useLinkedSpacesData] Found ${occupied.size} spaces occupied by other units`);
      } catch {
        setOccupiedSpaceIds(new Set());
      }
    };

    loadOccupiedSpaces();
  }, [buildingId, propertyId]);

  // Load parking options
  useEffect(() => {
    const loadParking = async () => {
      if (!buildingId) {
        setParkingOptions([]);
        return;
      }

      setLoadingParking(true);
      try {
        interface ParkingApiResponse {
          parkingSpots?: Array<{ id: string; number: string; type?: string; status?: string; floor?: string }>;
        }
        const result = await apiClient.get<ParkingApiResponse>(`${API_ROUTES.PARKING.LIST}?buildingId=${buildingId}`);
        const parkingData = result?.parkingSpots || [];
        setParkingOptions(parkingData);
        logger.info(`[useLinkedSpacesData] Loaded ${parkingData.length} parking spots`);
      } catch (error) {
        if (ApiClientError.isApiClientError(error) && (error.statusCode === 403 || error.statusCode === 404)) {
          logger.info(`[useLinkedSpacesData] No parking data (${error.statusCode})`);
        } else {
          logger.warn('[useLinkedSpacesData] Error loading parking:', { data: error });
        }
        setParkingOptions([]);
      } finally {
        setLoadingParking(false);
      }
    };

    loadParking();
  }, [buildingId]);

  // Load storage options
  useEffect(() => {
    const loadStorage = async () => {
      if (!buildingId) {
        setStorageOptions([]);
        return;
      }

      setLoadingStorage(true);
      try {
        interface StorageApiResponse {
          storages?: Array<{ id: string; name: string; buildingId?: string; type?: string; status?: string; floor?: string; area?: number }>;
        }
        const result = await apiClient.get<StorageApiResponse>(`${API_ROUTES.STORAGES.LIST}?buildingId=${buildingId}`);
        const storageData = result?.storages || [];
        setStorageOptions(storageData);
        logger.info(`[useLinkedSpacesData] Loaded ${storageData.length} storages`);
      } catch (error) {
        if (ApiClientError.isApiClientError(error) && (error.statusCode === 403 || error.statusCode === 404)) {
          logger.info(`[useLinkedSpacesData] No storage data (${error.statusCode})`);
        } else {
          logger.warn('[useLinkedSpacesData] Error loading storages:', { data: error });
        }
        setStorageOptions([]);
      } finally {
        setLoadingStorage(false);
      }
    };

    loadStorage();
  }, [buildingId]);

  return {
    parkingOptions,
    storageOptions,
    occupiedSpaceIds,
    loadingParking,
    loadingStorage,
  };
}
