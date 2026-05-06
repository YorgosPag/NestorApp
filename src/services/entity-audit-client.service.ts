/**
 * 📜 Entity Audit Trail — Client Subscription Service
 *
 * Google-level real-time subscriptions to the canonical `entity_audit_trail`
 * collection. Composes the existing `firestoreQueryService` SSoT layer
 * (ADR-214) — the tenant filter (`companyId == userCompanyId`) is auto-injected
 * so this module never touches auth context directly, never calls `onSnapshot`
 * itself, and never duplicates the firestore-realtime SSoT.
 *
 * Why a separate module from `entity-audit.service.ts`:
 *   The server service imports `server-only` and uses the Admin SDK. This
 *   client module is safe to import from React hooks. Both are canonical per
 *   ADR-195 — the server writes, the client subscribes to the same collection.
 *
 * SSoT contract (ADR-294, module `entity-audit-trail`):
 *   Inline subscriptions to `entity_audit_trail` are FORBIDDEN anywhere
 *   outside this file. The SSoT ratchet hook enforces this.
 *
 * Authorization:
 *   Enforced by `firestore.rules` — read allowed only for
 *   `super_admin | company_admin` whose token `companyId` claim matches the
 *   document. A denied query surfaces as an error on the callback.
 *
 * @module services/entity-audit-client.service
 * @enterprise ADR-195 — Entity Audit Trail (Phase 10: Client Subscriptions)
 * @ssot ADR-294 — ONLY canonical client-side reader of `entity_audit_trail`.
 */

'use client';

import {
  where,
  orderBy,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';

import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { dedupDualWrite } from '@/services/audit/dedup-dual-write';
import type {
  AuditAction,
  AuditEntityType,
  AuditSource,
  EntityAuditEntry,
} from '@/types/audit-trail';

// Re-export so existing importers (`useEntityAudit`, `useGlobalAuditTrail`)
// keep their `dedupDualWrite` import from this module stable.
export { dedupDualWrite };

// ============================================================================
// TYPES
// ============================================================================

export interface AuditSubscriptionFilters {
  entityType?: AuditEntityType;
  action?: AuditAction;
  performedBy?: string;
  /** Inclusive lower bound (ISO date string) — applied client-side */
  fromDate?: string;
  /** Inclusive upper bound (ISO date string) — applied client-side */
  toDate?: string;
}

export interface GlobalSubscriptionOptions {
  limit?: number;
  filters?: AuditSubscriptionFilters;
}

export interface EntitySubscriptionOptions {
  entityType: AuditEntityType;
  entityId: string;
  limit?: number;
}

export type AuditSubscriptionCallback = (
  entries: EntityAuditEntry[],
  error: Error | null,
) => void;

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_GLOBAL_WINDOW = 30;
const DEFAULT_ENTITY_WINDOW = 20;

/** Over-fetch factor so client-side filters still yield a usable window. */
const FILTER_OVERFETCH_FACTOR = 3;
const FILTER_OVERFETCH_CAP = 200;

// ============================================================================
// HELPERS
// ============================================================================

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date(0).toISOString();
}

function normalizeSource(value: unknown): AuditSource | undefined {
  return value === 'cdc' || value === 'service' ? value : undefined;
}

/**
 * Serialize a raw Firestore field that should be a display name string.
 * CDC Cloud Functions sometimes store floor/entity objects {name, number}
 * instead of plain strings — this guard prevents React #31 when rendering.
 */
function toDisplayString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if (obj.name != null) return String(obj.name);
    return JSON.stringify(obj);
  }
  return String(v) || null;
}

function normalizeEntry(doc: DocumentData & { id?: string }): EntityAuditEntry {
  return {
    id: doc.id,
    entityType: doc.entityType as AuditEntityType,
    entityId: doc.entityId as string,
    entityName: toDisplayString(doc.entityName),
    action: doc.action as AuditAction,
    changes: Array.isArray(doc.changes) ? doc.changes : [],
    performedBy: doc.performedBy as string,
    performedByName: toDisplayString(doc.performedByName),
    companyId: doc.companyId as string,
    timestamp: toIsoTimestamp(doc.timestamp),
    source: normalizeSource(doc.source),
  };
}

// `dedupDualWrite` lives in `@/services/audit/dedup-dual-write.ts` as a pure
// module so it can be unit tested without pulling in the Firebase client SDK
// that this service imports. Re-exported at the top of this file for
// backward-compatible imports from `useEntityAudit` / `useGlobalAuditTrail`.

function applyClientFilters(
  entries: EntityAuditEntry[],
  filters: AuditSubscriptionFilters | undefined,
  cap: number,
): EntityAuditEntry[] {
  if (!filters) return entries.slice(0, cap);

  const fromMs = filters.fromDate ? Date.parse(filters.fromDate) : null;
  const toMs = filters.toDate ? Date.parse(filters.toDate) : null;

  const filtered = entries.filter((entry) => {
    if (filters.entityType && entry.entityType !== filters.entityType) return false;
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.performedBy && entry.performedBy !== filters.performedBy) return false;
    if (fromMs !== null || toMs !== null) {
      const ts = Date.parse(entry.timestamp);
      if (Number.isFinite(ts)) {
        if (fromMs !== null && ts < fromMs) return false;
        if (toMs !== null && ts > toMs) return false;
      }
    }
    return true;
  });

  return filtered.slice(0, cap);
}

function hasAnyFilter(filters: AuditSubscriptionFilters | undefined): boolean {
  if (!filters) return false;
  return Boolean(
    filters.entityType ||
      filters.action ||
      filters.performedBy ||
      filters.fromDate ||
      filters.toDate,
  );
}

function computeFetchLimit(windowSize: number, filterActive: boolean): number {
  if (!filterActive) return windowSize;
  return Math.min(windowSize * FILTER_OVERFETCH_FACTOR, FILTER_OVERFETCH_CAP);
}

// ============================================================================
// SERVICE
// ============================================================================

export const EntityAuditClientService = {
  /**
   * Subscribe to the company-wide audit trail feed.
   *
   * Tenant filter (`companyId == current user's claim`) is auto-injected by
   * `firestoreQueryService`. Extra business filters are applied client-side so
   * we keep the composite-index surface small; we over-fetch by
   * `FILTER_OVERFETCH_FACTOR` so the visible window stays populated after
   * filtering.
   *
   * @returns Unsubscribe function. Call on unmount.
   */
  subscribeGlobal(
    options: GlobalSubscriptionOptions,
    callback: AuditSubscriptionCallback,
  ): Unsubscribe {
    const windowSize = options.limit ?? DEFAULT_GLOBAL_WINDOW;
    const filterActive = hasAnyFilter(options.filters);
    const fetchLimit = computeFetchLimit(windowSize, filterActive);

    const constraints: QueryConstraint[] = [orderBy('timestamp', 'desc')];

    return firestoreQueryService.subscribe<DocumentData & { id?: string }>(
      'ENTITY_AUDIT_TRAIL',
      (result) => {
        const all = result.documents.map((doc) => normalizeEntry(doc));
        const deduped = dedupDualWrite(all);
        callback(applyClientFilters(deduped, options.filters, windowSize), null);
      },
      (error) => callback([], error),
      {
        constraints,
        maxResults: fetchLimit,
      },
    );
  },

  /**
   * Subscribe to the audit trail for a single entity (per-entity History tab).
   *
   * Composes the canonical tenant filter with entityType + entityId filters.
   *
   * @returns Unsubscribe function. Call on unmount.
   */
  subscribeEntity(
    options: EntitySubscriptionOptions,
    callback: AuditSubscriptionCallback,
  ): Unsubscribe {
    const windowSize = options.limit ?? DEFAULT_ENTITY_WINDOW;

    const constraints: QueryConstraint[] = [
      where('entityType', '==', options.entityType),
      where('entityId', '==', options.entityId),
      orderBy('timestamp', 'desc'),
    ];

    return firestoreQueryService.subscribe<DocumentData & { id?: string }>(
      'ENTITY_AUDIT_TRAIL',
      (result) => {
        const entries = result.documents.map((doc) => normalizeEntry(doc));
        callback(dedupDualWrite(entries), null);
      },
      (error) => callback([], error),
      {
        constraints,
        maxResults: windowSize,
      },
    );
  },
};
