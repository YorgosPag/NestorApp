/**
 * =============================================================================
 * BACKFILL ENGINE - BulkWriter + Parallel Processing (ADR-029)
 * =============================================================================
 *
 * Contains:
 * - Search document builder (entity → SearchDocumentInput)
 * - Single entity type backfill with BulkWriter
 * - Parallel backfill across all entity types
 *
 * @module api/admin/search-backfill/backfill-engine
 * @enterprise ADR-029 - Global Search v1
 */

import { FieldValue, type Firestore as FirebaseFirestoreType, type Query, type DocumentData, type BulkWriter } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import type { SearchEntityType, SearchDocumentInput } from '@/types/search';
import {
  SEARCH_INDEX_CONFIG,
  extractTitle,
  extractSubtitle,
  determineAudience,
  extractSearchableText,
  normalizeSearchText,
  generateSearchPrefixes,
  removeUndefinedValues,
} from './search-index-config';
import { resolveTenantId } from './tenant-resolver';

const logger = createModuleLogger('BackfillEngine');

// =============================================================================
// TYPES
// =============================================================================

export interface BackfillRequest {
  dryRun?: boolean;
  type?: SearchEntityType;
  companyId?: string;
  limit?: number;
}

export interface BackfillStats {
  processed: number;
  indexed: number;
  skipped: number;
  errors: number;
  skippedDetails?: Array<{
    id: string;
    reason: string;
    fields: Record<string, unknown>;
  }>;
}

// =============================================================================
// BULKWRITER CONFIG
// =============================================================================

const BULK_WRITER_CONFIG = {
  INITIAL_OPS_PER_SECOND: 500,
  MAX_OPS_PER_SECOND: 10000,
} as const;

// =============================================================================
// SEARCH DOCUMENT BUILDER
// =============================================================================

export async function buildSearchDocument(
  entityType: SearchEntityType,
  entityId: string,
  data: Record<string, unknown>,
  adminDb: FirebaseFirestoreType
): Promise<SearchDocumentInput | null> {
  const config = SEARCH_INDEX_CONFIG[entityType];
  if (!config) return null;

  const tenantId = await resolveTenantId(entityType, data, adminDb);
  if (!tenantId) return null;

  const title = extractTitle(data, config);
  const subtitle = extractSubtitle(data, config);
  const status = (data[config.statusField] as string) || 'active';
  const audience = determineAudience(data, config);
  const searchableText = extractSearchableText(data, config);
  const normalizedText = normalizeSearchText(searchableText);
  const prefixes = generateSearchPrefixes(normalizedText);

  // Extract metadata for parking/storage card stats
  let metadata: SearchDocumentInput['metadata'] | undefined;
  if (entityType === 'parking' || entityType === 'storage') {
    metadata = {
      floor: data.floor as string | number | undefined,
      area: data.area as number | undefined,
      price: data.price as number | undefined,
      type: data.type as string | undefined,
    };
    metadata = Object.fromEntries(
      Object.entries(metadata).filter(([, v]) => v !== undefined)
    ) as SearchDocumentInput['metadata'];
    if (Object.keys(metadata || {}).length === 0) {
      metadata = undefined;
    }
  }

  return {
    tenantId,
    entityType,
    entityId,
    title,
    subtitle,
    status,
    search: { normalized: normalizedText, prefixes },
    audience,
    requiredPermission: config.requiredPermission,
    links: {
      href: config.routeTemplate.replace('{id}', entityId),
      routeParams: { id: entityId },
    },
    metadata,
  };
}

// =============================================================================
// BACKFILL SINGLE ENTITY TYPE
// =============================================================================

export async function backfillEntityType(
  entityType: SearchEntityType,
  options: BackfillRequest,
  sharedBulkWriter?: BulkWriter
): Promise<BackfillStats> {
  const adminDb = getAdminFirestore();
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized');
  }

  const config = SEARCH_INDEX_CONFIG[entityType];
  const stats: BackfillStats = { processed: 0, indexed: 0, skipped: 0, errors: 0, skippedDetails: [] };

  logger.info('Processing entity type', { entityType });

  // Build query with optional filters
  let query: Query<DocumentData> = adminDb.collection(config.collection);
  if (options.companyId) {
    query = query.where(FIELDS.COMPANY_ID, '==', options.companyId);
  }

  // ADR-214 Phase 8: Default limit(500) to prevent unbounded reads
  const effectiveLimit = options.limit || 500;
  query = query.limit(effectiveLimit);

  const snapshot = await query.get();
  logger.info('Found documents', { count: snapshot.size });

  // Use shared BulkWriter or create new one
  const bulkWriter = sharedBulkWriter || adminDb.bulkWriter({
    throttling: {
      initialOpsPerSecond: BULK_WRITER_CONFIG.INITIAL_OPS_PER_SECOND,
      maxOpsPerSecond: BULK_WRITER_CONFIG.MAX_OPS_PER_SECOND,
    },
  });

  const writePromises: Promise<void>[] = [];

  for (const doc of snapshot.docs) {
    stats.processed++;
    const data = doc.data() as Record<string, unknown>;

    // Skip soft-deleted
    if (data.isDeleted === true || data.deletedAt) {
      stats.skipped++;
      continue;
    }

    const searchDoc = await buildSearchDocument(entityType, doc.id, data, adminDb);
    if (!searchDoc) {
      stats.skipped++;
      stats.skippedDetails?.push({
        id: doc.id,
        reason: 'No tenant ID resolved',
        fields: {
          companyId: data.companyId || null,
          tenantId: data.tenantId || null,
          project: data.project || null,
          projectId: data.projectId || null,
          buildingId: data.buildingId || null,
          createdBy: data.createdBy || null,
          assignedTo: data.assignedTo || null,
          contactId: data.contactId || null,
        },
      });
      continue;
    }

    const searchDocId = `${entityType}_${doc.id}`;
    const searchDocRef = adminDb.collection(COLLECTIONS.SEARCH_DOCUMENTS).doc(searchDocId);

    if (options.dryRun) {
      logger.info('[DRY-RUN] Would index', { title: searchDoc.title, searchDocId });
      stats.indexed++;
    } else {
      const firestoreDoc = removeUndefinedValues(searchDoc as unknown as Record<string, unknown>);
      stats.indexed++;

      const writePromise = bulkWriter
        .set(searchDocRef, {
          ...firestoreDoc,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          indexedAt: FieldValue.serverTimestamp(),
        })
        .then(() => undefined)
        .catch((error) => {
          logger.error('Write failed', { searchDocId, error });
          stats.indexed--;
          stats.errors++;
        });

      writePromises.push(writePromise);
    }
  }

  // Wait for all writes to complete
  if (!options.dryRun && writePromises.length > 0) {
    await Promise.all(writePromises);
    if (!sharedBulkWriter) {
      await bulkWriter.close();
    }
  }

  logger.info('Entity type stats', {
    entityType,
    processed: stats.processed,
    indexed: stats.indexed,
    skipped: stats.skipped,
    errors: stats.errors,
  });

  return stats;
}

// =============================================================================
// PARALLEL BACKFILL ALL TYPES
// =============================================================================

export async function backfillAllTypesParallel(
  types: SearchEntityType[],
  options: BackfillRequest
): Promise<{ statsByType: Record<string, BackfillStats>; totalStats: BackfillStats }> {
  const adminDb = getAdminFirestore();
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized');
  }

  logger.info('PARALLEL MODE - Processing entity types concurrently', { count: types.length });

  // Shared BulkWriter for cross-type batching
  const bulkWriter = adminDb.bulkWriter({
    throttling: {
      initialOpsPerSecond: BULK_WRITER_CONFIG.INITIAL_OPS_PER_SECOND,
      maxOpsPerSecond: BULK_WRITER_CONFIG.MAX_OPS_PER_SECOND,
    },
  });

  const resultsArray = await Promise.all(
    types.map((entityType) => backfillEntityType(entityType, options, bulkWriter))
  );

  if (!options.dryRun) {
    logger.info('Flushing all pending writes...');
    await bulkWriter.close();
    logger.info('All writes completed');
  }

  // Aggregate results
  const statsByType: Record<string, BackfillStats> = {};
  const totalStats: BackfillStats = { processed: 0, indexed: 0, skipped: 0, errors: 0 };

  types.forEach((entityType, index) => {
    const stats = resultsArray[index];
    statsByType[entityType] = stats;
    totalStats.processed += stats.processed;
    totalStats.indexed += stats.indexed;
    totalStats.skipped += stats.skipped;
    totalStats.errors += stats.errors;
  });

  return { statsByType, totalStats };
}
