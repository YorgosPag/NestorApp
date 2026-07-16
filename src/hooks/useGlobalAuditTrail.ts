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
 * The live-window / historical-tail / dedupe plumbing is shared with
 * `useEntityAudit` via `useAuditFeed` (ADR-584). This hook owns only what is
 * specific to the admin feed: the filter set, and the `offset`-cursored
 * endpoint that carries those filters.
 *
 * @module hooks/useGlobalAuditTrail
 * @enterprise ADR-195 — Entity Audit Trail (Phase 10: Client Subscriptions)
 * @permission super_admin | company_admin (server + rules enforced)
 */

'use client';

import { useMemo } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { useAuditFeed } from '@/hooks/audit/useAuditFeed';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
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

const DEFAULT_PAGE_SIZE = 30;

/** Filters that page the historical tail, in query-string order. */
const FILTER_PARAMS = [
  'entityType',
  'performedBy',
  'action',
  'fromDate',
  'toDate',
] as const satisfies readonly (keyof GlobalAuditFilters)[];

// ============================================================================
// HOOK
// ============================================================================

export function useGlobalAuditTrail({
  filters,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseGlobalAuditTrailOptions = {}): UseGlobalAuditTrailReturn {
  const { user } = useAuth();

  // Value-identity of the filter set, so a caller re-creating an equal object
  // does not tear down the live subscription.
  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);

  return useAuditFeed({
    enabled: Boolean(user),
    pageSize,
    subscriptionKey: `${user?.uid ?? ''}|${filtersKey}`,
    subscribeErrorFallback: 'Failed to subscribe to audit trail',

    subscribe: (callback) =>
      EntityAuditClientService.subscribeGlobal(
        { limit: pageSize, filters: filters ?? undefined },
        callback,
      ),

    fetchPage: async (cursor) => {
      const params = new URLSearchParams({ limit: String(pageSize) });
      params.set('offset', cursor);
      for (const name of FILTER_PARAMS) {
        const value = filters?.[name];
        if (value) params.set(name, value);
      }

      const data = await apiClient.get<EntityAuditResponse>(
        `${API_ROUTES.AUDIT_TRAIL.GLOBAL}?${params.toString()}`,
      );
      return {
        entries: data.entries,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
      };
    },
  });
}
