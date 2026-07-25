/**
 * =============================================================================
 * search-backfill — HTTP handlers (ADR-704 split)
 * =============================================================================
 *
 * POST backfill (delegates to backfill-engine) · GET status · PATCH contact
 * tenant migration. Extracted from route.ts so the route stays under the
 * N.7.1 300-line limit. Each verb keeps its bypass-role guard (ADR-703).
 *
 * @module api/admin/search-backfill/handlers
 * @enterprise ADR-029 - Global Search v1
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue, type Query, type DocumentData } from 'firebase-admin/firestore';
import type { AuthContext } from '@/lib/auth/types';
import type { PermissionCache } from '@/lib/auth/permissions';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { SEARCH_ENTITY_TYPES, type SearchEntityType } from '@/types/search';
import { getErrorMessage } from '@/lib/error-utils';
import { clearUserCompanyCache } from './tenant-resolver';
import { backfillAllTypesParallel, type BackfillStats } from './backfill-engine';
import { nowISO } from '@/lib/date-local';
import { isRoleBypass } from '@/lib/auth/roles';

const logger = createModuleLogger('SearchBackfillRoute');

// =============================================================================
// TYPES
// =============================================================================

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

export type BackfillApiResponse = ApiSuccessResponse<BackfillResponse> | ErrorResponse;
export type BackfillStatusApiResponse = ApiSuccessResponse<BackfillStatusResponse> | ErrorResponse;
export type MigrationApiResponse = ApiSuccessResponse<MigrationResponse> | ErrorResponse;

export function createErrorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false as const, error: message },
    { status }
  );
}

// =============================================================================
// POST — execute search index backfill
// =============================================================================

export async function runSearchBackfill(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<BackfillApiResponse>> {
  const startTime = Date.now();

  if (!isRoleBypass(ctx.globalRole)) {
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
      timestamp: nowISO(),
    }, dryRun
      ? `Dry run complete. Would index ${totalStats.indexed} documents.`
      : `Backfill complete. Indexed ${totalStats.indexed} documents.`
    );
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('Search Backfill error', { error: errorMessage });
    return createErrorResponse(errorMessage, 500);
  }
}

// =============================================================================
// GET — backfill system status
// =============================================================================

export async function getBackfillStatus(
  _request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<BackfillStatusApiResponse>> {
  if (!isRoleBypass(ctx.globalRole)) {
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
}

// =============================================================================
// PATCH — contact tenant migration
// =============================================================================

export async function migrateContactTenants(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<MigrationApiResponse>> {
  const startTime = Date.now();

  if (!isRoleBypass(ctx.globalRole)) {
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
      timestamp: nowISO(),
    }, dryRun
      ? `Dry run complete. Would migrate ${stats.migrated} contacts.`
      : `Migration complete. Migrated ${stats.migrated} contacts.`
    );
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('Contact Migration error', { error: errorMessage });
    return createErrorResponse(errorMessage, 500);
  }
}
