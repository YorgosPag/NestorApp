'use client';

/**
 * useScheduleAlerts — ADR-266 §5.8 / Phase D.3
 *
 * Subscribes to active construction_alerts for a building.
 * Exposes dismiss and refresh (trigger schedule-check) actions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { where, orderBy } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import type { ConstructionAlert } from '@/types/building/construction';

const logger = createModuleLogger('useScheduleAlerts');

const alertsCache = createStaleCache<ConstructionAlert[]>('schedule-alerts');

interface UseScheduleAlertsReturn {
  alerts: ConstructionAlert[];
  loading: boolean;
  error: string | null;
  dismiss: (alertId: string) => Promise<void>;
  refresh: (buildingName?: string) => Promise<void>;
  refreshing: boolean;
}

export function useScheduleAlerts(buildingId: string): UseScheduleAlertsReturn {
  const { user, loading: authLoading } = useAuth();
  const companyResult = useCompanyId();
  const companyId = companyResult?.companyId;

  const [alerts, setAlerts] = useState<ConstructionAlert[]>(
    alertsCache.get() ?? [],
  );
  const [loading, setLoading] = useState(!alertsCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const prevSnapshotRef = useRef<string>('');

  useEffect(() => {
    if (authLoading || !user || !companyId || !buildingId) {
      if (!authLoading) setLoading(false);
      return;
    }

    setLoading(!alertsCache.hasLoaded());

    const unsubscribe = firestoreQueryService.subscribe<Record<string, unknown>>(
      'CONSTRUCTION_ALERTS',
      (result) => {
        const incoming = result.documents.map(d => d as unknown as ConstructionAlert);
        const hash = incoming.map(a => `${a.id}:${a.status}`).join(',');

        if (hash === prevSnapshotRef.current) return;
        prevSnapshotRef.current = hash;

        alertsCache.set(incoming);
        setAlerts(incoming);
        setLoading(false);
        setError(null);
      },
      (err) => {
        logger.error('Schedule alerts subscription error', { error: err.message });
        setError('SUBSCRIPTION_ERROR');
        setLoading(false);
      },
      {
        constraints: [
          where('companyId', '==', companyId),
          where('buildingId', '==', buildingId),
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
        ],
      },
    );

    return unsubscribe;
  }, [authLoading, user, companyId, buildingId]);

  const dismiss = useCallback(
    async (alertId: string): Promise<void> => {
      if (!user) return;

      setAlerts(prev => prev.filter(a => a.id !== alertId));

      try {
        const res = await fetch(`/api/alerts/dismiss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alertId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        logger.error('Dismiss alert failed', { alertId, error: String(err) });
        setError('DISMISS_ERROR');
      }
    },
    [user],
  );

  const refresh = useCallback(
    async (buildingName?: string): Promise<void> => {
      setRefreshing(true);
      setError(null);
      try {
        const res = await fetch('/api/alerts/schedule-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ buildingId, buildingName }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        logger.error('Schedule check refresh failed', { error: String(err) });
        setError('REFRESH_ERROR');
      } finally {
        setRefreshing(false);
      }
    },
    [buildingId],
  );

  return { alerts, loading, error, dismiss, refresh, refreshing };
}
