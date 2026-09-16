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
 *   ADR-864 Φ1β: the **personal** ledger lives in its own partition
 *   (`entity_audit_trail_personal`, `lib/audit/audit-ledger.ts`) and is readable
 *   **only** by `request.auth.uid == userId` — not by company admins, not by
 *   super admin. The company rule above is untouched.
 *
 * @module services/entity-audit-client.service
 * @enterprise ADR-195 — Entity Audit Trail (Phase 10: Client Subscriptions)
 * @ssot ADR-294 — ONLY canonical client-side reader of `entity_audit_trail`.
 */

'use client';

import {
  where,
  orderBy,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';

import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { dedupDualWrite } from '@/services/audit/dedup-dual-write';
import { entityAuditEntriesFromData } from '@/lib/audit/audit-entry-from-document';
import { AUDIT_LEDGER_COLLECTION, type AuditLedgerKind } from '@/lib/audit/audit-ledger';
import type {
  AuditAction,
  AuditEntityType,
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
  /**
   * 🔑 ADR-864 Φ1β — **ποιο βιβλίο**. Απουσία ⇒ `company` (ό,τι ίσχυε πάντα).
   *
   * `personal` ⇒ διαμέρισμα `ENTITY_AUDIT_TRAIL_PERSONAL`, που το `tenant-config.ts` δηλώνει
   * `mode: 'userId'` ⇒ το **ίδιο** tenant layer βάζει `userId == uid του συνδεδεμένου` — το
   * `uid` το δίνει η ταυτότητα, **ποτέ** ο καλών.
   */
  ledger?: AuditLedgerKind;
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

/**
 * Έγγραφα → εγγραφές, μέσω του **ενός** συνόρου (`lib/audit/audit-entry-from-document`).
 * Εγγραφή χωρίς ακριβώς ένα βιβλίο **παραλείπεται** — δεν μαντεύουμε σε ποιον ανήκει.
 */
function entriesOf(documents: ReadonlyArray<DocumentData & { id?: string }>): EntityAuditEntry[] {
  return entityAuditEntriesFromData(
    documents.map(({ id, ...data }) => ({ id: id ?? '', data })),
  );
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
        const all = entriesOf(result.documents);
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
   * The partition follows the requested {@link EntitySubscriptionOptions.ledger}; its tenant
   * filter comes from `tenant-config.ts`: `company` ⇒ `companyId` (default), `personal` ⇒
   * `userId == uid`.
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
      AUDIT_LEDGER_COLLECTION[options.ledger ?? 'company'],
      (result) => {
        const entries = entriesOf(result.documents);
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
