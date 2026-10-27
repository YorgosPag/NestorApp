/**
 * =============================================================================
 * CRON MONITOR — η ρύθμιση του dead-man's switch
 * =============================================================================
 *
 * Το `buildMonitorConfig` είναι η γέφυρα ανάμεσα στο πρόγραμμα και στον συναγερμό. Αν
 * σπάσει, **δεν σπάει τίποτα ορατό**: οι εργασίες τρέχουν κανονικά, απλώς το Sentry
 * περιμένει check-in σε λάθος ώρα — άρα ή σιωπά όταν πρέπει να χτυπήσει, ή χτυπά
 * καθημερινά χωρίς λόγο μέχρι κάποιος να σιωπήσει το monitor. Και τα δύο καταλήγουν
 * στο ίδιο: κανείς δεν μαθαίνει ότι μια εργασία σταμάτησε.
 *
 * ⚠️ Οι τιμές εδώ είναι **σκόπιμα ασυνήθιστες** (`13`, `41`, `America/Denver`,
 * `'7 3 * * 2'`). Μια δοκιμή με τις προεπιλογές του έργου θα περνούσε ακόμη κι αν ο
 * κώδικας αγνοούσε εντελώς το όρισμα και επέστρεφε σταθερές — το κλασικό test που
 * επιβεβαιώνει τον εαυτό του.
 *
 * @see ADR-740
 */

import { buildMonitorConfig, sendHeartbeat, type CronMonitorSpec } from '@/lib/cron/cron-monitor';
import { CRON_HEARTBEAT_SCHEDULE, CRON_HEARTBEAT_SLUG, CRON_TIMEZONE } from '@/config/cron-schedule';

const captureCheckIn = jest.fn();

jest.mock('@sentry/nextjs', () => ({
  captureCheckIn: (...args: unknown[]) => captureCheckIn(...args),
  withMonitor: jest.fn(),
}));

const SPEC: CronMonitorSpec = {
  slug: 'a-very-specific-slug',
  schedule: '7 3 * * 2',
  timezone: 'America/Denver',
  checkinMarginMinutes: 13,
  maxRuntimeMinutes: 41,
};

beforeEach(() => jest.clearAllMocks());

describe('buildMonitorConfig', () => {
  it('μεταφέρει ΚΑΘΕ πεδίο από τη δήλωση, χωρίς σταθερές', () => {
    expect(buildMonitorConfig(SPEC)).toEqual({
      schedule: { type: 'crontab', value: '7 3 * * 2' },
      checkinMargin: 13,
      maxRuntime: 41,
      timezone: 'America/Denver',
    });
  });

  it('η ώρα του monitor είναι Η ΙΔΙΑ με την ώρα εκτέλεσης', () => {
    // Το αναλλοίωτο που κάνει αδύνατη την απόκλιση προγράμματος ↔ συναγερμού.
    expect(buildMonitorConfig(SPEC).schedule).toEqual({
      type: 'crontab',
      value: SPEC.schedule,
    });
  });

  it('η ζώνη του monitor είναι Η ΙΔΙΑ με τη ζώνη εκτέλεσης', () => {
    expect(buildMonitorConfig(SPEC).timezone).toBe(SPEC.timezone);
  });
});

describe('sendHeartbeat', () => {
  it('χτυπά στην κορυφή της ώρας', () => {
    sendHeartbeat('hb', '0 * * * *', 'Europe/Athens', new Date('2026-07-15T10:00:00.000Z'));

    expect(captureCheckIn).toHaveBeenCalledWith(
      { monitorSlug: 'hb', status: 'ok' },
      expect.objectContaining({
        schedule: { type: 'crontab', value: '0 * * * *' },
        timezone: 'Europe/Athens',
      })
    );
  });

  it('ΔΕΝ χτυπά στα ενδιάμεσα λεπτά', () => {
    // 1.440 check-ins/ημέρα σε ωριαίο monitor: το Sentry περιορίζει σε 6/λεπτό και ο
    // θόρυβος δεν προσθέτει καμία πληροφορία — ο heartbeat απαντά «ζει το ρολόι;»,
    // ερώτηση που δεν χρειάζεται απάντηση ανά λεπτό.
    for (const minute of [1, 17, 30, 59]) {
      sendHeartbeat('hb', '0 * * * *', 'Europe/Athens', new Date(`2026-07-15T10:${String(minute).padStart(2, '0')}:00.000Z`));
    }
    expect(captureCheckIn).not.toHaveBeenCalled();
  });
});

/**
 * 🔴 **Η ΑΠΟΣΤΟΛΗ ΑΚΟΛΟΥΘΕΙ ΤΟ ΔΗΛΩΜΕΝΟ ΠΡΟΓΡΑΜΜΑ — ΟΧΙ ΔΙΚΗ ΤΗΣ ΚΡΙΣΗ** (2026-10-26).
 *
 * Η αποστολή έκρινε με `getMinutes() !== 0` (ωριαία) ενώ στο Sentry δηλωνόταν `*\/5` από το ADR-777 §8.23: το
 * monitor περίμενε check-in ανά 5′ και έπαιρνε ένα ανά ώρα. Οι δύο άγκυρες πάνω (με `0 * * * *`) ήταν **πράσινες**
 * επειδή δοκίμαζαν το μόνο πρόγραμμα όπου οι δύο κρίσεις συμπίπτουν.
 */
describe('sendHeartbeat — ένας κριτής με το πρόγραμμα', () => {
  const at = (minute: number): Date => new Date(`2026-07-15T10:${String(minute).padStart(2, '0')}:00.000Z`);

  it('🔴 πρόγραμμα ανά 5′ ⇒ χτυπά στο :05, ΟΧΙ στο :07 (η ωριαία χειρόγραφη κρίση θα σιωπούσε στο :05)', () => {
    sendHeartbeat('hb', '*/5 * * * *', 'Europe/Athens', at(7));
    expect(captureCheckIn).not.toHaveBeenCalled();

    sendHeartbeat('hb', '*/5 * * * *', 'Europe/Athens', at(5));
    expect(captureCheckIn).toHaveBeenCalledTimes(1);
  });

  it('🔑 η σταθερά της παραγωγής: ΕΝΑ check-in σε κάθε tick μιας ώρας — όσα δηλώνονται στο Sentry', () => {
    for (let minute = 0; minute < 60; minute += 1) {
      sendHeartbeat(CRON_HEARTBEAT_SLUG, CRON_HEARTBEAT_SCHEDULE, CRON_TIMEZONE, at(minute));
    }
    expect(captureCheckIn).toHaveBeenCalledTimes(60);
    expect(captureCheckIn).toHaveBeenLastCalledWith(
      { monitorSlug: CRON_HEARTBEAT_SLUG, status: 'ok' },
      expect.objectContaining({ schedule: { type: 'crontab', value: CRON_HEARTBEAT_SCHEDULE } }),
    );
  });
});
