'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SourcingEvent, CreateSourcingEventDTO, UpdateSourcingEventDTO } from '../types/sourcing-event';

interface UseSourcingEventResult {
  event: SourcingEvent | null;
  loading: boolean;
  error: string | null;
  create: (dto: CreateSourcingEventDTO) => Promise<SourcingEvent>;
  update: (dto: UpdateSourcingEventDTO) => Promise<SourcingEvent>;
  archive: () => Promise<void>;
  linkRfq: (rfqId: string) => Promise<void>;
  unlinkRfq: (rfqId: string) => Promise<void>;
}

const BASE = '/api/procurement/sourcing-events';

async function fetchEvent(eventId: string): Promise<SourcingEvent> {
  const res = await fetch(`${BASE}/${eventId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json.data as SourcingEvent;
}

export function useSourcingEvent(eventId?: string): UseSourcingEventResult {
  const [event, setEvent] = useState<SourcingEvent | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchEvent(eventId)
      .then((data) => { setEvent(data); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load sourcing event'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const create = useCallback(async (dto: CreateSourcingEventDTO): Promise<SourcingEvent> => {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
    const created = json.data as SourcingEvent;
    setEvent(created);
    return created;
  }, []);

  const update = useCallback(
    async (dto: UpdateSourcingEventDTO): Promise<SourcingEvent> => {
      if (!eventId) throw new Error('No eventId — cannot update');
      const snapshot = event;
      setEvent((prev) => (prev ? { ...prev, ...dto } : prev));
      try {
        const res = await fetch(`${BASE}/${eventId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dto),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        const updated = json.data as SourcingEvent;
        setEvent(updated);
        return updated;
      } catch (e) {
        if (snapshot) setEvent(snapshot);
        throw e;
      }
    },
    [eventId, event],
  );

  const archive = useCallback(async (): Promise<void> => {
    if (!eventId) throw new Error('No eventId — cannot archive');
    const res = await fetch(`${BASE}/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
    setEvent(json.data as SourcingEvent);
  }, [eventId]);

  const linkRfq = useCallback(
    async (rfqId: string): Promise<void> => {
      if (!eventId) throw new Error('No eventId — cannot link RFQ');
      const res = await fetch(`${BASE}/${eventId}/rfqs/${rfqId}`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setEvent(data.data as SourcingEvent);
    },
    [eventId],
  );

  const unlinkRfq = useCallback(
    async (rfqId: string): Promise<void> => {
      if (!eventId) throw new Error('No eventId — cannot unlink RFQ');
      const res = await fetch(`${BASE}/${eventId}/rfqs/${rfqId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setEvent(data.data as SourcingEvent);
    },
    [eventId],
  );

  return { event, loading, error, create, update, archive, linkRfq, unlinkRfq };
}
