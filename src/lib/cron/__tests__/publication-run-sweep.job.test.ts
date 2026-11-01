/**
 * Το δίχτυ των εκδόσεων (ADR-923 §5.6.1, απόφαση 45): αποτυχημένη διάθεση δεν μετριέται ως επιτυχία. Το job ρίχνει όταν το πέρασμα
 * απέτυχε χωρίς να σβήσει τίποτα, γιατί μόνο τότε το βλέπουν το Sentry monitor και η κατάσταση της εργασίας.
 */

import { runPublicationRunSweep } from '@/lib/cron/jobs/publication-run-sweep.job';

const mockRetention = jest.fn();
const mockInterrupted = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));
jest.mock('@/server/catalog/publishing/publication-retention.server', () => ({
  runPublicationRetention: (...args: unknown[]) => mockRetention(...args),
}));
jest.mock('@/server/catalog/publishing/publication-run.server', () => ({
  failInterruptedPublicationRuns: (...args: unknown[]) => mockInterrupted(...args),
}));

const report = (counts: Partial<Record<'kept' | 'deferred' | 'disposed' | 'failed', number>>) => ({
  considered: 0, kept: 0, deferred: 0, disposed: 0, failed: 0, ...counts,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockInterrupted.mockResolvedValue(2);
});

describe('runPublicationRunSweep', () => {
  it('αναφέρει κάθε μετρητή, και τα μηδενικά', async () => {
    mockRetention.mockResolvedValue(report({}));
    await expect(runPublicationRunSweep()).resolves.toEqual({
      summary: 'interrupted 2, disposed 0, deferred 0, failed 0',
      metrics: { interrupted: 2, considered: 0, kept: 0, deferred: 0, disposed: 0, failed: 0 },
    });
  });

  it('ρίχνει όταν όλες οι διαθέσεις απέτυχαν', async () => {
    mockRetention.mockResolvedValue(report({ considered: 3, failed: 3 }));
    await expect(runPublicationRunSweep()).rejects.toThrow('all 3 disposals failed');
  });

  it('μένει επιτυχία όταν κάτι σβήστηκε: το αποτυχημένο ξανακρίνεται στο επόμενο πέρασμα', async () => {
    mockRetention.mockResolvedValue(report({ considered: 3, disposed: 2, failed: 1 }));
    await expect(runPublicationRunSweep()).resolves.toMatchObject({ metrics: { disposed: 2, failed: 1 } });
  });

  it('η αποτυχία διάθεσης δεν εμποδίζει το κλείσιμο των διακομμένων εκδόσεων', async () => {
    mockRetention.mockResolvedValue(report({ failed: 1 }));
    await expect(runPublicationRunSweep()).rejects.toThrow();
    expect(mockInterrupted).toHaveBeenCalledTimes(1);
  });
});
