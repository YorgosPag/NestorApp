/**
 * 📜 useEntityAudit — Client hook for entity audit trail
 *
 * Fetches paginated audit history for any entity type.
 * Uses the centralized API client for authenticated requests.
 * Subscribes to RealtimeService events for instant updates.
 *
 * @module hooks/useEntityAudit
 * @enterprise ADR-195 — Entity Audit Trail
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeService } from '@/services/realtime';
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
  refetch: () => void;
}

/** Map entity types to RealtimeService event names */
const ENTITY_EVENT_MAP: Record<string, string[]> = {
  unit: ['UNIT_UPDATED', 'UNIT_CREATED', 'UNIT_DELETED'],
  building: ['BUILDING_UPDATED', 'BUILDING_CREATED', 'BUILDING_DELETED'],
  contact: ['CONTACT_UPDATED', 'CONTACT_CREATED', 'CONTACT_DELETED'],
  project: ['PROJECT_UPDATED', 'PROJECT_CREATED', 'PROJECT_DELETED'],
};

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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isMounted = useRef(true);

  const fetchEntries = useCallback(
    async (cursor?: string) => {
      if (!entityId || !user) return;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ limit: String(pageSize) });
        if (cursor) params.set('startAfter', cursor);

        const data = await apiClient.get<EntityAuditResponse>(
          `${API_ROUTES.AUDIT_TRAIL.BY_ENTITY(entityType, entityId)}?${params.toString()}`,
        );

        if (!isMounted.current) return;

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
        if (!isMounted.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load audit trail');
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    },
    [entityType, entityId, pageSize, user],
  );

  // Initial fetch on mount / entity change / refresh trigger
  useEffect(() => {
    setEntries([]);
    setNextCursor(undefined);
    setHasMore(false);
    fetchEntries();
  }, [fetchEntries, refreshTrigger]);

  // 🏢 ENTERPRISE: Real-time subscription via RealtimeService
  useEffect(() => {
    isMounted.current = true;
    const eventNames = ENTITY_EVENT_MAP[entityType];
    if (!eventNames) return;

    // Small delay to allow the server to write the audit entry
    const handleEvent = () => {
      setTimeout(() => {
        if (isMounted.current) {
          setRefreshTrigger((prev) => prev + 1);
        }
      }, 500);
    };

    const unsubscribers = eventNames.map((eventName) =>
      RealtimeService.subscribe(
        eventName as Parameters<typeof RealtimeService.subscribe>[0],
        handleEvent,
      ),
    );

    return () => {
      isMounted.current = false;
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [entityType]);

  const loadMore = useCallback(() => {
    if (hasMore && nextCursor && !isLoading) {
      fetchEntries(nextCursor);
    }
  }, [hasMore, nextCursor, isLoading, fetchEntries]);

  const refetch = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return { entries, isLoading, error, hasMore, loadMore, refetch };
}
