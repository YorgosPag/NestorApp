/**
 * =============================================================================
 * SEARCH INDEX BACKFILL API - PROTECTED (super_admin ONLY)
 * =============================================================================
 *
 * Admin endpoint for backfilling search index documents.
 * Indexes existing entities into the searchDocuments collection for Global Search.
 *
 * @module api/admin/search-backfill
 * @enterprise ADR-029 - Global Search v1
 *
 * USAGE:
 *   POST /api/admin/search-backfill  - Execute backfill
 *   GET  /api/admin/search-backfill  - Get system status
 *   PATCH /api/admin/search-backfill - Migrate contact tenantIds
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue, type Query, type DocumentData } from 'firebase-admin/firestore';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from '@/types/search';
import { getErrorMessage } from '@/lib/error-utils';
import { SEARCH_INDEX_CONFIG } from './search-index-config';
import { clearUserCompanyCache } from './tenant-resolver';
import { backfillAllTypesParallel, type BackfillStats } from './backfill-engine';

const logger = createModuleLogger('SearchBackfillRoute');

// =============================================================================
// TYPES
// =============================================================================

function createErrorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false as const, error: message },
    { status }
  );
}

interface BackfillResponse {
  mode: 'DRY_RUN' | 'EXECUTE';
  stats: Record<SearchEntityType, BackfillStats>;
  totalStats: BackfillStats;
  duration: number;
  timestamp: string;
}

interface BackfillStatusResponse {
  system: { name: string; version: string; security: string };
  currentIndex: {
    collection: string;
    totalDocuments: number;
    byEntityType: Record<string, number>;
  };
  availableTypes: SearchEntityType[];
  usage: Record<string, string>;
}

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  noCreator: number;
}

interface MigrationResponse {
  mode: string;
  stats: MigrationStats;
  duration: number;
  timestamp: string;
}

interface ErrorResponse {
  success: false;
  error: string;
}

type BackfillApiResponse = ApiSuccessResponse<BackfillResponse> | ErrorResponse;
type BackfillStatusApiResponse = ApiSuccessResponse<BackfillStatusResponse> | ErrorResponse;
type MigrationApiResponse = ApiSuccessResponse<MigrationResponse> | ErrorResponse;

// =============================================================================
// POST - Execute search index backfill
// =============================================================================

export const POST = withSensitiveRateLimit(withAuth<BackfillApiResponse>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<BackfillApiResponse>> => {
    const startTime = Date.now();

    if (ctx.globalRole !== 'super_admin') {
      logger.warn('BLOCKED: Non-super_admin attempted backfill', { email: ctx.email });
      return createErrorResponse('Forbidden: Only super_admin can execute search backfill', 403);
    }

    logger.info('Search Backfill request', { email: ctx.email });

    try {
      const body = await request.json() as { dryRun?: boolean; type?: SearchEntityType; companyId?: string; limit?: number };
      const { dryRun = true, type, companyId, limit } = body;

      const typesToProcess = type ? [type] : Object.values(SEARCH_ENTITY_TYPES);

      const { statsByType, totalStats } = await backfillAllTypesParallel(
        typesToProcess,
        { dryRun, companyId, limit }
      );

      const duration = Date.now() - startTime;

      return apiSuccess<BackfillResponse>({
        mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
        stats: statsByType as Record<SearchEntityType, BackfillStats>,
        totalStats,
        duration,
        timestamp: new Date().toISOString(),
      }, dryRun
        ? `Dry run complete. Would index ${totalStats.indexed} documents.`
        : `Backfill complete. Indexed ${totalStats.indexed} documents.`
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Search Backfill error', { error: errorMessage });
      return createErrorResponse(errorMessage, 500);
    }
  },
  { permissions: 'admin:migrations:execute' }
));

// =============================================================================
// GET - Backfill system status
// =============================================================================

export const GET = withAuth<BackfillStatusApiResponse>(
  async (_request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<BackfillStatusApiResponse>> => {
    if (ctx.globalRole !== 'super_admin') {
      return createErrorResponse('Forbidden: Only super_admin can access search backfill', 403);
    }

    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return createErrorResponse('Firebase Admin not initialized', 500);
    }

    const counts: Record<string, number> = {};
    for (const entityType of Object.values(SEARCH_ENTITY_TYPES)) {
      const snapshot = await adminDb
        .collection(COLLECTIONS.SEARCH_DOCUMENTS)
        .where(FIELDS.ENTITY_TYPE, '==', entityType)
        .count()
        .get();
      counts[entityType] = snapshot.data().count;
    }

    const totalCount = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return apiSuccess<BackfillStatusResponse>({
      system: { name: 'Search Index Backfill', version: '1.0.0', security: 'super_admin ONLY' },
      currentIndex: {
        collection: COLLECTIONS.SEARCH_DOCUMENTS,
        totalDocuments: totalCount,
        byEntityType: counts,
      },
      availableTypes: Object.values(SEARCH_ENTITY_TYPES),
      usage: {
        dryRun: 'POST { "dryRun": true } - Preview what would be indexed',
        execute: 'POST { "dryRun": false } - Execute indexing',
        filterByType: 'POST { "type": "contact" } - Index only contacts',
        filterByCompany: 'POST { "companyId": "abc123" } - Index only specific company',
      },
    }, 'Search backfill system ready');
  },
  { permissions: 'admin:migrations:execute' }
);

// =============================================================================
// PATCH - Contact tenant migration
// =============================================================================

export const PATCH = withAuth<MigrationApiResponse>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<MigrationApiResponse>> => {
    const startTime = Date.now();

    if (ctx.globalRole !== 'super_admin') {
      logger.warn('BLOCKED: Non-super_admin attempted contact migration', { email: ctx.email });
      return createErrorResponse('Forbidden: Only super_admin can execute contact migration', 403);
    }

    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return createErrorResponse('Firebase Admin not initialized', 500);
    }

    try {
      const body = await request.json() as { dryRun?: boolean; limit?: number; defaultCompanyId?: string };
      const { dryRun = true, limit, defaultCompanyId } = body;

      const stats: MigrationStats = { total: 0, migrated: 0, skipped: 0, errors: 0, noCreator: 0 };

      let query = adminDb.collection(COLLECTIONS.CONTACTS) as Query<DocumentData>;
      query = query.limit(limit || 500);

      const snapshot = await query.get();
      stats.total = snapshot.size;

      // Clear cache for fresh lookups
      clearUserCompanyCache();

      // User lookup cache (local to this migration run)
      const localUserCache = new Map<string, string | null>();

      const BATCH_SIZE = 500;
      let batch = adminDb.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data() as Record<string, unknown>;

        if (data.companyId) {
          stats.skipped++;
          continue;
        }

        const createdBy = data.createdBy as string | undefined;
        let resolvedCompanyId: string | null = null;

        if (createdBy) {
          if (localUserCache.has(createdBy)) {
            resolvedCompanyId = localUserCache.get(createdBy) || null;
          } else {
            try {
              const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(createdBy).get();
              if (userDoc.exists) {
                resolvedCompanyId = (userDoc.data()?.companyId as string) || null;
              }
              localUserCache.set(createdBy, resolvedCompanyId);
            } catch (error) {
              logger.warn('Failed to lookup user', { userId: createdBy, error });
              localUserCache.set(createdBy, null);
            }
          }
        }

        // Fallback to defaultCompanyId
        if (!resolvedCompanyId && defaultCompanyId) {
          resolvedCompanyId = defaultCompanyId;
        }

        if (!resolvedCompanyId) {
          stats.noCreator++;
          continue;
        }

        if (dryRun) {
          stats.migrated++;
        } else {
          batch.update(doc.ref, {
            companyId: resolvedCompanyId,
            updatedAt: FieldValue.serverTimestamp(),
          });
          batchCount++;
          stats.migrated++;

          if (batchCount >= BATCH_SIZE) {
            try {
              await batch.commit();
              batch = adminDb.batch();
              batchCount = 0;
            } catch (error) {
              logger.error('Batch commit failed', { error });
              stats.errors += batchCount;
              stats.migrated -= batchCount;
              batch = adminDb.batch();
              batchCount = 0;
            }
          }
        }
      }

      // Commit remaining
      if (!dryRun && batchCount > 0) {
        try {
          await batch.commit();
        } catch (error) {
          logger.error('Final batch commit failed', { error });
          stats.errors += batchCount;
          stats.migrated -= batchCount;
        }
      }

      const duration = Date.now() - startTime;

      return apiSuccess<MigrationResponse>({
        mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
        stats,
        duration,
        timestamp: new Date().toISOString(),
      }, dryRun
        ? `Dry run complete. Would migrate ${stats.migrated} contacts.`
        : `Migration complete. Migrated ${stats.migrated} contacts.`
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Contact Migration error', { error: errorMessage });
      return createErrorResponse(errorMessage, 500);
    }
  },
  { permissions: 'admin:migrations:execute' }
);
