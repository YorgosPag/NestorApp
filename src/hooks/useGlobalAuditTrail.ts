/**
 * 📜 useGlobalAuditTrail — Admin client hook for company-wide audit trail
 *
 * Google-level SSoT: subscribes DIRECTLY to the canonical `entity_audit_trail`
 * Firestore collection via the `EntityAuditClientService` (which composes
 * `firestoreQueryService` for auto tenant filtering). Every audit write fans
 * out to authorized clients in real time — no HTTP polling, no manually
 * maintained RealtimeService event list, no race conditions between entity
 * writes and debounced refetches.
 *
 * Authorization is enforced by Firestore rules (admin-only, tenant-scoped).
 * A permission-denied read surfaces as a subscription error.
 *
 * `loadMore` still goes through the paginated HTTP endpoint so admins can
 * scroll beyond the live window without inflating the realtime listener.
 *
 * @module hooks/useGlobalAuditTrail
 * @enterprise ADR-195 — Entity Audit Trail (Phase 10: Client Subscriptions)
 * @permission super_admin | company_admin (server + rules enforced)
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/lib/error-utils';
import { EntityAuditClientService } from '@/services/entity-audit-client.service';
import type {
  AuditAction,
  AuditEntityType,
  EntityAuditEntry,
  EntityAuditResponse,
} from '@/types/audit-trail';

// ============================================================================
// TYPES
// ============================================================================

export interface GlobalAuditFilters {
  entityType?: AuditEntityType;
  performedBy?: string;
  action?: AuditAction;
  /** ISO date string (inclusive) */
  fromDate?: string;
  /** ISO date string (inclusive) */
  toDate?: string;
}

interface UseGlobalAuditTrailOptions {
  filters?: GlobalAuditFilters;
  pageSize?: number;
}

interface UseGlobalAuditTrailReturn {
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

export function useGlobalAuditTrail({
  filters,
  pageSize = 30,
}: UseGlobalAuditTrailOptions = {}): UseGlobalAuditTrailReturn {
  const { user } = useAuth();
  const [liveEntries, setLiveEntries] = useState<EntityAuditEntry[]>([]);
  const [historyEntries, setHistoryEntries] = useState<EntityAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const isMounted = useRef(true);

  // Stable key so the subscribe effect only re-runs when filters actually change.
  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);

  // 🔴 LIVE SUBSCRIPTION — canonical audit subscribe (ADR-195 Phase 10)
  useEffect(() => {
    isMounted.current = true;
    if (!user) return;

    setIsLoading(true);
    setError(null);
    // Reset historical tail whenever filters change — prevents stale mix.
    setHistoryEntries([]);
    setNextCursor(undefined);
    setHasMore(false);

    const unsubscribe = EntityAuditClientService.subscribeGlobal(
      {
        limit: pageSize,
        filters: filters ?? undefined,
      },
      (entries, subscriptionError) => {
        if (!isMounted.current) return;
        if (subscriptionError) {
          setError(
            getErrorMessage(
              subscriptionError,
              'Failed to subscribe to audit trail',
            ),
          );
          setIsLoading(false);
          return;
        }
        setLiveEntries(entries);
        // A full live window implies older entries likely exist.
        setHasMore(entries.length >= pageSize);
        setError(null);
        setIsLoading(false);
      },
    );

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  // `filtersKey` captures `filters`, `user` triggers re-subscription on login.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pageSize, filtersKey]);

  // 📜 HISTORICAL PAGINATION — HTTP endpoint (older than live window)
  const loadMore = useCallback(async () => {
    if (!user || isLoading) return;

    // Oldest loaded entry becomes the cursor; without it we can't page older.
    const tail = liveEntries.concat(historyEntries);
    const oldest = tail[tail.length - 1];
    const offset = nextCursor ?? oldest?.id;
    if (!offset) {
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: String(pageSize) });
      params.set('offset', offset);
      if (filters?.entityType) params.set('entityType', filters.entityType);
      if (filters?.performedBy) params.set('performedBy', filters.performedBy);
      if (filters?.action) params.set('action', filters.action);
      if (filters?.fromDate) params.set('fromDate', filters.fromDate);
      if (filters?.toDate) params.set('toDate', filters.toDate);

      const data = await apiClient.get<EntityAuditResponse>(
        `${API_ROUTES.AUDIT_TRAIL.GLOBAL}?${params.toString()}`,
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
    isLoading,
    liveEntries,
    historyEntries,
    nextCursor,
    pageSize,
    filters,
  ]);

  // refetch is kept for API compatibility. The subscription is already live —
  // there is nothing to "re-fetch". We simply clear any transient error state.
  const refetch = useCallback(() => {
    setError(null);
  }, []);

  const entries = useMemo(
    () => dedupeAndSort([...liveEntries, ...historyEntries]),
    [liveEntries, historyEntries],
  );

  return { entries, isLoading, error, hasMore, loadMore, refetch };
}
