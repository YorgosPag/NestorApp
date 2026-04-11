/**
 * GET /api/audit-trail/global
 *
 * Company-wide audit trail across all entity types.
 * Admin-only — equivalent of Google Workspace Admin Console "Audit log".
 *
 * Supports optional filters:
 *   - `entityType` — filter to a single entity type (in-memory)
 *   - `performedBy` — filter to a specific user UID (in-memory)
 *   - `action`     — filter to a specific audit action (in-memory)
 *   - `fromDate`   — ISO date, inclusive (server-side via `timestamp >=`)
 *   - `toDate`     — ISO date, inclusive (server-side via `timestamp <=`)
 *   - `limit`      — 1..100, default 20
 *   - `startAfter` — cursor (audit doc ID)
 *
 * Tenant isolation is automatic via `ctx.companyId` — no admin can read
 * another company's audit trail.
 *
 * **Indexing strategy (MVP)**:
 *   - Single composite index: `(companyId, timestamp desc)` — base query
 *   - Date-range filters use the timestamp field (no extra index)
 *   - Entity/action/user filters are applied in-memory AFTER fetching.
 *     To keep pagination stable under filters, we overfetch by 5x when
 *     at least one in-memory filter is active. Acceptable for admin
 *     workloads; can be upgraded to dedicated composite indexes later.
 *
 * @module api/audit-trail/global
 * @permission super_admin | company_admin (enforced via withAuth)
 * @rateLimit STANDARD (60 req/min)
 * @enterprise ADR-195 — Entity Audit Trail (Phase 7: Global Admin View)
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import {
  ApiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '@/lib/api/ApiErrorHandler';
import type {
  AuditAction,
  AuditEntityType,
  EntityAuditEntry,
  EntityAuditResponse,
} from '@/types/audit-trail';

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set<AuditEntityType>([
  'contact',
  'building',
  'property',
  'project',
  'parking',
  'storage',
  'company',
  'floor',
  'purchase_order',
]);

const VALID_ACTIONS: ReadonlySet<string> = new Set<AuditAction>([
  'created',
  'updated',
  'deleted',
  'soft_deleted',
  'restored',
  'status_changed',
  'linked',
  'unlinked',
  'professional_assigned',
  'professional_removed',
  'email_sent',
  'invoice_created',
  'document_added',
  'document_removed',
]);

/**
 * Overfetch multiplier when in-memory filters are active.
 * Ensures we fetch enough candidates to satisfy `limit` after filtering,
 * without requiring a dedicated composite index per filter combination.
 */
const OVERFETCH_MULTIPLIER = 5;

// ============================================================================
// GET — Paginated Global Audit Trail
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<EntityAuditResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const db = getAdminFirestore();
      if (!db) throw new ApiError(503, 'Database unavailable');

      const url = new URL(request.url);

      // Parse + validate optional filters
      const entityTypeFilter = url.searchParams.get('entityType');
      if (entityTypeFilter && !VALID_ENTITY_TYPES.has(entityTypeFilter)) {
        throw new ApiError(
          400,
          `Invalid entity type. Valid: ${[...VALID_ENTITY_TYPES].join(', ')}`,
        );
      }

      const performedByFilter = url.searchParams.get('performedBy');
      if (performedByFilter && performedByFilter.length > 128) {
        throw new ApiError(400, 'performedBy too long');
      }

      const actionFilter = url.searchParams.get('action');
      if (actionFilter && !VALID_ACTIONS.has(actionFilter)) {
        throw new ApiError(
          400,
          `Invalid action. Valid: ${[...VALID_ACTIONS].join(', ')}`,
        );
      }

      const fromDateStr = url.searchParams.get('fromDate');
      const toDateStr = url.searchParams.get('toDate');
      const fromDate = parseIsoDate(fromDateStr, 'fromDate');
      const toDate = parseIsoDate(toDateStr, 'toDate');

      if (fromDate && toDate && fromDate > toDate) {
        throw new ApiError(400, 'fromDate must be <= toDate');
      }

      const limitParam = parseInt(url.searchParams.get('limit') ?? '20', 10);
      const limit = Math.min(Math.max(limitParam, 1), 100);
      const startAfter = url.searchParams.get('startAfter') ?? undefined;

      // Detect in-memory filter activity → decide fetch size
      const hasInMemoryFilters =
        !!entityTypeFilter || !!performedByFilter || !!actionFilter;
      const fetchSize = hasInMemoryFilters
        ? limit * OVERFETCH_MULTIPLIER + 1
        : limit + 1;

      // Build Firestore query — always company-scoped
      let q: FirebaseFirestore.Query = db
        .collection(COLLECTIONS.ENTITY_AUDIT_TRAIL)
        .where(FIELDS.COMPANY_ID, '==', ctx.companyId);

      if (fromDate) {
        q = q.where('timestamp', '>=', fromDate);
      }
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        q = q.where('timestamp', '<=', endOfDay);
      }

      q = q.orderBy('timestamp', 'desc').limit(fetchSize);

      // Cursor-based pagination
      if (startAfter) {
        const cursorDoc = await db
          .collection(COLLECTIONS.ENTITY_AUDIT_TRAIL)
          .doc(startAfter)
          .get();

        if (cursorDoc.exists) {
          q = q.startAfter(cursorDoc);
        }
      }

      const snapshot = await q.get();
      const rawDocs = snapshot.docs;

      // In-memory filter for entityType / performedBy / action
      const filteredDocs = rawDocs.filter((doc) => {
        const data = doc.data();
        if (entityTypeFilter && data.entityType !== entityTypeFilter) return false;
        if (actionFilter && data.action !== actionFilter) return false;
        if (performedByFilter) {
          const haystack = `${data.performedBy ?? ''} ${data.performedByName ?? ''}`.toLowerCase();
          if (!haystack.includes(performedByFilter.toLowerCase())) return false;
        }
        return true;
      });

      // Determine hasMore: if we overfetched AND still have > limit results
      // after filtering, there are likely more pages available.
      const hasMore = hasInMemoryFilters
        ? rawDocs.length >= fetchSize && filteredDocs.length > limit
        : rawDocs.length > limit;

      const resultDocs = filteredDocs.slice(0, limit);

      const entries: EntityAuditEntry[] = resultDocs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          entityType: data.entityType,
          entityId: data.entityId,
          entityName: data.entityName ?? null,
          action: data.action,
          changes: data.changes ?? [],
          performedBy: data.performedBy,
          performedByName: data.performedByName ?? null,
          companyId: data.companyId,
          timestamp: data.timestamp?.toDate?.()?.toISOString() ?? '',
        };
      });

      const response: EntityAuditResponse = {
        entries,
        hasMore,
        // Use the LAST raw doc for the cursor (not filtered), so the next
        // page starts where this fetch left off regardless of filters.
        ...(hasMore && rawDocs.length > 0
          ? { nextCursor: rawDocs[rawDocs.length - 1].id }
          : {}),
      };

      return apiSuccess(response, 'Global audit trail retrieved');
    },
    { requiredGlobalRoles: ['super_admin', 'company_admin'] },
  ),
);

// ============================================================================
// HELPERS
// ============================================================================

function parseIsoDate(raw: string | null, fieldName: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    throw new ApiError(400, `Invalid ${fieldName}: expected ISO date`);
  }
  return d;
}
