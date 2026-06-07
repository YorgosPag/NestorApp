/**
 * =============================================================================
 * 🏢 ENTERPRISE: BIM Floor Wipe Service (ADR-340 replace + ADR-420 floor-scope)
 * =============================================================================
 *
 * Single source of truth for "delete ALL BIM entities + their auto-BOQ for a
 * floor". Used by the floorplan REPLACE flow when the user chooses
 * "full replace" (wipe BIM too) — see `FloorplanFloorWipeService`.
 *
 * Why a separate module: BIM entities are scoped to the stable `floorId`
 * (ADR-420), so a plain floorplan re-import does NOT remove them (by design —
 * you keep your walls). A *replace* that wipes the file/scene therefore leaves
 * the old walls/columns/openings/slabs as orphans that still render on the new
 * plan. This service is the explicit, opt-in cleanup for that case.
 *
 * HARD delete only. Best-effort audit (never blocks the wipe).
 *
 * @module services/floorplan-background/bim-floor-wipe.service
 * @enterprise ADR-340 replace cleanup / ADR-420 BIM floor-scope
 */

import 'server-only';

import { getAdminFirestore, type Firestore } from '@/lib/firebaseAdmin';
import {
  COLLECTIONS,
  FLOOR_SCOPED_BIM_COLLECTIONS,
} from '@/config/firestore-collections';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditEntityType } from '@/types/audit-trail';
import { createModuleLogger } from '@/lib/telemetry';
import { deleteRefsInChunks } from './firestore-batch-delete';

const logger = createModuleLogger('BimFloorWipeService');

// ============================================================================
// TYPES
// ============================================================================

export interface BimFloorCounts {
  /** Total BIM entity docs across all 20 floor-scoped collections. */
  bimEntityCount: number;
  /** Auto-generated (`source: 'bim-auto'`) BOQ items linked to the floor. */
  boqItemCount: number;
}

export interface BimWipeResult extends BimFloorCounts {
  bimEntitiesDeleted: number;
  boqItemsDeleted: number;
}

/** Who performed the wipe — for the audit trail (best-effort). */
export interface BimWipeAuditContext {
  performedBy: string;
  performedByName: string | null;
}

// ============================================================================
// AUDIT MAPPING (ADR-195 / audit-trail union)
// ============================================================================

/**
 * Maps each floor-scoped BIM collection to its `AuditEntityType`. Collections
 * whose entity type is not yet in the audit union (railings, floor-finishes,
 * furniture, mep-radiators, mep-boilers) are wiped but not individually
 * audited — best-effort by design (the wipe must never fail on audit gaps).
 */
const COLLECTION_AUDIT_TYPE: Readonly<Record<string, AuditEntityType>> = {
  [COLLECTIONS.FLOORPLAN_WALLS]: 'wall',
  [COLLECTIONS.FLOORPLAN_OPENINGS]: 'opening',
  [COLLECTIONS.FLOORPLAN_SLABS]: 'slab',
  [COLLECTIONS.FLOORPLAN_SLAB_OPENINGS]: 'slab-opening',
  [COLLECTIONS.FLOORPLAN_COLUMNS]: 'column',
  [COLLECTIONS.FLOORPLAN_BEAMS]: 'beam',
  [COLLECTIONS.FLOORPLAN_STAIRS]: 'stair',
  [COLLECTIONS.FLOORPLAN_ROOFS]: 'roof',
  [COLLECTIONS.FLOORPLAN_ELECTRICAL_PANELS]: 'electrical-panel',
  [COLLECTIONS.FLOORPLAN_SYMBOLS]: 'floorplan-symbol',
  [COLLECTIONS.FLOORPLAN_MEP_FIXTURES]: 'mep-fixture',
  [COLLECTIONS.FLOORPLAN_MEP_SYSTEMS]: 'mep-system',
  [COLLECTIONS.FLOORPLAN_MEP_SEGMENTS]: 'mep-segment',
  [COLLECTIONS.FLOORPLAN_MEP_FITTINGS]: 'mep-fitting',
  [COLLECTIONS.FLOORPLAN_MEP_MANIFOLDS]: 'mep-manifold',
};

// ============================================================================
// HELPERS
// ============================================================================

function getDb(): Firestore {
  return getAdminFirestore();
}

function isBimAutoBoq(data: FirebaseFirestore.DocumentData): boolean {
  return data.source === 'bim-auto' || data.sourceType === 'bim-auto';
}

/** Query all docs of a collection scoped to (companyId, floorId). */
async function queryFloorScoped(
  db: Firestore,
  collectionName: string,
  companyId: string,
  floorId: string,
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const snap = await db
    .collection(collectionName)
    .where('companyId', '==', companyId)
    .where('floorId', '==', floorId)
    .get();
  return snap.docs;
}

/**
 * Best-effort audit: record a `deleted` entry per entity for collections whose
 * type is in the audit union. Never throws (recordChange is fire-and-forget).
 */
async function auditDeletions(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  auditType: AuditEntityType,
  companyId: string,
  ctx: BimWipeAuditContext,
): Promise<void> {
  await Promise.allSettled(
    docs.map((d) => {
      const data = d.data() as { params?: { mark?: string }; name?: string };
      const entityName = data.params?.mark ?? data.name ?? null;
      return EntityAuditService.recordChange({
        entityType: auditType,
        entityId: d.id,
        entityName,
        action: 'deleted',
        changes: [],
        performedBy: ctx.performedBy,
        performedByName: ctx.performedByName,
        companyId,
      });
    }),
  );
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Count BIM entities + auto-BOQ for a floor. Used by the replace-confirm
 * preview so the user sees what "full replace" will delete. Cheap: parallel
 * count() aggregations across the 20 collections + one BOQ read.
 */
export async function countBimForFloor(
  companyId: string,
  floorId: string,
): Promise<BimFloorCounts> {
  const db = getDb();
  const perCollection = await Promise.all(
    FLOOR_SCOPED_BIM_COLLECTIONS.map(async (collectionName) => {
      const agg = await db
        .collection(collectionName)
        .where('companyId', '==', companyId)
        .where('floorId', '==', floorId)
        .count()
        .get();
      return agg.data().count;
    }),
  );
  const bimEntityCount = perCollection.reduce((sum, n) => sum + n, 0);

  const boqSnap = await db
    .collection(COLLECTIONS.BOQ_ITEMS)
    .where('companyId', '==', companyId)
    .where('linkedFloorId', '==', floorId)
    .get();
  const boqItemCount = boqSnap.docs.filter((d) => isBimAutoBoq(d.data())).length;

  return { bimEntityCount, boqItemCount };
}

/**
 * HARD-wipe every BIM entity (20 floor-scoped collections) + their auto-BOQ
 * for a floor. Only `source: 'bim-auto'` BOQ rows are deleted — manual BOQ
 * items the user created for the floor are preserved. Idempotent: zero-state
 * input returns a success no-op.
 */
export async function wipeBimForFloor(
  companyId: string,
  floorId: string,
  audit?: BimWipeAuditContext,
): Promise<BimWipeResult> {
  const db = getDb();

  // BIM entities — sequential per-collection to keep batch pressure bounded.
  let bimEntitiesDeleted = 0;
  for (const collectionName of FLOOR_SCOPED_BIM_COLLECTIONS) {
    const docs = await queryFloorScoped(db, collectionName, companyId, floorId);
    if (docs.length === 0) continue;
    const auditType = COLLECTION_AUDIT_TYPE[collectionName];
    if (auditType && audit) {
      await auditDeletions(docs, auditType, companyId, audit);
    }
    bimEntitiesDeleted += await deleteRefsInChunks(db, docs.map((d) => d.ref));
  }

  // Auto-BOQ — delete only bim-auto rows linked to this floor.
  const boqSnap = await db
    .collection(COLLECTIONS.BOQ_ITEMS)
    .where('companyId', '==', companyId)
    .where('linkedFloorId', '==', floorId)
    .get();
  const boqRefs = boqSnap.docs
    .filter((d) => isBimAutoBoq(d.data()))
    .map((d) => d.ref);
  const boqItemsDeleted = await deleteRefsInChunks(db, boqRefs);

  const result: BimWipeResult = {
    bimEntitiesDeleted,
    boqItemsDeleted,
    bimEntityCount: bimEntitiesDeleted,
    boqItemCount: boqItemsDeleted,
  };
  logger.info('BIM floor wipe complete', { companyId, floorId, ...result });
  return result;
}
