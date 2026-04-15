'use client';

/**
 * ENTERPRISE STORAGE HOOK
 *
 * React hook for Firestore storage units data.
 * Supports optional buildingId filtering (ADR-184 — Building Spaces Tabs).
 * Uses centralized useAsyncData hook (ADR-223).
 */

import { useEffect } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import type { Storage } from '@/types/storage/contracts';
import { createModuleLogger } from '@/lib/telemetry';
import { useAsyncData } from '@/hooks/useAsyncData';
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('useFirestoreStorages');

// SSoT stale-while-revalidate cache (ADR-300) — keyed by buildingId or 'all'
const storagesCache = createStaleCache<Storage[]>('storages');

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface UseFirestoreStoragesOptions {
  /** Filter by building ID (ADR-184) */
  buildingId?: string;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

interface UseFirestoreStoragesReturn {
  storages: Storage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface StoragesApiResponse {
  storages: Storage[];
  count?: number;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useFirestoreStorages(
  options: UseFirestoreStoragesOptions = {}
): UseFirestoreStoragesReturn {
  const { buildingId, autoFetch = true } = options;
  const { user, loading: authLoading } = useAuth();

  const cacheKey = buildingId ?? 'all';

  const { data, loading, error, refetch } = useAsyncData({
    fetcher: async () => {
      const url = buildingId
        ? `${API_ROUTES.STORAGES.LIST}?buildingId=${encodeURIComponent(buildingId)}`
        : API_ROUTES.STORAGES.LIST;

      logger.info('Fetching storages', { buildingId });
      const result = await apiClient.get<StoragesApiResponse>(url);
      const storages = result?.storages || [];
      logger.info(`Loaded ${storages.length} storages`, { buildingId });

      storagesCache.set(storages, cacheKey);
      return storages;
    },
    deps: [buildingId, user?.uid],
    enabled: autoFetch && !authLoading && !!user,
    initialData: storagesCache.get(cacheKey),
    silentInitialFetch: storagesCache.hasLoaded(cacheKey),
  });

  // Real-time sync — refetch on storage CRUD events
  useEffect(() => {
    const unsubCreated = RealtimeService.subscribe('STORAGE_CREATED', () => {
      logger.debug('Storage created event — refetching list');
      refetch();
    });
    const unsubUpdated = RealtimeService.subscribe('STORAGE_UPDATED', () => {
      logger.debug('Storage updated event — refetching list');
      refetch();
    });
    const unsubDeleted = RealtimeService.subscribe('STORAGE_DELETED', () => {
      logger.debug('Storage deleted event — refetching list');
      refetch();
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, [refetch]);

  return {
    storages: data ?? [],
    loading,
    error,
    refetch,
  };
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Get storages for a specific building (ADR-184)
 */
export function useBuildingStorages(buildingId: string): UseFirestoreStoragesReturn {
  return useFirestoreStorages({ buildingId });
}

export default useFirestoreStorages;
