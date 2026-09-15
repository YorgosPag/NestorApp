/**
 * =============================================================================
 * ΑΠΑΝΤΗΣΗ FORCE RUN — ΜΙΑ αντιστοίχιση outcome → HTTP (ADR-740 · ADR-777 §8.69.14)
 * =============================================================================
 *
 * Κοινή για τα routes **σάρωσης** (`scan-cron-route`) και **ουράς** (`queue-cron-route`): αν
 * γραφόταν δύο φορές, το «409 = τρέχει ήδη» θα ίσχυε στο ένα και θα ξεχνιόταν στο άλλο.
 *
 * | Έκβαση | HTTP | Γιατί |
 * |---|---|---|
 * | `success` | 200 | τελείωσε — το σώμα κουβαλά summary + metrics όπως πριν |
 * | `failed` | 500 | η εργασία έσκασε — ο άνθρωπος πρέπει να δει τι |
 * | `skipped-locked` | **409** | η εργασία **τρέχει ήδη** (lease): καμία δεύτερη εκτέλεση — **δεν** είναι σφάλμα διακομιστή |
 * | `unknown` | 404 | δεν υπάρχει στο `CRON_SCHEDULE` |
 *
 * ⚠️ Τα μηνύματα είναι **αγγλικά αναγνωριστικά** για χειριστή/logs (ίδιο ιδίωμα με το probe του
 * `scan-cron-route`) — δεν φτάνουν ποτέ σε οθόνη χρήστη.
 *
 * @module lib/cron/cron-run-response
 */

import type { createModuleLogger } from '@/lib/telemetry';
import type { CronRunOutcome } from '@/types/cron-schedule';

type ModuleLogger = ReturnType<typeof createModuleLogger>;

const HTTP_STATUS: Readonly<Record<CronRunOutcome['status'], number>> = {
  success: 200,
  failed: 500,
  'skipped-locked': 409,
  unknown: 404,
};

export function cronRunHttpStatus(outcome: CronRunOutcome): number {
  return HTTP_STATUS[outcome.status];
}

/** Τα πεδία του σώματος για μια έκβαση — ο καλών προσθέτει `elapsedMs` και ό,τι δικό του. */
export function cronRunResponseFields(outcome: CronRunOutcome): Record<string, unknown> {
  const base = { slug: outcome.slug, runTrigger: outcome.trigger, status: outcome.status };
  switch (outcome.status) {
    case 'success':
      return { ok: true, ...base, summary: outcome.summary, ...outcome.metrics };
    case 'failed':
      return { ok: false, ...base, error: outcome.error };
    case 'skipped-locked':
      return { ok: false, ...base, heldUntil: outcome.heldUntil, error: 'Job is already running (lease held) — not started twice' };
    case 'unknown':
      return { ok: false, ...base, error: 'Unknown cron job' };
  }
}

/** Μία γραμμή log ανά έκβαση — επίπεδο ανάλογο της σοβαρότητας. */
export function logCronRunOutcome(
  logger: ModuleLogger,
  label: string,
  outcome: CronRunOutcome,
  elapsedMs: number,
): void {
  const data = { slug: outcome.slug, runTrigger: outcome.trigger, status: outcome.status, elapsedMs };
  if (outcome.status === 'success') logger.info(`${label} completed`, { ...data, summary: outcome.summary });
  else if (outcome.status === 'failed') logger.error(`${label} error`, { ...data, error: outcome.error });
  else logger.warn(`${label} not run`, data);
}
