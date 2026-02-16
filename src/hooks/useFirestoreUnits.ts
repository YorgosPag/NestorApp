'use client';

/**
 * ENTERPRISE UNITS HOOK
 *
 * React hook for Firestore units data.
 * Supports optional buildingId/floorId filtering (ADR-184 — Building Spaces Tabs).
 *
 * USAGE:
 * ```tsx
 * // Get units for specific building
 * const { units, loading, error } = useFirestoreUnits({ buildingId: 'bldg_xxx' });
 *
 * // Get all units
 * const { units, loading, error } = useFirestoreUnits();
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { Unit } from '@/types/unit';
import { createModuleLogger } from '@/lib/telemetry';

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

  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnits = useCallback(async () => {
    if (authLoading) {
      logger.info('Waiting for auth state');
      return;
    }

    if (!user) {
      setLoading(false);
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build API URL with optional filters
      const params = new URLSearchParams();
      if (buildingId) params.set('buildingId', buildingId);
      if (floorId) params.set('floorId', floorId);

      const queryString = params.toString();
      const url = queryString ? `/api/units?${queryString}` : '/api/units';

      logger.info('Fetching units', { buildingId, floorId });

      const data = await apiClient.get<UnitsApiResponse>(url);

      setUnits(data?.units || []);
      logger.info(`Loaded ${data?.units?.length || 0} units`, { buildingId });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Error fetching units', { error: err });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [buildingId, floorId, user, authLoading]);

  useEffect(() => {
    if (autoFetch && !authLoading && user) {
      fetchUnits();
    }
  }, [fetchUnits, autoFetch, authLoading, user]);

  return {
    units,
    loading,
    error,
    refetch: fetchUnits
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
