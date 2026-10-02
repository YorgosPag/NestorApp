/**
 * =============================================================================
 * MIGRATION: Διαστάσεις εικόνας στις υπάρχουσες εγγραφές αρχείων (ADR-899 §3.7)
 * =============================================================================
 *
 * Ό,τι ανέβηκε **πριν** από τον trigger `onImageDimensionsFinalize` (ή του οποίου η εγγραφή γράφτηκε **μετά** το
 * ανέβασμα) δεν έχει `imageDimensions`. Η μέτρηση διαβάζει **μόνο την κεφαλίδα** (128 KiB) της τρέχουσας γενιάς.
 *
 * - GET  = dry-run (μέτρηση + αναφορά, **καμία** γραφή — ούτε στο αντικείμενο)
 * - POST = εκτέλεση (custom metadata αντικειμένου με `ifGenerationMatch` + εγγραφή σε transaction)
 *
 * Ιδεμπότητο: ξανατρέξιμο οποτεδήποτε — όπου υπάρχουν έγκυρες διαστάσεις, η εγγραφή δεν διαβάζεται καν.
 *
 * @module api/admin/backfill-image-dimensions
 * @see server/files/image-dimensions-backfill — η λογική ανά εγγραφή
 * @see ADR-704 — Admin Migration-Runner SSoT (`createMigrationRoute`)
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit (από τη factory)
 */

import type { Firestore } from 'firebase-admin/firestore';

import { createMigrationRoute, type MigrationOutcome } from '@/lib/admin-migration-runner';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { runImageDimensionsBackfill } from '@/server/files/image-dimensions-backfill';

const logger = createModuleLogger('BackfillImageDimensions');

export const maxDuration = 300;

const migrationRoute = createMigrationRoute({ name: 'backfill-image-dimensions', run: runBackfill });
export const GET = migrationRoute.GET;
export const POST = migrationRoute.POST;

async function runBackfill(db: Firestore, { dryRun }: { dryRun: boolean }): Promise<MigrationOutcome> {
  const startedAt = Date.now();
  const collections = await runImageDimensionsBackfill(db, dryRun);
  const report = { dryRun, timestamp: nowISO(), durationMs: Date.now() - startedAt, collections };
  logger.info(`Image dimensions backfill ${dryRun ? 'DRY-RUN' : 'EXECUTE'} complete`, { durationMs: report.durationMs });
  return {
    body: { report },
    audit: { collections: collections.map(({ collection, scanned, candidates, outcomes, failed }) => ({ collection, scanned, candidates, outcomes, failed })) },
  };
}
