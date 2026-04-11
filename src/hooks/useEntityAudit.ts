/**
 * 📜 useEntityAudit — Client hook for per-entity audit trail
 *
 * Google-level SSoT: subscribes DIRECTLY to the canonical `entity_audit_trail`
 * Firestore collection via `EntityAuditClientService` (which composes the
 * canonical `firestoreQueryService` layer). Eliminates the manually maintained
 * `ENTITY_EVENT_MAP` and the 500 ms debounced refetch — the audit collection
 * itself is the event bus.
 *
 * `loadMore` continues to use the paginated HTTP endpoint so History tabs can
 * scroll beyond the live window without inflating the realtime listener.
 *
 * @module hooks/useEntityAudit
 * @enterprise ADR-195 — Entity Audit Trail (Phase 10: Client Subscriptions)
 * @ssot ADR-294 — Canonical hook. Re-implementations are blocked by the
 *                 SSoT ratchet (`entity-audit-trail` module).
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/lib/error-utils';
import { EntityAuditClientService } from '@/services/entity-audit-client.service';
import type {
  AuditEntityType,
  EntityAuditEntry,
  EntityAuditResponse,
} from '@/types/audit-trail';

interface UseEntityAuditOptions {
  entityType: AuditEntityType;
  entityId: string | undefined;
  pageSize?: number;
}

interface UseEntityAuditReturn {
  entries: EntityAuditEntry[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function dedupeAndSort(entries: EntityAuditEntry[]): EntityAuditEntry[] {
  const seen = new Set<string>();
  const out: EntityAuditEntry[] = [];
  for (const entry of entries) {
    if (!entry.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  out.sort((a, b) => {
    const bMs = Date.parse(b.timestamp) || 0;
    const aMs = Date.parse(a.timestamp) || 0;
    return bMs - aMs;
  });
  return out;
}

// ============================================================================
// HOOK
// ============================================================================

export function useEntityAudit({
  entityType,
  entityId,
  pageSize = 20,
}: UseEntityAuditOptions): UseEntityAuditReturn {
  const { user } = useAuth();
  const [liveEntries, setLiveEntries] = useState<EntityAuditEntry[]>([]);
  const [historyEntries, setHistoryEntries] = useState<EntityAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const isMounted = useRef(true);

  // 🔴 LIVE SUBSCRIPTION — canonical per-entity audit subscribe
  useEffect(() => {
    isMounted.current = true;
    if (!user || !entityId) {
      setLiveEntries([]);
      setHistoryEntries([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHistoryEntries([]);
    setNextCursor(undefined);
    setHasMore(false);

    const unsubscribe = EntityAuditClientService.subscribeEntity(
      {
        entityType,
        entityId,
        limit: pageSize,
      },
      (entries, subscriptionError) => {
        if (!isMounted.current) return;
        if (subscriptionError) {
          setError(
            getErrorMessage(
              subscriptionError,
              'Failed to subscribe to entity audit trail',
            ),
          );
          setIsLoading(false);
          return;
        }
        setLiveEntries(entries);
        setHasMore(entries.length >= pageSize);
        setError(null);
        setIsLoading(false);
      },
    );

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [user, entityType, entityId, pageSize]);

  // 📜 HISTORICAL PAGINATION — HTTP endpoint (older than live window)
  const loadMore = useCallback(async () => {
    if (!entityId || !user || isLoading) return;

    const tail = liveEntries.concat(historyEntries);
    const oldest = tail[tail.length - 1];
    const cursor = nextCursor ?? oldest?.id;
    if (!cursor) {
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: String(pageSize) });
      params.set('startAfter', cursor);

      const data = await apiClient.get<EntityAuditResponse>(
        `${API_ROUTES.AUDIT_TRAIL.BY_ENTITY(entityType, entityId)}?${params.toString()}`,
      );

      if (!isMounted.current) return;
      setHistoryEntries((prev) => [...prev, ...data.entries]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (err) {
      if (!isMounted.current) return;
      setError(getErrorMessage(err, 'Failed to load more audit entries'));
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [
    user,
    entityType,
    entityId,
    isLoading,
    liveEntries,
    historyEntries,
    nextCursor,
    pageSize,
  ]);

  // Kept for API compatibility — subscription is already live.
  const refetch = useCallback(() => {
    setError(null);
  }, []);

  const entries = useMemo(
    () => dedupeAndSort([...liveEntries, ...historyEntries]),
    [liveEntries, historyEntries],
  );

  return { entries, isLoading, error, hasMore, loadMore, refetch };
}
