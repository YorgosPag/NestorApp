/**
 * GET /api/audit-trail/[entityType]/[entityId]
 *
 * Paginated audit trail for a specific entity.
 * Returns field-level change history (newest first).
 *
 * @module api/audit-trail/[entityType]/[entityId]
 * @permission Authenticated users (same company)
 * @rateLimit STANDARD (60 req/min)
 * @enterprise ADR-195 — Entity Audit Trail
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import type { AuditEntityType, EntityAuditEntry, EntityAuditResponse } from '@/types/audit-trail';

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set<AuditEntityType>([
  'contact', 'building', 'property', 'project', 'parking', 'storage',
]);

// ============================================================================
// GET — Paginated Audit Trail
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<EntityAuditResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const db = getAdminFirestore();
      if (!db) throw new ApiError(503, 'Database unavailable');

      // Extract route params from URL
      // URL pattern: /api/audit-trail/[entityType]/[entityId]
      const { entityType, entityId } = extractParamsFromUrl(request.url);

      if (!entityType || !VALID_ENTITY_TYPES.has(entityType)) {
        throw new ApiError(400, `Invalid entity type. Valid: ${[...VALID_ENTITY_TYPES].join(', ')}`);
      }
      if (!entityId) {
        throw new ApiError(400, 'Entity ID is required');
      }

      // Parse query params
      const url = new URL(request.url);
      const limitParam = parseInt(url.searchParams.get('limit') ?? '20', 10);
      const limit = Math.min(Math.max(limitParam, 1), 100); // Clamp 1-100
      const startAfter = url.searchParams.get('startAfter') ?? undefined;

      // Build Firestore query
      let q = db
        .collection(COLLECTIONS.ENTITY_AUDIT_TRAIL)
        .where(FIELDS.ENTITY_TYPE, '==', entityType)
        .where(FIELDS.ENTITY_ID, '==', entityId)
        .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
        .orderBy('timestamp', 'desc')
        .limit(limit + 1); // Fetch one extra to determine hasMore

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
      const docs = snapshot.docs;
      const hasMore = docs.length > limit;
      const resultDocs = hasMore ? docs.slice(0, limit) : docs;

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
        ...(hasMore && resultDocs.length > 0
          ? { nextCursor: resultDocs[resultDocs.length - 1].id }
          : {}),
      };

      return apiSuccess(response, 'Audit trail retrieved');
    },
  ),
);

// ============================================================================
// HELPERS
// ============================================================================

function extractParamsFromUrl(url: string): { entityType: string | null; entityId: string | null } {
  const segments = new URL(url).pathname.split('/');
  // /api/audit-trail/[entityType]/[entityId]
  // segments: ['', 'api', 'audit-trail', entityType, entityId]
  const auditTrailIdx = segments.indexOf('audit-trail');
  if (auditTrailIdx === -1 || auditTrailIdx + 2 >= segments.length) {
    return { entityType: null, entityId: null };
  }
  return {
    entityType: segments[auditTrailIdx + 1] || null,
    entityId: segments[auditTrailIdx + 2] || null,
  };
}
