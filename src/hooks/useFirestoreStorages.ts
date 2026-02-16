'use client';

/**
 * ENTERPRISE STORAGE HOOK
 *
 * React hook for Firestore storage units data.
 * Supports optional buildingId filtering (ADR-184 — Building Spaces Tabs).
 *
 * USAGE:
 * ```tsx
 * // Get storages for specific building
 * const { storages, loading, error } = useFirestoreStorages({ buildingId: 'bldg_xxx' });
 *
 * // Get all storages
 * const { storages, loading, error } = useFirestoreStorages();
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { Storage } from '@/types/storage/contracts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFirestoreStorages');

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

  const [storages, setStorages] = useState<Storage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStorages = useCallback(async () => {
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

      // Build API URL with optional buildingId filter
      const url = buildingId
        ? `/api/storages?buildingId=${encodeURIComponent(buildingId)}`
        : '/api/storages';

      logger.info('Fetching storages', { buildingId });

      const data = await apiClient.get<StoragesApiResponse>(url);

      setStorages(data?.storages || []);
      logger.info(`Loaded ${data?.storages?.length || 0} storages`, { buildingId });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Error fetching storages', { error: err });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [buildingId, user, authLoading]);

  useEffect(() => {
    if (autoFetch && !authLoading && user) {
      fetchStorages();
    }
  }, [fetchStorages, autoFetch, authLoading, user]);

  return {
    storages,
    loading,
    error,
    refetch: fetchStorages
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
