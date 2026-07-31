/**
 * =============================================================================
 * CRON DISPATCHER — η ενορχήστρωση
 * =============================================================================
 *
 * Το `cron-due` δοκιμάζει «ποια οφείλεται», το `cron-lease` «ποιος κερδίζει». Εδώ
 * δοκιμάζεται ό,τι μένει και είναι εύκολο να είναι λάθος **χωρίς να φανεί**:
 *
 * - Οι ανενεργές εργασίες δεν εκτελούνται ποτέ.
 * - Η αποτυχία μιας εργασίας δεν εμποδίζει τις υπόλοιπες (`allSettled`, όχι `all`).
 * - Η επιτυχία γράφει `lastSuccessAt`· η αποτυχία **όχι**.
 * - Κάθε εκτέλεση περνά από Sentry check-in — ο dead-man's switch δεν είναι προαιρετικός.
 *
 * @see ADR-740
 */

import type { CronJobDefinition } from '@/types/cron-schedule';

// ─── Ψεύτικο πρόγραμμα ────────────────────────────────────────────────────────
// Το πραγματικό `CRON_SCHEDULE` έχει ώρες παραγωγής· εδώ χρειάζονται εργασίες που
// οφείλονται *τώρα*, ελεγχόμενα.

const runAlpha = jest.fn();
const runBeta = jest.fn();
const runDisabled = jest.fn();
const runNotDue = jest.fn();

const FAKE_SCHEDULE: CronJobDefinition[] = [
  {
    slug: 'alpha',
    path: '/api/cron/alpha',
    description: 'πάντα οφειλόμενη',
    enabled: true,
    schedule: '* * * * *',
    timezone: 'UTC',
    checkinMarginMinutes: 5,
    maxRuntimeMinutes: 5,
    leaseMinutes: 5,
    run: runAlpha,
  },
  {
    slug: 'beta',
    path: '/api/cron/beta',
    description: 'πάντα οφειλόμενη',
    enabled: true,
    schedule: '* * * * *',
    timezone: 'UTC',
    checkinMarginMinutes: 5,
    maxRuntimeMinutes: 5,
    leaseMinutes: 5,
    run: runBeta,
  },
  {
    // Ενεργή αλλά **όχι** οφειλόμενη σε αυτό το tick. Χωρίς αυτήν, ένα `if (due)` που
    // μεταλλάσσεται σε `if (true)` θα ήταν αόρατο: όλες οι εργασίες θα έτρεχαν είτε
    // έτσι είτε αλλιώς, και το test θα επιβεβαίωνε τον εαυτό του.
    slug: 'delta-not-due',
    path: '/api/cron/delta-not-due',
    description: 'ενεργή, αλλά η ώρα της είναι αλλού',
    enabled: true,
    schedule: '0 4 * * *',
    timezone: 'UTC',
    checkinMarginMinutes: 5,
    maxRuntimeMinutes: 5,
    leaseMinutes: 5,
    run: runNotDue,
  },
  {
    slug: 'gamma-disabled',
    path: '/api/cron/gamma-disabled',
    description: 'δηλωμένη αλλά ανενεργή',
    enabled: false,
    disabledReason: 'paused',
    reactivateWhen: 'Ποτέ — υπάρχει μόνο για αυτό το test και τεκμηριώνει τον λόγο.',
  },
];

jest.mock('@/config/cron-schedule', () => ({
  get CRON_SCHEDULE() {
    return FAKE_SCHEDULE;
  },
  CRON_TIMEZONE: 'UTC',
  CRON_HEARTBEAT_SLUG: 'heartbeat-test',
  CRON_HEARTBEAT_SCHEDULE: '0 * * * *',
}));

const captureCheckIn = jest.fn();
const withMonitor = jest.fn(
  async (_slug: string, callback: () => Promise<unknown>) => callback()
);

jest.mock('@sentry/nextjs', () => ({
  get withMonitor() {
    return withMonitor;
  },
  get captureCheckIn() {
    return captureCheckIn;
  },
}));

const acquireCronLease = jest.fn();
const releaseCronLeaseAfterSuccess = jest.fn();
const releaseCronLeaseAfterFailure = jest.fn();
const readCronJobState = jest.fn();

jest.mock('@/lib/cron/cron-lease', () => ({
  acquireCronLease: (...args: unknown[]) => acquireCronLease(...args),
  releaseCronLeaseAfterSuccess: (...args: unknown[]) => releaseCronLeaseAfterSuccess(...args),
  releaseCronLeaseAfterFailure: (...args: unknown[]) => releaseCronLeaseAfterFailure(...args),
  readCronJobState: (...args: unknown[]) => readCronJobState(...args),
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν το import
import { dispatchCronTick } from '@/lib/cron/cron-dispatcher';

const TICK = new Date('2026-07-15T09:30:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  readCronJobState.mockImplementation(async (slug: string) => ({
    slug,
    // Η `delta-not-due` έτρεξε ήδη σήμερα: χωρίς αυτό το catch-up θα την έκανε
    // οφειλόμενη και θα ακύρωνε τον σκοπό της μέσα στο test.
    lastSuccessAt: slug === 'delta-not-due' ? '2026-07-15T09:00:00.000Z' : null,
    lastAttemptAt: null,
    leaseExpiresAt: null,
    leaseOwner: null,
    consecutiveFailures: 0,
    lastError: null,
  }));
  acquireCronLease.mockResolvedValue({ acquired: true, state: {} });
  runAlpha.mockResolvedValue({ summary: 'alpha ok' });
  runBeta.mockResolvedValue({ summary: 'beta ok' });
});

describe('dispatchCronTick — επιλογή εργασιών', () => {
  it('τρέχει τις οφειλόμενες ενεργές εργασίες', async () => {
    const report = await dispatchCronTick(TICK);

    expect(report.due).toEqual(['alpha', 'beta']);
    expect(runAlpha).toHaveBeenCalledTimes(1);
    expect(runBeta).toHaveBeenCalledTimes(1);
  });

  it('ΔΕΝ τρέχει ενεργή εργασία που δεν οφείλεται τώρα', async () => {
    // Το ουσιώδες: ο dispatcher χτυπά 1.440 φορές την ημέρα· αν αγνοούσε το «οφείλεται»,
    // κάθε εργασία θα έτρεχε κάθε λεπτό — 1.440 αντίγραφα ασφαλείας την ημέρα.
    const report = await dispatchCronTick(TICK);

    expect(report.due).not.toContain('delta-not-due');
    expect(runNotDue).not.toHaveBeenCalled();
  });

  it('ΔΕΝ τρέχει ποτέ ανενεργή εργασία', async () => {
    await dispatchCronTick(TICK);

    expect(runDisabled).not.toHaveBeenCalled();
    expect(acquireCronLease).not.toHaveBeenCalledWith('gamma-disabled', expect.anything(), expect.anything());
  });

  it('δεν τρέχει τίποτα όταν το lease κρατείται', async () => {
    acquireCronLease.mockResolvedValue({ acquired: false, heldUntil: '2026-07-15T10:00:00.000Z' });

    const report = await dispatchCronTick(TICK);

    expect(runAlpha).not.toHaveBeenCalled();
    expect(report.outcomes.every((o) => o.status === 'skipped-locked')).toBe(true);
  });
});

describe('dispatchCronTick — απομόνωση αποτυχιών', () => {
  it('η αποτυχία μιας εργασίας δεν εμποδίζει τις υπόλοιπες', async () => {
    // Με `Promise.all` αντί για `allSettled`, η πρώτη αποτυχία θα ακύρωνε την αναφορά
    // ολόκληρου του tick — και το «τι έτρεξε» θα γινόταν άγνωστο.
    runAlpha.mockRejectedValue(new Error('alpha έσκασε'));

    const report = await dispatchCronTick(TICK);

    expect(runBeta).toHaveBeenCalledTimes(1);

    const alpha = report.outcomes.find((o) => o.slug === 'alpha');
    const beta = report.outcomes.find((o) => o.slug === 'beta');
    expect(alpha?.status).toBe('failed');
    expect(beta?.status).toBe('success');
  });

  it('η επιτυχία γράφει lastSuccessAt, η αποτυχία όχι', async () => {
    runAlpha.mockRejectedValue(new Error('boom'));

    await dispatchCronTick(TICK);

    expect(releaseCronLeaseAfterSuccess).toHaveBeenCalledWith('beta');
    expect(releaseCronLeaseAfterSuccess).not.toHaveBeenCalledWith('alpha');
    expect(releaseCronLeaseAfterFailure).toHaveBeenCalledWith('alpha', expect.stringContaining('boom'));
  });
});

describe('dispatchCronTick — παρατηρησιμότητα', () => {
  it('κάθε εκτέλεση περνά από Sentry check-in', async () => {
    await dispatchCronTick(TICK);

    expect(withMonitor).toHaveBeenCalledTimes(2);
    expect(withMonitor).toHaveBeenCalledWith('alpha', expect.any(Function), expect.anything());
  });

  it('η ρύθμιση του monitor προέρχεται από την ΙΔΙΑ δήλωση με το πρόγραμμα', async () => {
    // Αυτό είναι το αναλλοίωτο που κάνει αδύνατη την απόκλιση προγράμματος/συναγερμού.
    await dispatchCronTick(TICK);

    const [, , config] = withMonitor.mock.calls[0];
    expect(config).toEqual({
      schedule: { type: 'crontab', value: '* * * * *' },
      checkinMargin: 5,
      maxRuntime: 5,
      timezone: 'UTC',
    });
  });

  it('ο heartbeat χτυπά μόνο στην κορυφή της ώρας', async () => {
    await dispatchCronTick(new Date('2026-07-15T09:30:00.000Z'));
    expect(captureCheckIn).not.toHaveBeenCalled();

    await dispatchCronTick(new Date('2026-07-15T10:00:00.000Z'));
    expect(captureCheckIn).toHaveBeenCalledWith(
      { monitorSlug: 'heartbeat-test', status: 'ok' },
      expect.objectContaining({ schedule: { type: 'crontab', value: '0 * * * *' } })
    );
  });
});
