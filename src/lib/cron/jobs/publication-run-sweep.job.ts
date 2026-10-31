import 'server-only';

/**
 * @fileoverview Cron: **το δίχτυ των εκδόσεων καταλόγου** (ADR-923 §5.6). Η απόδοση τρέχει στο `after` της αίτησης· επανεκκίνηση
 * ή ανάπτυξη στη μέση αφήνει ανοιχτή έκδοση. Εδώ γίνεται `failed: interrupted`, ώστε το UI να μην περιμένει για πάντα και η
 * επόμενη αίτηση να την ξαναπιάσει στο ίδιο id. Στο ίδιο πέρασμα η διάθεση των PDF που έληξαν (§5.6.1): καμία νέα υποδομή.
 * @module lib/cron/jobs/publication-run-sweep.job
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { runPublicationRetention } from '@/server/catalog/publishing/publication-retention.server';
import { failInterruptedPublicationRuns } from '@/server/catalog/publishing/publication-run.server';
import type { CronJobResult } from '@/types/cron-schedule';

const BATCH_LIMIT = 50;

/** Λίγα ανά πέρασμα: το όριο των 60 s είναι κοινό, και ό,τι μείνει το πιάνει το επόμενο σε 30′. */
const DISPOSAL_LIMIT = 20;

/** ⚠️ Κάθε μετρητής εκπέμπεται και όταν είναι μηδέν: «0 απέτυχαν» ≠ «δεν κοίταξε κανείς». */
export async function runPublicationRunSweep(): Promise<CronJobResult> {
  const db = getAdminFirestore();
  const interrupted = await failInterruptedPublicationRuns(db, Date.now(), BATCH_LIMIT);
  const retention = await runPublicationRetention(db, DISPOSAL_LIMIT);
  return {
    summary: `interrupted ${interrupted}, disposed ${retention.disposed}, deferred ${retention.deferred}, failed ${retention.failed}`,
    metrics: { interrupted, ...retention },
  };
}
