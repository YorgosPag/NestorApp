'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { Building } from '@/types/building/contracts';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type BuildingUpdatedPayload, type BuildingCreatedPayload, type BuildingDeletedPayload } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { applyUpdates } from '@/lib/utils';

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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 🏢 ENTERPRISE: Real-time handlers for BUILDING_UPDATED/CREATED/DELETED
  useEffect(() => {
    const handleBuildingUpdate = (payload: BuildingUpdatedPayload) => {
      logger.info('Applying update for building', { buildingId: payload.buildingId });
      setBuildings(prev => prev.map(building =>
        building.id === payload.buildingId
          ? applyUpdates(building, payload.updates)
          : building
      ));
    };

    const handleBuildingCreated = (_payload: BuildingCreatedPayload) => {
      logger.info('Building created, triggering refetch');
      setRefreshTrigger(prev => prev + 1);
    };

    const handleBuildingDeleted = (payload: BuildingDeletedPayload) => {
      logger.info('Removing deleted building from list', { buildingId: payload.buildingId });
      setBuildings(prev => prev.filter(building => building.id !== payload.buildingId));
    };

    const unsubUpdate = RealtimeService.subscribe('BUILDING_UPDATED', handleBuildingUpdate);
    const unsubCreate = RealtimeService.subscribe('BUILDING_CREATED', handleBuildingCreated);
    const unsubDelete = RealtimeService.subscribe('BUILDING_DELETED', handleBuildingDeleted);

    return () => {
      unsubUpdate();
      unsubCreate();
      unsubDelete();
    };
  }, []);

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

  // Fetch buildings when auth is ready or manual refresh triggered
  useEffect(() => {
    if (!authLoading && user) {
      fetchBuildings();
    }
  }, [authLoading, user, refreshTrigger]);

  return {
    buildings,
    loading,
    error,
    refetch: fetchBuildings
  };
}