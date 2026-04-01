'use client';

/**
 * 🏢 ENTERPRISE: Real-time Properties Hook for Navigation
 *
 * Provides real-time updates for properties grouped by buildingId.
 * Used by NavigationContext to show live property counts per building.
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
import type { RealtimeUnit, SubscriptionStatus, PropertyCreatedPayload, PropertyUpdatedPayload, PropertyDeletedPayload } from '../types';
import { REALTIME_EVENTS } from '../types';
import { RealtimeService } from '../RealtimeService';
import { applyUpdates } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useRealtimeProperties');

// ============================================================================
// TYPES
// ============================================================================

interface UnitsByBuilding {
  [buildingId: string]: RealtimeUnit[];
}

interface UseRealtimePropertiesReturn {
  /** Properties grouped by buildingId */
  propertiesByBuilding: UnitsByBuilding;
  /** All properties flat array */
  allProperties: RealtimeUnit[];
  /** Get properties for a specific building */
  getPropertiesForBuilding: (buildingId: string) => RealtimeUnit[];
  /** Get property count for a building */
  getPropertyCount: (buildingId: string) => number;
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
 * 🏢 ENTERPRISE: Real-time properties hook
 *
 * Watches the properties collection and groups by buildingId.
 * Automatically updates when properties are added/removed/modified.
 *
 * @example
 * ```tsx
 * const { getPropertyCount, propertiesByBuilding } = useRealtimeProperties();
 *
 * // Get count for a specific building
 * const count = getPropertyCount('buildingId123'); // Returns number
 *
 * // Get all properties for a building
 * const properties = propertiesByBuilding['buildingId123']; // Returns Property[]
 * ```
 */
export function useRealtimeProperties(enabled = true): UseRealtimePropertiesReturn {
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
   * 🏢 ENTERPRISE: Get properties for a specific building
   */
  const getPropertiesForBuilding = useCallback(
    (buildingId: string): RealtimeUnit[] => {
      return unitsByBuilding[buildingId] || [];
    },
    [unitsByBuilding]
  );

  /**
   * 🏢 ENTERPRISE: Get property count for a building
   */
  const getPropertyCount = useCallback(
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
      'PROPERTIES',
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
    const handleCreated = (_payload: PropertyCreatedPayload) => {
      logger.info('Unit created — triggering refetch');
      refetch();
    };

    const handleUpdated = (payload: PropertyUpdatedPayload) => {
      logger.info('Applying optimistic update for property', { propertyId: payload.propertyId });
      setAllUnits(prev => {
        const updated = prev.map(unit =>
          unit.id === payload.propertyId
            ? applyUpdates(unit, payload.updates as Partial<RealtimeUnit>)
            : unit
        );
        setUnitsByBuilding(groupUnitsByBuilding(updated));
        return updated;
      });
    };

    const handleDeleted = (payload: PropertyDeletedPayload) => {
      logger.info('Removing deleted property', { propertyId: payload.propertyId });
      setAllUnits(prev => {
        const filtered = prev.filter(unit => unit.id !== payload.propertyId);
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
    propertiesByBuilding: unitsByBuilding,
    allProperties: allUnits,
    getPropertiesForBuilding,
    getPropertyCount,
    loading,
    error,
    status,
    refetch,
  };
}

export default useRealtimeProperties;
