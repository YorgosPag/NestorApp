'use client';

/**
 * ENTERPRISE UNITS HOOK
 *
 * React hook for Firestore units data.
 * Supports optional buildingId/floorId filtering (ADR-184 — Building Spaces Tabs).
 * Uses centralized useAsyncData hook (ADR-223).
 */

import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { Unit } from '@/types/unit';
import { createModuleLogger } from '@/lib/telemetry';
import { useAsyncData } from '@/hooks/useAsyncData';

const logger = createModuleLogger('useFirestoreUnits');

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface UseFirestoreUnitsOptions {
  /** Filter by building ID (ADR-184) */
  buildingId?: string;
  /** Filter by floor ID */
  floorId?: string;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

interface UseFirestoreUnitsReturn {
  units: Unit[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UnitsApiResponse {
  units: Unit[];
  count?: number;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useFirestoreUnits(
  options: UseFirestoreUnitsOptions = {}
): UseFirestoreUnitsReturn {
  const { buildingId, floorId, autoFetch = true } = options;
  const { user, loading: authLoading } = useAuth();

  const { data, loading, error, refetch } = useAsyncData({
    fetcher: async () => {
      const params = new URLSearchParams();
      if (buildingId) params.set('buildingId', buildingId);
      if (floorId) params.set('floorId', floorId);

      const queryString = params.toString();
      const url = queryString ? `${API_ROUTES.UNITS.LIST}?${queryString}` : API_ROUTES.UNITS.LIST;

      logger.info('Fetching units', { buildingId, floorId });
      const result = await apiClient.get<UnitsApiResponse>(url);
      logger.info(`Loaded ${result?.units?.length || 0} units`, { buildingId });

      return result?.units || [];
    },
    deps: [buildingId, floorId, user?.uid],
    enabled: autoFetch && !authLoading && !!user,
  });

  return {
    units: data ?? [],
    loading,
    error,
    refetch,
  };
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Get units for a specific building (ADR-184)
 */
export function useBuildingUnits(buildingId: string): UseFirestoreUnitsReturn {
  return useFirestoreUnits({ buildingId });
}

export default useFirestoreUnits;
