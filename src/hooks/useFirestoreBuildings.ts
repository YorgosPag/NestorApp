'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { Building } from '@/types/building/contracts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFirestoreBuildings');

interface UseFirestoreBuildingsReturn {
  buildings: Building[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * 🏢 ENTERPRISE: Response data type (apiClient returns unwrapped data)
 *
 * The endpoint returns: { success: true, data: { buildings, count, ... } }
 * But apiClient.get() unwraps it and returns just the data object.
 */
interface BuildingsData {
  buildings: Building[];
  count: number;
  projectId?: string;
}

export function useFirestoreBuildings(): UseFirestoreBuildingsReturn {
  // 🔐 ENTERPRISE: Wait for auth state before making API calls
  const { user, loading: authLoading } = useAuth();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuildings = async () => {
    try {
      // 🔐 AUTH-READY GATING - Wait for authentication
      if (authLoading) {
        // Auth state is still loading - wait for it
        logger.info('Waiting for auth state');
        return; // Will retry via useEffect when authLoading changes
      }

      if (!user) {
        // User not authenticated - cannot proceed
        setLoading(false);
        setError('User not authenticated');
        return;
      }

      setLoading(true);
      setError(null);

      logger.info('Fetching buildings');

      // 🏢 ENTERPRISE: Use centralized API client (automatic Authorization header + unwrap)
      // apiClient.get() returns unwrapped data (not { success, data })
      const data = await apiClient.get<BuildingsData>('/api/buildings');

      // 🏢 ENTERPRISE: Validate unwrapped data
      if (!data || !data.buildings) {
        throw new Error('Invalid response format from API');
      }

      setBuildings(data.buildings);
      logger.info(`Loaded ${data.count} buildings`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Error fetching buildings', { error: err });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fetch buildings when auth is ready
  useEffect(() => {
    if (!authLoading && user) {
      fetchBuildings();
    }
  }, [authLoading, user]);

  return {
    buildings,
    loading,
    error,
    refetch: fetchBuildings
  };
}