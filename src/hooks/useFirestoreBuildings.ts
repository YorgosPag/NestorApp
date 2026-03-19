'use client';

/**
 * ENTERPRISE BUILDINGS HOOK
 *
 * Uses centralized useAsyncData hook (ADR-223).
 * Real-time sync via RealtimeService triggers refetch on CRUD events.
 */

import { useEffect } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { Building } from '@/types/building/contracts';
import { RealtimeService, type BuildingUpdatedPayload, type BuildingCreatedPayload, type BuildingDeletedPayload } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { useAsyncData } from '@/hooks/useAsyncData';

const logger = createModuleLogger('useFirestoreBuildings');

interface UseFirestoreBuildingsReturn {
  buildings: Building[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Response data type (apiClient returns unwrapped data)
 */
interface BuildingsData {
  buildings: Building[];
  count: number;
  projectId?: string;
}

export function useFirestoreBuildings(): UseFirestoreBuildingsReturn {
  const { user, loading: authLoading } = useAuth();

  const { data, loading, error, refetch } = useAsyncData({
    fetcher: async () => {
      logger.info('Fetching buildings');
      const result = await apiClient.get<BuildingsData>(API_ROUTES.BUILDINGS.LIST);

      if (!result || !result.buildings) {
        throw new Error('Invalid response format from API');
      }

      logger.info(`Loaded ${result.count} buildings`);
      return result.buildings;
    },
    deps: [user?.uid],
    enabled: !authLoading && !!user,
  });

  // Real-time handlers — all trigger refetch for server-consistent state
  useEffect(() => {
    const handleBuildingUpdate = (_payload: BuildingUpdatedPayload) => {
      logger.info('Building updated, triggering refetch');
      refetch();
    };

    const handleBuildingCreated = (_payload: BuildingCreatedPayload) => {
      logger.info('Building created, triggering refetch');
      refetch();
    };

    const handleBuildingDeleted = (_payload: BuildingDeletedPayload) => {
      logger.info('Building deleted, triggering refetch');
      refetch();
    };

    const unsubUpdate = RealtimeService.subscribe('BUILDING_UPDATED', handleBuildingUpdate);
    const unsubCreate = RealtimeService.subscribe('BUILDING_CREATED', handleBuildingCreated);
    const unsubDelete = RealtimeService.subscribe('BUILDING_DELETED', handleBuildingDeleted);

    return () => {
      unsubUpdate();
      unsubCreate();
      unsubDelete();
    };
  }, [refetch]);

  return {
    buildings: data ?? [],
    loading,
    error,
    refetch,
  };
}
