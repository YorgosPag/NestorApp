/**
 * Unit PATCH / DELETE / GET endpoint
 *
 * @module api/units/[id]
 * @permission units:units:update (PATCH), units:units:delete (DELETE), units:units:view (GET)
 * @rateLimit STANDARD (60 req/min)
 * @see ADR-184 (Building Spaces Tabs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { UNIT_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { linkEntity, validateLinkedSpacesUniqueness } from '@/lib/firestore/entity-linking.service';
import { validateUnitFieldLocking } from '@/lib/firestore/unit-field-locking';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { PropertyOwnerRole } from '@/types/ownership-table';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';
import { extractIdFromUrl } from '@/lib/api/route-helpers';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import {
  activateClientPersona,
  autoCreateUnitContactLinks,
  deactivateUnitContactLinks,
} from './unit-contact-links';
import { validateCommercialTransaction } from './unit-commercial-validation';
import {
  UnitPatchSchema,
  applyMultiLevelDefaults,
  applyLevelDataAggregation,
  buildUpdateData,
  detectCancellation,
  type UnitMutationResult,
  type UnitPatchPayload,
} from './unit-patch-helpers';

const logger = createModuleLogger('UnitIdRoute');

// ============================================================================
// PATCH — Update Unit
// ============================================================================

export const PATCH = withStandardRateLimit(
  withAuth<ApiSuccessResponse<UnitMutationResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Unit ID is required');
      if (id === '__new__') throw new ApiError(400, 'Cannot update placeholder unit — save it first');

      try {
        const docRef = adminDb.collection(COLLECTIONS.UNITS).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) throw new ApiError(404, 'Unit not found');

        await requireUnitInTenant({ ctx, unitId: id, path: '/api/units/[id]' });
        const existing = doc.data() as Record<string, unknown>;

        const parsed = safeParseBody(UnitPatchSchema, await request.json());
        if (parsed.error) throw new ApiError(400, 'Validation failed');
        const { _v: expectedVersion, ...body } = parsed.data as UnitPatchPayload & { _v?: number };

        // 🛡️ ADR-249: Field locking after sale/reservation
        validateUnitFieldLocking(
          existing.commercialStatus as string | undefined,
          Object.keys(body),
        );

        // ADR-236: Multi-level floors — mutates body in-place
        applyMultiLevelDefaults(body);

        // ADR-236 Phase 2: Per-level data aggregation — mutates body in-place
        applyLevelDataAggregation(body, existing.levels as typeof body.levels);

        // Hierarchy + buyer validation for reserve/sell operations
        const isCommercialTransaction =
          body.commercialStatus === 'reserved' || body.commercialStatus === 'sold';
        if (isCommercialTransaction) {
          await validateCommercialTransaction(
            adminDb,
            existing,
            body.commercial as Record<string, unknown> | undefined,
            body.commercialStatus as 'reserved' | 'sold',
          );
        }

        // SPEC-257A: Detect cancellation before write
        const isCancellation = detectCancellation(existing, body);

        // Build sanitised Firestore payload
        const updateData = buildUpdateData(body, existing);

        // Compute field-level diffs BEFORE the write (with ID→name resolution)
        const auditChanges = await EntityAuditService.diffFieldsWithResolution(
          existing,
          updateData,
          UNIT_TRACKED_FIELDS,
          {
            buildingId: async (bldgId) => {
              if (!bldgId || typeof bldgId !== 'string') return null;
              const snap = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(bldgId).get();
              return snap.exists ? (snap.data()?.name as string) ?? null : null;
            },
          },
        );

        // 🛡️ ADR-247 F-1: Server-side uniqueness guard for linked spaces
        if (Array.isArray(body.linkedSpaces)) {
          const buildingId = (existing.buildingId as string) ?? null;
          if (buildingId) {
            await validateLinkedSpacesUniqueness(
              adminDb, buildingId, id,
              body.linkedSpaces as ReadonlyArray<{ spaceId: string }>,
            );
          }
        }

        // SPEC-256A: Version-checked write (injects updatedAt + updatedBy)
        const versionResult = await withVersionCheck({
          db: adminDb,
          collection: COLLECTIONS.UNITS,
          docId: id,
          expectedVersion,
          updates: updateData,
          userId: ctx.uid,
        });

        // Resync payment plan when sale price changes (non-blocking)
        const newCommercial = updateData.commercial as Record<string, unknown> | undefined;
        if (newCommercial) {
          const newPrice =
            (newCommercial.askingPrice as number | null) ??
            (newCommercial.finalPrice as number | null);
          if (newPrice && newPrice > 0) {
            PaymentPlanService.resyncTotalAmount(id, newPrice, ctx.uid).catch((err) => {
              logger.warn('Payment plan resync failed (non-blocking)', {
                unitId: id, newPrice, error: getErrorMessage(err),
              });
            });
          }
        }

        logger.info('Unit updated', { id, companyId: ctx.companyId });

        // 🔗 ADR-239: Centralized linking — change detection + cascade (non-blocking)
        if ('buildingId' in body) {
          linkEntity('unit:buildingId', {
            auth: ctx,
            entityId: id,
            newLinkValue: (body.buildingId as string) ?? null,
            existingDoc: existing,
            apiPath: '/api/units/[id] (PATCH)',
          }).catch((err) => {
            logger.warn('linkEntity failed (non-blocking)', { unitId: id, error: getErrorMessage(err) });
          });
        }

        await logAuditEvent(ctx, 'data_updated', 'unit', 'api', {
          newValue: { type: 'status', value: { unitId: id, updates: Object.keys(updateData) } },
          metadata: { reason: 'Unit updated via API' },
        });

        // ================================================================
        // POST-WRITE SIDE EFFECTS (fire-and-forget, non-blocking)
        // All side effects run AFTER successful Firestore write.
        // ================================================================
        if (isCommercialTransaction) {
          const ownersArr = newCommercial?.owners as
            ReadonlyArray<{ contactId: string; role: PropertyOwnerRole }> | null ?? null;
          const primaryBuyerId = ownersArr?.[0]?.contactId ?? null;

          if (primaryBuyerId) {
            activateClientPersona(adminDb, primaryBuyerId).catch((err) => {
              logger.warn('Auto-persona activation failed (non-blocking)', {
                buyerContactId: primaryBuyerId, error: getErrorMessage(err),
              });
            });
            autoCreateUnitContactLinks(adminDb, id, ownersArr!, ctx.companyId, ctx.uid)
              .catch((err) => {
                logger.warn('SPEC-257A: Auto-link failed (non-blocking)', {
                  unitId: id, error: getErrorMessage(err),
                });
              });
          }
        }

        if (isCancellation) {
          deactivateUnitContactLinks(adminDb, id, ctx.uid).catch((err) => {
            logger.warn('SPEC-257A: Deactivate links failed (non-blocking)', {
              unitId: id, error: getErrorMessage(err),
            });
          });
        }

        if (auditChanges.length > 0) {
          const isStatusChange = auditChanges.some((c) => c.field === 'status');
          EntityAuditService.recordChange({
            entityType: 'unit',
            entityId: id,
            entityName: (existing.name as string) ?? null,
            action: isStatusChange ? 'status_changed' : 'updated',
            changes: auditChanges,
            performedBy: ctx.uid,
            performedByName: ctx.email ?? null,
            companyId: ctx.companyId,
          }).catch(() => { /* fire-and-forget */ });
        }

        return apiSuccess<UnitMutationResult>({ id, _v: versionResult.newVersion }, 'Unit updated');
      } catch (error) {
        if (error instanceof ConflictError) {
          return NextResponse.json(error.body, { status: error.statusCode });
        }
        if (error instanceof ApiError) throw error;
        logger.error('Error updating unit', { id, error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to update unit'));
      }
    },
    { permissions: 'units:units:update' }
  )
);

// ============================================================================
// DELETE — Delete Unit
// ============================================================================

export const DELETE = withStandardRateLimit(
  withAuth<ApiSuccessResponse<UnitMutationResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Unit ID is required');

      try {
        const docRef = adminDb.collection(COLLECTIONS.UNITS).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) throw new ApiError(404, 'Unit not found');

        await requireUnitInTenant({ ctx, unitId: id, path: '/api/units/[id]' });
        const existing = doc.data() as Record<string, unknown>;

        // 🛡️ ADR-226: Guarded deletion (checks dependencies → blocks or deletes + audit)
        await executeDeletion(adminDb, 'unit', id, ctx.uid, ctx.companyId);

        logger.info('Unit deleted', { id, companyId: ctx.companyId });

        await logAuditEvent(ctx, 'data_deleted', 'unit', 'api', {
          newValue: { type: 'status', value: { unitId: id, name: existing.name } },
          metadata: { reason: 'Unit deleted via API' },
        });

        return apiSuccess<UnitMutationResult>({ id }, 'Unit deleted');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error deleting unit', { id, error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to delete unit'));
      }
    },
    { permissions: 'units:units:delete' }
  )
);

// ============================================================================
// GET — Fetch Single Unit
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<Record<string, unknown>>>(
    async (request: NextRequest, ctx: AuthContext) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Unit ID is required');

      await requireUnitInTenant({ ctx, unitId: id, path: '/api/units/[id]' });

      const docRef = adminDb.collection(COLLECTIONS.UNITS).doc(id);
      const doc = await docRef.get();
      if (!doc.exists) throw new ApiError(404, 'Unit not found');

      return apiSuccess({ id: doc.id, ...doc.data() }, 'Unit loaded');
    },
    { permissions: 'units:units:view' }
  )
);
