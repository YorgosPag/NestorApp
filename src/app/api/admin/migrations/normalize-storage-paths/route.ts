/**
 * =============================================================================
 * MIGRATION: normalize legacy project-scoped Storage paths (ADR-709)
 * =============================================================================
 *
 * Before ADR-709 the path builder accepted an optional `projectId`, so the same
 * logical file could be written to either of two trees:
 *
 *   companies/{c}/projects/{p}/entities/{t}/{id}/…   ← legacy
 *   companies/{c}/entities/{t}/{id}/…                ← canonical
 *
 * Writers now emit only the canonical form. This migration moves what already
 * exists, so prefix-based sweeps (deletion cleanup, floor wipe, orphan GC) can
 * once again be COMPLETE by walking a single tree.
 *
 * - GET  = dry-run (scan + report, zero writes, zero object copies)
 * - POST = execute (copy → verify → delete per object, then update FileRecords)
 *
 * Re-runnable: a failed object leaves its source intact and its FileRecord
 * unchanged, so a second run retries exactly what is still legacy.
 *
 * @module api/admin/migrations/normalize-storage-paths
 * @enterprise ADR-709 — Immutable Storage Path
 * @enterprise ADR-704 — Admin Migration-Runner SSoT (createMigrationRoute / flushInBatches)
 *
 * 🔒 SECURITY: Protected with RBAC — super_admin ONLY
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { flushInBatches, type BatchUpdate } from '@/lib/admin-batch-utils';
import { createMigrationRoute, type MigrationOutcome } from '@/lib/admin-migration-runner';
import { getAdminBucket } from '@/lib/firebaseAdmin';
import {
  scanLegacyPaths,
  moveRecordObjects,
  rewriteDownloadUrl,
  type MoveResult,
} from './storage-path-normalize-operations';

/** Firestore batch size for the path rewrites (max 500 per batch). */
const FIX_BATCH_SIZE = 400;

/** Reported verbatim in the dry-run body; kept small so the response stays readable. */
const SAMPLE_SIZE = 25;

// =============================================================================
// Route — GET dry-run / POST execute (ADR-704 shared factory)
// =============================================================================

const migrationRoute = createMigrationRoute({
  name: 'normalize-storage-paths',
  run: runNormalizeStoragePaths,
});
export const GET = migrationRoute.GET;
export const POST = migrationRoute.POST;

// =============================================================================
// Migration logic
// =============================================================================

async function runNormalizeStoragePaths(
  db: Firestore,
  { dryRun }: { dryRun: boolean }
): Promise<MigrationOutcome> {
  const { legacy, alreadyCanonical, unparseable } = await scanLegacyPaths(db);

  if (dryRun || legacy.length === 0) {
    return buildOutcome({ legacy, alreadyCanonical, unparseable, dryRun, moves: [], updated: 0 });
  }

  // Objects first: a FileRecord must never point at a path whose bytes are not
  // there yet. Records whose move failed are excluded from the rewrite below.
  const bucket = getAdminBucket();
  const moves: MoveResult[] = [];
  for (const record of legacy) {
    moves.push(await moveRecordObjects(bucket, record));
  }

  const movedIds = new Set(moves.filter((m) => !m.error).map((m) => m.fileRecordId));
  const updates: BatchUpdate[] = legacy
    .filter((r) => movedIds.has(r.fileRecordId))
    .map((r) => ({
      ref: db.collection(COLLECTIONS.FILES).doc(r.fileRecordId),
      data: {
        storagePath: r.canonicalPath,
        ...(r.downloadUrl
          ? { downloadUrl: rewriteDownloadUrl(r.downloadUrl, r.legacyPath, r.canonicalPath) }
          : {}),
        updatedAt: new Date(),
        migrationNote: `storagePath normalized ${r.legacyPath} → ${r.canonicalPath} [normalize-storage-paths migration ${nowISO()}]`,
      },
    }));

  const flush = await flushInBatches(db, updates, FIX_BATCH_SIZE);

  return buildOutcome({
    legacy,
    alreadyCanonical,
    unparseable,
    dryRun,
    moves,
    updated: flush.written,
    flushErrors: flush.errors,
  });
}

// =============================================================================
// Reporting
// =============================================================================

interface OutcomeInput {
  legacy: Awaited<ReturnType<typeof scanLegacyPaths>>['legacy'];
  alreadyCanonical: number;
  unparseable: Awaited<ReturnType<typeof scanLegacyPaths>>['unparseable'];
  dryRun: boolean;
  moves: MoveResult[];
  updated: number;
  flushErrors?: string[];
}

function buildOutcome(input: OutcomeInput): MigrationOutcome {
  const { legacy, alreadyCanonical, unparseable, dryRun, moves, updated, flushErrors } = input;
  const failed = moves.filter((m) => m.error);
  const movedObjects = moves.reduce((sum, m) => sum + m.movedObjects, 0);

  const summary = {
    legacyRecords: legacy.length,
    alreadyCanonical,
    unparseable: unparseable.length,
    objectsMoved: movedObjects,
    recordsUpdated: updated,
    recordsFailed: failed.length,
  };

  return {
    body: {
      dryRun,
      summary,
      // Truncated on purpose — a full listing of thousands of paths is unusable
      // in a JSON response. The counts above are authoritative.
      sample: legacy.slice(0, SAMPLE_SIZE).map((r) => ({
        fileRecordId: r.fileRecordId,
        legacyProjectId: r.legacyProjectId,
        from: r.legacyPath,
        to: r.canonicalPath,
      })),
      sampleTruncated: legacy.length > SAMPLE_SIZE,
      ...(unparseable.length > 0 ? { unparseable: unparseable.slice(0, SAMPLE_SIZE) } : {}),
      ...(failed.length > 0 ? { failures: failed } : {}),
      ...(flushErrors && flushErrors.length > 0 ? { errors: flushErrors } : {}),
    },
    audit: summary,
  };
}
