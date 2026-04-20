/**
 * GET /api/audit-trail/global
 *
 * Company-wide audit trail across all entity types.
 * Admin-only — equivalent of Google Workspace Admin Console "Audit log".
 *
 * Supports optional filters:
 *   - `entityType` — filter to a single entity type (in-memory)
 *   - `performedBy` — free-text match on user UID or display name (in-memory)
 *   - `action`     — filter to a specific audit action (in-memory)
 *   - `fromDate`   — ISO date, inclusive (in-memory)
 *   - `toDate`     — ISO date, inclusive (in-memory)
 *   - `limit`      — 1..100, default 20
 *   - `offset`     — 0..N, default 0 (offset-based pagination)
 *
 * Tenant isolation is automatic via `ctx.companyId` — no admin can read
 * another company's audit trail.
 *
 * **Indexing strategy (MVP, works without composite index deploy)**:
 *   The server query is intentionally simple — a single-field equality
 *   filter on `companyId` with a hard cap of `SCAN_CAP` documents. All
 *   other filters (entityType, action, user, date range) and sorting are
 *   applied in-memory. This avoids the composite-index requirement and
 *   lets the feature work immediately in development without a Firebase
 *   index deploy.
 *
 *   For production scale (> SCAN_CAP audit entries per company), upgrade
 *   to the composite index `(companyId asc, timestamp desc)` already
 *   registered in `firestore.indexes.json`, then switch the query to use
 *   `.orderBy('timestamp', 'desc').limit(X)` with cursor pagination.
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
  AuditSource,
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
 * Hard cap on documents fetched from Firestore per request.
 * Keeps the unindexed scan bounded. If a company exceeds this count,
 * the proper fix is to deploy the composite index and switch to
 * server-side pagination.
 */
const SCAN_CAP = 500;

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
      const toDateRaw = parseIsoDate(toDateStr, 'toDate');
      const toDate = toDateRaw
        ? new Date(new Date(toDateRaw).setHours(23, 59, 59, 999))
        : null;

      if (fromDate && toDate && fromDate > toDate) {
        throw new ApiError(400, 'fromDate must be <= toDate');
      }

      const limitParam = parseInt(url.searchParams.get('limit') ?? '20', 10);
      const limit = Math.min(Math.max(limitParam, 1), 100);

      const offsetParam = parseInt(url.searchParams.get('offset') ?? '0', 10);
      const offset = Math.max(offsetParam, 0);

      // Single-field query — does NOT require a composite index.
      // Firestore's auto-generated index on `companyId` handles this.
      const snapshot = await db
        .collection(COLLECTIONS.ENTITY_AUDIT_TRAIL)
        .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
        .limit(SCAN_CAP)
        .get();

      // Materialize all docs → entries
      const allEntries: EntityAuditEntry[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        const rawSource = data.source;
        const source: AuditSource | undefined =
          rawSource === 'cdc' || rawSource === 'service' ? rawSource : undefined;
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
          ...(source ? { source } : {}),
        };
      });

      // In-memory filter pipeline
      const performedByLower = performedByFilter?.toLowerCase() ?? null;
      const filtered = allEntries.filter((entry) => {
        if (entityTypeFilter && entry.entityType !== entityTypeFilter) {
          return false;
        }
        if (actionFilter && entry.action !== actionFilter) return false;
        if (performedByLower) {
          const haystack =
            `${entry.performedBy ?? ''} ${entry.performedByName ?? ''}`.toLowerCase();
          if (!haystack.includes(performedByLower)) return false;
        }
        if (fromDate || toDate) {
          const ts = entry.timestamp ? new Date(entry.timestamp) : null;
          if (!ts || isNaN(ts.getTime())) return false;
          if (fromDate && ts < fromDate) return false;
          if (toDate && ts > toDate) return false;
        }
        return true;
      });

      // Sort newest-first
      filtered.sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      });

      const pageEntries = filtered.slice(offset, offset + limit);
      const hasMore = filtered.length > offset + limit;

      const response: EntityAuditResponse = {
        entries: pageEntries,
        hasMore,
        ...(hasMore ? { nextCursor: String(offset + limit) } : {}),
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
