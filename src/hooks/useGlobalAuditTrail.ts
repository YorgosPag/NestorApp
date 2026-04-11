/**
 * 📜 useGlobalAuditTrail — Admin client hook for company-wide audit trail
 *
 * Fetches paginated audit history across ALL entity types for the current
 * company (tenant-isolated server-side). Supports optional filters.
 *
 * Mirrors `useEntityAudit` but targets the global admin endpoint. Both
 * hooks return the same shape so they can feed the shared
 * `AuditTimelineView` component.
 *
 * Subscribes to RealtimeService events for instant updates whenever any
 * tracked entity is created/updated/deleted anywhere in the app.
 *
 * @module hooks/useGlobalAuditTrail
 * @enterprise ADR-195 — Entity Audit Trail (Phase 7: Global Admin View)
 * @permission super_admin | company_admin (server enforces)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/lib/error-utils';
import { RealtimeService } from '@/services/realtime';
import type { RealtimeEventMap } from '@/services/realtime/types';
import type {
  AuditAction,
  AuditEntityType,
  EntityAuditEntry,
  EntityAuditResponse,
} from '@/types/audit-trail';

/**
 * Events that correspond to entity audit trail writes across the app.
 * When any of these fires, the global admin view refetches its current page.
 * Must stay in sync with the entity types served by /api/audit-trail/global.
 */
const GLOBAL_AUDIT_WATCH_EVENTS = [
  // Contacts (individual, company, service — all share the same collection)
  'CONTACT_CREATED',
  'CONTACT_UPDATED',
  'CONTACT_DELETED',
  // Buildings
  'BUILDING_CREATED',
  'BUILDING_UPDATED',
  'BUILDING_DELETED',
  // Projects
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_DELETED',
  // Units (properties)
  'UNIT_CREATED',
  'UNIT_UPDATED',
  'UNIT_DELETED',
  // Parking spots
  'PARKING_CREATED',
  'PARKING_UPDATED',
  'PARKING_DELETED',
  // Storages
  'STORAGE_CREATED',
  'STORAGE_UPDATED',
  'STORAGE_DELETED',
  // Contact relationships (tracked via entity audit too)
  'RELATIONSHIP_CREATED',
  'RELATIONSHIP_UPDATED',
  'RELATIONSHIP_DELETED',
  // Entity linking (ADR-012) — surfaces through audit trail as linked/unlinked
  'ENTITY_LINKED',
  'ENTITY_UNLINKED',
] as const satisfies ReadonlyArray<keyof RealtimeEventMap>;

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
// HOOK
// ============================================================================

export function useGlobalAuditTrail({
  filters,
  pageSize = 20,
}: UseGlobalAuditTrailOptions = {}): UseGlobalAuditTrailReturn {
  const { user } = useAuth();
  const [entries, setEntries] = useState<EntityAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isMounted = useRef(true);

  // Serialize filters into a stable key for useCallback dependency
  const filtersKey = JSON.stringify(filters ?? {});

  const fetchEntries = useCallback(
    async (offset?: string) => {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ limit: String(pageSize) });
        if (offset) params.set('offset', offset);
        if (filters?.entityType) params.set('entityType', filters.entityType);
        if (filters?.performedBy) params.set('performedBy', filters.performedBy);
        if (filters?.action) params.set('action', filters.action);
        if (filters?.fromDate) params.set('fromDate', filters.fromDate);
        if (filters?.toDate) params.set('toDate', filters.toDate);

        const data = await apiClient.get<EntityAuditResponse>(
          `${API_ROUTES.AUDIT_TRAIL.GLOBAL}?${params.toString()}`,
        );

        if (!isMounted.current) return;

        if (offset) {
          setEntries((prev) => [...prev, ...data.entries]);
        } else {
          setEntries(data.entries);
        }

        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      } catch (err) {
        if (!isMounted.current) return;
        setError(getErrorMessage(err, 'Failed to load global audit trail'));
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, pageSize, filtersKey],
  );

  // Reset + fetch whenever filters or refresh trigger change
  useEffect(() => {
    isMounted.current = true;
    setEntries([]);
    setNextCursor(undefined);
    setHasMore(false);
    fetchEntries();

    return () => {
      isMounted.current = false;
    };
  }, [fetchEntries, refreshTrigger]);

  // 🏢 ENTERPRISE: Real-time subscription via RealtimeService (ADR-195 Phase 8)
  // Any entity create/update/delete across the app → refresh the global view.
  // Debounced by 500ms to let the server finish writing the audit entry
  // (entity save dispatches immediately; audit.recordChange is fire-and-forget).
  useEffect(() => {
    isMounted.current = true;

    const handleEvent = () => {
      setTimeout(() => {
        if (isMounted.current) {
          setRefreshTrigger((prev) => prev + 1);
        }
      }, 500);
    };

    const unsubscribers = GLOBAL_AUDIT_WATCH_EVENTS.map((eventName) =>
      RealtimeService.subscribe(eventName, handleEvent),
    );

    return () => {
      isMounted.current = false;
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

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
