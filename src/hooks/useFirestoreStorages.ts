'use client';

/**
 * ENTERPRISE STORAGE HOOK — Real-time
 *
 * React hook for Firestore storage units.
 * Uses `firestoreQueryService.subscribe()` (onSnapshot) — ADR-227.
 * Supports optional buildingId filtering (ADR-184 — Building Spaces Tabs).
 *
 * No event-dispatch refetch pattern: list updates incrementally via snapshot,
 * eliminating full-list refetch flashes on CRUD.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { where, type DocumentData } from 'firebase/firestore';
import { useAuth } from '@/auth/hooks/useAuth';
import { firestoreQueryService, type QueryResult } from '@/services/firestore';
import { mapStorageDoc } from '@/lib/firestore-mappers';
import type { Storage } from '@/types/storage/contracts';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime';

const logger = createModuleLogger('useFirestoreStorages');

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface UseFirestoreStoragesOptions {
  /** Filter by building ID (ADR-184) */
  buildingId?: string;
  /** Auto-subscribe on mount (default: true) */
  autoFetch?: boolean;
}

interface UseFirestoreStoragesReturn {
  storages: Storage[];
  loading: boolean;
  error: string | null;
  /** Real-time subscription auto-refreshes; this is a no-op kept for API compat. */
  refetch: () => Promise<void>;
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
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const enabled = autoFetch && !authLoading && !!user;

  const constraints = useMemo(
    () => (buildingId ? [where('buildingId', '==', buildingId)] : []),
    [buildingId]
  );

  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'STORAGE',
      (result: QueryResult<DocumentData>) => {
        const mapped = result.documents
          .map(doc => {
            const { id, ...rest } = doc;
            return mapStorageDoc(id as string, rest as Record<string, unknown>);
          })
          // ADR-281: Exclude soft-deleted records from normal list
          .filter(s => s.status !== 'deleted');

        logger.info('Storages snapshot received', { count: mapped.length, buildingId });
        setStorages(mapped);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        logger.error('Storages subscription error', { error: err.message });
        setError(err.message);
        setLoading(false);
      },
      { constraints }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [enabled, constraints, buildingId]);

  // Instant removal on soft-delete — don't wait for onSnapshot propagation (ADR-281)
  useEffect(() => {
    const unsub = RealtimeService.subscribe('STORAGE_DELETED', (payload) => {
      const { storageId } = payload as { storageId: string };
      setStorages(prev => prev.filter(s => s.id !== storageId));
    });
    return unsub;
  }, []);

  // No-op: onSnapshot delivers updates live. Kept for API backward compat.
  const refetch = useCallback(async () => { /* noop — realtime */ }, []);

  return { storages, loading, error, refetch };
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export default useFirestoreStorages;
