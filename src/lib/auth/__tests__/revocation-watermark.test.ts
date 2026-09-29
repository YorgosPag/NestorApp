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
const mockReadRevokedSignIns = jest.fn(async (_uid: string): Promise<ReadonlySet<number>> => new Set<number>());
jest.mock('@/lib/auth/revoked-sign-ins', () => ({ readRevokedSignIns: (uid: string) => mockReadRevokedSignIns(uid) }));
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
    expect(isCredentialRevoked({ auth_time: SIGNED_IN_AT_S }, { validAfterMs: revokedAt, disabled: false, missing: false, revokedSignInsSec: new Set<number>() })).toBe(true);
    expect(isCredentialRevoked({ auth_time: SIGNED_IN_AT_S }, { validAfterMs: Date.parse(REVOKED_BEFORE), disabled: false, missing: false, revokedSignInsSec: new Set<number>() })).toBe(false);
  });

  it('Σ2 — κλειδωμένος ή ανύπαρκτος λογαριασμός ⇒ άκυρο, ό,τι κι αν λέει η ώρα', () => {
    expect(isCredentialRevoked({ auth_time: SIGNED_IN_AT_S }, { validAfterMs: 0, disabled: true, missing: false, revokedSignInsSec: new Set<number>() })).toBe(true);
    expect(isCredentialRevoked({ auth_time: SIGNED_IN_AT_S }, { validAfterMs: 0, disabled: false, missing: true, revokedSignInsSec: new Set<number>() })).toBe(true);
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

// ADR-894 §10 Β1 — «Αποσύνδεση ΑΥΤΗΣ της συσκευής»: η σύνδεση (`auth_time`) ανακαλείται μόνη της.
describe('Α — ανά σύνδεση, όχι μόνο ανά λογαριασμό (ADR-894 §10 Β1)', () => {
  const OTHER_DEVICE_S = SIGNED_IN_AT_S + 3_600;

  it('Α1 — ανακλημένη σύνδεση ⇒ άκυρο· ΑΛΛΗ σύνδεση του ίδιου λογαριασμού ⇒ έγκυρο', () => {
    const state = { validAfterMs: 0, disabled: false, missing: false, revokedSignInsSec: new Set([SIGNED_IN_AT_S]) };
    expect(isCredentialRevoked({ auth_time: SIGNED_IN_AT_S }, state)).toBe(true);
    expect(isCredentialRevoked({ auth_time: OTHER_DEVICE_S }, state)).toBe(false);
  });

  it('Α2 🔴 το σύνορο: η ανακλημένη συσκευή παίρνει null, η άλλη περνά', async () => {
    forgetRevocationState('uid_j');
    mockGetUser.mockResolvedValue(account());
    mockReadRevokedSignIns.mockResolvedValue(new Set([SIGNED_IN_AT_S]));
    mockVerifyIdToken.mockResolvedValueOnce(decoded('uid_j'));
    await expect(verifyIdToken('revoked-device')).resolves.toBeNull();
    const other = { uid: 'uid_j', auth_time: OTHER_DEVICE_S } as DecodedIdToken;
    mockVerifySessionCookie.mockResolvedValueOnce(other);
    await expect(verifySessionCookie('other-device')).resolves.toEqual(other);
    mockReadRevokedSignIns.mockResolvedValue(new Set<number>());
  });

  it('Α3 — ΜΙΑ ανάγνωση της λίστας ανά παράθυρο, μαζί με το getUser (όχι ανά αίτημα)', async () => {
    mockGetUser.mockResolvedValue(account());
    await isCredentialStillValid(decoded('uid_k'), clock);
    await isCredentialStillValid(decoded('uid_k'), clock + 1_000);
    expect(mockReadRevokedSignIns).toHaveBeenCalledTimes(1);
  });

  it('Α4 — η λίστα δεν διαβάζεται και δεν υπάρχει μνήμη ⇒ ΡΙΧΝΕΙ (ποτέ «έγκυρο» στα τυφλά)', async () => {
    mockGetUser.mockResolvedValue(account());
    mockReadRevokedSignIns.mockRejectedValueOnce(new Error('FIRESTORE_UNAVAILABLE'));
    await expect(isCredentialStillValid(decoded('uid_l'), clock)).rejects.toThrow('FIRESTORE_UNAVAILABLE');
  });
});
