/**
 * =============================================================================
 * CRON JOB EXECUTOR — το «force run» περνά από τον ΙΔΙΟ δρόμο με το ρολόι (ADR-777 §8.69.14)
 * =============================================================================
 *
 * 🔴 Το εύρημα: το χειροκίνητο τρέξιμο καλούσε τη συνάρτηση της εργασίας ΩΜΑ — χωρίς lease,
 * monitor και κατάσταση ⇒ χειροκίνητο + προγραμματισμένο μαζί = διπλή εκτέλεση. Εδώ
 * αποδεικνύεται ότι το force run παίρνει lease, περνά από το monitor, γράφει κατάσταση, και
 * **δεν** ξεκινά όταν η εργασία τρέχει ήδη.
 */

import type { CronJobDefinition } from '@/types/cron-schedule';

const runScheduled = jest.fn();
const runDisabled = jest.fn();
const routeRunner = jest.fn();

const FAKE_SCHEDULE: CronJobDefinition[] = [
  {
    slug: 'alpha',
    path: '/api/cron/alpha',
    description: 'ενεργή',
    enabled: true,
    schedule: '0 4 * * *',
    timezone: 'UTC',
    checkinMarginMinutes: 5,
    maxRuntimeMinutes: 10,
    leaseMinutes: 20,
    run: runScheduled,
  },
  {
    slug: 'gamma-disabled',
    path: '/api/cron/gamma-disabled',
    description: 'ανενεργή',
    enabled: false,
    disabledReason: 'never-scheduled',
    reactivateWhen: 'Ποτέ — υπάρχει μόνο για αυτό το test.',
  },
];

jest.mock('@/config/cron-schedule', () => ({
  findCronJob: (slug: string) => FAKE_SCHEDULE.find((job) => job.slug === slug),
}));

const withMonitor = jest.fn(async (_slug: string, callback: () => Promise<unknown>) => callback());
jest.mock('@sentry/nextjs', () => ({
  get withMonitor() {
    return withMonitor;
  },
  captureCheckIn: jest.fn(),
}));

const acquireCronLease = jest.fn();
const releaseCronLeaseAfterSuccess = jest.fn();
const releaseCronLeaseAfterFailure = jest.fn();
jest.mock('@/lib/cron/cron-lease', () => ({
  acquireCronLease: (...args: unknown[]) => acquireCronLease(...args),
  releaseCronLeaseAfterSuccess: (...args: unknown[]) => releaseCronLeaseAfterSuccess(...args),
  releaseCronLeaseAfterFailure: (...args: unknown[]) => releaseCronLeaseAfterFailure(...args),
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν το import
import { MANUAL_DISABLED_LEASE_MINUTES, runCronJob, runCronJobNow } from '@/lib/cron/cron-job-executor';

const AT = new Date('2026-09-15T12:34:56.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  acquireCronLease.mockResolvedValue({ acquired: true, state: {} });
  runScheduled.mockResolvedValue({ summary: 'scheduled ok', metrics: { sent: 1 } });
  routeRunner.mockResolvedValue({ summary: 'route ok' });
  runDisabled.mockResolvedValue({ summary: 'disabled ok' });
});

describe('Ε — force run ενεργής εργασίας', () => {
  it('🔴🔴 Ε1 — lease + monitor + κατάσταση, σημασμένο `manual`', async () => {
    const outcome = await runCronJobNow({ slug: 'alpha', run: routeRunner }, AT);

    expect(acquireCronLease).toHaveBeenCalledWith('alpha', 20, `manual@${AT.toISOString()}`, 'manual');
    expect(withMonitor).toHaveBeenCalledWith('alpha', expect.any(Function), expect.anything());
    expect(releaseCronLeaseAfterSuccess).toHaveBeenCalledWith('alpha');
    expect(outcome).toEqual({
      slug: 'alpha',
      trigger: 'manual',
      status: 'success',
      durationMs: expect.any(Number),
      summary: 'scheduled ok',
      metrics: { sent: 1 },
    });
  });

  it('🔴 Ε2 — η εργασία ΤΡΕΧΕΙ ΗΔΗ (lease) ⇒ `skipped-locked`, ΚΑΜΙΑ δεύτερη εκτέλεση', async () => {
    acquireCronLease.mockResolvedValue({ acquired: false, heldUntil: '2026-09-15T12:50:00.000Z' });

    const outcome = await runCronJobNow({ slug: 'alpha', run: routeRunner }, AT);

    expect(outcome).toEqual({
      slug: 'alpha',
      trigger: 'manual',
      status: 'skipped-locked',
      heldUntil: '2026-09-15T12:50:00.000Z',
    });
    expect(runScheduled).not.toHaveBeenCalled();
    expect(routeRunner).not.toHaveBeenCalled();
    expect(withMonitor).not.toHaveBeenCalled();
  });

  it('Ε3 — ένα σημείο εισόδου: τρέχει ο runner ΤΟΥ ΠΡΟΓΡΑΜΜΑΤΟΣ, όχι του route', async () => {
    await runCronJobNow({ slug: 'alpha', run: routeRunner }, AT);

    expect(runScheduled).toHaveBeenCalledTimes(1);
    expect(routeRunner).not.toHaveBeenCalled();
  });

  it('Ε4 — αποτυχία ⇒ `failed`, απελευθέρωση ΧΩΡΙΣ lastSuccessAt', async () => {
    runScheduled.mockRejectedValue(new Error('boom'));

    const outcome = await runCronJobNow({ slug: 'alpha', run: routeRunner }, AT);

    expect(outcome).toMatchObject({ status: 'failed', trigger: 'manual', error: expect.stringContaining('boom') });
    expect(releaseCronLeaseAfterFailure).toHaveBeenCalledWith('alpha', expect.stringContaining('boom'));
    expect(releaseCronLeaseAfterSuccess).not.toHaveBeenCalled();
  });
});

describe('Α — ανενεργή και άγνωστη εργασία', () => {
  it('🔴 Α1 — ανενεργή ⇒ ο runner του route, ΚΑΤΩ από lease, χωρίς monitor (δεν έχει πρόγραμμα)', async () => {
    const outcome = await runCronJobNow({ slug: 'gamma-disabled', run: runDisabled }, AT);

    expect(acquireCronLease).toHaveBeenCalledWith(
      'gamma-disabled',
      MANUAL_DISABLED_LEASE_MINUTES,
      `manual@${AT.toISOString()}`,
      'manual',
    );
    expect(runDisabled).toHaveBeenCalledTimes(1);
    expect(withMonitor).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: 'success', trigger: 'manual', metrics: {} });
  });

  it('Α2 — άγνωστο slug ⇒ `unknown`, ΤΙΠΟΤΑ δεν τρέχει, κανένα lease', async () => {
    const outcome = await runCronJobNow({ slug: 'nope', run: routeRunner }, AT);

    expect(outcome).toEqual({ slug: 'nope', trigger: 'manual', status: 'unknown' });
    expect(acquireCronLease).not.toHaveBeenCalled();
    expect(routeRunner).not.toHaveBeenCalled();
  });
});

describe('Ρ — το ρολόι περνά από τον ΙΔΙΟ executor', () => {
  it('Ρ1 — `schedule` ⇒ κάτοχος `dispatch@…`, trigger `schedule`', async () => {
    const [job] = FAKE_SCHEDULE;
    if (!job.enabled) throw new Error('fixture');

    const outcome = await runCronJob(job, 'schedule', AT);

    expect(acquireCronLease).toHaveBeenCalledWith('alpha', 20, `dispatch@${AT.toISOString()}`, 'schedule');
    expect(outcome.trigger).toBe('schedule');
  });
});
