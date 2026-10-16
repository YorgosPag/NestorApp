/**
 * =============================================================================
 * MIGRATION: Ανάγνωση κειμένου για τα έγγραφα που ανέβηκαν πριν από την ανάγνωση στο ανέβασμα (ADR-915 §20)
 * =============================================================================
 *
 * Ό,τι ανέβηκε **πριν** ο καταναλωτής του CDC αρχίσει να διαβάζει (φορολογική · ασφαλιστική · ΕΝΦΙΑ · ΠΕΑ) δεν έχει
 * γεγονότα από το κείμενό του, άρα στο μητρώο λήξεων είναι «άγνωστο». Ο ίδιος πυρήνας με το CDC.
 *
 * - GET  = dry-run (κατεβάζει και κρίνει — αναφορά «τι θα γραφτεί»· **καμία** γραφή)
 * - POST = εκτέλεση (ο ΕΝΑΣ γραφέας, με φραγμό bytes)
 *
 * Ιδεμπότητο: ξανατρέξιμο οποτεδήποτε — όπου υπάρχει ήδη ανάγνωση του εγγράφου, το αρχείο δεν κατεβαίνει καν.
 *
 * @module api/admin/backfill-document-text-facts
 * @see server/files/document-text-backfill — ο βρόχος
 * @see ADR-704 — Admin Migration-Runner SSoT (`createMigrationRoute`)
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit (από τη factory)
 */

import type { Firestore } from 'firebase-admin/firestore';

import { createMigrationRoute, type MigrationOutcome } from '@/lib/admin-migration-runner';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { runDocumentTextBackfill } from '@/server/files/document-text-backfill';
import { extractPdfText } from '@/services/pdf/pdf-rasterize.service';

const logger = createModuleLogger('BackfillDocumentTextFacts');

export const maxDuration = 300;

const migrationRoute = createMigrationRoute({ name: 'backfill-document-text-facts', run: runBackfill });
export const GET = migrationRoute.GET;
export const POST = migrationRoute.POST;

async function runBackfill(db: Firestore, { dryRun }: { dryRun: boolean }): Promise<MigrationOutcome> {
  const startedAt = Date.now();
  const tally = await runDocumentTextBackfill(db, dryRun, { readPdfText: extractPdfText });
  const report = { dryRun, timestamp: nowISO(), durationMs: Date.now() - startedAt, tally };
  logger.info(`Document text backfill ${dryRun ? 'DRY-RUN' : 'EXECUTE'} complete`, { durationMs: report.durationMs });
  const { scanned, candidates, outcomes, failed } = tally;
  return { body: { report }, audit: { scanned, candidates, outcomes, failed } };
}
