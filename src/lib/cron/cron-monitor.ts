/**
 * =============================================================================
 * CRON MONITOR — dead-man's switch μέσω Sentry Crons (ADR-740)
 * =============================================================================
 *
 * ## Το πρόβλημα που λύνει
 *
 * Ένα cron που αποτυγχάνει θορυβωδώς είναι εύκολο. Ένα cron που **δεν τρέχει καθόλου**
 * είναι αόρατο: δεν υπάρχει σφάλμα να καταγραφεί, δεν υπάρχει αίτημα να αποτύχει. Έτσι
 * ακριβώς έμεινε το έργο τρεις μήνες χωρίς αντίγραφα ασφαλείας.
 *
 * Ο dead-man's switch αντιστρέφει την ερώτηση: αντί να ρωτάμε «απέτυχε κάτι;», η
 * εργασία **χτυπά** το Sentry κάθε φορά που τρέχει, και το Sentry χτυπά καμπανάκι όταν
 * το χτύπημα **δεν** έρθει στην ώρα του.
 *
 * ## Γιατί περνά από εδώ και δεν καλείται απευθείας το Sentry
 *
 * Το `monitorConfig` παράγεται **αποκλειστικά** από την εγγραφή του
 * `src/config/cron-schedule.ts`. Άρα το πρόγραμμα και η ρύθμιση του συναγερμού είναι
 * **η ίδια δήλωση**: δεν υπάρχει τρόπος να αλλάξει κανείς την ώρα μιας εργασίας και να
 * ξεχάσει να ενημερώσει το monitor. Το monitor δημιουργείται/ενημερώνεται αυτόματα από
 * το check-in (upsert) — δεν υπάρχει χειροκίνητο βήμα στο UI του Sentry.
 *
 * @module lib/cron/cron-monitor
 * @see ADR-740
 */

import * as Sentry from '@sentry/nextjs';

import type { CronJobResult } from '@/types/cron-schedule';

/** Τα πεδία της εγγραφής που καθορίζουν πότε ένα check-in θεωρείται χαμένο. */
export interface CronMonitorSpec {
  readonly slug: string;
  readonly schedule: string;
  readonly timezone: string;
  readonly checkinMarginMinutes: number;
  readonly maxRuntimeMinutes: number;
}

/**
 * Μεταφράζει μια εγγραφή προγράμματος σε ρύθμιση Sentry monitor.
 *
 * Εξάγεται ξεχωριστά ώστε να είναι δοκιμάσιμη χωρίς να χρειάζεται δίκτυο: το test
 * επιβεβαιώνει ότι η ώρα του monitor είναι **η ίδια** με την ώρα εκτέλεσης.
 */
export function buildMonitorConfig(spec: CronMonitorSpec): Sentry.MonitorConfig {
  return {
    schedule: { type: 'crontab', value: spec.schedule },
    checkinMargin: spec.checkinMarginMinutes,
    maxRuntime: spec.maxRuntimeMinutes,
    timezone: spec.timezone,
  };
}

/**
 * Εκτελεί μια εργασία τυλιγμένη σε check-in.
 *
 * Το `withMonitor` στέλνει `in_progress` πριν, και `ok`/`error` μετά. Αν η εργασία
 * ρίξει, **η εξαίρεση διαδίδεται** — ο καλών (dispatcher) πρέπει να δει την αποτυχία
 * για να ενημερώσει το lease. Η καταστολή της εδώ θα έκανε το Sentry να δείχνει σφάλμα
 * ενώ η Firestore θα κατέγραφε επιτυχία.
 */
export async function runWithMonitor(
  spec: CronMonitorSpec,
  run: () => Promise<CronJobResult>
): Promise<CronJobResult> {
  return Sentry.withMonitor(spec.slug, run, buildMonitorConfig(spec));
}

/**
 * Χτύπημα καρδιάς για το **ίδιο το ρολόι**.
 *
 * Κάθε εργασία έχει δικό της monitor, αλλά όλες είναι ημερήσιες: αν πεθάνει η Coolify
 * Scheduled Task, θα περάσουν έως 24 ώρες μέχρι το πρώτο χαμένο check-in. Ο ωριαίος
 * heartbeat κόβει τον χρόνο ανίχνευσης σε ~1 ώρα.
 *
 * Στέλνεται **μόνο** στην κορυφή της ώρας ώστε να ταιριάζει με το δηλωμένο `0 * * * *`:
 * ένα check-in κάθε λεπτό σε ωριαίο monitor θα το θεωρούσε το Sentry υπερβολικά συχνό
 * (όριο 6/λεπτό) και θα ήταν 1.440 check-ins/ημέρα χωρίς αντίκρισμα.
 */
export function sendHeartbeat(
  slug: string,
  schedule: string,
  timezone: string,
  tick: Date
): void {
  if (tick.getMinutes() !== 0) return;

  Sentry.captureCheckIn(
    { monitorSlug: slug, status: 'ok' },
    {
      schedule: { type: 'crontab', value: schedule },
      // Ανοχή 5 λεπτών: ο dispatcher χτυπά στο λεπτό :00, αλλά ένα tick μπορεί να
      // καθυστερήσει όσο τρέχει μια προηγούμενη βαριά εργασία.
      checkinMargin: 5,
      maxRuntime: 1,
      timezone,
    }
  );
}
