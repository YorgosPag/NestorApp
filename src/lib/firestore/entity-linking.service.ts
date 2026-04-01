/**
 * =============================================================================
 * 🏢 ENTERPRISE: Entity Linking Service (ADR-239)
 * =============================================================================
 *
 * Centralized orchestrator for server-side entity linking (PATCH operations).
 * Replaces inline cascade blocks scattered across 5 PATCH endpoints.
 *
 * Problems eliminated:
 * - Missing change detection (cascade fired even when value was unchanged)
 * - Missing field locking for sold/rented entities (storage, parking)
 * - Missing entity audit trail for link changes on storage, parking, building
 * - Inconsistent patterns across endpoints
 *
 * REUSES without modification:
 * - cascade-propagation.service.ts (4 cascade functions)
 * - entity-audit.service.ts (EntityAuditService.recordChange)
 * - lib/auth/audit.ts (logAuditEvent)
 *
 * @see ADR-239 — Entity Linking Centralization
 * @module lib/firestore/entity-linking.service
 */

import 'server-only';

import { logAuditEvent } from '@/lib/auth/audit';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  propagateChildBuildingLink,
  propagateUnitBuildingLink,
  propagateBuildingProjectLink,
  propagateProjectCompanyLink,
  type CascadeResult,
} from './cascade-propagation.service';
import {
  LINK_REGISTRY,
  type LinkEntityParams,
  type LinkEntityResult,
  type LinkCascadeType,
} from './entity-linking.types';

const logger = createModuleLogger('EntityLinking');

// =============================================================================
// INTERNAL: Cascade Dispatch (fire-and-forget)
// =============================================================================

/**
 * Dispatches the appropriate cascade function based on cascadeType.
 * Always fire-and-forget — cascade failure never blocks the link operation.
 * Errors are logged as warnings (non-blocking, same as existing PATCH endpoints).
 */
function dispatchCascade(
  cascadeType: LinkCascadeType,
  collection: string,
  entityId: string,
  newLinkValue: string | null
): void {
  let cascadePromise: Promise<CascadeResult>;

  switch (cascadeType) {
    case 'child-building':
      cascadePromise = propagateChildBuildingLink(collection, entityId, newLinkValue);
      break;
    case 'unit-building':
      cascadePromise = propagateUnitBuildingLink(entityId, newLinkValue);
      break;
    case 'building-project':
      cascadePromise = propagateBuildingProjectLink(entityId, newLinkValue);
      break;
    case 'project-company':
      cascadePromise = propagateProjectCompanyLink(entityId, newLinkValue);
      break;
    default: {
      // TypeScript exhaustiveness guard
      const exhaustive: never = cascadeType;
      logger.warn('linkEntity: unhandled cascadeType, cascade skipped', { cascadeType: exhaustive });
      return;
    }
  }

  cascadePromise.catch((err) => {
    logger.warn('linkEntity: cascade failed (non-blocking)', {
      cascadeType,
      entityId,
      error: getErrorMessage(err),
    });
  });
}

// =============================================================================
// PUBLIC: linkEntity() — Orchestrator
// =============================================================================

/**
 * Links (or unlinks) an entity to its parent via the centralized linking pipeline.
 *
 * 7-step pipeline:
 * 1. Registry lookup     → resolve LinkRegistryEntry from registryKey
 * 2. Change detection    → early return { changed: false } if value is unchanged
 * 3. Field locking check → throw ApiError(403) if entity is in a locked status
 * 4. Cascade dispatch    → fire-and-forget, failure is non-blocking
 * 5. Entity audit        → EntityAuditService.recordChange (skipped when skipAudit = true)
 * 6. Auth audit          → logAuditEvent (backward compat with existing endpoints)
 * 7. Return              → { changed: true, oldValue, newValue, cascadeResult: null }
 *
 * Intended call pattern from PATCH handlers (fire-and-forget at the endpoint level):
 * ```typescript
 * if (body.buildingId !== undefined) {
 *   linkEntity('storage:buildingId', {
 *     auth: ctx, entityId: id,
 *     newLinkValue: body.buildingId ?? null,
 *     existingDoc: existing,
 *     apiPath: '/api/storages/[id] (PATCH)',
 *   }).catch(err => logger.warn('linkEntity failed', { id, error: String(err) }));
 * }
 * ```
 *
 * @param registryKey - Key from LINK_REGISTRY (e.g. 'storage:buildingId')
 * @param params      - Link operation parameters
 * @returns LinkEntityResult with change metadata
 * @throws ApiError(404) if registryKey is not in LINK_REGISTRY
 * @throws ApiError(403) if the entity is in a locked status
 */
export async function linkEntity(
  registryKey: string,
  params: LinkEntityParams
): Promise<LinkEntityResult> {
  const { auth, entityId, newLinkValue, existingDoc, apiPath } = params;

  // --- Step 1: Registry lookup ---
  const entry = LINK_REGISTRY[registryKey];
  if (!entry) {
    throw new ApiError(404, `linkEntity: unknown registry key '${registryKey}'`);
  }

  // --- Step 2: Change detection ---
  const oldValue = (existingDoc[entry.linkField] as string) ?? null;
  const normalizedNew = newLinkValue ?? null;

  if (oldValue === normalizedNew) {
    logger.info('linkEntity: no change detected, cascade + audit skipped', {
      registryKey,
      entityId,
      value: oldValue,
    });
    return { changed: false, oldValue, newValue: normalizedNew, cascadeResult: null };
  }

  // --- Step 3: Field locking check ---
  if (entry.lockedStatuses !== null && entry.lockedStatusField !== null) {
    const currentStatus = (existingDoc[entry.lockedStatusField] as string) ?? null;
    if (currentStatus !== null && entry.lockedStatuses.includes(currentStatus)) {
      const entityType = registryKey.split(':')[0];
      throw new ApiError(
        403,
        `Cannot change ${entry.linkField} on a ${currentStatus} ${entityType}`
      );
    }
  }

  // --- Step 3b: Building reassignment warning (ADR-247 F-5) ---
  if (registryKey === 'building:projectId' && oldValue !== null && normalizedNew !== null) {
    logger.warn('linkEntity: building reassigned between projects', {
      entityId,
      previousProjectId: oldValue,
      newProjectId: normalizedNew,
    });
  }

  // --- Step 3c: Cross-company guard (ADR-249 P1-3) ---
  // When linking a building to a project, verify both belong to the same company.
  // Prevents cross-company data contamination.
  if (registryKey === 'building:projectId' && normalizedNew !== null) {
    const buildingCompanyId = (existingDoc.companyId as string) ?? null;

    if (buildingCompanyId) {
      const db = getAdminFirestore();
      const projectDoc = await db.collection(COLLECTIONS.PROJECTS).doc(normalizedNew).get();
      const projectCompanyId = projectDoc.exists
        ? (projectDoc.data()?.companyId as string) ?? null
        : null;

      if (projectCompanyId && buildingCompanyId !== projectCompanyId) {
        throw new ApiError(
          400,
          `Cross-company linking blocked: building belongs to company '${buildingCompanyId}' but project belongs to '${projectCompanyId}'`
        );
      }
    }
  }

  // --- Step 4: Cascade dispatch (fire-and-forget) ---
  dispatchCascade(entry.cascadeType, entry.collection, entityId, normalizedNew);

  // --- Step 5: Entity audit (link-level change) ---
  if (!entry.skipAudit) {
    const action = normalizedNew !== null ? 'linked' : 'unlinked';
    EntityAuditService.recordChange({
      entityType: entry.auditEntityType,
      entityId,
      entityName:
        (existingDoc.name as string) ??
        (existingDoc.number as string) ??
        null,
      action,
      changes: [
        {
          field: entry.linkField,
          oldValue: oldValue ?? null,
          newValue: normalizedNew ?? null,
          label: entry.linkField,
        },
      ],
      performedBy: auth.uid,
      performedByName: auth.email ?? null,
      companyId: auth.companyId,
    }).catch(() => {
      /* fire-and-forget — audit failure never blocks the response */
    });
  }

  // --- Step 6: Auth audit (backward compat) ---
  const entityType = registryKey.split(':')[0];
  await logAuditEvent(auth, 'data_updated', entityId, entry.auditTargetType, {
    newValue: {
      type: 'status',
      value: {
        entityId,
        registryKey,
        [entry.linkField]: normalizedNew,
        previousValue: oldValue,
      },
    },
    metadata: {
      path: apiPath,
      reason: `${entityType} ${entry.linkField} ${normalizedNew !== null ? 'linked' : 'unlinked'} via centralized linking service`,
    },
  });

  // --- Step 7: Return ---
  logger.info('linkEntity: link updated', {
    registryKey,
    entityId,
    oldValue,
    newValue: normalizedNew,
  });

  return { changed: true, oldValue, newValue: normalizedNew, cascadeResult: null };
}

// =============================================================================
// PUBLIC: validateLinkedSpacesUniqueness() — ADR-247 F-1
// =============================================================================

/**
 * ADR-247 F-1: Validates that no spaceId in linkedSpaces is already linked to another unit.
 * Building-scoped query — max ~50 units per building, safe performance.
 *
 * @throws ApiError(409) if duplicate linkage detected
 */
export async function validateLinkedSpacesUniqueness(
  db: FirebaseFirestore.Firestore,
  buildingId: string,
  currentUnitId: string,
  proposedSpaces: ReadonlyArray<{ spaceId: string }>
): Promise<void> {
  const spaceIds = new Set(proposedSpaces.map((s) => s.spaceId));
  if (spaceIds.size === 0) return;

  // Query all units in the same building (typically ≤50)
  const snapshot = await db
    .collection(COLLECTIONS.PROPERTIES)
    .where(FIELDS.BUILDING_ID, '==', buildingId)
    .select('linkedSpaces')
    .get();

  for (const propertyDoc of snapshot.docs) {
    if (propertyDoc.id === currentUnitId) continue;

    const linkedSpaces = propertyDoc.data().linkedSpaces as
      | Array<{ spaceId: string }> | undefined;
    if (!Array.isArray(linkedSpaces)) continue;

    for (const space of linkedSpaces) {
      if (spaceIds.has(space.spaceId)) {
        throw new ApiError(
          409,
          `Space ${space.spaceId} is already linked to property ${propertyDoc.id}`
        );
      }
    }
  }
}
