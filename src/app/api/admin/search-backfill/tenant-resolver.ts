/**
 * =============================================================================
 * TENANT RESOLVER - Multi-Strategy Tenant ID Resolution (ADR-029)
 * =============================================================================
 *
 * Resolves tenant/company ID for search entities using 5 strategies:
 * 1. Direct field (companyId / tenantId)
 * 2. CreatedBy user lookup
 * 2.5. AssignedTo user lookup (CRM entities)
 * 3. Contact lookup (opportunities, communications, tasks)
 * 4. Project lookup (units, parking, storage)
 * 5. Building chain (unit → building → project → companyId)
 *
 * @module api/admin/search-backfill/tenant-resolver
 * @enterprise ADR-029 - Global Search v1
 */

import type { Firestore as FirebaseFirestoreType } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { SearchEntityType } from '@/types/search';

const logger = createModuleLogger('TenantResolver');

/** User → companyId cache for performance optimization */
const userCompanyCache = new Map<string, string | null>();

/** Clear the user company cache (used before migration runs) */
export function clearUserCompanyCache(): void {
  userCompanyCache.clear();
}

/**
 * Resolve tenant ID for an entity using multiple strategies.
 * Enterprise pattern: explicit > relationship > creator
 */
export async function resolveTenantId(
  entityType: SearchEntityType,
  data: Record<string, unknown>,
  adminDb: FirebaseFirestoreType
): Promise<string | null> {
  // Strategy 1: Direct field (preferred)
  const directTenantId = (data.companyId as string) || (data.tenantId as string);
  if (directTenantId) return directTenantId;

  // Strategy 2: CreatedBy lookup
  const createdByResult = await resolveFromUserField(data.createdBy as string | undefined, adminDb, 'createdBy');
  if (createdByResult) return createdByResult;

  // Strategy 2.5: AssignedTo lookup (CRM entities)
  const assignedToResult = await resolveFromUserField(data.assignedTo as string | undefined, adminDb, 'assignedTo');
  if (assignedToResult) return assignedToResult;

  // Strategy 3: Contact lookup (opportunities, communications, tasks)
  const contactResult = await resolveFromContact(data.contactId as string | undefined, adminDb);
  if (contactResult) return contactResult;

  // Strategy 4: Project lookup (units, parking, storage)
  const projectRef = (data.project as string | undefined) || (data.projectId as string | undefined);
  const projectResult = await resolveFromProject(projectRef, adminDb);
  if (projectResult) return projectResult;

  // Strategy 5: Building chain (unit → building → project → companyId)
  const buildingResult = await resolveFromBuildingChain(data.buildingId as string | undefined, adminDb);
  if (buildingResult) return buildingResult;

  logger.info('No tenant resolved', { entityType, docKeys: Object.keys(data).join(',') });
  return null;
}

// =============================================================================
// STRATEGY IMPLEMENTATIONS
// =============================================================================

/**
 * Resolve companyId from a user field (createdBy or assignedTo).
 * Uses cache to avoid repeated Firestore lookups.
 */
async function resolveFromUserField(
  userId: string | undefined,
  adminDb: FirebaseFirestoreType,
  fieldName: string
): Promise<string | null> {
  if (!userId) return null;

  // Check cache first — only return if valid companyId
  if (userCompanyCache.has(userId)) {
    const cached = userCompanyCache.get(userId);
    if (cached) {
      logger.info(`Resolved via ${fieldName} cache`, { userId, companyId: cached });
      return cached;
    }
    // cached is null — fall through to let other strategies try
    return null;
  }

  try {
    const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(userId).get();
    if (userDoc.exists) {
      const companyId = userDoc.data()?.companyId as string | undefined;
      userCompanyCache.set(userId, companyId || null);
      if (companyId) {
        logger.info(`Resolved via ${fieldName}`, { userId, companyId });
        return companyId;
      }
    } else {
      userCompanyCache.set(userId, null);
    }
  } catch (error) {
    logger.warn(`Failed to lookup ${fieldName}`, { userId, error });
    userCompanyCache.set(userId, null);
  }

  return null;
}

/**
 * Resolve companyId from a contact document.
 */
async function resolveFromContact(
  contactId: string | undefined,
  adminDb: FirebaseFirestoreType
): Promise<string | null> {
  if (!contactId) return null;

  try {
    const contactDoc = await adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
    if (contactDoc.exists) {
      const companyId = contactDoc.data()?.companyId as string | undefined;
      if (companyId) {
        logger.info('Resolved via contact', { contactId, companyId });
        return companyId;
      }
      logger.warn('Contact has no companyId', { contactId });
    } else {
      logger.warn('Contact not found', { contactId });
    }
  } catch (error) {
    logger.warn('Failed to lookup contact', { contactId, error });
  }

  return null;
}

/**
 * Resolve companyId from a project document.
 * Handles both prefixed (project_xxx) and non-prefixed IDs.
 */
async function resolveFromProject(
  projectRef: string | undefined,
  adminDb: FirebaseFirestoreType
): Promise<string | null> {
  if (!projectRef) return null;

  try {
    const projectDoc = await lookupWithPrefixFallback(
      adminDb, COLLECTIONS.PROJECTS, projectRef, 'project_'
    );

    if (projectDoc?.exists) {
      const companyId = projectDoc.data()?.companyId as string | undefined;
      if (companyId) {
        logger.info('Resolved via project', { projectId: projectDoc.id, companyId });
        return companyId;
      }
      logger.warn('Project has no companyId', { projectId: projectDoc.id });
    }
  } catch (error) {
    logger.warn('Failed to lookup project', { projectRef, error });
  }

  return null;
}

/**
 * Resolve companyId through building → project → companyId chain.
 * Handles both prefixed and non-prefixed IDs at each level.
 */
async function resolveFromBuildingChain(
  buildingId: string | undefined,
  adminDb: FirebaseFirestoreType
): Promise<string | null> {
  if (!buildingId) return null;

  try {
    const buildingDoc = await lookupWithPrefixFallback(
      adminDb, COLLECTIONS.BUILDINGS, buildingId, 'building_'
    );

    if (!buildingDoc?.exists) return null;

    const projectId = buildingDoc.data()?.projectId as string | undefined;
    if (!projectId) return null;

    const projectDoc = await lookupWithPrefixFallback(
      adminDb, COLLECTIONS.PROJECTS, projectId, 'project_'
    );

    if (projectDoc?.exists) {
      const companyId = projectDoc.data()?.companyId as string | undefined;
      if (companyId) {
        logger.info('Resolved via building chain', {
          buildingId,
          projectId: projectDoc.id,
          companyId,
        });
        return companyId;
      }
    }
  } catch (error) {
    logger.warn('Failed building chain lookup', { buildingId, error });
  }

  return null;
}

// =============================================================================
// SHARED UTILITIES
// =============================================================================

/**
 * Lookup a Firestore document with prefix fallback.
 * Tries: original ID → without prefix → with prefix.
 */
async function lookupWithPrefixFallback(
  adminDb: FirebaseFirestoreType,
  collection: string,
  docId: string,
  prefix: string
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  // Try original ID
  let doc = await adminDb.collection(collection).doc(docId).get();
  if (doc.exists) return doc;

  // Try without prefix (legacy support)
  if (docId.startsWith(prefix)) {
    const unprefixedId = docId.replace(prefix, '');
    doc = await adminDb.collection(collection).doc(unprefixedId).get();
    if (doc.exists) {
      logger.warn('[MIGRATION NEEDED]', { unprefixedId, prefixedId: docId });
      return doc;
    }
  }

  // Try with prefix
  if (!docId.startsWith(prefix)) {
    const prefixedId = `${prefix}${docId}`;
    doc = await adminDb.collection(collection).doc(prefixedId).get();
    if (doc.exists) return doc;
  }

  return null;
}
