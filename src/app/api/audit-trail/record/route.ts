/**
 * POST /api/audit-trail/record
 *
 * Centralized audit trail recording endpoint.
 * Accepts pre-computed diffs from ANY entity type (contacts, buildings, etc.).
 *
 * Security:
 * - performedBy/performedByName derived from auth token (NEVER from client)
 * - Entity ownership verified via companyId check
 *
 * @module api/audit-trail/record
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
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { EntityAuditService } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { AuditEntityType, AuditAction, AuditFieldChange } from '@/types/audit-trail';
// ADR-195 SSoT — entity→collection routing (εξήχθη ώστε να κλειδώνεται με regression test· βλ. module).
import {
  ENTITY_COLLECTION_MAP,
  SUBCOLLECTION_ENTITY_TYPES,
  VALID_ENTITY_TYPES,
} from '@/config/audit-entity-collection-map';

const logger = createModuleLogger('AuditTrailRecord');

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_ACTIONS: ReadonlySet<string> = new Set<AuditAction>([
  'created', 'updated', 'deleted', 'restored', 'status_changed', 'linked', 'unlinked',
  'professional_assigned', 'professional_removed', 'email_sent', 'invoice_created',
  'document_added', 'document_removed',
]);

// ============================================================================
// TYPES
// ============================================================================

interface RecordAuditPayload {
  entityType: string;
  entityId: string;
  entityName: string | null;
  action: string;
  changes: AuditFieldChange[];
}

interface RecordAuditResult {
  auditId: string | null;
}

// ============================================================================
// POST — Record Audit Entry
// ============================================================================

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<RecordAuditResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const db = getAdminFirestore();
      if (!db) throw new ApiError(503, 'Database unavailable');

      // Parse and validate payload
      const body: RecordAuditPayload = await request.json();

      if (!body.entityType || !VALID_ENTITY_TYPES.has(body.entityType)) {
        throw new ApiError(400, `Invalid entityType. Valid: ${[...VALID_ENTITY_TYPES].join(', ')}`);
      }
      if (!body.entityId || typeof body.entityId !== 'string') {
        throw new ApiError(400, 'entityId is required');
      }
      if (!body.action || !VALID_ACTIONS.has(body.action)) {
        throw new ApiError(400, `Invalid action. Valid: ${[...VALID_ACTIONS].join(', ')}`);
      }
      if (!Array.isArray(body.changes) || body.changes.length === 0) {
        throw new ApiError(400, 'changes array is required and must not be empty');
      }

      // Verify entity ownership: load doc via Admin SDK, check companyId
      const collectionName = ENTITY_COLLECTION_MAP[body.entityType];
      if (!collectionName) {
        throw new ApiError(400, `No collection mapping for entity type: ${body.entityType}`);
      }

      const entityRef = SUBCOLLECTION_ENTITY_TYPES.has(body.entityType)
        ? db
            .collection(COLLECTIONS.COMPANIES)
            .doc(ctx.companyId)
            .collection(collectionName)
            .doc(body.entityId)
        : db.collection(collectionName).doc(body.entityId);
      const entityDoc = await entityRef.get();

      // Action 'deleted' is recorded AFTER the entity is removed from
      // Firestore, so `!entityDoc.exists` is the normal case. Returning 404
      // here silently dropped every BIM delete audit entry (the client
      // swallows errors via `.catch(() => {})`). Allow the missing doc only
      // for the 'deleted' action and tag the audit row with the caller's
      // companyId — defense-in-depth: a malicious caller can only pollute
      // their own tenant's audit trail with fake IDs, never cross-tenant.
      if (!entityDoc.exists) {
        if (body.action !== 'deleted') {
          throw new ApiError(404, `Entity not found: ${body.entityType}/${body.entityId}`);
        }
      } else {
        const entityCompanyId = entityDoc.data()?.companyId as string | undefined;
        if (ctx.globalRole !== 'super_admin' && entityCompanyId && entityCompanyId !== ctx.companyId) {
          throw new ApiError(403, 'Access denied: entity belongs to a different company');
        }
      }

      // Record via EntityAuditService (server-side, fire-and-forget safe)
      const auditId = await EntityAuditService.recordChange({
        entityType: body.entityType as AuditEntityType,
        entityId: body.entityId,
        entityName: body.entityName ?? null,
        action: body.action as AuditAction,
        changes: body.changes,
        performedBy: ctx.uid,
        performedByName: ctx.email ?? null,
        companyId: ctx.companyId,
      });

      logger.info('Audit entry recorded', {
        entityType: body.entityType,
        entityId: body.entityId,
        action: body.action,
        changesCount: body.changes.length,
        auditId,
      });

      return apiSuccess<RecordAuditResult>({ auditId }, 'Audit entry recorded');
    },
  ),
);
