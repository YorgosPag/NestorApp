/**
 * 📜 useEntityAudit — Client hook for entity audit trail
 *
 * Fetches paginated audit history for any entity type.
 * Uses the centralized API client for authenticated requests.
 *
 * @module hooks/useEntityAudit
 * @enterprise ADR-195 — Entity Audit Trail
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useAuth } from '@/lib/auth/useAuth';
import type { AuditEntityType, EntityAuditEntry, EntityAuditResponse } from '@/types/audit-trail';

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
}

export function useEntityAudit({
  entityType,
  entityId,
  pageSize = 20,
}: UseEntityAuditOptions): UseEntityAuditReturn {
  const { user } = useAuth();
  const [entries, setEntries] = useState<EntityAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  const fetchEntries = useCallback(
    async (cursor?: string) => {
      if (!entityId || !user) return;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ limit: String(pageSize) });
        if (cursor) params.set('startAfter', cursor);

        const data = await apiClient.get<EntityAuditResponse>(
          `/api/audit-trail/${entityType}/${entityId}?${params.toString()}`,
        );

        if (cursor) {
          // Append for "load more"
          setEntries((prev) => [...prev, ...data.entries]);
        } else {
          // Replace for initial fetch
          setEntries(data.entries);
        }

        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load audit trail');
      } finally {
        setIsLoading(false);
      }
    },
    [entityType, entityId, pageSize, user],
  );

  // Initial fetch on mount / entity change
  useEffect(() => {
    setEntries([]);
    setNextCursor(undefined);
    setHasMore(false);
    fetchEntries();
  }, [fetchEntries]);

  const loadMore = useCallback(() => {
    if (hasMore && nextCursor && !isLoading) {
      fetchEntries(nextCursor);
    }
  }, [hasMore, nextCursor, isLoading, fetchEntries]);

  return { entries, isLoading, error, hasMore, loadMore };
}
