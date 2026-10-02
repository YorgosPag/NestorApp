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

import { COLLECTIONS } from '@/config/firestore-collections';
import { BATCH_SIZE_READ, processAdminBatch } from '@/lib/admin-batch-utils';
import { createMigrationRoute, type MigrationOutcome } from '@/lib/admin-migration-runner';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import {
  backfillImageDimensions,
  needsImageDimensions,
  type ImageDimensionsBackfillOutcome,
} from '@/server/files/image-dimensions-backfill';

const logger = createModuleLogger('BackfillImageDimensions');

/** Πόσα σφάλματα κρατά η αναφορά — τα υπόλοιπα μετριούνται μόνο. */
const MAX_REPORTED_ERRORS = 50;

export const maxDuration = 300;

interface CollectionTally {
  readonly collection: string;
  scanned: number;
  candidates: number;
  readonly outcomes: Partial<Record<ImageDimensionsBackfillOutcome, number>>;
  failed: number;
  readonly errors: string[];
}

const migrationRoute = createMigrationRoute({ name: 'backfill-image-dimensions', run: runBackfill });
export const GET = migrationRoute.GET;
export const POST = migrationRoute.POST;

async function runBackfill(db: Firestore, { dryRun }: { dryRun: boolean }): Promise<MigrationOutcome> {
  const startedAt = Date.now();
  // Τα δύο διαμερίσματα αρχείων (ADR-866 §5.2) — ίδια λογική, ίδια ετυμηγορία.
  const collections = [
    await backfillCollection(db, COLLECTIONS.FILES, dryRun),
    await backfillCollection(db, COLLECTIONS.FILES_PERSONAL, dryRun),
  ];
  const report = { dryRun, timestamp: nowISO(), durationMs: Date.now() - startedAt, collections };
  logger.info(`Image dimensions backfill ${dryRun ? 'DRY-RUN' : 'EXECUTE'} complete`, { durationMs: report.durationMs });
  return {
    body: { report },
    audit: { collections: collections.map(({ collection, scanned, candidates, outcomes, failed }) => ({ collection, scanned, candidates, outcomes, failed })) },
  };
}

async function backfillCollection(db: Firestore, collection: string, dryRun: boolean): Promise<CollectionTally> {
  const tally: CollectionTally = { collection, scanned: 0, candidates: 0, outcomes: {}, failed: 0, errors: [] };
  await processAdminBatch(db.collection(collection).orderBy('__name__'), BATCH_SIZE_READ, async (docs) => {
    tally.scanned += docs.length;
    // Σειριακά: λίγες δεκάδες εικόνες, και κάθε μία = 1 stat + 128 KiB — καμία πίεση στον κάδο ή στη μνήμη.
    for (const doc of docs) {
      const record = doc.data();
      if (!needsImageDimensions(record)) continue;
      tally.candidates += 1;
      try {
        const outcome = await backfillImageDimensions(db, doc.ref, record, dryRun);
        tally.outcomes[outcome] = (tally.outcomes[outcome] ?? 0) + 1;
      } catch (error) {
        tally.failed += 1;
        if (tally.errors.length < MAX_REPORTED_ERRORS) tally.errors.push(`${doc.id}: ${getErrorMessage(error)}`);
      }
    }
  });
  return tally;
}
