'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { SourcingEventAggregate } from '@/app/api/procurement/sourcing-events/[eventId]/aggregate/route';

interface UseSourcingEventAggregateResult {
  aggregate: SourcingEventAggregate | null;
  loading: boolean;
  error: string | null;
}

const BASE = '/api/procurement/sourcing-events';
const AGGREGATE_REFETCH_DEBOUNCE_MS = 400;

async function fetchAggregate(eventId: string): Promise<SourcingEventAggregate> {
  const res = await fetch(`${BASE}/${eventId}/aggregate`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json.data as SourcingEventAggregate;
}

export function useSourcingEventAggregate(
  eventId?: string | null,
): UseSourcingEventAggregateResult {
  const [aggregate, setAggregate] = useState<SourcingEventAggregate | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const data = await fetchAggregate(id);
      setAggregate(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sourcing event aggregate');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!eventId) {
      setAggregate(null);
      setLoading(false);
      return;
    }

    let initialDelivered = false;

    const triggerRefetch = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        void refetch(eventId);
      }, AGGREGATE_REFETCH_DEBOUNCE_MS);
    };

    void refetch(eventId);

    const unsubscribe = firestoreQueryService.subscribeDoc<DocumentData>(
      'SOURCING_EVENTS',
      eventId,
      () => {
        if (!initialDelivered) {
          initialDelivered = true;
          return;
        }
        triggerRefetch();
      },
      (err) => {
        setError(err.message ?? 'Failed to subscribe to sourcing event');
      },
    );

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      unsubscribe();
    };
  }, [eventId, refetch]);

  return { aggregate, loading, error };
}
