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

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import {
  SEARCH_ENTITY_TYPES,
  COLLECTIONS,
  buildSearchDocument,
  createSearchDocument,
  generateSearchDocId,
  type SearchEntityType,
} from './indexBuilder';

// =============================================================================
// FIRESTORE REFERENCE
// =============================================================================

function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

// =============================================================================
// GENERIC INDEX HANDLER
// =============================================================================

/**
 * Handle entity write (create/update/delete) for search indexing.
 */
async function handleEntityWrite(
  entityType: SearchEntityType,
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext,
): Promise<void> {
  const db = getDb();
  const entityId = context.params.docId;
  const searchDocId = generateSearchDocId(entityType, entityId);
  const searchDocRef = db.collection(COLLECTIONS.SEARCH_DOCUMENTS).doc(searchDocId);

  // === DELETE ===
  if (!change.after.exists) {
    functions.logger.info(`[Search] Deleting index for ${entityType}/${entityId}`);

    try {
      await searchDocRef.delete();
      functions.logger.info(`[Search] Index deleted: ${searchDocId}`);
    } catch (error) {
      functions.logger.error(`[Search] Failed to delete index: ${searchDocId}`, { error });
    }
    return;
  }

  // === CREATE or UPDATE ===
  const data = change.after.data();
  if (!data) {
    functions.logger.warn(`[Search] No data for ${entityType}/${entityId}`);
    return;
  }

  // Skip soft-deleted documents (ADR-281)
  if (data.isDeleted === true || data.deletedAt || data.status === 'deleted') {
    functions.logger.info(`[Search] Skipping deleted entity ${entityType}/${entityId}`);

    try {
      await searchDocRef.delete();
    } catch {
      // Ignore — document may not exist
    }
    return;
  }

  // Build search document
  const searchInput = buildSearchDocument(
    entityType,
    entityId,
    data as Record<string, unknown>,
  );

  if (!searchInput) {
    functions.logger.warn(
      `[Search] Could not build search document for ${entityType}/${entityId}`,
    );
    return;
  }

  const searchDoc = createSearchDocument(searchInput);

  const isCreate = !change.before.exists;
  const operation = isCreate ? 'Creating' : 'Updating';

  functions.logger.info(`[Search] ${operation} index for ${entityType}/${entityId}`, {
    title: searchDoc.title,
    tenantId: searchDoc.tenantId,
  });

  try {
    if (isCreate) {
      await searchDocRef.set(searchDoc);
    } else {
      await searchDocRef.set(
        {
          ...searchDoc,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          indexedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    functions.logger.info(
      `[Search] Index ${isCreate ? 'created' : 'updated'}: ${searchDocId}`,
    );
  } catch (error) {
    functions.logger.error(`[Search] Failed to index ${entityType}/${entityId}`, { error });
    throw error;
  }
}

// =============================================================================
// TRIGGER FACTORY — builds a trigger per collection
// =============================================================================

const TRIGGER_RUNTIME = {
  timeoutSeconds: 60,
  memory: '256MB' as const,
};

function makeTrigger(entityType: SearchEntityType, collection: string) {
  return functions
    .runWith(TRIGGER_RUNTIME)
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
