/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §29 — ο πυρήνας του κωδικού πρόσβασης: CSPRNG · HMAC δεμένο στο `invitationId` · κανονικοποίηση
 *   της υπαγόρευσης · μετρητής που **δεν** μηδενίζεται · μόνιμο κλείδωμα στο 5ο λάθος.
 */

import {
  ACCESS_CODE_MAX_FAILURES,
  judgeAccessCode,
  mintAccessCode,
  normaliseAccessCode,
} from '@/server/invitations/invitation-access-code';

const ENV = 'TEST_ACCESS_CODE_SECRET';
const SECRET = 'test-secret-access-code-0123456789abcdef';
const OTHER_SECRET = 'test-other-secret-0123456789abcdef';
const NOW = '2026-10-17T09:00:00.000Z';
const ctx = (invitationId = 'diin_1') => ({ secret: SECRET, invitationId, nowIso: NOW });

beforeEach(() => { process.env[ENV] = SECRET; });

describe('mintAccessCode', () => {
  it('6 ψηφία (με μηδενικά μπροστά), μετρητής 0, κανάλι «γραφείο»· ο ωμός κωδικός ΔΕΝ υπάρχει στο αποθηκευμένο', () => {
    for (let i = 0; i < 50; i += 1) {
      const { code, stored } = mintAccessCode(ENV, 'diin_1');
      expect(code).toMatch(/^\d{6}$/);
      expect(stored).toMatchObject({ channel: 'office-relay', failures: 0, lockedAt: null });
      expect(JSON.stringify(stored)).not.toContain(code);
    }
  });

  it('χωρίς μυστικό ⇒ πετά (ο καλών το λέει `secret-missing` και δεν στέλνει τίποτα)', () => {
    delete process.env[ENV];
    expect(() => mintAccessCode(ENV, 'diin_1')).toThrow();
  });
});

describe('normaliseAccessCode', () => {
  it('κρατά μόνο ψηφία — κενά, παύλες, τελείες της υπαγόρευσης δεν είναι λάθος', () => {
    expect(normaliseAccessCode(' 123 456 ')).toBe('123456');
    expect(normaliseAccessCode('123-456')).toBe('123456');
    expect(normaliseAccessCode('12.34.56')).toBe('123456');
  });
});

describe('judgeAccessCode', () => {
  it('σωστός ⇒ ok· και με κενά', () => {
    const { code, stored } = mintAccessCode(ENV, 'diin_1');
    expect(judgeAccessCode(stored, code, ctx())).toEqual({ kind: 'ok' });
    expect(judgeAccessCode(stored, `${code.slice(0, 3)} ${code.slice(3)}`, ctx())).toEqual({ kind: 'ok' });
  });

  it('🔴 δεμένος στο αίτημα: ο ίδιος κωδικός σε ΑΛΛΗ πρόσκληση είναι λάθος', () => {
    const { code, stored } = mintAccessCode(ENV, 'diin_1');
    expect(judgeAccessCode(stored, code, ctx('diin_2'))).toMatchObject({ kind: 'wrong' });
  });

  it('🔴 δεμένος στο μυστικό: χωρίς το μυστικό η επαλήθευση αποτυγχάνει (διαρροή βάσης ≠ κωδικός)', () => {
    const { code, stored } = mintAccessCode(ENV, 'diin_1');
    expect(judgeAccessCode(stored, code, { ...ctx(), secret: OTHER_SECRET })).toMatchObject({ kind: 'wrong' });
  });

  it('λάθος ⇒ +1 και «απομένουν»· λάθος μήκος μετρά κι αυτό', () => {
    const { code, stored } = mintAccessCode(ENV, 'diin_1');
    const wrong = code === '000000' ? '111111' : '000000';
    expect(judgeAccessCode(stored, wrong, ctx())).toEqual({ kind: 'wrong', remaining: 4, next: { ...stored, failures: 1 } });
    expect(judgeAccessCode(stored, '12', ctx())).toMatchObject({ kind: 'wrong', remaining: 4 });
  });

  it(`🔴 το ${ACCESS_CODE_MAX_FAILURES}ο λάθος κλειδώνει· κλειδωμένος ⇒ ούτε ο ΣΩΣΤΟΣ περνά, και τίποτα νέο για γράψιμο`, () => {
    const { code, stored } = mintAccessCode(ENV, 'diin_1');
    const wrong = code === '000000' ? '111111' : '000000';
    const fourth = { ...stored, failures: ACCESS_CODE_MAX_FAILURES - 1 };
    const locked = judgeAccessCode(fourth, wrong, ctx());
    expect(locked).toEqual({ kind: 'locked', next: { ...fourth, failures: ACCESS_CODE_MAX_FAILURES, lockedAt: NOW } });
    if (locked.kind !== 'locked' || locked.next === null) throw new Error('not locked');
    expect(judgeAccessCode(locked.next, code, ctx())).toEqual({ kind: 'locked', next: null });
  });
});
