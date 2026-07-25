/**
 * =============================================================================
 * MIGRATION: Fix companyId mismatch in floor/building floorplan FileRecords
 * =============================================================================
 *
 * Before commit d9a56120, the DXF wizard saved floorplan FileRecords with
 * `selectedCompanyId` (contact entity ID) instead of the property's companyId.
 * ReadOnlyMediaViewer queries with the property's companyId, so these
 * floorplans were invisible in the Ευρετήριο Ακινήτων view.
 *
 * - GET  = dry-run (scan + report, zero writes)
 * - POST = execute (batch writes + audit log)
 *
 * @module api/admin/migrations/fix-floorplan-companyid
 * @enterprise ADR-031 - Canonical File Storage System
 * @see ADR-704 — Admin Migration-Runner SSoT (createMigrationRoute / flushInBatches)
 *
 * 🔒 SECURITY: Protected with RBAC — super_admin ONLY
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { flushInBatches, type BatchUpdate } from '@/lib/admin-batch-utils';
import { createMigrationRoute, type MigrationOutcome } from '@/lib/admin-migration-runner';
import { loadFloorplanRecords, buildEntityMaps, analyzeFloorplans } from './floorplan-companyid-operations';

/** Firestore batch size for the fix writes (max 500 per batch). */
const FIX_BATCH_SIZE = 400;

// =============================================================================
// Route — GET dry-run / POST execute (ADR-704 shared factory)
// =============================================================================

const migrationRoute = createMigrationRoute({ name: 'fix-floorplan-companyid', run: runFloorplanFix });
export const GET = migrationRoute.GET;
export const POST = migrationRoute.POST;

// =============================================================================
// Migration logic
// =============================================================================

async function runFloorplanFix(db: Firestore, { dryRun }: { dryRun: boolean }): Promise<MigrationOutcome> {
  const startTime = Date.now();

  const records = await loadFloorplanRecords(db);
  const maps = await buildEntityMaps(db, records);
  const { mismatches, alreadyCorrect, unresolvable } = analyzeFloorplans(records, maps);

  let updated = 0;
  let flushErrors: string[] = [];

  if (!dryRun && mismatches.length > 0) {
    const updates: BatchUpdate[] = mismatches.map(m => ({
      ref: db.collection(COLLECTIONS.FILES).doc(m.fileRecordId),
      data: {
        companyId: m.newCompanyId,
        updatedAt: new Date(),
        migrationNote: `companyId fixed from ${m.oldCompanyId} → ${m.newCompanyId} (${m.resolvedVia}) [fix-floorplan-companyid migration ${nowISO()}]`,
      },
    }));

    const flush = await flushInBatches(db, updates, FIX_BATCH_SIZE);
    updated = flush.written;
    flushErrors = flush.errors;
  }

  const durationMs = Date.now() - startTime;

  return {
    body: {
      dryRun,
      duration: `${durationMs}ms`,
      summary: {
        totalFloorplanRecords: records.length,
        alreadyCorrect: alreadyCorrect.length,
        mismatches: mismatches.length,
        unresolvable: unresolvable.length,
        updated,
      },
      mismatches,
      unresolvable,
      ...(flushErrors.length > 0 ? { errors: flushErrors } : {}),
    },
    audit: {
      totalRecords: records.length,
      mismatches: mismatches.length,
      updated,
      alreadyCorrect: alreadyCorrect.length,
      unresolvable: unresolvable.length,
    },
  };
}
