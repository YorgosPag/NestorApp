
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getOpportunityById } from '@/services/opportunities.service';
import type { Opportunity } from '@/types/crm';

export function useLead(id: string) {
  const [lead, setLead] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLead = useCallback(async (signal?: AbortSignal) => {
    if (!id) {
        setLoading(false);
        setError('No ID provided');
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
        setError('Το lead δεν βρέθηκε.');
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError('Σφάλμα κατά τη φόρτωση του lead.');
      console.error(err);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLead(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchLead]);

  return { lead, loading, error, refetch: fetchLead };
}
