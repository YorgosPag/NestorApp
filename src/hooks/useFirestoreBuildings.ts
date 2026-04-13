'use client';

/**
 * ENTERPRISE BUILDINGS HOOK — Real-time onSnapshot (ADR-227)
 *
 * Replaces the previous REST + useAsyncData pattern that caused full-screen
 * flicker on every CRUD event (setLoading(true) → spinner → data).
 *
 * Uses firestoreQueryService.subscribe('BUILDINGS', ...) which wraps Firestore
 * onSnapshot with tenant isolation (auto-companyId injection) and auth-ready
 * gating. Updates arrive incrementally — no loading state on mutations.
 *
 * @ssot ADR-227 — Real-Time Subscription Consolidation
 * @ssot ADR-228 — Real-Time Event Bus Coverage
 */

import { useState, useEffect, useCallback } from 'react';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { DocumentData } from 'firebase/firestore';
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
 * Normalize a createdAt value to milliseconds.
 * Handles Firestore Timestamp objects, ISO strings, and numeric millis.
 */
function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (typeof value === 'number') return value;
  return 0;
}

export function useFirestoreBuildings(): UseFirestoreBuildingsReturn {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'BUILDINGS',
      (result: QueryResult<DocumentData>) => {
        const mapped = result.documents
          // Mirror server-side soft-delete exclusion (ADR-281)
          .filter(doc => doc.status !== 'deleted')
          // Mirror server-side sort: createdAt desc
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
          .map(doc => doc as unknown as Building);

        logger.info('Buildings updated via real-time subscription', { count: mapped.length });
        setBuildings(mapped);
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        logger.error('Firestore subscription error', { error: err.message });
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // No-op: onSnapshot handles all updates automatically.
  // Kept for API compatibility with callers that invoke refetch() after mutations.
  const refetch = useCallback((): Promise<void> => Promise.resolve(), []);

  return { buildings, loading, error, refetch };
}
