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
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { DocumentData } from 'firebase/firestore';
import type { RealtimeUnit, SubscriptionStatus, UnitCreatedPayload, UnitUpdatedPayload, UnitDeletedPayload } from '../types';
import { REALTIME_EVENTS } from '../types';
import { RealtimeService } from '../RealtimeService';
import { applyUpdates } from '@/lib/utils';
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
export function useRealtimeUnits(enabled = true): UseRealtimeUnitsReturn {
  // State
  const [allUnits, setAllUnits] = useState<RealtimeUnit[]>([]);
  const [unitsByBuilding, setUnitsByBuilding] = useState<UnitsByBuilding>({});
  const [loading, setLoading] = useState(enabled);
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
    // 🔐 ENTERPRISE: Skip subscription when disabled (no auth yet)
    if (!enabled) {
      setStatus('idle');
      setLoading(false);
      return;
    }

    setStatus('connecting');
    setLoading(true);

    // 🔐 ENTERPRISE: firestoreQueryService.subscribe() handles auth internally
    // and auto-injects companyId tenant filter — SECURITY FIX for cross-tenant data leak
    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'UNITS',
      (result: QueryResult<DocumentData>) => {
        const units: RealtimeUnit[] = result.documents.map(doc => ({
          id: doc.id,
          name: (doc.name as string) || '',
          buildingId: (doc.buildingId as string) || null,
          type: doc.type as string | undefined,
          status: doc.status as string | undefined,
          area: doc.area as number | undefined,
          floor: doc.floor as number | undefined,
          createdAt: doc.createdAt as string | undefined,
          updatedAt: doc.updatedAt as string | undefined,
        }));

        logger.debug('Received units in real-time', { count: units.length });

        setAllUnits(units);
        setUnitsByBuilding(groupUnitsByBuilding(units));
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
      logger.debug('Cleaning up subscription');
      unsubscribe();
    };
  }, [enabled, refreshTriggerRef.current, groupUnitsByBuilding]);

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

  // 🏢 ENTERPRISE: Event bus subscribers for optimistic UI updates (ADR-228 Tier 1)
  useEffect(() => {
    const handleCreated = (_payload: UnitCreatedPayload) => {
      logger.info('Unit created — triggering refetch');
      refetch();
    };

    const handleUpdated = (payload: UnitUpdatedPayload) => {
      logger.info('Applying optimistic update for unit', { unitId: payload.unitId });
      setAllUnits(prev => {
        const updated = prev.map(unit =>
          unit.id === payload.unitId
            ? applyUpdates(unit, payload.updates as Partial<RealtimeUnit>)
            : unit
        );
        setUnitsByBuilding(groupUnitsByBuilding(updated));
        return updated;
      });
    };

    const handleDeleted = (payload: UnitDeletedPayload) => {
      logger.info('Removing deleted unit', { unitId: payload.unitId });
      setAllUnits(prev => {
        const filtered = prev.filter(unit => unit.id !== payload.unitId);
        setUnitsByBuilding(groupUnitsByBuilding(filtered));
        return filtered;
      });
    };

    const unsubCreate = RealtimeService.subscribe('UNIT_CREATED', handleCreated);
    const unsubUpdate = RealtimeService.subscribe('UNIT_UPDATED', handleUpdated);
    const unsubDelete = RealtimeService.subscribe('UNIT_DELETED', handleDeleted);

    return () => { unsubCreate(); unsubUpdate(); unsubDelete(); };
  }, [refetch, groupUnitsByBuilding]);

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
