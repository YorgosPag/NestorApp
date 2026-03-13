'use client';

/**
 * 🏢 ENTERPRISE: Real-time Buildings Hook for Navigation
 *
 * Provides real-time updates for buildings grouped by projectId.
 * Used by NavigationContext to show live building counts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { DocumentData } from 'firebase/firestore';
import type { RealtimeBuilding, SubscriptionStatus } from '../types';
import { REALTIME_EVENTS } from '../types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useRealtimeBuildings');

// ============================================================================
// TYPES
// ============================================================================

interface BuildingsByProject {
  [projectId: string]: RealtimeBuilding[];
}

interface UseRealtimeBuildingsReturn {
  /** Buildings grouped by projectId */
  buildingsByProject: BuildingsByProject;
  /** All buildings flat array */
  allBuildings: RealtimeBuilding[];
  /** Get buildings for a specific project */
  getBuildingsForProject: (projectId: string) => RealtimeBuilding[];
  /** Get building count for a project */
  getBuildingCount: (projectId: string) => number;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Subscription status */
  status: SubscriptionStatus;
  /** Manual refetch */
  refetch: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Real-time buildings hook
 *
 * Watches the buildings collection and groups by projectId.
 * Automatically updates when buildings are added/removed/modified.
 *
 * @example
 * ```tsx
 * const { getBuildingCount, buildingsByProject } = useRealtimeBuildings();
 *
 * // Get count for a specific project
 * const count = getBuildingCount('projectId123'); // Returns number
 *
 * // Get all buildings for a project
 * const buildings = buildingsByProject['projectId123']; // Returns Building[]
 * ```
 */
export function useRealtimeBuildings(): UseRealtimeBuildingsReturn {
  // State
  const [allBuildings, setAllBuildings] = useState<RealtimeBuilding[]>([]);
  const [buildingsByProject, setBuildingsByProject] = useState<BuildingsByProject>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>('idle');

  // Refs
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const refreshTriggerRef = useRef(0);

  /**
   * 🏢 ENTERPRISE: Group buildings by projectId
   */
  const groupBuildingsByProject = useCallback((buildings: RealtimeBuilding[]): BuildingsByProject => {
    const grouped: BuildingsByProject = {};

    buildings.forEach((building) => {
      const projectId = building.projectId || '__unassigned__';
      if (!grouped[projectId]) {
        grouped[projectId] = [];
      }
      grouped[projectId].push(building);
    });

    return grouped;
  }, []);

  /**
   * 🏢 ENTERPRISE: Get buildings for a specific project
   */
  const getBuildingsForProject = useCallback(
    (projectId: string): RealtimeBuilding[] => {
      return buildingsByProject[projectId] || [];
    },
    [buildingsByProject]
  );

  /**
   * 🏢 ENTERPRISE: Get building count for a project
   */
  const getBuildingCount = useCallback(
    (projectId: string): number => {
      return (buildingsByProject[projectId] || []).length;
    },
    [buildingsByProject]
  );

  /**
   * 🏢 ENTERPRISE: Manual refetch
   */
  const refetch = useCallback(() => {
    refreshTriggerRef.current += 1;
    setLoading(true);
    setError(null);
  }, []);

  // ==========================================================================
  // MAIN SUBSCRIPTION EFFECT - WAITS FOR AUTHENTICATION
  // ==========================================================================

  useEffect(() => {
    setStatus('connecting');
    setLoading(true);

    // 🔐 ENTERPRISE: firestoreQueryService.subscribe() handles auth internally
    // and auto-injects companyId tenant filter — SECURITY FIX for cross-tenant data leak
    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'BUILDINGS',
      (result: QueryResult<DocumentData>) => {
        const buildings: RealtimeBuilding[] = result.documents.map(doc => ({
          id: doc.id,
          name: (doc.name as string) || '',
          projectId: (doc.projectId as string) || null,
          address: doc.address as string | undefined,
          city: doc.city as string | undefined,
          status: doc.status as string | undefined,
          totalArea: doc.totalArea as number | undefined,
          floors: doc.floors as number | undefined,
          units: doc.units as number | undefined,
          createdAt: doc.createdAt as string | undefined,
          updatedAt: doc.updatedAt as string | undefined,
        }));

        logger.info('Received buildings in real-time', { count: buildings.length });

        setAllBuildings(buildings);
        setBuildingsByProject(groupBuildingsByProject(buildings));
        setLoading(false);
        setError(null);
        setStatus('active');
      },
      (err: Error) => {
        logger.error('Firestore error', { error: err.message });
        setError(err.message);
        setLoading(false);
        setStatus('error');
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      logger.info('Cleaning up subscription');
      unsubscribe();
    };
  }, [refreshTriggerRef.current, groupBuildingsByProject]);

  // ==========================================================================
  // LISTEN FOR EXTERNAL EVENTS
  // ==========================================================================

  useEffect(() => {
    const handleNavigationRefresh = () => {
      logger.info('[useRealtimeBuildings] Navigation refresh event received');
      // No need to refetch - onSnapshot already handles real-time updates
      // But we can force a re-render if needed
    };

    window.addEventListener(REALTIME_EVENTS.NAVIGATION_REFRESH, handleNavigationRefresh);

    return () => {
      window.removeEventListener(REALTIME_EVENTS.NAVIGATION_REFRESH, handleNavigationRefresh);
    };
  }, []);

  return {
    buildingsByProject,
    allBuildings,
    getBuildingsForProject,
    getBuildingCount,
    loading,
    error,
    status,
    refetch,
  };
}

export default useRealtimeBuildings;
