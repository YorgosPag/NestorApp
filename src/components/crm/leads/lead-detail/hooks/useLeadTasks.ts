'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTasksByLead } from '@/services/tasks.service';
import type { CrmTask } from '@/types/crm';
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const logger = createModuleLogger('useLeadTasks');

export function useLeadTasks(leadId: string) {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(['crm', 'crm-inbox']);

  const fetchTasks = useCallback(async (signal?: AbortSignal) => {
    if (!leadId) {
        setLoading(false);
        return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getTasksByLead(leadId);
      if (!signal?.aborted) {
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
