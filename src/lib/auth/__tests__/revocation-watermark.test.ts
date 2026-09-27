/**
 * @jest-environment node
 *
 * @fileoverview **ΥΠΟΓΕΓΡΑΜΜΕΝΟ ΔΕΝ ΣΗΜΑΙΝΕΙ ΙΣΧΥΟΝ** — ADR-892 §8.1 (Φ1).
 * @related lib/auth/revocation-watermark.ts · lib/auth/token-credentials.ts
 *
 * Ερώτημα: μέλος αφαιρείται από τον οικείο χώρο του και το `revokeRefreshTokens` καλείται. Το cookie
 * των 24 ωρών που κρατά ήδη ο browser του — γίνεται δεκτό στο επόμενο αίτημα;
 */

jest.mock('server-only', () => ({}));

const mockGetUser = jest.fn();
const mockVerifyIdToken = jest.fn();
const mockVerifySessionCookie = jest.fn();

jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: () => true,
  getAdminAuth: () => ({
    getUser: mockGetUser,
    verifyIdToken: mockVerifyIdToken,
    verifySessionCookie: mockVerifySessionCookie,
  }),
}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import type { DecodedIdToken } from 'firebase-admin/auth';

import { forgetRevocationState, isCredentialRevoked, isCredentialStillValid } from '../revocation-watermark';
import { verifyIdToken, verifySessionCookie } from '../token-credentials';

const SIGNED_IN_AT_S = 1_790_000_000;
const REVOKED_AFTER = new Date((SIGNED_IN_AT_S + 60) * 1000).toUTCString();
const REVOKED_BEFORE = new Date((SIGNED_IN_AT_S - 60) * 1000).toUTCString();

function decoded(uid: string): DecodedIdToken {
  return { uid, auth_time: SIGNED_IN_AT_S } as DecodedIdToken;
}

function account(overrides: { tokensValidAfterTime?: string; disabled?: boolean } = {}) {
  return { disabled: false, tokensValidAfterTime: undefined, ...overrides };
}

let clock = 1_000_000;
beforeEach(() => {
  jest.clearAllMocks();
  clock += 3_600_000; // κάθε σενάριο πέρα από κάθε μνήμη του προηγούμενου
});

describe('Σ — η καθαρή σύγκριση (ίδια με το checkRevoked του firebase-admin)', () => {
  it('Σ1 — σύνδεση ΠΡΙΝ από την ανάκληση ⇒ άκυρο· ΜΕΤΑ ⇒ έγκυρο', () => {
    const revokedAt = Date.parse(REVOKED_AFTER);
    expect(isCredentialRevoked({ auth_time: SIGNED_IN_AT_S }, { validAfterMs: revokedAt, disabled: false, missing: false })).toBe(true);
    expect(isCredentialRevoked({ auth_time: SIGNED_IN_AT_S }, { validAfterMs: Date.parse(REVOKED_BEFORE), disabled: false, missing: false })).toBe(false);
  });

  it('Σ2 — κλειδωμένος ή ανύπαρκτος λογαριασμός ⇒ άκυρο, ό,τι κι αν λέει η ώρα', () => {
    expect(isCredentialRevoked({ auth_time: SIGNED_IN_AT_S }, { validAfterMs: 0, disabled: true, missing: false })).toBe(true);
    expect(isCredentialRevoked({ auth_time: SIGNED_IN_AT_S }, { validAfterMs: 0, disabled: false, missing: true })).toBe(true);
  });
});

describe('Μ — η μνήμη είναι φραγμένη, όχι αιώνια', () => {
  it('Μ1 — δύο αιτήματα μέσα στο παράθυρο ⇒ ΕΝΑ getUser', async () => {
    mockGetUser.mockResolvedValue(account());
    await isCredentialStillValid(decoded('uid_a'), clock);
    await isCredentialStillValid(decoded('uid_a'), clock + 1_000);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it('Μ2 — μετά το παράθυρο ⇒ ξαναρωτά και ΒΛΕΠΕΙ την ανάκληση', async () => {
    mockGetUser.mockResolvedValueOnce(account()).mockResolvedValueOnce(account({ tokensValidAfterTime: REVOKED_AFTER }));
    await expect(isCredentialStillValid(decoded('uid_b'), clock)).resolves.toBe(true);
    await expect(isCredentialStillValid(decoded('uid_b'), clock + 31_000)).resolves.toBe(false);
  });

  it('Μ3 — η διεργασία που ανακάλεσε ΞΕΧΝΑ αμέσως (καμία αναμονή 30″)', async () => {
    mockGetUser.mockResolvedValueOnce(account()).mockResolvedValueOnce(account({ tokensValidAfterTime: REVOKED_AFTER }));
    await expect(isCredentialStillValid(decoded('uid_c'), clock)).resolves.toBe(true);
    forgetRevocationState('uid_c');
    await expect(isCredentialStillValid(decoded('uid_c'), clock + 1)).resolves.toBe(false);
  });

  it('Μ4 — το Auth δεν απαντά: παλιά σφραγίδα αν υπάρχει· αλλιώς ΡΙΧΝΕΙ (ποτέ «έγκυρο» στα τυφλά)', async () => {
    mockGetUser.mockResolvedValueOnce(account()).mockRejectedValueOnce(new Error('UNAVAILABLE'));
    await isCredentialStillValid(decoded('uid_d'), clock);
    await expect(isCredentialStillValid(decoded('uid_d'), clock + 31_000)).resolves.toBe(true);

    mockGetUser.mockRejectedValueOnce(new Error('UNAVAILABLE'));
    await expect(isCredentialStillValid(decoded('uid_e'), clock)).rejects.toThrow('UNAVAILABLE');
  });

  it('Μ5 — διαγραμμένος λογαριασμός (`auth/user-not-found`) ⇒ άκυρο, όχι σφάλμα', async () => {
    mockGetUser.mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 'auth/user-not-found' }));
    await expect(isCredentialStillValid(decoded('uid_f'), clock)).resolves.toBe(false);
  });
});

describe('Σ — το σύνορο: και οι δύο πόρτες (Bearer · cookie) ρωτούν', () => {
  it('Σ3 🔴 cookie 24 ωρών εκδομένο ΠΡΙΝ από την ανάκληση ⇒ null (άρνηση)', async () => {
    forgetRevocationState('uid_g');
    mockVerifySessionCookie.mockResolvedValue(decoded('uid_g'));
    mockGetUser.mockResolvedValue(account({ tokensValidAfterTime: REVOKED_AFTER }));
    await expect(verifySessionCookie('cookie')).resolves.toBeNull();
  });

  it('Σ4 🔴 ID token εκδομένο ΠΡΙΝ από την ανάκληση ⇒ null', async () => {
    forgetRevocationState('uid_h');
    mockVerifyIdToken.mockResolvedValue(decoded('uid_h'));
    mockGetUser.mockResolvedValue(account({ tokensValidAfterTime: REVOKED_AFTER }));
    await expect(verifyIdToken('token')).resolves.toBeNull();
  });

  it('Σ5 — ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς ανάκληση το διαπιστευτήριο περνά αυτούσιο', async () => {
    forgetRevocationState('uid_i');
    mockVerifyIdToken.mockResolvedValue(decoded('uid_i'));
    mockGetUser.mockResolvedValue(account());
    await expect(verifyIdToken('token')).resolves.toEqual(decoded('uid_i'));
  });
});
