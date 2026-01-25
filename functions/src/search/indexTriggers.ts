/**
 * =============================================================================
 * 🔍 SEARCH INDEX TRIGGERS
 * =============================================================================
 *
 * Firestore triggers for automatic search document indexing.
 * Triggers on create/update/delete of entities to keep search index in sync.
 *
 * @module functions/search/indexTriggers
 * @enterprise ADR-029 - Global Search v1
 * @compliance Local_Protocol.txt - ZERO any, Centralization First
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

/**
 * Get Firestore instance.
 * Note: admin.initializeApp() is called in main index.ts
 */
function getDb(): FirebaseFirestore.Firestore {
  return admin.firestore();
}

// =============================================================================
// GENERIC INDEX HANDLER
// =============================================================================

/**
 * Handle entity write (create/update/delete) for search indexing.
 *
 * @param entityType - Type of entity being indexed
 * @param change - Firestore document change
 * @param context - Function context with params
 */
async function handleEntityWrite(
  entityType: SearchEntityType,
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext
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

  // Skip soft-deleted documents
  if (data.isDeleted === true || data.deletedAt) {
    functions.logger.info(`[Search] Skipping deleted entity ${entityType}/${entityId}`);

    // Remove from search index if exists
    try {
      await searchDocRef.delete();
    } catch {
      // Ignore - document may not exist
    }
    return;
  }

  // Build search document
  const searchInput = buildSearchDocument(entityType, entityId, data as Record<string, unknown>);

  if (!searchInput) {
    functions.logger.warn(`[Search] Could not build search document for ${entityType}/${entityId}`);
    return;
  }

  // Create full document with timestamps
  const searchDoc = createSearchDocument(searchInput);

  // Determine if create or update
  const isCreate = !change.before.exists;
  const operation = isCreate ? 'Creating' : 'Updating';

  functions.logger.info(`[Search] ${operation} index for ${entityType}/${entityId}`, {
    title: searchDoc.title,
    tenantId: searchDoc.tenantId,
  });

  try {
    if (isCreate) {
      // Set with merge false for new documents
      await searchDocRef.set(searchDoc);
    } else {
      // Update with merge to preserve createdAt
      await searchDocRef.set(
        {
          ...searchDoc,
          // Don't overwrite createdAt on update
          createdAt: admin.firestore.FieldValue.serverTimestamp(), // Will be ignored if exists
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          indexedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    functions.logger.info(`[Search] Index ${isCreate ? 'created' : 'updated'}: ${searchDocId}`);
  } catch (error) {
    functions.logger.error(`[Search] Failed to index ${entityType}/${entityId}`, { error });
    throw error; // Rethrow to trigger retry
  }
}

// =============================================================================
// ENTITY-SPECIFIC TRIGGERS
// =============================================================================

/**
 * Trigger for Project documents.
 * Fires on create, update, or delete of any document in 'projects' collection.
 */
export const onProjectWrite = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('projects/{docId}')
  .onWrite(async (
    change: functions.Change<functions.firestore.DocumentSnapshot>,
    context: functions.EventContext
  ) => {
    await handleEntityWrite(SEARCH_ENTITY_TYPES.PROJECT, change, context);
  });

/**
 * Trigger for Contact documents.
 * Fires on create, update, or delete of any document in 'contacts' collection.
 */
export const onContactWrite = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('contacts/{docId}')
  .onWrite(async (
    change: functions.Change<functions.firestore.DocumentSnapshot>,
    context: functions.EventContext
  ) => {
    await handleEntityWrite(SEARCH_ENTITY_TYPES.CONTACT, change, context);
  });

// =============================================================================
// FUTURE TRIGGERS (PR#4+)
// =============================================================================

// Uncomment when ready to enable building indexing:
/*
export const onBuildingWrite = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document('buildings/{docId}')
  .onWrite(async (change, context) => {
    await handleEntityWrite(SEARCH_ENTITY_TYPES.BUILDING, change, context);
  });
*/

// Uncomment when ready to enable unit indexing:
/*
export const onUnitWrite = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document('units/{docId}')
  .onWrite(async (change, context) => {
    await handleEntityWrite(SEARCH_ENTITY_TYPES.UNIT, change, context);
  });
*/

// Uncomment when ready to enable file indexing:
/*
export const onFileWrite = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document('files/{docId}')
  .onWrite(async (change, context) => {
    await handleEntityWrite(SEARCH_ENTITY_TYPES.FILE, change, context);
  });
*/
