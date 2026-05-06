'use client';

/**
 * 🏢 ENTERPRISE: Real-time Properties Trash Count Hook
 *
 * Firestore onSnapshot listener for soft-deleted properties (status === 'deleted').
 * Drives the badge on the trash button in the Properties header.
 *
 * Pattern: same as useRealtimeBuildings / useRealtimeProperties.
 */

import { useState, useEffect, useRef } from 'react';
import { where, type QueryConstraint, type DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import type { SubscriptionStatus } from '../types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useRealtimePropertiesTrashCount');

const DELETED_CONSTRAINTS: readonly QueryConstraint[] = [where('status', '==', 'deleted')];

export interface UseRealtimePropertiesTrashCountReturn {
  trashCount: number;
  loading: boolean;
  status: SubscriptionStatus;
}

export function useRealtimePropertiesTrashCount(
  enabled = true
): UseRealtimePropertiesTrashCountReturn {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [status, setStatus] = useState<SubscriptionStatus>('idle');
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setLoading(false);
      return;
    }

    setStatus('connecting');
    setLoading(true);

    const unsub = firestoreQueryService.subscribe<DocumentData>(
      'PROPERTIES',
      (result: QueryResult<DocumentData>) => {
        setCount(result.documents.length);
        setLoading(false);
        setStatus('active');
        logger.debug('Trash count updated', { count: result.documents.length });
      },
      (err: Error) => {
        logger.error('Firestore subscription error', { error: err.message });
        setLoading(false);
        setStatus('error');
      },
      { constraints: DELETED_CONSTRAINTS }
    );

    unsubRef.current = unsub;
    return () => {
      unsub();
      unsubRef.current = null;
    };
  }, [enabled]);

  return { trashCount: count, loading, status };
}
