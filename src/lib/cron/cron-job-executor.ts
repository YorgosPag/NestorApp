/**
 * =============================================================================
 * CRON JOB EXECUTOR — lease → monitor → κατάσταση, για ΚΑΘΕ εκτέλεση (ADR-740 · ADR-777 §8.69.14)
 * =============================================================================
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ (ζωντανή δοκιμή 2026-09-15, ADR-777 §8.69.11 #2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το χειροκίνητο τρέξιμο μίας εργασίας (`/api/cron/<slug>`) καλούσε τη συνάρτηση της
 * εργασίας **ωμά** — χωρίς lease, χωρίς Sentry monitor, χωρίς κατάσταση. Χειροκίνητο και
 * προγραμματισμένο μαζί ⇒ **διπλή εκτέλεση** (σε ειδοποιητή: διπλά email). Ο executor με
 * lease υπήρχε ήδη μέσα στον dispatcher, αλλά **μόνο** για το χτύπημα ρολογιού.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΙΔΙΩΜΑ — «FORCE RUN» ΜΕΣΑ ΑΠΟ ΤΟΝ ΙΔΙΟ SCHEDULER
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Google Cloud Scheduler (`jobs.run` / «Force run») και Kubernetes
 * (`kubectl create job --from=cronjob/<name>`): η χειροκίνητη εκτέλεση περνά από το **ίδιο**
 * περιβάλλον και τους **ίδιους** φύλακες με την προγραμματισμένη. Εδώ: **ένας** executor,
 * δύο triggers (`schedule` · `manual`), σημασμένοι στο outcome, στον κάτοχο lease και στο
 * `lastTrigger` της κατάστασης.
 *
 * | Εργασία | Force run |
 * |---|---|
 * | ενεργή | runner **του προγράμματος** · lease `leaseMinutes` · Sentry monitor · κατάσταση |
 * | ανενεργή | runner του route (π.χ. `ai-pipeline`: «επιβεβαίωσε με χειροκίνητη κλήση») · lease {@link MANUAL_DISABLED_LEASE_MINUTES} · **χωρίς** monitor (δεν έχει πρόγραμμα) |
 * | άγνωστη | `unknown` — τίποτα δεν τρέχει |
 *
 * ⚠️ Το «οφείλεται;» **δεν** ρωτιέται σε force run — είναι ακριβώς το νόημά του. Το lease
 * **ρωτιέται**: αν η εργασία τρέχει ήδη, η απάντηση είναι `skipped-locked` με το `heldUntil`.
 *
 * @module lib/cron/cron-job-executor
 * @see ADR-740 §9
 */

import { findCronJob } from '@/config/cron-schedule';
import {
  acquireCronLease,
  releaseCronLeaseAfterFailure,
  releaseCronLeaseAfterSuccess,
} from '@/lib/cron/cron-lease';
import { runWithMonitor } from '@/lib/cron/cron-monitor';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import {
  isEnabledCronJob,
  type CronJobDefinition,
  type CronJobResult,
  type CronJobRunner,
  type CronRunOutcome,
  type CronTrigger,
} from '@/types/cron-schedule';

const logger = createModuleLogger('CronJobExecutor');

/**
 * Lease για χειροκίνητη εκτέλεση **ανενεργής** εργασίας — δεν έχει δικό της `leaseMinutes`.
 * Καλύπτει το `maxDuration` των routes με μεγάλο περιθώριο· απελευθερώνεται πάντα στο τέλος.
 */
export const MANUAL_DISABLED_LEASE_MINUTES = 15;

type EnabledCronJob = Extract<CronJobDefinition, { enabled: true }>;

/** Ταυτότητα κατόχου lease — για διάγνωση, όχι για ορθότητα (βλ. cron-lease). */
function leaseOwnerId(trigger: CronTrigger, at: Date): string {
  return `${trigger === 'schedule' ? 'dispatch' : 'manual'}@${at.toISOString()}`;
}

interface LeasedRun {
  readonly slug: string;
  readonly leaseMinutes: number;
  readonly trigger: CronTrigger;
  readonly at: Date;
  readonly execute: () => Promise<CronJobResult>;
}

/** **Ο ένας δρόμος**: lease → εκτέλεση → απελευθέρωση με κατάσταση. */
async function runUnderLease(run: LeasedRun): Promise<CronRunOutcome> {
  const { slug, trigger } = run;
  const lease = await acquireCronLease(slug, run.leaseMinutes, leaseOwnerId(trigger, run.at), trigger);

  if (!lease.acquired) {
    logger.info('Cron job skipped — lease held', { slug, trigger, heldUntil: lease.heldUntil });
    return { slug, trigger, status: 'skipped-locked', heldUntil: lease.heldUntil };
  }

  const startedAt = Date.now();

  try {
    const result = await run.execute();
    await releaseCronLeaseAfterSuccess(slug);

    const durationMs = Date.now() - startedAt;
    logger.info('Cron job succeeded', { slug, trigger, durationMs, summary: result.summary, ...result.metrics });

    return { slug, trigger, status: 'success', durationMs, summary: result.summary, metrics: result.metrics ?? {} };
  } catch (error) {
    const message = getErrorMessage(error, `Cron job ${slug} failed`);
    // Το lease απελευθερώνεται **και** στην αποτυχία: αλλιώς μια εργασία που έσκασε
    // στο πρώτο δευτερόλεπτο θα έμενε κλειδωμένη για όσο διαρκεί το lease.
    await releaseCronLeaseAfterFailure(slug, message);

    return { slug, trigger, status: 'failed', durationMs: Date.now() - startedAt, error: message };
  }
}

/** Εκτελεί μία **ενεργή** εργασία: lease → Sentry monitor → κατάσταση. */
export function runCronJob(job: EnabledCronJob, trigger: CronTrigger, at: Date): Promise<CronRunOutcome> {
  return runUnderLease({
    slug: job.slug,
    leaseMinutes: job.leaseMinutes,
    trigger,
    at,
    execute: () => runWithMonitor(job, job.run),
  });
}

/** Ό,τι δηλώνει ένα route εργασίας για το force run του. */
export interface ManualCronRunRequest {
  readonly slug: string;
  /** Ο runner του route — χρησιμοποιείται **μόνο** για ανενεργή εργασία (δες τον πίνακα). */
  readonly run: CronJobRunner;
}

/**
 * **Force run μίας εργασίας** — μέσα από τον ΙΔΙΟ executor με το πρόγραμμα.
 *
 * 🔑 Για ενεργή εργασία κερδίζει ο runner **του προγράμματος** (ένα σημείο εισόδου· το
 * `cron-route-contract.test.ts` επιβάλλει ότι το route δηλώνει τον ίδιο).
 */
export async function runCronJobNow(
  request: ManualCronRunRequest,
  at: Date = new Date(),
): Promise<CronRunOutcome> {
  const job = findCronJob(request.slug);
  if (!job) return { slug: request.slug, trigger: 'manual', status: 'unknown' };

  if (isEnabledCronJob(job)) return runCronJob(job, 'manual', at);

  logger.warn('Manual run of a DISABLED cron job', { slug: job.slug, disabledReason: job.disabledReason });
  return runUnderLease({
    slug: job.slug,
    leaseMinutes: MANUAL_DISABLED_LEASE_MINUTES,
    trigger: 'manual',
    at,
    execute: request.run,
  });
}
