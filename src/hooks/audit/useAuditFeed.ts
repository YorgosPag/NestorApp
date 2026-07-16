/**
 * 📜 useAuditFeed — shared plumbing behind every audit-trail client hook
 *
 * ADR-195 Phase 10 gave the app two canonical audit hooks — `useEntityAudit`
 * (per-entity History tab) and `useGlobalAuditTrail` (admin company-wide view).
 * Both converged on the same `EntityAuditClientService`, and with it on the same
 * feed mechanics: a live Firestore subscription that owns the newest window,
 * plus an HTTP-paginated tail for anything older, merged into one deduped,
 * newest-first list. That plumbing was copy-pasted between the two files.
 *
 * This module owns the plumbing exactly once. The two public hooks stay
 * canonical (SSoT ratchet module `entity-audit-trail` names them by path) and
 * keep their own signatures — they only supply the three things that genuinely
 * differ between an entity feed and a global feed:
 *
 *   - `subscribe`  — which `EntityAuditClientService` subscription to open
 *   - `fetchPage`  — which endpoint pages the tail, and how the cursor is named
 *                    (`startAfter` for entities, `offset` + filters for global)
 *   - `enabled`    — the auth/args gate
 *
 * NOT a third audit hook: this is internal plumbing with no knowledge of the
 * `entity_audit_trail` collection, no query construction, and no direct service
 * access. Reads still go through `EntityAuditClientService` only.
 *
 * @module hooks/audit/useAuditFeed
 * @enterprise ADR-195 — Entity Audit Trail (Phase 12: shared feed plumbing)
 * @ssot ADR-584 — de-duplication of the two canonical audit hooks
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEventCallback } from '@/hooks/useEventCallback';
import { getErrorMessage } from '@/lib/error-utils';
import type { AuditSubscriptionCallback } from '@/services/entity-audit-client.service';
import { dedupDualWrite } from '@/services/entity-audit-client.service';
import type { EntityAuditEntry } from '@/types/audit-trail';

// ============================================================================
// TYPES
// ============================================================================

/** One page of historical entries, as returned by the paginated HTTP endpoint. */
export interface AuditFeedPage {
  entries: EntityAuditEntry[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface UseAuditFeedOptions {
  /** Auth/args gate. While false no subscription is opened and the feed is empty. */
  enabled: boolean;
  /** Live window size; also the page size for the historical tail. */
  pageSize: number;
  /**
   * Value-identity of the subscription. Changing this string tears the live
   * subscription down and opens a new one — object-identity churn in
   * `subscribe` deliberately does NOT.
   */
  subscriptionKey: string;
  /** Opens the live subscription. Called only while `enabled`. */
  subscribe: (callback: AuditSubscriptionCallback) => () => void;
  /** Loads entries older than `cursor`. */
  fetchPage: (cursor: string) => Promise<AuditFeedPage>;
  /** Message used when a subscription error carries none of its own. */
  subscribeErrorFallback: string;
}

export interface UseAuditFeedReturn {
  entries: EntityAuditEntry[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

const LOAD_MORE_ERROR_FALLBACK = 'Failed to load more audit entries';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Merge the live window with the historical tail into the list the UI renders:
 * unique ids, no CDC dual-write pairs, newest first.
 */
function dedupeAndSort(entries: EntityAuditEntry[]): EntityAuditEntry[] {
  const seen = new Set<string>();
  const byId: EntityAuditEntry[] = [];
  for (const entry of entries) {
    if (!entry.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    byId.push(entry);
  }
  // ADR-195 Phase 1 CDC dual-write: collapse the service+cdc pair that fires
  // for every write before surfacing to the UI.
  const out = dedupDualWrite(byId);
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

export function useAuditFeed({
  enabled,
  pageSize,
  subscriptionKey,
  subscribe,
  fetchPage,
  subscribeErrorFallback,
}: UseAuditFeedOptions): UseAuditFeedReturn {
  const [liveEntries, setLiveEntries] = useState<EntityAuditEntry[]>([]);
  const [historyEntries, setHistoryEntries] = useState<EntityAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const isMounted = useRef(true);

  // Stable identities — the effect below re-runs on `subscriptionKey`, never on
  // the caller re-creating its inline closures.
  const openSubscription = useEventCallback(subscribe);
  const requestPage = useEventCallback(fetchPage);
  const describeSubscribeError = useEventCallback((err: unknown) =>
    getErrorMessage(err, subscribeErrorFallback),
  );

  // 🔴 LIVE SUBSCRIPTION — owns the newest window
  useEffect(() => {
    isMounted.current = true;
    if (!enabled) {
      setLiveEntries([]);
      setHistoryEntries([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    // Reset the historical tail whenever the subscription identity changes —
    // prevents mixing pages from the previous entity/filter set.
    setHistoryEntries([]);
    setNextCursor(undefined);
    setHasMore(false);

    const unsubscribe = openSubscription((entries, subscriptionError) => {
      if (!isMounted.current) return;
      if (subscriptionError) {
        setError(describeSubscribeError(subscriptionError));
        setIsLoading(false);
        return;
      }
      setLiveEntries(entries);
      // A full live window implies older entries likely exist.
      setHasMore(entries.length >= pageSize);
      setError(null);
      setIsLoading(false);
    });

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [
    enabled,
    pageSize,
    subscriptionKey,
    openSubscription,
    describeSubscribeError,
  ]);

  // 📜 HISTORICAL PAGINATION — entries older than the live window
  const loadMore = useCallback(async () => {
    if (!enabled || isLoading) return;

    // Oldest loaded entry becomes the cursor; without it we can't page older.
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
      const page = await requestPage(cursor);
      if (!isMounted.current) return;
      setHistoryEntries((prev) => [...prev, ...page.entries]);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (!isMounted.current) return;
      setError(getErrorMessage(err, LOAD_MORE_ERROR_FALLBACK));
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [
    enabled,
    isLoading,
    liveEntries,
    historyEntries,
    nextCursor,
    requestPage,
  ]);

  // Kept for API compatibility — the subscription is already live, so there is
  // nothing to re-fetch. Clears transient error state.
  const refetch = useCallback(() => {
    setError(null);
  }, []);

  const entries = useMemo(
    () => dedupeAndSort([...liveEntries, ...historyEntries]),
    [liveEntries, historyEntries],
  );

  return { entries, isLoading, error, hasMore, loadMore, refetch };
}
