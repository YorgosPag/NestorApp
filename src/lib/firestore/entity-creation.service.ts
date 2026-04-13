/**
 * =============================================================================
 * 🏢 ENTERPRISE: Entity Creation Service (ADR-238)
 * =============================================================================
 *
 * Centralized orchestrator for server-side entity creation.
 * Replaces ~175 lines of duplicated logic across 5 API endpoints.
 *
 * Single Firestore read per parent document (building/project) — used for
 * tenant verification, companyId inheritance, AND entity code generation.
 *
 * @see ADR-238 — Entity Creation Centralization
 * @module lib/firestore/entity-creation.service
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { logAuditEvent } from '@/lib/auth/audit';
import { EntityAuditService } from '@/services/entity-audit.service';
import { getTrackedFieldsForEntityAuditType } from '@/config/audit-tracked-fields';
import { isRoleBypass } from '@/lib/auth/roles';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import {
  parseEntityCode,
  formatEntityCode,
  resolveTypeCode,
  formatFloorCode,
} from '@/services/entity-code.service';
import { extractBuildingLetter } from '@/config/entity-code-config';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

import type { AuthContext } from '@/lib/auth/types';
import type {
  ServerEntityType,
  EntityRegistryEntry,
  EntityCreationParams,
  EntityCreationResult,
  ParentData,
} from './entity-creation.types';
import { ENTITY_REGISTRY } from './entity-creation.types';

const logger = createModuleLogger('EntityCreation');

// =============================================================================
// INTERNAL: Parent Data Fetching (SINGLE Firestore read)
// =============================================================================

/**
 * Fetches parent document data. Building-child entities fetch from buildings,
 * project-child entities fetch from projects.
 *
 * This is the ONLY Firestore read for parent resolution — tenant check,
 * companyId inheritance, and code generation all use this data.
 *
 * @throws ApiError(404) if parent document not found
 */
async function fetchParentData(
  entry: EntityRegistryEntry,
  parentId: string
): Promise<ParentData> {
  const adminDb = getAdminFirestore();

  if (entry.hierarchy === 'building-child') {
    const doc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(parentId).get();
    if (!doc.exists) {
      throw new ApiError(404, 'Building not found');
    }
    const data = doc.data() as Record<string, unknown>;
    return {
      companyId: (data.companyId as string) || '',
      name: (data.name as string) || undefined,
      code: (data.code as string) || undefined,
      projectId: (data.projectId as string) || undefined,
    };
  }

  if (entry.hierarchy === 'project-child') {
    const doc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(parentId).get();
    if (!doc.exists) {
      throw new ApiError(404, 'Project not found');
    }
    const data = doc.data() as Record<string, unknown>;
    return {
      companyId: (data.companyId as string) || '',
    };
  }

  // tenant-scoped: optional parent reference (e.g. dxfLevel.floorId).
  // We do not resolve companyId from the parent — it comes from auth ctx.
  // We only verify the referenced doc exists (if provided) to prevent dangling FKs.
  if (entry.parentField === 'floorId') {
    const doc = await adminDb.collection(COLLECTIONS.FLOORS).doc(parentId).get();
    if (!doc.exists) {
      throw new ApiError(404, 'Floor not found');
    }
    const data = doc.data() as Record<string, unknown>;
    return {
      companyId: (data.companyId as string) || '',
    };
  }

  // Unknown tenant-scoped parent — no validation, no data extraction.
  return { companyId: '' };
}

// =============================================================================
// INTERNAL: Tenant Access Verification
// =============================================================================

/**
 * Verifies the authenticated user has access to the parent entity's tenant.
 * Super admins bypass this check (per isRoleBypass).
 *
 * @throws ApiError(403) on tenant mismatch
 */
async function verifyTenantAccess(
  ctx: AuthContext,
  parentData: ParentData,
  parentId: string,
  apiPath?: string
): Promise<void> {
  if (isRoleBypass(ctx.globalRole)) {
    return; // Super admin — bypass tenant isolation
  }

  if (!parentData.companyId || parentData.companyId !== ctx.companyId) {
    await logAuditEvent(ctx, 'access_denied', parentId, 'building', {
      metadata: {
        path: apiPath,
        reason: 'Tenant isolation violation - companyId mismatch (entity creation)',
      },
    });
    throw new ApiError(403, 'Access denied — tenant isolation violation');
  }
}

// =============================================================================
// INTERNAL: Common Fields
// =============================================================================

/**
 * Builds the standard fields present on every entity document.
 */
function buildCommonFields(ctx: AuthContext, companyId: string): Record<string, unknown> {
  return {
    companyId,
    linkedCompanyId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: ctx.uid,
  };
}

// =============================================================================
// INTERNAL: ADR-233 Entity Code Generation
// =============================================================================

/**
 * Generates an entity code (e.g. "A-PK-0.01") using pre-fetched parent data.
 * Never throws — returns null on failure (code generation is best-effort).
 */
async function generateEntityCode(
  entry: EntityRegistryEntry,
  buildingName: string | undefined,
  buildingCode: string | undefined,
  buildingId: string,
  codeOptions: EntityCreationParams['codeOptions']
): Promise<string | null> {
  if (!entry.codeType) return null;
  if (!buildingName && !buildingCode) return null;
  if (!codeOptions) return null;

  // Skip if current value already follows ADR-233 format
  if (codeOptions.currentValue && parseEntityCode(codeOptions.currentValue)) {
    return null;
  }

  try {
    // ADR-233 §3.4: prefer locked `code` field, fall back to free-text `name`
    const buildingLetter = extractBuildingLetter({ code: buildingCode, name: buildingName });
    const typeCode = resolveTypeCode(
      entry.codeType,
      codeOptions.unitType,
      codeOptions.locationZone
    );

    if (!typeCode) return null;

    const floorLevel = codeOptions.floorLevel ?? 0;
    const floorCode = formatFloorCode(floorLevel);

    // Query existing entities in this building to find max sequence
    const adminDb = getAdminFirestore();
    const snapshot = await adminDb
      .collection(entry.collection)
      .where(FIELDS.BUILDING_ID, '==', buildingId)
      .get();

    let maxSeq = 0;
    const codeField = entry.codeField;
    if (codeField) {
      for (const doc of snapshot.docs) {
        const value = doc.data()[codeField] as string | undefined;
        if (!value) continue;
        const parsed = parseEntityCode(value);
        if (parsed && parsed.typeCode === typeCode && parsed.floorCode === floorCode) {
          if (parsed.sequence > maxSeq) maxSeq = parsed.sequence;
        }
      }
    }

    const code = formatEntityCode(buildingLetter, typeCode, floorCode, maxSeq + 1);
    logger.info('Auto-generated entity code', { code, entityType: entry.codeType, buildingId });
    return code;
  } catch (err) {
    logger.warn('Entity code auto-generation failed', {
      error: getErrorMessage(err),
    });
    return null;
  }
}

// =============================================================================
// PUBLIC: createEntity() — Orchestrator
// =============================================================================

/**
 * Creates a new entity document in Firestore.
 *
 * Pipeline:
 * 1. Registry lookup
 * 2. Fetch parent data (single Firestore read)
 * 3. Tenant isolation verification
 * 4. Resolve companyId from parent or auth context
 * 5. Build common fields (timestamps, createdBy, companyId)
 * 6. Generate ADR-233 entity code (if applicable)
 * 7. Merge common + entity-specific fields
 * 8. Sanitize for Firestore (undefined → null)
 * 9. Generate enterprise ID + setDoc
 * 10. Audit log
 *
 * @param entityType - One of: building, floor, unit, storage, parking
 * @param params - Creation parameters
 * @returns Created entity ID, code, and full document
 */
export async function createEntity(
  entityType: ServerEntityType,
  params: EntityCreationParams
): Promise<EntityCreationResult> {
  const { auth, parentId, entitySpecificFields, codeOptions, apiPath } = params;

  const adminDb = getAdminFirestore();
  if (!adminDb) {
    throw new ApiError(503, 'Database unavailable');
  }

  const entry = ENTITY_REGISTRY[entityType];

  // --- Step 1: Fetch parent data (single read) ---
  // For tenant-scoped entities, companyId comes from auth context, not from parent.
  let parentData: ParentData | null = null;
  if (parentId) {
    parentData = await fetchParentData(entry, parentId);
  }

  // --- Step 2: Tenant isolation ---
  if (entry.tenantCheck && parentId && parentData) {
    await verifyTenantAccess(auth, parentData, parentId, apiPath);
  }

  // --- Step 3: Resolve companyId ---
  // Tenant-scoped entities always derive companyId from auth (ignore parent companyId).
  const companyId =
    entry.hierarchy === 'tenant-scoped'
      ? auth.companyId
      : parentData?.companyId || auth.companyId;

  // --- Step 4: Common fields ---
  const commonFields = buildCommonFields(auth, companyId);

  // --- Step 5: Entity code generation ---
  let generatedCode: string | null = null;
  if (entry.codeType && parentId && parentData) {
    generatedCode = await generateEntityCode(
      entry,
      parentData.name,
      parentData.code,
      parentId,
      codeOptions
    );
  }

  // --- Step 6: Merge fields ---
  const mergedDoc: Record<string, unknown> = {
    ...commonFields,
    ...entitySpecificFields,
  };

  // Auto-propagate projectId for building-child entities (if not already set)
  if (entry.hierarchy === 'building-child' && parentData?.projectId && !mergedDoc.projectId) {
    mergedDoc.projectId = parentData.projectId;
  }

  // Apply generated code to the correct field
  if (generatedCode && entry.codeField) {
    mergedDoc[entry.codeField] = generatedCode;
  }

  // --- Step 7: Sanitize ---
  const sanitizedDoc = sanitizeForFirestore(mergedDoc);

  // --- Step 8: Generate ID + write ---
  const idModule = await import('@/services/enterprise-id.service');
  const generateId = idModule[entry.idGenerator] as () => string;
  const entityId = generateId();

  await adminDb.collection(entry.collection).doc(entityId).set(sanitizedDoc);
  logger.info('Entity created', { entityType, entityId });

  // --- Step 9: Entity Audit Trail (ADR-195) ---
  // Emit `action: 'created'` entry so History tabs surface the creation with
  // initial field values. `diffFields({}, doc, tracked)` produces null→value
  // entries for every tracked field present on the new document. If no
  // registry exists for the entity type, we still emit the creation event
  // (with empty changes) so the "created by" line appears in the timeline.
  // recordChange is fire-and-forget (internal try/catch); never breaks creation.
  if (entry.entityAuditType) {
    const trackedFields = getTrackedFieldsForEntityAuditType(entry.entityAuditType);
    const changes = trackedFields
      ? EntityAuditService.diffFields({}, sanitizedDoc, trackedFields)
      : [];

    await EntityAuditService.recordChange({
      entityType: entry.entityAuditType,
      entityId,
      entityName: (mergedDoc.name as string | undefined) ?? null,
      action: 'created',
      changes,
      performedBy: auth.uid,
      performedByName: auth.email ?? null,
      companyId,
    });
  }

  // --- Step 10: Legacy auth audit log ---
  await logAuditEvent(auth, 'data_created', entityId, entry.auditTargetType, {
    newValue: {
      type: 'status',
      value: { entityId, entityType, parentId: parentId ?? null },
    },
    metadata: {
      path: apiPath,
      reason: `${entityType} created via centralized entity service`,
    },
  });

  return {
    id: entityId,
    code: generatedCode,
    doc: sanitizedDoc,
  };
}
