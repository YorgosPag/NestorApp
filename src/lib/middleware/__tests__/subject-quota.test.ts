/**
 * @jest-environment node
 *
 * Άγκυρα — **Ο ΕΝΑΣ ΠΥΡΗΝΑΣ ΠΟΣΟΣΤΩΣΗΣ ΑΝΑ ΥΠΟΚΕΙΜΕΝΟ, ΚΑΙ Η ΣΚΙΑ ΤΟΥ** (ADR-900 §8 #4)
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Σ1 | χωρίς δήλωση ⇒ `enforce`: η υπέρβαση **αρνείται** | προεπιλογή `shadow` |
 * | Σ2 | `shadow`: η υπέρβαση **περνά** και **καταγράφεται** — με hash, ποτέ το ωμό υποκείμενο | `return false` σε σκιά · uid στα ίχνη |
 * | Σ3 | αποτυχία του store ⇒ επιτρέπει | `catch` που αρνείται |
 * | Σ4 | το `recipient-quota` κρατά **τα ίδια** κλειδιά με πριν την εξαγωγή (οι μετρητές δεν μηδενίζονται) | κανονικοποίηση στον πυρήνα · άλλο hash |
 * | Σ5 | το uid **δεν** κανονικοποιείται — δύο uid που διαφέρουν σε πεζά/κεφαλαία είναι δύο άνθρωποι | `toLowerCase()` στον πυρήνα |
 * | Σ6 | η διαδρομή `prospect-interest` ζητά τον πυρήνα με τη **δηλωμένη** ποσόστωση, σε σκιά | ποσόστωση γραμμένη inline · `enforce` χωρίς μέτρηση |
 */

import { createHash } from 'crypto';

jest.mock('server-only', () => ({}));

const mockCheckQuota = jest.fn<Promise<{ allowed: boolean; current: number; limit: number; resetMs: number }>, [string, number, number]>();
jest.mock('@/lib/middleware/rate-limiter', () => ({
  checkQuota: (key: string, limit: number, windowMs: number) => mockCheckQuota(key, limit, windowMs),
}));

const mockWarn = jest.fn<void, [string, Record<string, unknown>]>();
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: (message: string, data: Record<string, unknown>) => mockWarn(message, data) }),
}));

import { PROSPECT_INTEREST_DAILY_QUOTA } from '@/lib/middleware/rate-limit-config';
import { withinRecipientQuota } from '@/lib/middleware/recipient-quota';
import { subjectQuotaKey, withinSubjectQuota } from '@/lib/middleware/subject-quota';
import { readRepoCode } from '@/test-utils/read-source';

const QUOTA = { limit: 3, windowMs: 60_000 } as const;
const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

function storeAnswers(allowed: boolean): void {
  mockCheckQuota.mockResolvedValue({ allowed, current: allowed ? 1 : 4, limit: 3, resetMs: 1000 });
}

beforeEach(() => {
  mockCheckQuota.mockReset();
  mockWarn.mockReset();
});

describe('Σ — ο πυρήνας', () => {
  it('Σ1: χωρίς δηλωμένη επιβολή ⇒ enforce — η υπέρβαση αρνείται, σιωπηλά', async () => {
    storeAnswers(false);
    await expect(withinSubjectQuota('s', 'uid-1', QUOTA)).resolves.toBe(false);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('Σ1β: εντός ορίου ⇒ περνά', async () => {
    storeAnswers(true);
    await expect(withinSubjectQuota('s', 'uid-1', { ...QUOTA, enforcement: 'enforce' })).resolves.toBe(true);
  });

  it('Σ2: shadow ⇒ η υπέρβαση ΠΕΡΝΑ και ΚΑΤΑΓΡΑΦΕΤΑΙ — με hash, ποτέ το ωμό υποκείμενο', async () => {
    storeAnswers(false);
    await expect(withinSubjectQuota('s', 'uid-SECRET', { ...QUOTA, enforcement: 'shadow' })).resolves.toBe(true);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    const [, data] = mockWarn.mock.calls[0];
    expect(data).toMatchObject({ scope: 's', key: `s:${sha('uid-SECRET')}`, current: 4, limit: 3 });
    expect(JSON.stringify(data)).not.toContain('uid-SECRET');
  });

  it('Σ3: αποτυχία του store ⇒ επιτρέπει (και στις δύο λειτουργίες)', async () => {
    mockCheckQuota.mockRejectedValue(new Error('redis down'));
    await expect(withinSubjectQuota('s', 'u', QUOTA)).resolves.toBe(true);
    await expect(withinSubjectQuota('s', 'u', { ...QUOTA, enforcement: 'shadow' })).resolves.toBe(true);
  });
});

describe('Σ — οι καταναλωτές', () => {
  it('Σ4: το recipient-quota γράφει ΤΟ ΙΔΙΟ κλειδί με πριν την εξαγωγή (scope:sha256(trim+πεζά))', async () => {
    storeAnswers(true);
    await withinRecipientQuota('auth-mail:reset', '  Nikos@Example.GR ', QUOTA);
    expect(mockCheckQuota).toHaveBeenCalledWith(`auth-mail:reset:${sha('nikos@example.gr')}`, 3, 60_000);
  });

  it('Σ5: το uid ΔΕΝ κανονικοποιείται — διαφορά πεζών/κεφαλαίων = δύο άνθρωποι', () => {
    expect(subjectQuotaKey('s', 'AbC')).not.toBe(subjectQuotaKey('s', 'abc'));
  });

  it('Σ6: η διαδρομή prospect-interest ζητά τον πυρήνα με τη ΔΗΛΩΜΕΝΗ ποσόστωση — σε σκιά', () => {
    expect(PROSPECT_INTEREST_DAILY_QUOTA.enforcement).toBe('shadow');
    const route = readRepoCode('src/app/api/demand/prospect-interest/route.ts');
    expect(route).toMatch(/withinSubjectQuota\(\s*PROSPECT_INTEREST_QUOTA_SCOPE\s*,\s*actor\.ctx\.uid\s*,\s*PROSPECT_INTEREST_DAILY_QUOTA\s*\)/);
  });

  it('Σ7: ΝΑΡΚΗ — η μέρα του `enforce` απαιτεί ΚΑΙ δική του λέξη στον πελάτη', () => {
    // Σε σκιά το 429 της ημερήσιας ποσόστωσης δεν μπορεί να συμβεί, άρα το «Δοκιμάστε ξανά σε λίγο»
    // του `usePlaceInterest` είναι αληθινό (το μόνο 429 είναι το HEAVY, ανά λεπτό). Με `enforce` θα
    // ήταν ψέμα — η απάντηση είναι «αύριο». Η αλλαγή της μίας λέξης ΔΕΝ περνά χωρίς αυτή τη διάκριση.
    const enforced: string = PROSPECT_INTEREST_DAILY_QUOTA.enforcement;
    if (enforced !== 'enforce') return;
    expect(readRepoCode('src/hooks/demand/usePlaceInterest.ts')).toContain('DAILY_QUOTA_EXCEEDED');
  });
});
