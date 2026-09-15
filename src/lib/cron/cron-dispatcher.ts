/**
 * =============================================================================
 * CRON DISPATCHER — «ποιες εργασίες οφείλονται τώρα;» (ADR-740)
 * =============================================================================
 *
 * Καλείται μία φορά το λεπτό από μία Coolify Scheduled Task. Αξιολογεί ολόκληρο το
 * `CRON_SCHEDULE`, τρέχει ό,τι οφείλεται, και δεν κάνει τίποτα τα υπόλοιπα ~1.430
 * λεπτά της ημέρας.
 *
 * Το μοτίβο είναι της Laravel (`schedule:run`): **ένα** χτύπημα ρολογιού, το πρόγραμμα
 * στον κώδικα. Το εναλλακτικό —μία εγγραφή στο Coolify ανά εργασία— θα έβαζε την
 * αλήθεια σε βάση εκτός git, όπου ένα ξεχασμένο βήμα είναι αόρατο.
 *
 * ## Catch-up (misfire handling)
 *
 * Μια εργασία δεν είναι «οφειλόμενη» μόνο όταν το τρέχον λεπτό ταιριάζει με το cron.
 * Είναι οφειλόμενη και όταν **η προηγούμενη προγραμματισμένη στιγμή πέρασε χωρίς
 * επιτυχία** — π.χ. ο container έκανε επανεκκίνηση στις 04:00 και το backup χάθηκε.
 * Χωρίς αυτό, μια επανεκκίνηση ενός λεπτού κοστίζει ένα ολόκληρο ημερήσιο αντίγραφο.
 *
 * Ο περιορισμός `CATCHUP_GRACE_HOURS` εμποδίζει την «καταιγίδα επανεκκίνησης»: ένας
 * container που σηκώνεται μετά από μια εβδομάδα εκτός δεν τρέχει επτά φορές το κάθε job.
 *
 * @module lib/cron/cron-dispatcher
 * @see ADR-740
 */

import {
  CRON_HEARTBEAT_SCHEDULE,
  CRON_HEARTBEAT_SLUG,
  CRON_SCHEDULE,
  CRON_TIMEZONE,
} from '@/config/cron-schedule';
import { isJobDue } from '@/lib/cron/cron-due';
import { runCronJob } from '@/lib/cron/cron-job-executor';
import { readCronJobState } from '@/lib/cron/cron-lease';
import { sendHeartbeat } from '@/lib/cron/cron-monitor';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import {
  isEnabledCronJob,
  type CronDispatchReport,
  type CronJobDefinition,
  type CronRunOutcome,
} from '@/types/cron-schedule';

const logger = createModuleLogger('CronDispatcher');

// 🔗 ADR-777 §8.69.14 — ο executor μίας εργασίας (lease → monitor → κατάσταση) μετακόμισε στο
// `cron-job-executor.ts`: τον μοιράζονται πλέον το ρολόι ΚΑΙ το «force run» των routes.

/**
 * Ένα χτύπημα ρολογιού.
 *
 * Οι οφειλόμενες εργασίες τρέχουν **παράλληλα** με `allSettled`: τρεις από αυτές
 * μοιράζονται την ώρα 03:00, και σειριακή εκτέλεση θα σήμαινε ότι η αργή πρώτη
 * καθυστερεί τις άλλες δύο. Το `allSettled` (και όχι `all`) εγγυάται ότι η αποτυχία
 * μιας εργασίας δεν ακυρώνει την αναφορά των υπολοίπων — κάθε αποτυχία έχει ήδη
 * καταγραφεί στο δικό της monitor και lease.
 */
export async function dispatchCronTick(tick: Date = new Date()): Promise<CronDispatchReport> {
  const startedAt = Date.now();

  sendHeartbeat(CRON_HEARTBEAT_SLUG, CRON_HEARTBEAT_SCHEDULE, CRON_TIMEZONE, tick);

  const enabled = CRON_SCHEDULE.filter(isEnabledCronJob);

  const dueJobs: Array<Extract<CronJobDefinition, { enabled: true }>> = [];
  for (const job of enabled) {
    const state = await readCronJobState(job.slug);
    const { due, reason } = isJobDue(job.schedule, job.timezone, tick, state.lastSuccessAt);

    if (due) {
      dueJobs.push(job);
      logger.info('Cron job due', { slug: job.slug, reason });
    }
  }

  const settled = await Promise.allSettled(dueJobs.map((job) => runCronJob(job, 'schedule', tick)));

  const outcomes: CronRunOutcome[] = settled.map((entry, index) => {
    if (entry.status === 'fulfilled') return entry.value;
    // Δεν πρέπει να συμβεί — ο executor πιάνει τα δικά του σφάλματα. Αν συμβεί,
    // σημαίνει ότι απέτυχε η ίδια η Firestore (lease), και δεν το κρύβουμε.
    return {
      slug: dueJobs[index].slug,
      trigger: 'schedule',
      status: 'failed',
      durationMs: 0,
      error: getErrorMessage(entry.reason, 'dispatcher failure'),
    };
  });

  return {
    tickAt: tick.toISOString(),
    due: dueJobs.map((job) => job.slug),
    outcomes,
    durationMs: Date.now() - startedAt,
  };
}
