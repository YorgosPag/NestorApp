'use client';

/**
 * ENTERPRISE PARKING HOOK
 *
 * React hook for Firestore parking spots data.
 * Uses centralized useAsyncData hook (ADR-223).
 */

import { useEffect } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import type { ParkingSpot } from '@/types/parking';
import { useAsyncData } from '@/hooks/useAsyncData';
import { createStaleCache } from '@/lib/stale-cache';

// =============================================================================
// TYPE RE-EXPORTS — Canonical SSoT from @/types/parking (ADR-191)
// =============================================================================

export type { ParkingSpot, ParkingSpotType, ParkingSpotStatus, ParkingLocationZone } from '@/types/parking';

interface UseFirestoreParkingOptions {
  /** Filter by building ID */
  buildingId?: string;
  /** Filter by project ID (ADR-191) */
  projectId?: string;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

interface UseFirestoreParkingReturn {
  parkingSpots: ParkingSpot[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  cached: boolean;
}

interface ParkingApiResponse {
  parkingSpots: ParkingSpot[];
  count?: number;
  cached?: boolean;
}

interface ParkingFetchResult {
  spots: ParkingSpot[];
  cached: boolean;
}

const logger = createModuleLogger('useFirestoreParkingSpots');

// SSoT stale-while-revalidate cache (ADR-300) — keyed by buildingId:projectId
const parkingCache = createStaleCache<ParkingFetchResult>('parking');

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useFirestoreParkingSpots(
  options: UseFirestoreParkingOptions = {}
): UseFirestoreParkingReturn {
  const { buildingId, projectId, autoFetch = true } = options;
  const { user, loading: authLoading } = useAuth();

  const cacheKey = `${buildingId ?? 'all'}:${projectId ?? 'all'}`;

  const { data, loading, error, refetch, silentRefetch, patch } = useAsyncData<ParkingFetchResult>({
    fetcher: async () => {
      logger.info('Fetching parking spots');

      const params = new URLSearchParams();
      if (buildingId) params.set('buildingId', buildingId);
      if (projectId) params.set('projectId', projectId);
      const url = params.toString() ? `${API_ROUTES.PARKING.LIST}?${params.toString()}` : API_ROUTES.PARKING.LIST;

      const result = await apiClient.get<ParkingApiResponse>(url);
      logger.info(`Loaded ${result?.parkingSpots?.length || 0} parking spots`, { buildingId });

      const fetchResult: ParkingFetchResult = {
        spots: result?.parkingSpots || [],
        cached: result?.cached ?? false,
      };
      parkingCache.set(fetchResult, cacheKey);
      return fetchResult;
    },
    deps: [buildingId, projectId, user?.uid],
    enabled: autoFetch && !authLoading && !!user,
    initialData: parkingCache.get(cacheKey) ?? undefined,
    silentInitialFetch: parkingCache.hasLoaded(cacheKey),
  });

  // Real-time sync
  useEffect(() => {
    const unsubCreate = RealtimeService.subscribe('PARKING_CREATED', (payload) => {
      logger.debug('Parking created — optimistic insert then silent sync');
      // 1. Instant optimistic insert: spot appears immediately, no loading flicker
      const optimisticSpot: ParkingSpot = {
        id: payload.parkingSpotId,
        number: payload.parkingSpot.number ?? '',
        type: (payload.parkingSpot.type as ParkingSpot['type']) ?? 'standard',
        status: (payload.parkingSpot.status as ParkingSpot['status']) ?? 'available',
        buildingId: payload.parkingSpot.buildingId ?? null,
      };
      patch(prev => ({
        spots: [...(prev?.spots ?? []), optimisticSpot],
        cached: false,
      }));
      // 2. Silent background sync to reconcile with full server data
      silentRefetch();
    });
    const unsubUpdate = RealtimeService.subscribe('PARKING_UPDATED', () => {
      logger.debug('Parking updated event received, refetching');
      refetch();
    });
    const unsubDelete = RealtimeService.subscribe('PARKING_DELETED', () => {
      logger.debug('Parking deleted event received, refetching');
      refetch();
    });

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubDelete();
    };
  }, [refetch, silentRefetch, patch]);

  return {
    parkingSpots: data?.spots ?? [],
    loading,
    error,
    refetch,
    cached: data?.cached ?? false,
  };
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export function useBuildingParkingSpots(buildingId: string): UseFirestoreParkingReturn {
  return useFirestoreParkingSpots({ buildingId });
}

export default useFirestoreParkingSpots;
