/**
 * JOB: email-ingestion — επεξεργασία παρτίδας από την ουρά εισερχομένων email.
 *
 * @module lib/cron/jobs/email-ingestion
 * @enterprise ADR-071 — Enterprise Email Webhook Queue System
 */

import 'server-only';

import { processEmailIngestionBatch } from '@/server/comms/workers/email-ingestion-worker';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { CronJobResult } from '@/types/cron-schedule';

const logger = createModuleLogger('EMAIL_INGESTION_CRON');

export async function runEmailIngestion(): Promise<CronJobResult> {
  const result = await processEmailIngestionBatch();

  // Οι προειδοποιήσεις υγείας της ουράς δεν είναι αποτυχία της παρτίδας — αλλά
  // χάνονταν εντελώς όταν κανείς δεν διάβαζε την HTTP απάντηση. Τώρα καταγράφονται.
  if (result.healthStatus.warnings.length > 0) {
    logger.warn('Queue health warnings', { warnings: result.healthStatus.warnings });
  }

  return {
    summary: `processed ${result.processed}, failed ${result.failed}, recovered ${result.recovered}`,
    metrics: {
      processed: result.processed,
      failed: result.failed,
      recovered: result.recovered,
      healthy: result.healthStatus.healthy ? 1 : 0,
    },
  };
}
