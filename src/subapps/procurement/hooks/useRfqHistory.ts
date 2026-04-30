'use client';

// ADR-330: RFQ-level audit history — subscribes to all quotes' audit trails and merges.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { EntityAuditClientService, dedupDualWrite } from '@/services/entity-audit-client.service';
import { getErrorMessage } from '@/lib/error-utils';
import type { EntityAuditEntry } from '@/types/audit-trail';

interface UseRfqHistoryOptions {
  rfqId: string;
  quoteIds: string[];
}

interface UseRfqHistoryReturn {
  entries: EntityAuditEntry[];
  isLoading: boolean;
  error: string | null;
}

function mergeAndSort(byId: Map<string, EntityAuditEntry[]>): EntityAuditEntry[] {
  const merged: EntityAuditEntry[] = [];
  for (const list of byId.values()) merged.push(...list);
  const seen = new Set<string>();
  const deduped = merged.filter(e => {
    if (!e.id || seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  const out = dedupDualWrite(deduped);
  out.sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
  return out;
}

export function useRfqHistory({ rfqId, quoteIds }: UseRfqHistoryOptions): UseRfqHistoryReturn {
  const { user } = useAuth();
  const [entryMap, setEntryMap] = useState<Map<string, EntityAuditEntry[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const quoteKey = quoteIds.join(',');

  useEffect(() => {
    isMounted.current = true;
    if (!user || quoteIds.length === 0) {
      setEntryMap(new Map());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const localMap = new Map<string, EntityAuditEntry[]>();
    const unsubscribers: (() => void)[] = [];
    let responded = 0;

    for (const quoteId of quoteIds) {
      const unsub = EntityAuditClientService.subscribeEntity(
        { entityType: 'quote', entityId: quoteId, limit: 50 },
        (entries, err) => {
          if (!isMounted.current) return;
          responded++;
          if (err) {
            setError(getErrorMessage(err, 'History unavailable'));
          } else {
            localMap.set(quoteId, entries);
            setEntryMap(new Map(localMap));
          }
          if (responded >= quoteIds.length) setIsLoading(false);
        },
      );
      unsubscribers.push(unsub);
    }

    return () => {
      isMounted.current = false;
      unsubscribers.forEach(u => u());
    };
  // quoteKey stable proxy for quoteIds array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, rfqId, quoteKey]);

  const entries = useMemo(() => mergeAndSort(entryMap), [entryMap]);
  return { entries, isLoading, error };
}
