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
  propagatePropertyBuildingLink,
  propagateBuildingProjectLink,
  propagateProjectCompanyLink,
  type CascadeResult,
} from './cascade-propagation.service';
import {
  LINK_REGISTRY,
  type LinkEntityParams,
  type LinkEntityResult,
  type LinkRegistryEntry,
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
): Promise<void> {
  let cascadePromise: Promise<CascadeResult>;

  switch (cascadeType) {
    case 'child-building':
      cascadePromise = propagateChildBuildingLink(collection, entityId, newLinkValue);
      break;
    case 'property-building':
      cascadePromise = propagatePropertyBuildingLink(entityId, newLinkValue);
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
      return Promise.resolve();
    }
  }

  // Ποτέ δεν απορρίπτεται: ο καλών αποφασίζει αν θα περιμένει (μετάπτωση) ή όχι (PATCH).
  return cascadePromise.then(
    () => undefined,
    (err) => {
      logger.warn('linkEntity: cascade failed (non-blocking)', {
        cascadeType,
        entityId,
        error: getErrorMessage(err),
      });
    },
  );
}

// =============================================================================
// SHARED: the consequences of a link change that is ALREADY written
// =============================================================================

/** Μια αλλαγή δεσμού που **γράφτηκε ήδη** — ποιος, πού, από τι σε τι. */
export interface WrittenLinkChange {
  readonly entityId: string;
  readonly existingDoc: Readonly<Record<string, unknown>>;
  readonly oldValue: string | null;
  readonly newValue: string | null;
  readonly performedBy: string;
  readonly performedByName: string | null;
  readonly companyId: string;
}

/**
 * Βήματα 4 + 5 του `linkEntity`: cascade + ίχνος οντότητας. Η υπόσχεση **ποτέ δεν απορρίπτεται** — το PATCH δεν την
 * περιμένει (fire-and-forget, N.7.2 #6), η μετάπτωση την περιμένει (αλλιώς το `process.exit` θα έκοβε το ίχνος).
 */
async function applyLinkConsequences(entry: LinkRegistryEntry, change: WrittenLinkChange): Promise<void> {
  const cascade = dispatchCascade(entry.cascadeType, entry.collection, change.entityId, change.newValue);
  if (entry.skipAudit) return cascade;
  const audit = EntityAuditService.recordChange({
    entityType: entry.auditEntityType,
    entityId: change.entityId,
    entityName: (change.existingDoc.name as string) ?? (change.existingDoc.number as string) ?? null,
    action: change.newValue !== null ? 'linked' : 'unlinked',
    changes: [{ field: entry.linkField, oldValue: change.oldValue, newValue: change.newValue, label: entry.linkField }],
    performedBy: change.performedBy,
    performedByName: change.performedByName,
    companyId: change.companyId,
  }).then(
    () => undefined,
    () => {
      /* audit failure never blocks the response */
    },
  );
  await Promise.all([cascade, audit]);
}

/**
 * **Οι συνέπειες μιας αλλαγής δεσμού που γράφτηκε ΕΚΤΟΣ αιτήματος χρήστη** (ADR-898 §21: η εφάπαξ μετάπτωση των
 * χώρων χωρίς κτίριο) — ο ΙΔΙΟΣ cascade και το ΙΔΙΟ ίχνος με το `linkEntity`, χωρίς έλεγχο κλειδώματος και χωρίς
 * `logAuditEvent` (δεν υπάρχει αίτημα API να καταγραφεί).
 * @throws ApiError(404) if registryKey is not in LINK_REGISTRY
 */
export async function recordLinkChange(registryKey: string, change: WrittenLinkChange): Promise<void> {
  const entry = LINK_REGISTRY[registryKey];
  if (!entry) throw new ApiError(404, `recordLinkChange: unknown registry key '${registryKey}'`);
  if (change.oldValue === change.newValue) return;
  await applyLinkConsequences(entry, change);
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
  // ADR-898 §21 — **τοποθέτηση ≠ μετακίνηση**: από το κενό (`oldValue === null`) ο χώρος δεν φεύγει από πουθενά, άρα
  // ο πωλημένος χώρος χωρίς κτίριο ΤΟΠΟΘΕΤΕΙΤΑΙ (αλλιώς η επιδιόρθωση ενός κλικ δεν θα έβγαζε ποτέ cascade/ίχνος).
  if (oldValue !== null && entry.lockedStatuses !== null && entry.lockedStatusField !== null) {
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

  // --- Steps 4 + 5: Cascade dispatch + entity audit (fire-and-forget) ---
  void applyLinkConsequences(entry, {
    entityId,
    existingDoc,
    oldValue,
    newValue: normalizedNew,
    performedBy: auth.uid,
    performedByName: auth.email ?? null,
    companyId: auth.companyId,
  });

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

/** Πού ψάχνει η μοναδικότητα: το **έργο** της μονάδας· χωρίς έργο, το κτίριό της. */
export interface LinkedSpacesUniquenessScope {
  readonly projectId: string | null;
  readonly buildingId: string | null;
}

/**
 * ADR-247 F-1: Validates that no spaceId in linkedSpaces is already linked to another unit.
 *
 * 🔑 **Εμβέλεια = ΕΡΓΟ** (ADR-898 §20, θέση ≠ ανάθεση): ένας χώρος μπορεί να βρίσκεται σε άλλο κτίριο από τη μονάδα
 * που τον έχει. Με εμβέλεια κτιρίου η Π-5 του Β δινόταν **και** στο Α3 **και** στο Β2 χωρίς 409 — δύο κάτοχοι.
 * Χωρίς έργο ⇒ εμβέλεια κτιρίου (ό,τι ίσχυε). Χωρίς κανένα από τα δύο ⇒ τίποτα να ελεγχθεί.
 *
 * @throws ApiError(409) if duplicate linkage detected
 */
export async function validateLinkedSpacesUniqueness(
  db: FirebaseFirestore.Firestore,
  scope: LinkedSpacesUniquenessScope,
  currentUnitId: string,
  proposedSpaces: ReadonlyArray<{ spaceId: string }>
): Promise<void> {
  const spaceIds = new Set(proposedSpaces.map((s) => s.spaceId));
  if (spaceIds.size === 0) return;
  // Οποιαδήποτε ΑΛΛΗ μονάδα τον έχει ⇒ 409 — ακόμη κι αν η τρέχουσα τον έχει κι αυτή (υπάρχον διπλό δεν «περνά»).
  const others = await linkedSpaceOwnersInScope(db, scope, spaceIds, currentUnitId);
  const [conflict] = others;
  if (conflict !== undefined) {
    const [spaceId, unitId] = conflict;
    throw new ApiError(409, `Space ${spaceId} is already linked to property ${unitId}`);
  }
}

/**
 * **Ποια μονάδα έχει αυτούς τους χώρους** στο έργο (ή στο κτίριο, χωρίς έργο) — η ΜΙΑ σάρωση των `linkedSpaces`, κοινή
 * για τη μοναδικότητα (ADR-247) και τον φρουρό αποσύνδεσης χώρου από κτίριο (ADR-898 §20). Ντετερμινιστικά: σε
 * (απαγορευμένη) διπλή σύνδεση νικά η μικρότερη ταυτότητα μονάδας — ίδιος κανόνας με το `spaceOwnersOf`.
 */
export async function linkedSpaceOwnersInScope(
  db: FirebaseFirestore.Firestore,
  scope: LinkedSpacesUniquenessScope,
  spaceIds: ReadonlySet<string>,
  /** Η μονάδα που δεν μετρά ως κάτοχος (αυτή που γράφει τώρα τους χώρους της). */
  exceptUnitId?: string,
): Promise<ReadonlyMap<string, string>> {
  const owners = new Map<string, string>();
  const field: string = scope.projectId ? FIELDS.PROJECT_ID : FIELDS.BUILDING_ID;
  const value = scope.projectId ?? scope.buildingId;
  if (!value || spaceIds.size === 0) return owners;

  const snapshot = await db.collection(COLLECTIONS.PROPERTIES).where(field, '==', value).select('linkedSpaces').get();
  const docs = snapshot.docs.filter((doc) => doc.id !== exceptUnitId).sort((a, b) => a.id.localeCompare(b.id));
  for (const propertyDoc of docs) {
    const linkedSpaces: unknown = propertyDoc.data().linkedSpaces;
    if (!Array.isArray(linkedSpaces)) continue;
    for (const space of linkedSpaces as ReadonlyArray<{ spaceId?: unknown }>) {
      if (typeof space?.spaceId === 'string' && spaceIds.has(space.spaceId) && !owners.has(space.spaceId)) {
        owners.set(space.spaceId, propertyDoc.id);
      }
    }
  }
  return owners;
}
