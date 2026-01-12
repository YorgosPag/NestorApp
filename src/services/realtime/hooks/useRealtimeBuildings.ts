'use client';

/**
 * 🏢 ENTERPRISE: Real-time Buildings Hook for Navigation
 *
 * Provides real-time updates for buildings grouped by projectId.
 * Used by NavigationContext to show live building counts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { RealtimeBuilding, SubscriptionStatus } from '../types';
import { REALTIME_EVENTS } from '../types';

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

    const auth = getAuth();
    let firestoreUnsubscribe: (() => void) | null = null;

    // 🔐 ENTERPRISE: Wait for authentication before subscribing to Firestore
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      // Cleanup previous Firestore subscription if exists
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
      }

      if (!user) {
        console.log('⏳ [useRealtimeBuildings] Waiting for authentication...');
        setStatus('idle');
        setLoading(false);
        setAllBuildings([]);
        setBuildingsByProject({});
        return;
      }

      console.log('🔔 [useRealtimeBuildings] User authenticated, setting up real-time listener');

      const buildingsRef = collection(db, COLLECTIONS.BUILDINGS);

      firestoreUnsubscribe = onSnapshot(
        buildingsRef,
        (snapshot) => {
          const buildings: RealtimeBuilding[] = snapshot.docs.map((docSnapshot) => ({
            id: docSnapshot.id,
            name: docSnapshot.data().name || '',
            projectId: docSnapshot.data().projectId || null,
            address: docSnapshot.data().address,
            city: docSnapshot.data().city,
            status: docSnapshot.data().status,
            totalArea: docSnapshot.data().totalArea,
            floors: docSnapshot.data().floors,
            units: docSnapshot.data().units,
            createdAt: docSnapshot.data().createdAt,
            updatedAt: docSnapshot.data().updatedAt,
          }));

          console.log(`📡 [useRealtimeBuildings] Received ${buildings.length} buildings in real-time`);

          // Update state
          setAllBuildings(buildings);
          setBuildingsByProject(groupBuildingsByProject(buildings));
          setLoading(false);
          setError(null);
          setStatus('active');
        },
        (err) => {
          console.error('❌ [useRealtimeBuildings] Firestore error:', err);
          setError(err.message);
          setLoading(false);
          setStatus('error');
        }
      );

      unsubscribeRef.current = firestoreUnsubscribe;
    });

    // Cleanup both subscriptions
    return () => {
      console.log('🔕 [useRealtimeBuildings] Cleaning up subscriptions');
      authUnsubscribe();
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }
    };
  }, [refreshTriggerRef.current, groupBuildingsByProject]);

  // ==========================================================================
  // LISTEN FOR EXTERNAL EVENTS
  // ==========================================================================

  useEffect(() => {
    const handleNavigationRefresh = () => {
      console.log('🔄 [useRealtimeBuildings] Navigation refresh event received');
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
