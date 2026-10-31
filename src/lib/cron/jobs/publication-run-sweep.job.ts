import 'server-only';

/**
 * @fileoverview Cron: **το δίχτυ των εκδόσεων καταλόγου** (ADR-923 §5.6). Η απόδοση τρέχει στο `after` της αίτησης· επανεκκίνηση
 * ή ανάπτυξη στη μέση αφήνει ανοιχτή έκδοση. Εδώ γίνεται `failed: interrupted`, ώστε το UI να μην περιμένει για πάντα και η
 * επόμενη αίτηση να την ξαναπιάσει στο ίδιο id.
 * @module lib/cron/jobs/publication-run-sweep.job
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { failInterruptedPublicationRuns } from '@/server/catalog/publishing/publication-run.server';
import type { CronJobResult } from '@/types/cron-schedule';

const BATCH_LIMIT = 50;

export async function runPublicationRunSweep(): Promise<CronJobResult> {
  const interrupted = await failInterruptedPublicationRuns(getAdminFirestore(), Date.now(), BATCH_LIMIT);
  return { summary: `interrupted ${interrupted}`, metrics: { interrupted } };
}
