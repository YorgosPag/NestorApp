
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { ObligationDocument } from '@/types/obligations';
import { obligationsService } from '@/services/obligations.service';

export function useObligation(id: string) {
  const [obligation, setObligation] = useState<ObligationDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchObligation = useCallback(async (signal?: AbortSignal) => {
    if (!id) {
      setLoading(false);
      setError("No ID provided");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const data = await obligationsService.getById(id);
      if (signal?.aborted) return;
      
      if (data) {
        setObligation(data);
      } else {
        setError("Η συγγραφή υποχρεώσεων δεν βρέθηκε");
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError("Σφάλμα κατά τη φόρτωση των δεδομένων");
      console.error(err);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchObligation(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchObligation]);

  return { obligation, loading, error, refetch: fetchObligation };
}
