/**
 * =============================================================================
 * MIGRATION: Backfill companyId on file_comments + file_audit_log
 * =============================================================================
 *
 * After SPEC-255A deployed Firestore rules that require `companyId` for
 * tenant-isolated reads on file_comments and file_audit_log, existing documents
 * without `companyId` became invisible. This migration backfills the field
 * by resolving each document's fileId → files collection → companyId.
 *
 * - GET  = dry-run (scan + report, zero writes)
 * - POST = execute (batch writes + audit log)
 *
 * @module api/admin/backfill-file-companyid
 * @enterprise ADR-255 SPEC-255A — Firestore tenant isolation
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logMigrationExecuted, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('BackfillFileCompanyId');

// =============================================================================
// CONSTANTS
// =============================================================================

const BATCH_LIMIT = 450; // Conservative — Firestore max is 500
const PAGE_SIZE = 500;   // Cursor-based pagination page size
const MAX_ORPHAN_IDS = 50; // Cap orphan fileIds in response

// =============================================================================
// TYPES
// =============================================================================

interface BackfillCollectionResult {
  collection: string;
  scanned: number;
  alreadyHasCompanyId: number;
  backfilled: number;
  orphaned: number;
  orphanedFileIds: string[];
  missingFileId: number;
  errors: string[];
}

interface BackfillReport {
  dryRun: boolean;
  timestamp: string;
  durationMs: number;
  filesCacheSize: number;
  collections: BackfillCollectionResult[];
  totalBackfilled: number;
  totalOrphaned: number;
  errors: string[];
}

// =============================================================================
// VERCEL CONFIG
// =============================================================================

export const maxDuration = 60;

// =============================================================================
// GET — Dry-run analysis
// =============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleMigration(ctx, true);
    },
    { permissions: 'admin:migrations:execute' }
  ));

  return handler(request);
}

// =============================================================================
// POST — Execute migration
// =============================================================================

export async function POST(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleMigration(ctx, false, req);
    },
    { permissions: 'admin:migrations:execute' }
  ));

  return handler(request);
}

// =============================================================================
// STEP 1: Build file → companyId cache from files collection
// =============================================================================

async function buildFileCompanyCache(
  db: FirebaseFirestore.Firestore
): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let pageCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = db
      .collection(COLLECTIONS.FILES)
      .select('companyId')
      .orderBy('__name__')
      .limit(PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    pageCount++;

    for (const doc of snapshot.docs) {
      const companyId = doc.data().companyId as string | undefined;
      if (companyId) {
        cache.set(doc.id, companyId);
      }
    }

    if (snapshot.size < PAGE_SIZE) {
      break; // Last page
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  logger.info('Files cache built', { cacheSize: cache.size, pages: pageCount });
  return cache;
}

// =============================================================================
// STEP 2: Backfill a single collection
// =============================================================================

async function backfillCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  cache: Map<string, string>,
  dryRun: boolean
): Promise<BackfillCollectionResult> {
  const result: BackfillCollectionResult = {
    collection: collectionName,
    scanned: 0,
    alreadyHasCompanyId: 0,
    backfilled: 0,
    orphaned: 0,
    orphanedFileIds: [],
    missingFileId: 0,
    errors: [],
  };

  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let pendingUpdates: Array<{ ref: FirebaseFirestore.DocumentReference; companyId: string }> = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = db
      .collection(collectionName)
      .orderBy('__name__')
      .limit(PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    for (const doc of snapshot.docs) {
      result.scanned++;
      const data = doc.data();

      // Skip if already has companyId (idempotent)
      if (data.companyId) {
        result.alreadyHasCompanyId++;
        continue;
      }

      // Check for fileId field
      const fileId = data.fileId as string | undefined;
      if (!fileId) {
        result.missingFileId++;
        result.errors.push(`Doc ${doc.id}: missing fileId field`);
        continue;
      }

      // Lookup companyId from cache
      const companyId = cache.get(fileId);
      if (!companyId) {
        result.orphaned++;
        if (result.orphanedFileIds.length < MAX_ORPHAN_IDS) {
          result.orphanedFileIds.push(fileId);
        }
        continue;
      }

      // Queue for batch update
      pendingUpdates.push({ ref: doc.ref, companyId });

      // Flush batch when limit reached
      if (!dryRun && pendingUpdates.length >= BATCH_LIMIT) {
        try {
          await flushBatch(db, pendingUpdates);
          result.backfilled += pendingUpdates.length;
        } catch (error) {
          result.errors.push(`Batch write failed: ${getErrorMessage(error)}`);
        }
        pendingUpdates = [];
      }
    }

    if (snapshot.size < PAGE_SIZE) {
      break; // Last page
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  // Flush remaining
  if (dryRun) {
    // In dry-run, count all queued as "would be backfilled"
    result.backfilled = pendingUpdates.length;
  } else if (pendingUpdates.length > 0) {
    try {
      await flushBatch(db, pendingUpdates);
      result.backfilled += pendingUpdates.length;
    } catch (error) {
      result.errors.push(`Final batch write failed: ${getErrorMessage(error)}`);
    }
  }

  logger.info(`Collection ${collectionName} processed`, {
    scanned: result.scanned,
    backfilled: result.backfilled,
    alreadyHasCompanyId: result.alreadyHasCompanyId,
    orphaned: result.orphaned,
  });

  return result;
}

// =============================================================================
// BATCH WRITE HELPER
// =============================================================================

async function flushBatch(
  db: FirebaseFirestore.Firestore,
  updates: Array<{ ref: FirebaseFirestore.DocumentReference; companyId: string }>
): Promise<void> {
  const batch = db.batch();

  for (const { ref, companyId } of updates) {
    batch.update(ref, {
      companyId,
      _backfilledAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
}

// =============================================================================
// CORE MIGRATION HANDLER
// =============================================================================

async function handleMigration(
  ctx: AuthContext,
  dryRun: boolean,
  request?: NextRequest
): Promise<NextResponse> {
  const startTime = Date.now();

  // 🔐 Super_admin ONLY
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted file companyId backfill', {
      email: ctx.email,
      globalRole: ctx.globalRole,
    });
    return NextResponse.json(
      { success: false, error: 'Forbidden: Only super_admin can execute this migration' },
      { status: 403 }
    );
  }

  logger.info(`File companyId backfill ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`, {
    email: ctx.email,
  });

  try {
    const db = getAdminFirestore();

    // ====================================================================
    // STEP 1: Build file → companyId cache
    // ====================================================================

    logger.info('Step 1: Building file → companyId cache from files collection...');
    const fileCompanyCache = await buildFileCompanyCache(db);

    if (fileCompanyCache.size === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        message: 'No files with companyId found — nothing to backfill',
        report: {
          dryRun,
          timestamp: nowISO(),
          durationMs: Date.now() - startTime,
          filesCacheSize: 0,
          collections: [],
          totalBackfilled: 0,
          totalOrphaned: 0,
          errors: [],
        } satisfies BackfillReport,
      });
    }

    // ====================================================================
    // STEP 2: Backfill both collections
    // ====================================================================

    logger.info('Step 2: Backfilling file_comments...');
    const commentsResult = await backfillCollection(
      db,
      COLLECTIONS.FILE_COMMENTS,
      fileCompanyCache,
      dryRun
    );

    logger.info('Step 3: Backfilling file_audit_log...');
    const auditLogResult = await backfillCollection(
      db,
      COLLECTIONS.FILE_AUDIT_LOG,
      fileCompanyCache,
      dryRun
    );

    // ====================================================================
    // STEP 3: Aggregate report
    // ====================================================================

    const collections = [commentsResult, auditLogResult];
    const totalBackfilled = collections.reduce((sum, c) => sum + c.backfilled, 0);
    const totalOrphaned = collections.reduce((sum, c) => sum + c.orphaned, 0);
    const allErrors = collections.flatMap(c => c.errors);

    const report: BackfillReport = {
      dryRun,
      timestamp: nowISO(),
      durationMs: Date.now() - startTime,
      filesCacheSize: fileCompanyCache.size,
      collections,
      totalBackfilled,
      totalOrphaned,
      errors: allErrors,
    };

    // ====================================================================
    // STEP 4: Audit log (POST only)
    // ====================================================================

    if (!dryRun && request) {
      try {
        const metadata = extractRequestMetadata(request);
        await logMigrationExecuted(ctx, 'backfill-file-companyid', {
          ...metadata,
          filesCacheSize: fileCompanyCache.size,
          totalBackfilled,
          totalOrphaned,
          collectionsProcessed: collections.map(c => ({
            name: c.collection,
            scanned: c.scanned,
            backfilled: c.backfilled,
          })),
          errors: allErrors.length,
        });
      } catch {
        logger.warn('Audit logging failed (non-blocking)');
      }
    }

    logger.info(`Migration ${dryRun ? 'analysis' : 'execution'} complete`, {
      durationMs: report.durationMs,
      totalBackfilled,
      totalOrphaned,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('Migration failed', { error: errorMessage });

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
