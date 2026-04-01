/**
 * Property PATCH / DELETE / GET endpoint
 *
 * @module api/properties/[id]
 * @permission properties:properties:update (PATCH), properties:properties:delete (DELETE), properties:properties:view (GET)
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
import { PROPERTY_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { linkEntity, validateLinkedSpacesUniqueness } from '@/lib/firestore/entity-linking.service';
import { validatePropertyFieldLocking } from '@/lib/firestore/property-field-locking';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { PropertyOwnerRole } from '@/types/ownership-table';
import { getErrorMessage } from '@/lib/error-utils';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { extractIdFromUrl } from '@/lib/api/route-helpers';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import {
  activateClientPersona,
  autoCreatePropertyContactLinks,
  deactivatePropertyContactLinks,
} from './property-contact-links';
import { validateCommercialTransaction } from './property-commercial-validation';
import {
  PropertyPatchSchema,
  applyMultiLevelDefaults,
  applyLevelDataAggregation,
  buildUpdateData,
  detectCancellation,
  type PropertyMutationResult,
  type PropertyPatchPayload,
} from './property-patch-helpers';

const logger = createModuleLogger('PropertyIdRoute');

// ============================================================================
// PATCH — Update Property
// ============================================================================

export const PATCH = withStandardRateLimit(
  withAuth<ApiSuccessResponse<PropertyMutationResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Property ID is required');
      if (id === '__new__') throw new ApiError(400, 'Cannot update placeholder property — save it first');

      try {
        const docRef = adminDb.collection(COLLECTIONS.PROPERTIES).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) throw new ApiError(404, 'Property not found');

        await requirePropertyInTenantScope({ ctx, propertyId: id, path: '/api/properties/[id]' });
        const existing = doc.data() as Record<string, unknown>;

        const parsed = safeParseBody(PropertyPatchSchema, await request.json());
        if (parsed.error) throw new ApiError(400, 'Validation failed');
        const { _v: expectedVersion, ...body } = parsed.data as PropertyPatchPayload & { _v?: number };

        // 🛡️ ADR-249: Field locking after sale/reservation
        validatePropertyFieldLocking(
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
          PROPERTY_TRACKED_FIELDS,
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
          collection: COLLECTIONS.PROPERTIES,
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
                propertyId: id, newPrice, error: getErrorMessage(err),
              });
            });
          }
        }

        logger.info('Property updated', { id, companyId: ctx.companyId });

        // 🔗 ADR-239: Centralized linking — change detection + cascade (non-blocking)
        if ('buildingId' in body) {
          linkEntity('property:buildingId', {
            auth: ctx,
            entityId: id,
            newLinkValue: (body.buildingId as string) ?? null,
            existingDoc: existing,
            apiPath: '/api/properties/[id] (PATCH)',
          }).catch((err) => {
            logger.warn('linkEntity failed (non-blocking)', { propertyId: id, error: getErrorMessage(err) });
          });
        }

        await logAuditEvent(ctx, 'data_updated', 'property', 'api', {
          newValue: { type: 'status', value: { propertyId: id, updates: Object.keys(updateData) } },
          metadata: { reason: 'Property updated via API' },
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
            autoCreatePropertyContactLinks(adminDb, id, ownersArr!, ctx.companyId, ctx.uid)
              .catch((err) => {
                logger.warn('SPEC-257A: Auto-link failed (non-blocking)', {
                  propertyId: id, error: getErrorMessage(err),
                });
              });
          }
        }

        if (isCancellation) {
          deactivatePropertyContactLinks(adminDb, id, ctx.uid).catch((err) => {
            logger.warn('SPEC-257A: Deactivate links failed (non-blocking)', {
              propertyId: id, error: getErrorMessage(err),
            });
          });
        }

        if (auditChanges.length > 0) {
          const isStatusChange = auditChanges.some((c) => c.field === 'status');
          EntityAuditService.recordChange({
            entityType: 'property',
            entityId: id,
            entityName: (existing.name as string) ?? null,
            action: isStatusChange ? 'status_changed' : 'updated',
            changes: auditChanges,
            performedBy: ctx.uid,
            performedByName: ctx.email ?? null,
            companyId: ctx.companyId,
          }).catch(() => { /* fire-and-forget */ });
        }

        return apiSuccess<PropertyMutationResult>({ id, _v: versionResult.newVersion }, 'Property updated');
      } catch (error) {
        if (error instanceof ConflictError) {
          return NextResponse.json(error.body, { status: error.statusCode });
        }
        if (error instanceof ApiError) throw error;
        logger.error('Error updating property', { id, error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to update property'));
      }
    },
    { permissions: 'properties:properties:update' }
  )
);

// ============================================================================
// DELETE — Delete Property
// ============================================================================

export const DELETE = withStandardRateLimit(
  withAuth<ApiSuccessResponse<PropertyMutationResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Property ID is required');

      try {
        const docRef = adminDb.collection(COLLECTIONS.PROPERTIES).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) throw new ApiError(404, 'Property not found');

        await requirePropertyInTenantScope({ ctx, propertyId: id, path: '/api/properties/[id]' });
        const existing = doc.data() as Record<string, unknown>;

        // 🛡️ ADR-226: Guarded deletion (checks dependencies → blocks or deletes + audit)
        await executeDeletion(adminDb, 'property', id, ctx.uid, ctx.companyId);

        logger.info('Property deleted', { id, companyId: ctx.companyId });

        await logAuditEvent(ctx, 'data_deleted', 'property', 'api', {
          newValue: { type: 'status', value: { propertyId: id, name: existing.name } },
          metadata: { reason: 'Property deleted via API' },
        });

        return apiSuccess<PropertyMutationResult>({ id }, 'Property deleted');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error deleting property', { id, error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to delete property'));
      }
    },
    { permissions: 'properties:properties:delete' }
  )
);

// ============================================================================
// GET — Fetch Single Property
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<Record<string, unknown>>>(
    async (request: NextRequest, ctx: AuthContext) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Property ID is required');

      await requirePropertyInTenantScope({ ctx, propertyId: id, path: '/api/properties/[id]' });

      const docRef = adminDb.collection(COLLECTIONS.PROPERTIES).doc(id);
      const doc = await docRef.get();
      if (!doc.exists) throw new ApiError(404, 'Property not found');

      return apiSuccess({ id: doc.id, ...doc.data() }, 'Property loaded');
    },
    { permissions: 'properties:properties:view' }
  )
);
