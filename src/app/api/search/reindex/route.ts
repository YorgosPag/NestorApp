/**
 * =============================================================================
 * 🔍 SEARCH REINDEX API — Single-entity reindex trigger
 * =============================================================================
 *
 * Called after client-side Firestore writes (contacts, properties, tasks,
 * parking, files) to keep the search_documents index in sync.
 *
 * POST /api/search/reindex  → index or update a document
 * DELETE /api/search/reindex → remove a document from the index
 *
 * @module app/api/search/reindex/route
 * @enterprise ADR-029 - Global Search v1
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, ApiError, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getSearchIndexConfig } from '@/config/search-index-config';
import { indexEntityForSearch } from '@/lib/search/search-indexer';
import { isSearchEntityType, type SearchEntityType } from '@/types/search';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('SearchReindexRoute');

// =============================================================================
// POST /api/search/reindex — Index or update a single entity
// =============================================================================

interface ReindexResponseData {
  indexed: boolean;
  entityType: SearchEntityType;
  entityId: string;
}

const handlePOST = withAuth<ApiSuccessResponse<ReindexResponseData>>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    const adminDb = getAdminFirestore();
    if (!adminDb) throw new ApiError(500, 'Database unavailable');

    const body = await request.json() as Record<string, unknown>;
    const entityType = body.entityType as string;
    const entityId = body.entityId as string;

    if (!entityType || !isSearchEntityType(entityType)) {
      throw new ApiError(400, `Invalid entityType: ${entityType}`);
    }
    if (!entityId || typeof entityId !== 'string') {
      throw new ApiError(400, 'entityId is required');
    }

    const config = getSearchIndexConfig(entityType);
    if (!config) throw new ApiError(400, `No search config for ${entityType}`);

    // Fetch entity from its source collection (tenant-isolated)
    const snap = await adminDb
      .collection(config.collection)
      .doc(entityId)
      .get();

    if (!snap.exists) {
      logger.warn('[SearchReindex] Entity not found — skipping', { entityType, entityId });
      return apiSuccess<ReindexResponseData>(
        { indexed: false, entityType, entityId },
        'Entity not found'
      );
    }

    const entityData = snap.data() as Record<string, unknown>;

    // Tenant isolation: entity must belong to the caller's company
    const entityCompanyId = entityData.companyId as string | undefined;
    if (entityCompanyId && entityCompanyId !== ctx.companyId) {
      throw new ApiError(403, 'Access denied');
    }

    await indexEntityForSearch({
      entityType,
      entityId,
      entityData,
      tenantId: ctx.companyId,
    });

    logger.info('[SearchReindex] Entity reindexed', { entityType, entityId });

    return apiSuccess<ReindexResponseData>(
      { indexed: true, entityType, entityId },
      'Entity indexed successfully'
    );
  },
  { permissions: 'search:global:execute' }
);

// =============================================================================
// DELETE /api/search/reindex — Remove a single entity from the index
// =============================================================================

interface DeleteResponseData {
  removed: boolean;
  entityType: string;
  entityId: string;
}

const handleDELETE = withAuth<ApiSuccessResponse<DeleteResponseData>>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    const adminDb = getAdminFirestore();
    if (!adminDb) throw new ApiError(500, 'Database unavailable');

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !isSearchEntityType(entityType)) {
      throw new ApiError(400, `Invalid entityType: ${entityType}`);
    }
    if (!entityId) throw new ApiError(400, 'entityId is required');

    try {
      const docId = `${entityType}_${entityId}`;
      const docRef = adminDb.collection(COLLECTIONS.SEARCH_DOCUMENTS).doc(docId);

      // Tenant isolation: verify the search doc belongs to caller's company
      const existing = await docRef.get();
      if (existing.exists) {
        const data = existing.data() as Record<string, unknown> | undefined;
        if (data?.tenantId && data.tenantId !== ctx.companyId) {
          throw new ApiError(403, 'Access denied');
        }
        await docRef.delete();
        logger.info('[SearchReindex] Search document deleted', { docId });
      }

      return apiSuccess<DeleteResponseData>(
        { removed: true, entityType, entityId },
        'Search document removed'
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('[SearchReindex] Delete error', { entityType, entityId, error: getErrorMessage(error) });
      throw new ApiError(500, 'Failed to remove search document');
    }
  },
  { permissions: 'search:global:execute' }
);

export const POST = withStandardRateLimit(handlePOST);
export const DELETE = withStandardRateLimit(handleDELETE);
