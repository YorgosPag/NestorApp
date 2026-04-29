'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RfqLine, CreateRfqLineDTO, UpdateRfqLineDTO } from '../types/rfq-line';

interface UseRfqLinesResult {
  lines: RfqLine[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addLine: (dto: CreateRfqLineDTO) => Promise<RfqLine>;
  updateLine: (lineId: string, dto: UpdateRfqLineDTO) => Promise<RfqLine>;
  deleteLine: (lineId: string) => Promise<void>;
  bulkAdd: (dtos: CreateRfqLineDTO[]) => Promise<RfqLine[]>;
}

const BASE = (rfqId: string) => `/api/procurement/rfqs/${rfqId}/lines`;

export function useRfqLines(rfqId: string): UseRfqLinesResult {
  const [lines, setLines] = useState<RfqLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(BASE(rfqId));
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setLines((json.data ?? []) as RfqLine[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lines');
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const addLine = useCallback(
    async (dto: CreateRfqLineDTO): Promise<RfqLine> => {
      const optimistic = { ...dto, id: `__opt_${Date.now()}` } as RfqLine;
      setLines((prev) => [...prev, optimistic]);
      try {
        const res = await fetch(BASE(rfqId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dto),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        const created = json.data as RfqLine;
        setLines((prev) => prev.map((l) => (l.id === optimistic.id ? created : l)));
        return created;
      } catch (e) {
        setLines((prev) => prev.filter((l) => l.id !== optimistic.id));
        throw e;
      }
    },
    [rfqId],
  );

  const updateLine = useCallback(
    async (lineId: string, dto: UpdateRfqLineDTO): Promise<RfqLine> => {
      const snapshot = lines.find((l) => l.id === lineId);
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...dto } : l)));
      try {
        const res = await fetch(`${BASE(rfqId)}/${lineId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dto),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        const updated = json.data as RfqLine;
        setLines((prev) => prev.map((l) => (l.id === lineId ? updated : l)));
        return updated;
      } catch (e) {
        if (snapshot) setLines((prev) => prev.map((l) => (l.id === lineId ? snapshot : l)));
        throw e;
      }
    },
    [rfqId, lines],
  );

  const deleteLine = useCallback(
    async (lineId: string): Promise<void> => {
      const snapshot = lines.find((l) => l.id === lineId);
      setLines((prev) => prev.filter((l) => l.id !== lineId));
      try {
        const res = await fetch(`${BASE(rfqId)}/${lineId}`, { method: 'DELETE' });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error ?? `HTTP ${res.status}`);
        }
      } catch (e) {
        if (snapshot) setLines((prev) => [...prev, snapshot]);
        throw e;
      }
    },
    [rfqId, lines],
  );

  const bulkAdd = useCallback(
    async (dtos: CreateRfqLineDTO[]): Promise<RfqLine[]> => {
      const res = await fetch(`${BASE(rfqId)}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: dtos }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      const created = (json.data ?? []) as RfqLine[];
      setLines((prev) => [...prev, ...created]);
      return created;
    },
    [rfqId],
  );

  return { lines, loading, error, refetch, addLine, updateLine, deleteLine, bulkAdd };
}
