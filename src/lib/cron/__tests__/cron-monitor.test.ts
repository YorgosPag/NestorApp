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
