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
 * The live-window / historical-tail / dedupe plumbing is shared with
 * `useGlobalAuditTrail` via `useAuditFeed` (ADR-584). This hook owns only what
 * is specific to a single entity's feed: the gate, the entity subscription and
 * the `startAfter`-cursored endpoint.
 *
 * @module hooks/useEntityAudit
 * @enterprise ADR-195 — Entity Audit Trail (Phase 10: Client Subscriptions)
 * @ssot ADR-294 — Canonical hook. Re-implementations are blocked by the
 *                 SSoT ratchet (`entity-audit-trail` module).
 */

'use client';

import { API_ROUTES } from '@/config/domain-constants';
import { useAuditFeed } from '@/hooks/audit/useAuditFeed';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { EntityAuditClientService } from '@/services/entity-audit-client.service';
import { AUDIT_LEDGER_PARAM, type AuditLedgerKind } from '@/lib/audit/audit-ledger';
import type {
  AuditEntityType,
  EntityAuditEntry,
  EntityAuditResponse,
} from '@/types/audit-trail';

interface UseEntityAuditOptions {
  entityType: AuditEntityType;
  entityId: string | undefined;
  pageSize?: number;
  /**
   * 🔑 ADR-864 Φ1β — **ποιο βιβλίο**: `company` (προεπιλογή, ό,τι ίσχυε πάντα) ή `personal`.
   * Ο καλών το παράγει από τη **θεματοφυλακή** της οντότητας (`auditLedgerKindOf`), ποτέ από
   * τον χώρο της οθόνης. Ζωντανό παράθυρο **και** σελιδοποίηση ρωτούν το **ίδιο** βιβλίο.
   */
  ledger?: AuditLedgerKind;
}

interface UseEntityAuditReturn {
  entries: EntityAuditEntry[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// HOOK
// ============================================================================

export function useEntityAudit({
  entityType,
  entityId,
  pageSize = DEFAULT_PAGE_SIZE,
  ledger = 'company',
}: UseEntityAuditOptions): UseEntityAuditReturn {
  const { user } = useAuth();

  return useAuditFeed({
    enabled: Boolean(user && entityId),
    pageSize,
    subscriptionKey: `${user?.uid ?? ''}|${entityType}|${entityId ?? ''}|${ledger}`,
    subscribeErrorFallback: 'Failed to subscribe to entity audit trail',

    subscribe: (callback) => {
      if (!entityId) return () => {};
      return EntityAuditClientService.subscribeEntity(
        // ⚠️ Το εταιρικό βιβλίο στέλνει τα ΙΔΙΑ ορίσματα με πριν (άγκυρα χαρακτηρισμού).
        { entityType, entityId, limit: pageSize, ...(ledger === 'personal' ? { ledger } : {}) },
        callback,
      );
    },

    fetchPage: async (cursor) => {
      // Unreachable while `enabled` is false, but keeps the narrowing honest
      // without a non-null assertion.
      if (!entityId) return { entries: [], hasMore: false };

      const params = new URLSearchParams({ limit: String(pageSize) });
      params.set('startAfter', cursor);
      if (ledger === 'personal') params.set(AUDIT_LEDGER_PARAM, ledger);

      const data = await apiClient.get<EntityAuditResponse>(
        `${API_ROUTES.AUDIT_TRAIL.BY_ENTITY(entityType, entityId)}?${params.toString()}`,
      );
      return {
        entries: data.entries,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
      };
    },
  });
}
