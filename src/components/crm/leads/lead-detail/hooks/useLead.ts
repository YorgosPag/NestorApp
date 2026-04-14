'use client';

import { useState, useEffect, useCallback } from 'react';
import { getOpportunityById } from '@/services/opportunities.service';
import type { Opportunity } from '@/types/crm';
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const logger = createModuleLogger('useLead');

export function useLead(id: string) {
  const [lead, setLead] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(['crm', 'crm-inbox']);

  const fetchLead = useCallback(async (signal?: AbortSignal) => {
    if (!id) {
        setLoading(false);
        setError(t('leadDetails.errors.noId'));
        return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getOpportunityById(id);
      if (signal?.aborted) return;
      if (data) {
        setLead(data);
      } else {
        setError(t('leadDetails.notFound'));
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(t('leadDetails.errors.loadError'));
      logger.error('Failed to fetch lead', { error: err });
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [id, t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLead(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchLead]);

  return { lead, loading, error, refetch: fetchLead };
}
