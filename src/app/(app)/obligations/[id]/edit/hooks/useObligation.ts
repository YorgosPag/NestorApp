
"use client";

import { useState, useEffect, useCallback } from 'react';
import { obligationsService } from '@/services/obligations.service';
import type { ObligationDocument } from '@/types/obligations';

export function useObligation(id: string) {
  const [obligation, setObligation] = useState<ObligationDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchObligation = useCallback(async (signal?: AbortSignal) => {
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

  const saveObligation = useCallback(async () => {
    if (!obligation) return false;
    try {
      const updated = await obligationsService.update(id, obligation);
      if (updated) {
        setObligation(updated);
        return true;
      }
      return false;
    } catch(err) {
        console.error("Error saving obligation:", err);
        return false;
    }
  }, [id, obligation]);

  useEffect(() => {
    const controller = new AbortController();
    fetchObligation(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchObligation]);

  return { obligation, setObligation, loading, error, saveObligation, refetch: fetchObligation };
}
