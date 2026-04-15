'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTasksByLead } from '@/services/tasks.service';
import type { CrmTask } from '@/types/crm';
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('useLeadTasks');

// ADR-300: module-level cache keyed by leadId
const leadTasksCache = createStaleCache<CrmTask[]>('crm-lead-tasks');

export function useLeadTasks(leadId: string) {
  const [tasks, setTasks] = useState<CrmTask[]>(leadTasksCache.get(leadId) ?? []);
  const [loading, setLoading] = useState(!leadTasksCache.hasLoaded(leadId));
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(['crm', 'crm-inbox']);

  const fetchTasks = useCallback(async (signal?: AbortSignal) => {
    if (!leadId) {
        setLoading(false);
        return;
    }

    if (!leadTasksCache.hasLoaded(leadId)) setLoading(true);
    setError(null);
    try {
      const data = await getTasksByLead(leadId);
      if (!signal?.aborted) {
        leadTasksCache.set(data, leadId);
        setTasks(data);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(t('leadDetails.errors.loadTasksError'));
        logger.error('Failed to fetch lead tasks', { error: err });
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [leadId, t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTasks(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchTasks]);

  return { tasks, loading, error, refetch: fetchTasks };
}
