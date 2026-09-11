/**
 * @jest-environment node
 *
 * @fileoverview **Η ΕΠΑΝΑΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ** (ADR-844 §13.8) — άγκυρες.
 * @related server/auth/account-reprovision.ts
 *
 * ⚠️ **Ό,τι ΔΕΝ αποδεικνύεται εδώ**: ότι η διαγραφή/επαναδημιουργία **σκοτώνει** τον εκκρεμή
 * κωδικό. Αυτό είναι ιδιότητα της **Firebase**, όχι του κώδικά μας, και ο emulator απαντά
 * **ανάποδα** — η απόδειξη είναι το `scripts/firebase-auth/probe-oob-survival.ts` στην
 * παραγωγή. Εδώ αποδεικνύεται ότι **κάνουμε** αυτή την πράξη, με τη σωστή σειρά και τα
 * σωστά δίχτυα.
 *
 * - **Ρ** — η σειρά: ημερολόγιο **πριν** τη διαγραφή, ίδιο uid, claims χωρίς σφραγίδα.
 * - **Κ** — τα κενά: email που μετακινήθηκε · σφετεριστής · ταυτόχρονη διεκδίκηση.
 * - **Σ** — η συνέχιση διακοπείσας πράξης.
 */

jest.mock('server-only', () => ({}));
jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

const log: string[] = [];
const getUserMock = jest.fn();
const getUserByEmailMock = jest.fn();
const deleteUserMock = jest.fn(async (uid: string) => { log.push(`delete:${uid}`); });
const createUserMock = jest.fn(async (props: { uid: string }) => { log.push(`create:${props.uid}`); return props; });
const journalSetMock = jest.fn(async () => { log.push('journal:set'); });
const journalDeleteMock = jest.fn(async () => { log.push('journal:delete'); });
const journalGetMock = jest.fn(async () => ({ exists: false, data: () => undefined }));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    getUser: (...args: unknown[]) => getUserMock(...args),
    getUserByEmail: (...args: unknown[]) => getUserByEmailMock(...args),
    deleteUser: (uid: string) => deleteUserMock(uid),
    createUser: (props: { uid: string }) => createUserMock(props),
  }),
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({ set: journalSetMock, delete: journalDeleteMock, get: journalGetMock }),
    }),
  }),
}));

const setClaimsMock = jest.fn(async (..._args: unknown[]) => { log.push('claims'); });
jest.mock('@/lib/auth/set-claims-with-mirror', () => ({
  setClaimsWithMirror: (...args: unknown[]) => setClaimsMock(...args),
}));

const sentryMock = jest.fn();
jest.mock('@/lib/telemetry', () => ({ sentryCaptureMessage: (...args: unknown[]) => sentryMock(...args) }));

import { ReprovisionAborted, reprovisionAuthAccount, resumeInterruptedReprovision } from '../account-reprovision';

const EMAIL = 'maria@example.com';

function record(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'uid_victim',
    email: EMAIL,
    emailVerified: false,
    displayName: 'Μαρία Δ.',
    photoURL: undefined,
    customClaims: undefined,
    providerData: [{ providerId: 'password' }],
    ...overrides,
  };
}

function firebaseError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

beforeEach(() => {
  jest.clearAllMocks();
  log.length = 0;
});

describe('Ρ — η σειρά', () => {
  it('🔴 Ρ1 — ημερολόγιο → διαγραφή → δημιουργία ΙΔΙΟΥ uid → σβήσιμο ημερολογίου', async () => {
    getUserMock.mockResolvedValue(record());

    const receipt = await reprovisionAuthAccount('uid_victim', EMAIL);

    expect(log).toEqual(['journal:set', 'delete:uid_victim', 'create:uid_victim', 'journal:delete']);
    expect(createUserMock).toHaveBeenCalledWith({
      uid: 'uid_victim', email: EMAIL, emailVerified: true, displayName: 'Μαρία Δ.',
    });
    expect(receipt).toEqual({ removedProviders: ['password'] });
  });

  it('🔴 Ρ2 — Trojan identifier: ΚΑΘΕ πάροχος αναφέρεται, κανένας δεν ξαναδένεται', async () => {
    getUserMock.mockResolvedValue(record({ providerData: [{ providerId: 'password' }, { providerId: 'google.com' }] }));

    const receipt = await reprovisionAuthAccount('uid_victim', EMAIL);

    expect(receipt.removedProviders).toEqual(['password', 'google.com']);
    expect(createUserMock.mock.calls[0][0]).not.toHaveProperty('providerToLink');
  });

  it('🔑 Ρ3 — τα claims επιστρέφουν (ο ρόλος δεν υποβαθμίζεται), ΧΩΡΙΣ την παλιά σφραγίδα', async () => {
    getUserMock.mockResolvedValue(record({ customClaims: { globalRole: 'company_admin', companyId: 'c1', claimsUpdatedAt: 5 } }));

    await reprovisionAuthAccount('uid_victim', EMAIL);

    expect(setClaimsMock).toHaveBeenCalledWith('uid_victim', { globalRole: 'company_admin', companyId: 'c1' });
    expect(log).toEqual(['journal:set', 'delete:uid_victim', 'create:uid_victim', 'claims', 'journal:delete']);
  });
});

describe('Κ — τα κενά της πράξης', () => {
  it('🔴 Κ1 — ο επιτιθέμενος πρόλαβε να αλλάξει το email: ΑΡΝΗΣΗ πριν από ΚΑΘΕ γραφή', async () => {
    getUserMock.mockResolvedValue(record({ email: 'attacker@example.com' }));

    await expect(reprovisionAuthAccount('uid_victim', EMAIL)).rejects.toBeInstanceOf(ReprovisionAborted);
    expect(log).toEqual([]);
  });

  it('🔴 Κ2 — ανεπιβεβαίωτος σφετεριστής μέσα στο κενό: ΔΙΩΧΝΕΤΑΙ, και ξαναδοκιμάζουμε', async () => {
    getUserMock.mockResolvedValue(record());
    createUserMock.mockRejectedValueOnce(firebaseError('auth/email-already-exists'));
    getUserByEmailMock.mockResolvedValueOnce({ uid: 'uid_squatter', emailVerified: false });

    await reprovisionAuthAccount('uid_victim', EMAIL);

    expect(deleteUserMock).toHaveBeenCalledWith('uid_squatter');
    // Δύο απόπειρες, και οι δύο για το ΙΔΙΟ uid — ποτέ «δώσε του άλλο».
    expect(createUserMock).toHaveBeenCalledTimes(2);
    expect(createUserMock.mock.calls.map(([props]) => props.uid)).toEqual(['uid_victim', 'uid_victim']);
  });

  it('⛔ Κ3 — ΕΠΙΒΕΒΑΙΩΜΕΝΟΣ κάτοχος του email: άρνηση, και το ημερολόγιο ΜΕΝΕΙ', async () => {
    getUserMock.mockResolvedValue(record());
    createUserMock.mockRejectedValueOnce(firebaseError('auth/email-already-exists'));
    getUserByEmailMock.mockResolvedValueOnce({ uid: 'uid_other', emailVerified: true });

    await expect(reprovisionAuthAccount('uid_victim', EMAIL)).rejects.toBeInstanceOf(ReprovisionAborted);
    expect(journalDeleteMock).not.toHaveBeenCalled();
  });

  it('Κ4 — ταυτόχρονη διεκδίκηση (ίδιο uid, επιβεβαιωμένο, χωρίς πάροχο): ιδεμποτικό, όχι σφάλμα', async () => {
    getUserMock
      .mockResolvedValueOnce(record())
      .mockResolvedValueOnce(record({ emailVerified: true, providerData: [] }));
    deleteUserMock.mockRejectedValueOnce(firebaseError('auth/user-not-found'));
    createUserMock.mockRejectedValueOnce(firebaseError('auth/uid-already-exists'));

    await expect(reprovisionAuthAccount('uid_victim', EMAIL)).resolves.toEqual({ removedProviders: ['password'] });
    expect(journalDeleteMock).toHaveBeenCalled();
  });

  it('Κ5 — η δημιουργία απέτυχε για άλλο λόγο: ΠΕΤΑ, και το ημερολόγιο ΜΕΝΕΙ για συνέχιση', async () => {
    getUserMock.mockResolvedValue(record());
    createUserMock.mockRejectedValueOnce(firebaseError('auth/internal-error'));

    await expect(reprovisionAuthAccount('uid_victim', EMAIL)).rejects.toThrow('auth/internal-error');
    expect(journalDeleteMock).not.toHaveBeenCalled();
  });
});

describe('Σ — η συνέχιση', () => {
  it('Σ1 — κανένα ημερολόγιο ⇒ `null` (ο καλών γεννά λογαριασμό κανονικά)', async () => {
    await expect(resumeInterruptedReprovision(EMAIL)).resolves.toBeNull();
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('🔴 Σ2 — διεκδίκηση που διακόπηκε: ολοκληρώνεται με το ΙΔΙΟ uid — τα δεδομένα δεν ορφανεύουν', async () => {
    journalGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: 'uid_victim', email: EMAIL, displayName: null, photoURL: null, customClaims: { globalRole: 'external_user' } }),
    });

    await expect(resumeInterruptedReprovision(EMAIL)).resolves.toBe('uid_victim');
    expect(log).toEqual(['create:uid_victim', 'claims', 'journal:delete']);
    expect(sentryMock).toHaveBeenCalledTimes(1);
  });
});
