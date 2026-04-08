/**
 * POST /api/properties/[id]/activity
 *
 * Records a custom audit trail entry for a property (e.g., floorplan upload).
 * Used when the operation happens client-side but audit must be server-side.
 *
 * @module api/properties/[id]/activity
 * @permission properties:properties:update
 * @rateLimit STANDARD (60 req/min)
 * @enterprise ADR-195 — Entity Audit Trail
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { extractNestedIdFromUrl } from '@/lib/api/route-helpers';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditAction } from '@/types/audit-trail';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';

// ============================================================================
// TYPES
// ============================================================================

interface ActivityPayload {
  action: AuditAction;
  changes: Array<{
    field: string;
    oldValue: string | number | boolean | null;
    newValue: string | number | boolean | null;
    label?: string;
  }>;
}

const VALID_ACTIONS: ReadonlySet<string> = new Set<AuditAction>([
  'created', 'updated', 'deleted', 'status_changed', 'linked', 'unlinked',
  'professional_assigned', 'professional_removed', 'email_sent', 'invoice_created',
]);

// ============================================================================
// POST — Record Activity
// ============================================================================

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<{ recorded: boolean }>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const db = getAdminFirestore();
      if (!db) throw new ApiError(503, 'Database unavailable');

      const id = extractNestedIdFromUrl(request.url, 'properties');
      if (!id) throw new ApiError(400, 'Property ID is required');

      await requirePropertyInTenantScope({ ctx, propertyId: id, path: '/api/properties/[id]/activity' });

      // Validate property exists
      const docRef = db.collection(COLLECTIONS.PROPERTIES).doc(id);
      const doc = await docRef.get();
      if (!doc.exists) throw new ApiError(404, 'Property not found');

      const existing = doc.data() as Record<string, unknown>;

      // Parse and validate body
      const body: ActivityPayload = await request.json();

      if (!body.action || !VALID_ACTIONS.has(body.action)) {
        throw new ApiError(400, `Invalid action. Valid: ${[...VALID_ACTIONS].join(', ')}`);
      }

      if (!Array.isArray(body.changes) || body.changes.length === 0) {
        throw new ApiError(400, 'At least one change entry is required');
      }

      // Record audit entry (fire-and-forget)
      await EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.PROPERTY,
        entityId: id,
        entityName: (existing.name as string) ?? null,
        action: body.action,
        changes: body.changes,
        performedBy: ctx.uid,
        performedByName: ctx.email ?? null,
        companyId: (existing.companyId as string) ?? ctx.companyId,
      });

      return apiSuccess({ recorded: true }, 'Activity recorded');
    },
    { permissions: 'properties:properties:update' },
  ),
);

// Helper: extractNestedIdFromUrl → centralized in @/lib/api/route-helpers
