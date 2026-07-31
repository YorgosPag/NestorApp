/**
 * =============================================================================
 * ΑΝΑΛΛΟΙΩΤΑ ΤΟΥ ΠΡΟΓΡΑΜΜΑΤΟΣ — src/config/cron-schedule.ts
 * =============================================================================
 *
 * Το `cron-route-contract.test.ts` ρωτά «υπάρχει δήλωση;». Εδώ ρωτάμε «είναι **σωστή**
 * η δήλωση;» — δηλαδή τα πράγματα που ένας άνθρωπος συμπληρώνει με copy-paste και
 * κανένας μεταγλωττιστής δεν ελέγχει: έγκυρη έκφραση cron, ζώνη ώρας, και το ότι το
 * lease καλύπτει τη μέγιστη διάρκεια.
 *
 * Τα job modules παρακάμπτονται: το ζητούμενο είναι το **πρόγραμμα**, όχι οι εργασίες,
 * και ένα πραγματικό import θα έσερνε firebase-admin και δίκτυο μέσα σε unit test.
 *
 * @see ADR-740
 */

import { Cron } from 'croner';

jest.mock('@/lib/cron/jobs/ai-learning.job', () => ({ runAiLearning: jest.fn() }));
jest.mock('@/lib/cron/jobs/backup.job', () => ({ runBackup: jest.fn() }));
jest.mock('@/lib/cron/jobs/email-ingestion.job', () => ({ runEmailIngestion: jest.fn() }));
jest.mock('@/lib/cron/jobs/file-purge.job', () => ({ runFilePurge: jest.fn() }));
jest.mock('@/lib/cron/jobs/oauth-cleanup.job', () => ({ runOAuthCleanup: jest.fn() }));
jest.mock('@/lib/cron/jobs/onboarding-reminder.job', () => ({ runOnboardingReminder: jest.fn() }));
jest.mock('@/lib/cron/jobs/overdue-alerts.job', () => ({ runOverdueAlerts: jest.fn() }));
jest.mock('@/lib/cron/jobs/purge-deleted-entities.job', () => ({
  runPurgeDeletedEntities: jest.fn(),
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν το import
import {
  CRON_SCHEDULE,
  CRON_TIMEZONE,
  CRON_HEARTBEAT_SCHEDULE,
  findCronJob,
} from '@/config/cron-schedule';
import { isEnabledCronJob } from '@/types/cron-schedule';

const enabled = CRON_SCHEDULE.filter(isEnabledCronJob);
const disabled = CRON_SCHEDULE.filter((job) => !isEnabledCronJob(job));

describe('πρόγραμμα — δομή', () => {
  it('υπάρχουν ενεργές εργασίες', () => {
    // Δικλείδα: αν κάποιος απενεργοποιήσει τα πάντα, τα `it.each` παρακάτω θα ήταν
    // κενά και πράσινα — η ακριβής μορφή του σφάλματος που διορθώνει το ADR-740.
    expect(enabled.length).toBeGreaterThanOrEqual(8);
  });

  it('υπάρχουν και δηλωμένες-ανενεργές εργασίες', () => {
    expect(disabled.length).toBeGreaterThan(0);
  });

  it('το findCronJob βρίσκει ό,τι υπάρχει και τίποτα άλλο', () => {
    expect(findCronJob('backup')?.slug).toBe('backup');
    expect(findCronJob('δεν-υπάρχει')).toBeUndefined();
  });
});

describe('πρόγραμμα — κάθε ενεργή εργασία', () => {
  it.each(enabled.map((job) => [job.slug, job] as const))(
    '%s έχει έγκυρη έκφραση cron',
    (_slug, job) => {
      // Μια άκυρη έκφραση ρίχνει· μια **έγκυρη αλλά αδύνατη** (π.χ. 31 Φεβρουαρίου)
      // δεν ρίχνει και απλώς δεν τρέχει ποτέ. Ελέγχουμε ότι έχει επόμενη εκτέλεση.
      const next = new Cron(job.schedule, { timezone: job.timezone }).nextRun();
      expect(next).toBeInstanceOf(Date);
    }
  );

  it.each(enabled.map((job) => [job.slug, job] as const))(
    '%s δηλώνει ρητά τη ζώνη ώρας του έργου',
    (_slug, job) => {
      expect(job.timezone).toBe(CRON_TIMEZONE);
    }
  );

  it.each(enabled.map((job) => [job.slug, job] as const))(
    '%s: το lease καλύπτει τη μέγιστη διάρκεια',
    (_slug, job) => {
      // Αν το lease λήγει πριν τελειώσει η εργασία, το επόμενο tick τη βρίσκει
      // «ελεύθερη» και την ξαναρχίζει — παράλληλα με την πρώτη. Για το backup αυτό
      // σημαίνει δύο ταυτόχρονες μεταφορές προς GCS.
      expect(job.leaseMinutes).toBeGreaterThanOrEqual(job.maxRuntimeMinutes);
    }
  );

  it.each(enabled.map((job) => [job.slug, job] as const))(
    '%s: τα όρια είναι θετικά',
    (_slug, job) => {
      expect(job.maxRuntimeMinutes).toBeGreaterThan(0);
      expect(job.checkinMarginMinutes).toBeGreaterThan(0);
    }
  );

  it.each(enabled.map((job) => [job.slug, job] as const))(
    '%s: το run είναι συνάρτηση',
    (_slug, job) => {
      expect(typeof job.run).toBe('function');
    }
  );
});

describe('πρόγραμμα — κάθε ανενεργή εργασία τεκμηριώνει το γιατί', () => {
  it.each(disabled.map((job) => [job.slug, job] as const))(
    '%s έχει αιτία και όρο επανενεργοποίησης',
    (_slug, job) => {
      // Ανενεργό χωρίς αιτία είναι δυσδιάκριτο από ξεχασμένο — και αυτή ακριβώς η
      // δυσδιακρισία κόστισε τρεις μήνες χωρίς αντίγραφα ασφαλείας.
      expect(job.disabledReason).toBeTruthy();
      expect(job.reactivateWhen.length).toBeGreaterThan(20);
    }
  );

  it('το superseded δείχνει σε εργασία που όντως υπάρχει', () => {
    for (const job of disabled) {
      if (job.disabledReason !== 'superseded') continue;
      expect(job.supersededBy).toBeTruthy();
      expect(findCronJob(job.supersededBy as string)).toBeDefined();
    }
  });
});

describe('heartbeat', () => {
  it('χτυπά συχνότερα από την πιο συχνή εργασία', () => {
    // Ο heartbeat είναι ο ανιχνευτής «πέθανε το ρολόι». Αν χτυπούσε αραιότερα από τις
    // εργασίες, θα το μαθαίναμε από αυτές — δηλαδή δεν θα πρόσφερε τίποτα.
    const heartbeatNext = new Cron(CRON_HEARTBEAT_SCHEDULE, { timezone: CRON_TIMEZONE });
    const [h1, h2] = heartbeatNext.nextRuns(2);
    const heartbeatGapMs = h2.getTime() - h1.getTime();

    for (const job of enabled) {
      const [j1, j2] = new Cron(job.schedule, { timezone: job.timezone }).nextRuns(2);
      expect(heartbeatGapMs).toBeLessThan(j2.getTime() - j1.getTime());
    }
  });
});
