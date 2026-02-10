'use client';

/**
 * 🏢 ENTERPRISE: Real-time Units Hook for Navigation
 *
 * Provides real-time updates for units grouped by buildingId.
 * Used by NavigationContext to show live unit counts per building.
 *
 * @compliance CLAUDE.md Enterprise Standards
 * - ZERO hardcoded values
 * - ZERO any types
 * - Full TypeScript strict mode
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { RealtimeUnit, SubscriptionStatus } from '../types';
import { REALTIME_EVENTS } from '../types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useRealtimeUnits');

// ============================================================================
// TYPES
// ============================================================================

interface UnitsByBuilding {
  [buildingId: string]: RealtimeUnit[];
}

interface UseRealtimeUnitsReturn {
  /** Units grouped by buildingId */
  unitsByBuilding: UnitsByBuilding;
  /** All units flat array */
  allUnits: RealtimeUnit[];
  /** Get units for a specific building */
  getUnitsForBuilding: (buildingId: string) => RealtimeUnit[];
  /** Get unit count for a building */
  getUnitCount: (buildingId: string) => number;
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
 * 🏢 ENTERPRISE: Real-time units hook
 *
 * Watches the units collection and groups by buildingId.
 * Automatically updates when units are added/removed/modified.
 *
 * @example
 * ```tsx
 * const { getUnitCount, unitsByBuilding } = useRealtimeUnits();
 *
 * // Get count for a specific building
 * const count = getUnitCount('buildingId123'); // Returns number
 *
 * // Get all units for a building
 * const units = unitsByBuilding['buildingId123']; // Returns Unit[]
 * ```
 */
export function useRealtimeUnits(): UseRealtimeUnitsReturn {
  // State
  const [allUnits, setAllUnits] = useState<RealtimeUnit[]>([]);
  const [unitsByBuilding, setUnitsByBuilding] = useState<UnitsByBuilding>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>('idle');

  // Refs
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const refreshTriggerRef = useRef(0);

  /**
   * 🏢 ENTERPRISE: Group units by buildingId
   */
  const groupUnitsByBuilding = useCallback((units: RealtimeUnit[]): UnitsByBuilding => {
    const grouped: UnitsByBuilding = {};

    units.forEach((unit) => {
      const buildingId = unit.buildingId || '__unassigned__';
      if (!grouped[buildingId]) {
        grouped[buildingId] = [];
      }
      grouped[buildingId].push(unit);
    });

    return grouped;
  }, []);

  /**
   * 🏢 ENTERPRISE: Get units for a specific building
   */
  const getUnitsForBuilding = useCallback(
    (buildingId: string): RealtimeUnit[] => {
      return unitsByBuilding[buildingId] || [];
    },
    [unitsByBuilding]
  );

  /**
   * 🏢 ENTERPRISE: Get unit count for a building
   */
  const getUnitCount = useCallback(
    (buildingId: string): number => {
      return (unitsByBuilding[buildingId] || []).length;
    },
    [unitsByBuilding]
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
  // MAIN SUBSCRIPTION EFFECT
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
        logger.info('Waiting for authentication');
        setStatus('idle');
        setLoading(false);
        setAllUnits([]);
        setUnitsByBuilding({});
        return;
      }

      logger.info('User authenticated, setting up real-time listener');

      const unitsRef = collection(db, COLLECTIONS.UNITS);

      firestoreUnsubscribe = onSnapshot(
        unitsRef,
        (snapshot) => {
          const units: RealtimeUnit[] = snapshot.docs.map((docSnapshot) => ({
            id: docSnapshot.id,
            name: docSnapshot.data().name || '',
            buildingId: docSnapshot.data().buildingId || null,
            type: docSnapshot.data().type,
            status: docSnapshot.data().status,
            area: docSnapshot.data().area,
            floor: docSnapshot.data().floor,
            createdAt: docSnapshot.data().createdAt,
            updatedAt: docSnapshot.data().updatedAt,
          }));

          logger.debug('Received units in real-time', { count: units.length });

          // Update state
          setAllUnits(units);
          setUnitsByBuilding(groupUnitsByBuilding(units));
          setLoading(false);
          setError(null);
          setStatus('active');
        },
        (err) => {
          logger.error('Firestore error', { error: err.message });
          setError(err.message);
          setLoading(false);
          setStatus('error');
        }
      );

      unsubscribeRef.current = firestoreUnsubscribe;
    });

    // Cleanup both subscriptions
    return () => {
      logger.debug('Cleaning up subscriptions');
      authUnsubscribe();
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }
    };
  }, [refreshTriggerRef.current, groupUnitsByBuilding]);

  // ==========================================================================
  // LISTEN FOR EXTERNAL EVENTS
  // ==========================================================================

  useEffect(() => {
    const handleNavigationRefresh = () => {
      logger.debug('Navigation refresh event received');
      // No need to refetch - onSnapshot already handles real-time updates
    };

    window.addEventListener(REALTIME_EVENTS.NAVIGATION_REFRESH, handleNavigationRefresh);

    return () => {
      window.removeEventListener(REALTIME_EVENTS.NAVIGATION_REFRESH, handleNavigationRefresh);
    };
  }, []);

  return {
    unitsByBuilding,
    allUnits,
    getUnitsForBuilding,
    getUnitCount,
    loading,
    error,
    status,
    refetch,
  };
}

export default useRealtimeUnits;
