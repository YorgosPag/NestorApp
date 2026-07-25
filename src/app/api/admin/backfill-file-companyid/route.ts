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
 * @see ADR-704 — Admin Migration-Runner SSoT (buildLookupCache / flushInBatches / createMigrationRoute)
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit
 */

import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import {
  buildLookupCache,
  flushInBatches,
  processAdminBatch,
  BATCH_SIZE_READ,
  type BatchUpdate,
} from '@/lib/admin-batch-utils';
import { createMigrationRoute, type MigrationOutcome } from '@/lib/admin-migration-runner';

const logger = createModuleLogger('BackfillFileCompanyId');

// =============================================================================
// CONSTANTS / TYPES
// =============================================================================

const MAX_ORPHAN_IDS = 50; // Cap orphan fileIds in response

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

export const maxDuration = 60;

// =============================================================================
// Route — GET dry-run / POST execute (ADR-704 shared factory)
// =============================================================================

const migrationRoute = createMigrationRoute({ name: 'backfill-file-companyid', run: runBackfill });
export const GET = migrationRoute.GET;
export const POST = migrationRoute.POST;

// =============================================================================
// Migration logic
// =============================================================================

async function runBackfill(db: Firestore, { dryRun }: { dryRun: boolean }): Promise<MigrationOutcome> {
  const startTime = Date.now();

  // STEP 1: Build file → companyId cache from files collection
  const fileCompanyCache = await buildLookupCache(db.collection(COLLECTIONS.FILES), 'companyId');
  logger.info('Files cache built', { cacheSize: fileCompanyCache.size });

  if (fileCompanyCache.size === 0) {
    return {
      body: {
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
      },
    };
  }

  // STEP 2: Backfill both collections
  const commentsResult = await backfillCollection(db, COLLECTIONS.FILE_COMMENTS, fileCompanyCache, dryRun);
  const auditLogResult = await backfillCollection(db, COLLECTIONS.FILE_AUDIT_LOG, fileCompanyCache, dryRun);

  // STEP 3: Aggregate report
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

  return {
    body: { report },
    audit: {
      filesCacheSize: fileCompanyCache.size,
      totalBackfilled,
      totalOrphaned,
      collectionsProcessed: collections.map(c => ({
        name: c.collection,
        scanned: c.scanned,
        backfilled: c.backfilled,
      })),
      errors: allErrors.length,
    },
  };
}

// =============================================================================
// Backfill a single collection (cursor scan → batched writes, per page)
// =============================================================================

async function backfillCollection(
  db: Firestore,
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

  await processAdminBatch(
    db.collection(collectionName).orderBy('__name__'),
    BATCH_SIZE_READ,
    async (docs) => {
      const updates: BatchUpdate[] = [];

      for (const doc of docs) {
        result.scanned++;
        const data = doc.data();

        // Skip if already has companyId (idempotent)
        if (data.companyId) {
          result.alreadyHasCompanyId++;
          continue;
        }

        const fileId = data.fileId as string | undefined;
        if (!fileId) {
          result.missingFileId++;
          result.errors.push(`Doc ${doc.id}: missing fileId field`);
          continue;
        }

        const companyId = cache.get(fileId);
        if (!companyId) {
          result.orphaned++;
          if (result.orphanedFileIds.length < MAX_ORPHAN_IDS) {
            result.orphanedFileIds.push(fileId);
          }
          continue;
        }

        updates.push({
          ref: doc.ref,
          data: { companyId, _backfilledAt: FieldValue.serverTimestamp() },
        });
      }

      // Dry-run counts would-be writes; execute flushes them (per page)
      if (dryRun) {
        result.backfilled += updates.length;
      } else if (updates.length > 0) {
        const flush = await flushInBatches(db, updates);
        result.backfilled += flush.written;
        result.errors.push(...flush.errors);
      }
    }
  );

  logger.info(`Collection ${collectionName} processed`, {
    scanned: result.scanned,
    backfilled: result.backfilled,
    alreadyHasCompanyId: result.alreadyHasCompanyId,
    orphaned: result.orphaned,
  });

  return result;
}
