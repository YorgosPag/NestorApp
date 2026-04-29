'use client';

import { useEffect, useState } from 'react';
import type { SourcingEventAggregate } from '@/app/api/procurement/sourcing-events/[eventId]/aggregate/route';

interface UseSourcingEventAggregateResult {
  aggregate: SourcingEventAggregate | null;
  loading: boolean;
  error: string | null;
}

const BASE = '/api/procurement/sourcing-events';

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

  useEffect(() => {
    if (!eventId) {
      setAggregate(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAggregate(eventId)
      .then((data) => {
        setAggregate(data);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load sourcing event aggregate'),
      )
      .finally(() => setLoading(false));
  }, [eventId]);

  return { aggregate, loading, error };
}
