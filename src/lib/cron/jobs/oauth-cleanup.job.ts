/**
 * JOB: oauth-cleanup — εκκαθάριση ληγμένων εγγράφων OAuth.
 *
 * ⚠️ **Μην πειράξεις τα παράθυρα διατήρησης** — ζουν στο `lib/oauth/oauth-cleanup.ts`
 * και είναι **δύο** σκόπιμα διαφορετικά (ADR-738 §10.1). Το δεύτερο τροφοδοτεί
 * ανιχνευτή επαναχρησιμοποίησης κωδικού· συντόμευσή του σπάει τον ανιχνευτή κλοπής.
 *
 * @module lib/cron/jobs/oauth-cleanup
 * @see ADR-738 §10
 */

import { cleanupExpiredOAuthDocuments } from '@/lib/oauth/oauth-cleanup';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runOAuthCleanup(): Promise<CronJobResult> {
  const report = await cleanupExpiredOAuthDocuments();
  return {
    summary: `deleted ${report.totalDeleted}`,
    metrics: { totalDeleted: report.totalDeleted },
  };
}
