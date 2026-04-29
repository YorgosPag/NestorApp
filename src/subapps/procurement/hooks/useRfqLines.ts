'use client';

import { useCallback, useEffect, useState } from 'react';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
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

  useEffect(() => {
    if (!rfqId) {
      setLines([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = firestoreQueryService.subscribeSubcollection<RfqLine>(
      'RFQS',
      rfqId,
      'lines',
      (result) => {
        const sorted = [...result.documents].sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
        );
        setLines(sorted);
        setLoading(false);
      },
      (err) => {
        setError(err.message ?? 'Failed to subscribe to RFQ lines');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [rfqId]);

  const refetch = useCallback(async () => {
    /* onSnapshot is live — no manual refetch (kept for API compat) */
  }, []);

  const addLine = useCallback(
    async (dto: CreateRfqLineDTO): Promise<RfqLine> => {
      const res = await fetch(BASE(rfqId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      const created = json.data as RfqLine | undefined;
      if (!created) throw new Error('Server returned empty line data');
      return created;
    },
    [rfqId],
  );

  const updateLine = useCallback(
    async (lineId: string, dto: UpdateRfqLineDTO): Promise<RfqLine> => {
      const res = await fetch(`${BASE(rfqId)}/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      return json.data as RfqLine;
    },
    [rfqId],
  );

  const deleteLine = useCallback(
    async (lineId: string): Promise<void> => {
      const res = await fetch(`${BASE(rfqId)}/${lineId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
    },
    [rfqId],
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
      return (json.data ?? []) as RfqLine[];
    },
    [rfqId],
  );

  return { lines, loading, error, refetch, addLine, updateLine, deleteLine, bulkAdd };
}
