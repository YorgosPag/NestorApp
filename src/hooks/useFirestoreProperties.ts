'use client';

/**
 * ENTERPRISE PROPERTIES HOOK
 *
 * React hook for Firestore properties data.
 * Supports optional buildingId/floorId filtering (ADR-184 — Building Spaces Tabs).
 * Uses centralized useAsyncData hook (ADR-223).
 */

import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { Property } from '@/types/property';
import { createModuleLogger } from '@/lib/telemetry';
import { useAsyncData } from '@/hooks/useAsyncData';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('useFirestoreProperties');

// ADR-300: Module-level cache keyed by buildingId+floorId — survives remount
const propertiesCache = createStaleCache<Property[]>('properties');

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface UseFirestorePropertiesOptions {
  /** Filter by building ID (ADR-184) */
  buildingId?: string;
  /** Filter by floor ID */
  floorId?: string;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

interface UseFirestorePropertiesReturn {
  properties: Property[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface PropertiesApiResponse {
  units: Property[];
  count?: number;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useFirestoreProperties(
  options: UseFirestorePropertiesOptions = {}
): UseFirestorePropertiesReturn {
  const { buildingId, floorId, autoFetch = true } = options;
  const { user, loading: authLoading } = useAuth();

  const cacheKey = `${buildingId ?? 'all'}_${floorId ?? ''}`;

  const { data, loading, error, refetch } = useAsyncData({
    fetcher: async () => {
      const params = new URLSearchParams();
      if (buildingId) params.set('buildingId', buildingId);
      if (floorId) params.set('floorId', floorId);

      const queryString = params.toString();
      const url = queryString ? `${API_ROUTES.PROPERTIES.LIST}?${queryString}` : API_ROUTES.PROPERTIES.LIST;

      logger.info('Fetching properties', { buildingId, floorId });
      const response = await apiClient.get<PropertiesApiResponse>(url);
      const properties = response?.units || [];
      logger.info(`Loaded ${properties.length} properties`, { buildingId });

      // ADR-300: Write to module-level cache so next remount skips spinner
      propertiesCache.set(properties, cacheKey);
      return properties;
    },
    deps: [buildingId, floorId, user?.uid],
    enabled: autoFetch && !authLoading && !!user,
    initialData: propertiesCache.get(cacheKey),
    silentInitialFetch: propertiesCache.hasLoaded(cacheKey),
  });

  return {
    properties: data ?? [],
    loading,
    error,
    refetch,
  };
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Get properties for a specific building (ADR-184)
 */
export function useBuildingProperties(buildingId: string): UseFirestorePropertiesReturn {
  return useFirestoreProperties({ buildingId });
}

export default useFirestoreProperties;



