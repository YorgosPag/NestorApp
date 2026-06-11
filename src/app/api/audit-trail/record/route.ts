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

const logger = createModuleLogger('AuditTrailRecord');

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Entity types whose documents live in a per-company subcollection
 * (`companies/{companyId}/<collection>/{id}`) rather than a top-level
 * collection. Ownership verification reads from the caller's OWN company
 * subcollection (path derived from `ctx.companyId`), so a forged id can only
 * ever touch the caller's own tenant — cross-tenant access is impossible.
 */
const SUBCOLLECTION_ENTITY_TYPES: ReadonlySet<string> = new Set<AuditEntityType>([
  'bim_family_type',
]);

const VALID_ACTIONS: ReadonlySet<string> = new Set<AuditAction>([
  'created', 'updated', 'deleted', 'restored', 'status_changed', 'linked', 'unlinked',
  'professional_assigned', 'professional_removed', 'email_sent', 'invoice_created',
  'document_added', 'document_removed',
]);

/**
 * Map entity type → Firestore collection for ownership verification.
 *
 * SSoT: this map is the SINGLE source of valid audit entity types. `VALID_ENTITY_TYPES`
 * is DERIVED from its keys (below), so an entity type can never be "valid" without a
 * collection mapping. This permanently kills the desync class of bug where a type was
 * added to the allow-list but not the map (mep-fitting, foundation) → every POST 400'd.
 * Add a new auditable entity HERE (one place) and it is automatically accepted.
 *
 * Typing: `Record<string, string | undefined>` keeps it indexable by the raw
 * `body.entityType` string (returning `undefined` for unknown types, preserving the
 * runtime guard), while `satisfies Partial<Record<AuditEntityType, string>>` compile-time
 * rejects any key that is not a real `AuditEntityType`.
 */
const ENTITY_COLLECTION_MAP: Record<string, string | undefined> = {
  contact: COLLECTIONS.CONTACTS,
  building: COLLECTIONS.BUILDINGS,
  property: COLLECTIONS.PROPERTIES,
  project: COLLECTIONS.PROJECTS,
  parking: COLLECTIONS.PARKING_SPACES,
  storage: COLLECTIONS.STORAGE,
  wall: COLLECTIONS.FLOORPLAN_WALLS,
  opening: COLLECTIONS.FLOORPLAN_OPENINGS,
  slab: COLLECTIONS.FLOORPLAN_SLABS,
  'slab-opening': COLLECTIONS.FLOORPLAN_SLAB_OPENINGS,
  column: COLLECTIONS.FLOORPLAN_COLUMNS,
  beam: COLLECTIONS.FLOORPLAN_BEAMS,
  stair: COLLECTIONS.FLOORPLAN_STAIRS,
  // ADR-417 — parametric pitched roof (top-level floorplan_roofs collection).
  roof: COLLECTIONS.FLOORPLAN_ROOFS,
  // ADR-406 — was missing (fixture audit 400'd silently via fire-and-forget). Fixed alongside ADR-408.
  'mep-fixture': COLLECTIONS.FLOORPLAN_MEP_FIXTURES,
  // ADR-408 — logical MEP systems.
  'mep-system': COLLECTIONS.FLOORPLAN_MEP_SYSTEMS,
  // ADR-408 Φ3 — point-based electrical panels.
  'electrical-panel': COLLECTIONS.FLOORPLAN_ELECTRICAL_PANELS,
  // ADR-408 Φ8 — linear duct/pipe MEP segments.
  'mep-segment': COLLECTIONS.FLOORPLAN_MEP_SEGMENTS,
  // ADR-408 Φ12 — point-based plumbing manifolds.
  'mep-manifold': COLLECTIONS.FLOORPLAN_MEP_MANIFOLDS,
  // ADR-408 Φ11 — auto-derived pipe fittings. Was in VALID_ENTITY_TYPES but missing
  // here → every fitting audit POST 400'd ("No collection mapping"), spamming the
  // console in bursts whenever pipes were drawn (auto-reconciler creates fittings).
  'mep-fitting': COLLECTIONS.FLOORPLAN_MEP_FITTINGS,
  // ADR-436 — foundation discipline (pads / strip footings / tie-beams). Was missing
  // → every foundation audit POST 400'd ("Invalid entityType"), spamming the console
  // in bursts whenever the grid reconciler ran. Same desync class as mep-fitting above.
  foundation: COLLECTIONS.FLOORPLAN_FOUNDATIONS,
  // ADR-412 Φ5 — BIM family types (subcollection — see SUBCOLLECTION_ENTITY_TYPES).
  bim_family_type: COLLECTIONS.BIM_FAMILY_TYPES,
} satisfies Partial<Record<AuditEntityType, string>>;

/**
 * Valid audit entity types — DERIVED from `ENTITY_COLLECTION_MAP` keys (SSoT).
 * Never hand-maintain a parallel list again.
 */
const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set(Object.keys(ENTITY_COLLECTION_MAP));

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
