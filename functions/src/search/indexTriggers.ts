/**
 * =============================================================================
 * 🔍 SEARCH INDEX TRIGGERS
 * =============================================================================
 *
 * Firestore triggers for automatic search document indexing.
 * Triggers on create/update/delete of entities to keep search index in sync.
 *
 * Canonical owner of `search_documents` (ADR-029 Phase B). Client-side
 * fire-and-forget reindex calls are being removed — these triggers are the
 * single writer per entity type.
 *
 * @module functions/search/indexTriggers
 * @enterprise ADR-029 — Global Search v1
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

import {
  SEARCH_ENTITY_TYPES,
  COLLECTIONS,
  buildSearchDocument,
  createSearchDocument,
  generateSearchDocId,
  type SearchEntityType,
} from './indexBuilder';
import { REACTIVE_TRIGGER_RUNTIME } from '../config/runtime';
import {
  isoToCommitVersion,
  toCommitVersion,
  type CommitVersion,
} from '../generated/lib/search/search-index-version';
import { applySearchIndexTombstone, applySearchIndexWrite } from './search-index-writer';

// =============================================================================
// FIRESTORE REFERENCE
// =============================================================================

function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

// =============================================================================
// THE VERSION OF THIS CHANGE
// =============================================================================

/**
 * Which commit this event carries — the value the whole ordering guarantee rests on.
 *
 * `updateTime` is the entity's own commit time: the same number for every observer of the same
 * change, whoever delivers it and however late. The two fallbacks exist so a missing field can
 * never mean "no version" (which would silently disable the fence): `readTime` is still
 * server-assigned, and `context.timestamp` is the event's publish time — close enough to keep
 * ordering, and only ever reached if the snapshot carries neither.
 */
function eventVersion(
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext,
): CommitVersion | null {
  return (
    toCommitVersion(snapshot.updateTime) ??
    toCommitVersion(snapshot.readTime) ??
    isoToCommitVersion(context.timestamp)
  );
}

/** Which tenant this entry belongs to — needed even on a tombstone, for the read rules. */
function tenantOf(change: functions.Change<functions.firestore.DocumentSnapshot>): string | null {
  const data = change.after.data() ?? change.before.data();
  const tenant = data?.companyId ?? data?.tenantId;
  return typeof tenant === 'string' ? tenant : null;
}

/** `gone` — the entity was deleted · `soft-deleted` — it exists but is marked removed (ADR-281). */
type Removal = 'gone' | 'soft-deleted';

function removalReason(
  change: functions.Change<functions.firestore.DocumentSnapshot>,
): Removal | null {
  if (!change.after.exists) return 'gone';
  const data = change.after.data();
  if (data && (data.isDeleted === true || data.deletedAt || data.status === 'deleted')) {
    return 'soft-deleted';
  }
  return null;
}

// =============================================================================
// GENERIC INDEX HANDLER
// =============================================================================

/**
 * Take the entity out of the index — as a tombstone, never as a hole.
 *
 * The version comes from the snapshot that **carries** it: for a hard delete that is `before`
 * (the `after` snapshot does not exist and has no commit time), for a soft delete it is
 * `after` (the entity is still there, marked). Getting this backwards would compare a live
 * version against a deleted one and refuse every deletion.
 */
async function removeFromIndex(
  searchDocRef: admin.firestore.DocumentReference,
  entityType: SearchEntityType,
  entityId: string,
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext,
  reason: Removal,
): Promise<void> {
  const versionSource = reason === 'gone' ? change.before : change.after;
  const outcome = await applySearchIndexTombstone(
    searchDocRef,
    { tenantId: tenantOf(change), entityType, entityId },
    eventVersion(versionSource, context),
    Date.now(),
  );
  functions.logger.info(`[Search] Tombstone ${outcome} for ${entityType}/${entityId}`, { reason });
}

/**
 * Handle entity write (create/update/delete) for search indexing.
 *
 * ⚠️ Failures are NOT swallowed here (they used to be, on the delete path). The index is now
 * version-fenced, so a retry of the same change is harmless — and a silently failed removal is
 * an entity that stays searchable forever.
 */
async function handleEntityWrite(
  entityType: SearchEntityType,
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext,
): Promise<void> {
  const entityId = context.params.docId;
  const searchDocRef = getDb()
    .collection(COLLECTIONS.SEARCH_DOCUMENTS)
    .doc(generateSearchDocId(entityType, entityId));

  const removal = removalReason(change);
  if (removal) {
    await removeFromIndex(searchDocRef, entityType, entityId, change, context, removal);
    return;
  }

  const data = change.after.data();
  if (!data) {
    functions.logger.warn(`[Search] No data for ${entityType}/${entityId}`);
    return;
  }

  const searchInput = buildSearchDocument(entityType, entityId, data as Record<string, unknown>);
  if (!searchInput) {
    functions.logger.warn(
      `[Search] Could not build search document for ${entityType}/${entityId}`,
    );
    return;
  }

  const outcome = await applySearchIndexWrite(
    searchDocRef,
    createSearchDocument(searchInput),
    eventVersion(change.after, context),
  );

  functions.logger.info(`[Search] Index ${outcome} for ${entityType}/${entityId}`, {
    title: searchInput.title,
    tenantId: searchInput.tenantId,
  });
}

// =============================================================================
// TRIGGER FACTORY — builds a trigger per collection
// =============================================================================

function makeTrigger(entityType: SearchEntityType, collection: string) {
  return functions
    .runWith(REACTIVE_TRIGGER_RUNTIME)
    .firestore.document(`${collection}/{docId}`)
    .onWrite(async (change, context) => {
      await handleEntityWrite(entityType, change, context);
    });
}

// =============================================================================
// ENTITY-SPECIFIC TRIGGERS — one per indexed collection (ADR-029)
// =============================================================================

export const onProjectWrite = makeTrigger(SEARCH_ENTITY_TYPES.PROJECT, COLLECTIONS.PROJECTS);
export const onBuildingWrite = makeTrigger(SEARCH_ENTITY_TYPES.BUILDING, COLLECTIONS.BUILDINGS);
export const onFloorWrite = makeTrigger(SEARCH_ENTITY_TYPES.FLOOR, COLLECTIONS.FLOORS);
export const onPropertyWrite = makeTrigger(SEARCH_ENTITY_TYPES.PROPERTY, COLLECTIONS.PROPERTIES);
export const onContactWrite = makeTrigger(SEARCH_ENTITY_TYPES.CONTACT, COLLECTIONS.CONTACTS);
export const onFileWrite = makeTrigger(SEARCH_ENTITY_TYPES.FILE, COLLECTIONS.FILES);
export const onParkingWrite = makeTrigger(
  SEARCH_ENTITY_TYPES.PARKING,
  COLLECTIONS.PARKING_SPACES,
);
export const onStorageWrite = makeTrigger(SEARCH_ENTITY_TYPES.STORAGE, COLLECTIONS.STORAGE);
export const onOpportunityWrite = makeTrigger(
  SEARCH_ENTITY_TYPES.OPPORTUNITY,
  COLLECTIONS.OPPORTUNITIES,
);
export const onCommunicationWrite = makeTrigger(
  SEARCH_ENTITY_TYPES.COMMUNICATION,
  COLLECTIONS.COMMUNICATIONS,
);
export const onTaskWrite = makeTrigger(SEARCH_ENTITY_TYPES.TASK, COLLECTIONS.TASKS);
