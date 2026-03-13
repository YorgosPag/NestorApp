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
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import type { ParkingSpot } from '@/types/parking';
import { useAsyncData } from '@/hooks/useAsyncData';

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

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useFirestoreParkingSpots(
  options: UseFirestoreParkingOptions = {}
): UseFirestoreParkingReturn {
  const { buildingId, projectId, autoFetch = true } = options;
  const { user, loading: authLoading } = useAuth();

  const { data, loading, error, refetch } = useAsyncData<ParkingFetchResult>({
    fetcher: async () => {
      logger.info('Fetching parking spots');

      const params = new URLSearchParams();
      if (buildingId) params.set('buildingId', buildingId);
      if (projectId) params.set('projectId', projectId);
      const url = params.toString() ? `/api/parking?${params.toString()}` : '/api/parking';

      const result = await apiClient.get<ParkingApiResponse>(url);
      logger.info(`Loaded ${result?.parkingSpots?.length || 0} parking spots`, { buildingId });

      return {
        spots: result?.parkingSpots || [],
        cached: result?.cached ?? false,
      };
    },
    deps: [buildingId, projectId, user?.uid],
    enabled: autoFetch && !authLoading && !!user,
  });

  // Real-time sync
  useEffect(() => {
    const unsubCreate = RealtimeService.subscribe('PARKING_CREATED', () => {
      logger.debug('Parking created event received, refetching');
      refetch();
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
  }, [refetch]);

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
