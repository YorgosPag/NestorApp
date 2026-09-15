/**
 * ΑΠΑΝΤΗΣΗ FORCE RUN — outcome → HTTP (ADR-777 §8.69.14).
 *
 * 🔑 Το «τρέχει ήδη» είναι **409**, όχι 500: δεν έσπασε τίποτα, απλώς δεν ξεκίνησε δεύτερη εκτέλεση.
 */
import { cronRunHttpStatus, cronRunResponseFields } from '@/lib/cron/cron-run-response';
import type { CronRunOutcome } from '@/types/cron-schedule';

const SUCCESS: CronRunOutcome = {
  slug: 'alpha', trigger: 'manual', status: 'success', durationMs: 5, summary: 'ok', metrics: { sent: 2 },
};
const FAILED: CronRunOutcome = { slug: 'alpha', trigger: 'manual', status: 'failed', durationMs: 5, error: 'boom' };
const LOCKED: CronRunOutcome = { slug: 'alpha', trigger: 'manual', status: 'skipped-locked', heldUntil: '2026-09-15T13:00:00.000Z' };
const UNKNOWN: CronRunOutcome = { slug: 'nope', trigger: 'manual', status: 'unknown' };

describe('cronRunHttpStatus', () => {
  it.each([
    [SUCCESS, 200],
    [FAILED, 500],
    [LOCKED, 409],
    [UNKNOWN, 404],
  ] as const)('%o ⇒ %i', (outcome, status) => {
    expect(cronRunHttpStatus(outcome)).toBe(status);
  });
});

describe('cronRunResponseFields', () => {
  it('success ⇒ `ok: true` με summary ΚΑΙ τα metrics στην κορυφή (ίδιο σχήμα με πριν)', () => {
    expect(cronRunResponseFields(SUCCESS)).toMatchObject({ ok: true, runTrigger: 'manual', summary: 'ok', sent: 2 });
  });

  it('🔴 skipped-locked ⇒ `ok: false` με `heldUntil` — ο χειριστής ξέρει ΠΟΤΕ να ξαναδοκιμάσει', () => {
    expect(cronRunResponseFields(LOCKED)).toMatchObject({ ok: false, status: 'skipped-locked', heldUntil: LOCKED.heldUntil });
  });

  it('failed / unknown ⇒ `ok: false` με μήνυμα', () => {
    expect(cronRunResponseFields(FAILED)).toMatchObject({ ok: false, error: 'boom' });
    expect(cronRunResponseFields(UNKNOWN)).toMatchObject({ ok: false, status: 'unknown' });
  });
});
