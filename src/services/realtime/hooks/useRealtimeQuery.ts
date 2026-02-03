'use client';

/**
 * 🏢 ENTERPRISE: Generic Real-time Query Hook
 *
 * Type-safe React hook for Firestore real-time subscriptions.
 * Based on the proven pattern from useProjectFloorplans.ts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DocumentData, QueryConstraint } from 'firebase/firestore';
import { RealtimeService } from '../RealtimeService';
import type {
  RealtimeCollection,
  RealtimeQueryResult,
  SubscriptionStatus,
} from '../types';

// ============================================================================
// HOOK OPTIONS
// ============================================================================

interface UseRealtimeQueryOptions<T> {
  /** Firestore collection name */
  collection: RealtimeCollection;
  /** Query constraints (where, orderBy, limit) */
  constraints?: QueryConstraint[];
  /** Enable/disable the subscription */
  enabled?: boolean;
  /** Transform raw Firestore data to typed data */
  transform?: (data: DocumentData) => T;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Real-time query hook
 *
 * @example
 * ```tsx
 * const { data, loading, error } = useRealtimeQuery<Building>({
 *   collection: 'buildings',
 *   constraints: [where('projectId', '==', projectId)],
 *   enabled: !!projectId,
 * });
 * ```
 */
export function useRealtimeQuery<T extends DocumentData = DocumentData>(
  options: UseRealtimeQueryOptions<T>
): RealtimeQueryResult<T> {
  const {
    collection: collectionName,
    constraints = [],
    enabled = true,
    transform,
  } = options;

  // State
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>('idle');

  // Refs for cleanup
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const refreshTriggerRef = useRef(0);

  // Refetch function
  const refetch = useCallback(() => {
    refreshTriggerRef.current += 1;
    setLoading(true);
    setError(null);
  }, []);

  // Unsubscribe function
  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  // Subscribe effect
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setStatus('idle');
      return;
    }

    setStatus('connecting');

    const handleData = (rawData: DocumentData[]) => {
      const transformedData = transform
        ? rawData.map(transform)
        : (rawData as T[]);

      setData(transformedData);
      setLoading(false);
      setError(null);
      setStatus('active');
    };

    const handleError = (err: Error) => {
      setError(err.message);
      setLoading(false);
      setStatus('error');
    };

    // Subscribe via RealtimeService
    unsubscribeRef.current = RealtimeService.subscribeToCollection(
      {
        collection: collectionName,
        constraints,
        enabled,
      },
      handleData,
      handleError
    );

    // Cleanup on unmount or dependency change
    return () => {
      unsubscribe();
    };
  }, [collectionName, enabled, refreshTriggerRef.current]);

  return {
    data,
    loading,
    error,
    status,
    refetch,
    unsubscribe,
  };
}

export default useRealtimeQuery;
