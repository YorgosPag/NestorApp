/**
 * Unit PATCH / DELETE endpoint
 *
 * @module api/units/[id]
 * @permission units:units:update (PATCH), units:units:update (DELETE)
 * @rateLimit STANDARD (60 req/min)
 * @see ADR-184 (Building Spaces Tabs)
 */

import { NextRequest } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from 'firebase-admin/firestore';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { aggregateLevelData } from '@/services/multi-level.service';
import type { LevelData } from '@/types/unit';
import { UNIT_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { linkEntity, validateLinkedSpacesUniqueness } from '@/lib/firestore/entity-linking.service';
import { createDefaultPersonaData, findActivePersona } from '@/types/contacts/personas';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { PersonaData, ClientPersona } from '@/types/contacts/personas';
import { validateContactForSale, isServiceContact } from '@/types/contacts/helpers';
import type { Contact } from '@/types/contacts/contracts';
import type { CommercialTransactionType } from '@/types/contacts/helpers';

const logger = createModuleLogger('UnitIdRoute');

/** Fields that are NEVER writable via PATCH (security) */
const FORBIDDEN_FIELDS: ReadonlySet<string> = new Set([
  'id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy',
]);

// ============================================================================
// TYPES
// ============================================================================

interface UnitLevelPayload {
  floorId: string;
  floorNumber: number;
  name: string;
  isPrimary: boolean;
}

/** Unit PATCH body — core fields explicitly typed, extended fields passed through */
interface UnitPatchPayload extends Record<string, unknown> {
  name?: string;
  type?: string;
  status?: string;
  floor?: string | number;
  area?: number;
  price?: number;
  description?: string;
  buildingId?: string | null;
  projectId?: string | null;
  companyId?: string | null;
  companyName?: string;
  projectName?: string;
  // ADR-236: Multi-level fields
  isMultiLevel?: boolean;
  levels?: UnitLevelPayload[];
  // ADR-236 Phase 2: Per-level data
  levelData?: Record<string, unknown>;
  // Auto-aggregated fields (set by server from levelData)
  areas?: Record<string, number>;
  layout?: Record<string, number>;
  orientations?: string[];
}

interface UnitMutationResult {
  id: string;
}

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

      try {
        const docRef = adminDb.collection(COLLECTIONS.UNITS).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) throw new ApiError(404, 'Unit not found');

        const existing = doc.data() as Record<string, unknown>;
        if (ctx.globalRole !== 'super_admin' && existing.companyId && existing.companyId !== ctx.companyId) {
          throw new ApiError(403, 'Access denied');
        }

        const body: UnitPatchPayload = await request.json();

        // ================================================================
        // VALIDATION: Field locking based on commercialStatus
        // After sale/reservation, critical fields cannot be modified
        // (legal requirement: cadastre, tax office, contracts)
        // ================================================================
        const currentCommercialStatus = existing.commercialStatus as string | undefined;

        if (currentCommercialStatus === 'sold' || currentCommercialStatus === 'rented') {
          const soldLockedFields = [
            'code', 'type', 'name', 'areas', 'layout', 'floor', 'floorId',
            'commercialStatus', 'buildingId', 'linkedSpaces',
            'orientations', 'condition', 'energy', 'systemsOverride',
            'finishes', 'interiorFeatures', 'securityFeatures',
            'levels', 'isMultiLevel', 'levelData',
          ] as const;
          const attemptedLockedFields = soldLockedFields.filter(f => f in body);
          if (attemptedLockedFields.length > 0) {
            throw new ApiError(403, `Cannot modify locked fields on a ${currentCommercialStatus} unit: ${attemptedLockedFields.join(', ')}`);
          }
        } else if (currentCommercialStatus === 'reserved') {
          const reservedLockedFields = ['code', 'type', 'name'] as const;
          const attemptedLockedFields = reservedLockedFields.filter(f => f in body);
          if (attemptedLockedFields.length > 0) {
            throw new ApiError(403, `Cannot modify locked fields on a reserved unit: ${attemptedLockedFields.join(', ')}`);
          }
        }

        // ================================================================
        // VALIDATION: ADR-236 — Multi-level floors
        // ================================================================
        if (Array.isArray(body.levels)) {
          if (body.levels.length >= 2) {
            const primaryCount = body.levels.filter((l: UnitLevelPayload) => l.isPrimary).length;
            if (primaryCount !== 1) {
              throw new ApiError(400, 'Exactly one floor must be marked as primary');
            }
            // Auto-derive backward-compat fields from primary level
            const primary = body.levels.find((l: UnitLevelPayload) => l.isPrimary);
            if (primary) {
              body.floor = primary.floorNumber;
              body.floorId = primary.floorId;
              body.isMultiLevel = true;
            }
          } else if (body.levels.length === 0) {
            // Clearing levels — revert to single floor mode
            body.isMultiLevel = false;
          }
        }

        // ================================================================
        // VALIDATION + AGGREGATION: ADR-236 Phase 2 — Per-level data
        // ================================================================
        if (body.levelData && typeof body.levelData === 'object') {
          const ld = body.levelData as Record<string, LevelData>;
          const existingLevels = (body.levels ?? existing.levels) as UnitLevelPayload[] | undefined;

          if (existingLevels && existingLevels.length >= 2) {
            const validFloorIds = new Set(existingLevels.map((l) => l.floorId));
            const invalidKeys = Object.keys(ld).filter((k) => !validFloorIds.has(k));
            if (invalidKeys.length > 0) {
              throw new ApiError(400, `levelData contains invalid floorIds: ${invalidKeys.join(', ')}`);
            }
          }

          // Auto-aggregate into top-level fields
          const aggregated = aggregateLevelData(ld);
          body.areas = aggregated.areas;
          body.layout = aggregated.layout;
          body.orientations = aggregated.orientations;
        }

        // ================================================================
        // VALIDATION: Company chain check for reserve/sell operations
        // ================================================================
        const isCommercialTransaction =
          body.commercialStatus === 'reserved' || body.commercialStatus === 'sold';

        if (isCommercialTransaction) {
          // Hierarchy validation: Unit → Building → Project → Company
          // Each check is separate so the user gets a specific error message
          const buildingId = (existing.buildingId as string) ?? null;
          const floorId = (existing.floorId as string) ?? null;
          // 🔒 ADR-232: Only floorId (document reference) counts as valid floor link
          const hasFloor = !!floorId;

          // 1. Building check
          if (!buildingId) {
            throw new ApiError(400, 'Unit is not linked to a building');
          }

          // 2. Floor check
          if (!hasFloor) {
            throw new ApiError(400, 'Unit is not linked to a floor');
          }

          // 3. Project check (building → project)
          const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
          const projectId = buildingDoc.exists
            ? (buildingDoc.data()?.projectId as string) ?? null
            : null;

          if (!projectId) {
            throw new ApiError(400, 'Building is not linked to a project');
          }

          // 4. Company check (project → linkedCompanyId — ADR-232 business link)
          const projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
          const linkedCompanyId = projectDoc.exists
            ? (projectDoc.data()?.linkedCompanyId as string) ?? null
            : null;

          if (!linkedCompanyId) {
            throw new ApiError(400, 'Project is not linked to a company');
          }

          // 5. Asking price check — cannot reserve/sell without a price
          const commercialPayload = body.commercial as Record<string, unknown> | undefined;
          const askingPrice = (commercialPayload?.askingPrice as number)
            ?? (existing.commercial as Record<string, unknown> | undefined)?.askingPrice as number | undefined
            ?? null;

          if (!askingPrice || askingPrice <= 0) {
            throw new ApiError(400, 'Unit must have an asking price before reservation or sale');
          }

          // 5b. Area check — unit must have net or gross area
          const unitArea = (existing.area as number) ?? 0;
          const unitGrossArea = (existing.areas as Record<string, number> | undefined)?.gross ?? 0;
          if (unitArea <= 0 && unitGrossArea <= 0) {
            throw new ApiError(400, 'Unit must have area (sqm) before reservation or sale');
          }

          // 6. Buyer contact validation (enterprise-grade)
          const buyerContactId = (commercialPayload?.buyerContactId as string) ?? null;

          if (!buyerContactId) {
            throw new ApiError(400, 'Buyer contact is required');
          }

          const buyerDoc = await adminDb.collection(COLLECTIONS.CONTACTS).doc(buyerContactId).get();
          if (!buyerDoc.exists) {
            throw new ApiError(400, 'Buyer contact not found');
          }

          const buyerData = buyerDoc.data() as Contact;

          if (isServiceContact(buyerData)) {
            throw new ApiError(400, 'Service contacts cannot be buyers');
          }

          const transactionType: CommercialTransactionType =
            body.commercialStatus === 'reserved' ? 'reserve' : 'sell';
          const readiness = validateContactForSale(buyerData, transactionType);

          if (!readiness.valid) {
            throw new ApiError(400, `Buyer missing required fields: ${readiness.missingFields.join(', ')}`);
          }
        }

        const updateData: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: ctx.uid,
        };

        // Pass through all fields except forbidden ones
        // Handles both core fields (name, status, etc.) and extended fields (layout, areas, orientation, etc.)
        for (const [key, value] of Object.entries(body)) {
          if (FORBIDDEN_FIELDS.has(key)) continue;
          if (value === undefined) continue;
          updateData[key] = value ?? null;
        }

        // Trim string fields for core fields
        if (typeof updateData.name === 'string') updateData.name = (updateData.name as string).trim() || existing.name;
        if (typeof updateData.floor === 'string') updateData.floor = (updateData.floor as string).trim() || null;
        if (typeof updateData.description === 'string') updateData.description = (updateData.description as string).trim() || null;

        // Compute field-level diffs BEFORE the update (with ID→name resolution)
        const auditChanges = await EntityAuditService.diffFieldsWithResolution(
          existing,
          updateData,
          UNIT_TRACKED_FIELDS,
          {
            buildingId: async (id) => {
              if (!id || typeof id !== 'string') return null;
              const bldgSnap = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(id).get();
              return bldgSnap.exists ? (bldgSnap.data()?.name as string) ?? null : null;
            },
          },
        );

        // 🛡️ ADR-247 F-1: Server-side uniqueness guard for linked spaces
        if (Array.isArray(body.linkedSpaces)) {
          const buildingId = (existing.buildingId as string) ?? null;
          if (buildingId) {
            await validateLinkedSpacesUniqueness(
              adminDb, buildingId, id, body.linkedSpaces as ReadonlyArray<{ spaceId: string }>
            );
          }
        }

        await docRef.update(updateData);

        // ── Resync payment plan when sale price changes ──
        const newCommercial = updateData.commercial as Record<string, unknown> | undefined;
        if (newCommercial) {
          const newPrice = (newCommercial.askingPrice as number | null)
            ?? (newCommercial.finalPrice as number | null);
          if (newPrice && newPrice > 0) {
            PaymentPlanService.resyncTotalAmount(id, newPrice, ctx.uid).catch((err) => {
              logger.warn('Payment plan resync failed (non-blocking)', {
                unitId: id,
                newPrice,
                error: err instanceof Error ? err.message : String(err),
              });
            });
          }
        }

        logger.info('Unit updated', { id, companyId: ctx.companyId });

        // 🔗 ADR-239: Centralized linking — change detection + cascade (skipAudit=true: units PATCH has own audit)
        if ('buildingId' in body) {
          linkEntity('unit:buildingId', {
            auth: ctx,
            entityId: id,
            newLinkValue: (body.buildingId as string) ?? null,
            existingDoc: existing,
            apiPath: '/api/units/[id] (PATCH)',
          }).catch((err) => {
            logger.warn('linkEntity failed (non-blocking)', {
              unitId: id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }

        // Auth audit (existing — kept)
        await logAuditEvent(ctx, 'data_updated', 'unit', 'api', {
          newValue: { type: 'status', value: { unitId: id, updates: Object.keys(updateData) } },
          metadata: { reason: 'Unit updated via API' },
        });

        // ================================================================
        // AUTO-PERSONA: Activate "client" persona on buyer contact
        // ================================================================
        if (isCommercialTransaction) {
          const buyerContactId =
            (updateData.commercial as Record<string, unknown> | undefined)?.buyerContactId as string | null
            ?? (body.commercial as Record<string, unknown> | undefined)?.buyerContactId as string | null;

          if (buyerContactId) {
            activateClientPersona(adminDb, buyerContactId).catch((err) => {
              logger.warn('Auto-persona activation failed (non-blocking)', {
                buyerContactId,
                error: err instanceof Error ? err.message : String(err),
              });
            });
          }
        }

        // Entity audit trail (fire-and-forget)
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

        return apiSuccess<UnitMutationResult>({ id }, 'Unit updated');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error updating unit', { id, error: error instanceof Error ? error.message : String(error) });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to update unit');
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

        const existing = doc.data() as Record<string, unknown>;
        if (ctx.globalRole !== 'super_admin' && existing.companyId && existing.companyId !== ctx.companyId) {
          throw new ApiError(403, 'Access denied');
        }

        // 🛡️ ADR-226: Guarded deletion (checks dependencies → blocks or deletes + audit)
        await executeDeletion(adminDb, 'unit', id, ctx.uid, ctx.companyId);

        logger.info('Unit deleted', { id, companyId: ctx.companyId });

        // Auth audit (dual audit — executeDeletion handles entity audit with full snapshot)
        await logAuditEvent(ctx, 'data_deleted', 'unit', 'api', {
          newValue: { type: 'status', value: { unitId: id, name: existing.name } },
          metadata: { reason: 'Unit deleted via API' },
        });

        return apiSuccess<UnitMutationResult>({ id }, 'Unit deleted');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error deleting unit', { id, error: error instanceof Error ? error.message : String(error) });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to delete unit');
      }
    },
    { permissions: 'units:units:delete' }
  )
);

// ============================================================================
// HELPERS
// ============================================================================

function extractIdFromUrl(url: string): string | null {
  const segments = new URL(url).pathname.split('/');
  return segments[segments.length - 1] || null;
}

/**
 * Activate "client" persona on a contact if not already active.
 * Fire-and-forget — errors are logged but never block the response.
 */
async function activateClientPersona(
  db: FirebaseFirestore.Firestore,
  contactId: string
): Promise<void> {
  const contactRef = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
  const contactDoc = await contactRef.get();

  if (!contactDoc.exists) {
    logger.warn('activateClientPersona: contact not found', { contactId });
    return;
  }

  const contactData = contactDoc.data() as { personas?: PersonaData[] };
  const personas = contactData.personas ?? [];

  // Already has active client persona — skip
  const existingClient = findActivePersona<ClientPersona>(personas, 'client');
  if (existingClient) return;

  // Create new client persona with clientSince = today
  const newPersona = createDefaultPersonaData('client') as ClientPersona;
  newPersona.clientSince = new Date().toISOString();

  await contactRef.update({
    personas: [...personas, newPersona],
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info('Client persona auto-activated', { contactId });
}
