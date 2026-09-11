/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΚΟΛΟΥΘΙΑ ΤΗΣ ΤΑΥΤΟΤΗΤΑΣ ΤΟΥ ΠΟΛΙΤΗ** — με τη φύλαξη του ADR-844 §13 μέσα.
 * @related server/auth/citizen-identity.ts · server/auth/mailbox-proof-custody.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Η ΦΥΛΑΞΗ ΕΙΝΑΙ ΑΛΗΘΙΝΗ ΕΔΩ ΚΑΙ ΟΧΙ ΠΛΑΣΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ερώτημα που δεν απαντά καμία σουίτα μεμονωμένα είναι **η σειρά ΑΝΑΜΕΣΑ στα δύο
 * αρχεία**: η εξουδετέρωση (αφαίρεση κωδικού + ανάκληση) οφείλει να έχει γίνει **πριν**
 * τα claims. Γι' αυτό η Firebase, τα claims και το έγγραφο γράφουν σε **ΕΝΑ** ημερολόγιο,
 * και η `mailbox-proof-custody` τρέχει **αυτούσια** πάνω τους.
 */

jest.mock('server-only', () => ({}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS' },
}));

const log: string[] = [];
const getUserByEmailMock = jest.fn();
const createUserMock = jest.fn(async (..._args: unknown[]) => ({ uid: 'uid_born' }));
const createCustomTokenMock = jest.fn(async (..._args: unknown[]) => {
  log.push('token');
  return 'tok_custom';
});
const updateUserMock = jest.fn(async (..._args: unknown[]) => { log.push('updateUser'); });
const revokeMock = jest.fn(async (..._args: unknown[]) => { log.push('revoke'); });
const docSetMock = jest.fn(async (..._args: unknown[]) => { log.push('doc'); });

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    getUserByEmail: (...args: unknown[]) => getUserByEmailMock(...args),
    createUser: (...args: unknown[]) => createUserMock(...args),
    createCustomToken: (...args: unknown[]) => createCustomTokenMock(...args),
    updateUser: (...args: unknown[]) => updateUserMock(...args),
    revokeRefreshTokens: (...args: unknown[]) => revokeMock(...args),
    generatePasswordResetLink: async () => 'https://auth.example/reset',
  }),
  getAdminFirestore: () => ({
    collection: () => ({ doc: () => ({ set: (...args: unknown[]) => docSetMock(...args) }) }),
  }),
}));

const setClaimsMock = jest.fn(async (..._args: unknown[]) => { log.push('claims'); });
jest.mock('@/lib/auth/set-claims-with-mirror', () => ({
  setClaimsWithMirror: (...args: unknown[]) => setClaimsMock(...args),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  sentryCaptureMessage: jest.fn(),
}));

jest.mock('@/services/ai-pipeline/shared/mailgun-sender', () => ({
  sendReplyViaMailgun: jest.fn(async () => ({ success: true })),
}));

import { ensureCitizenIdentity } from '../citizen-identity';

interface RecordSeed {
  readonly emailVerified?: boolean;
  readonly providers?: readonly string[];
  readonly mfa?: boolean;
  readonly claims?: Record<string, unknown>;
  readonly disabled?: boolean;
}

/** Ο λογαριασμός που «βρίσκει» το `getUserByEmail`. */
function existing(seed: RecordSeed = {}) {
  return {
    uid: 'uid_existing',
    disabled: seed.disabled ?? false,
    customClaims: seed.claims,
    emailVerified: seed.emailVerified ?? false,
    providerData: (seed.providers ?? ['password']).map((providerId) => ({ providerId })),
    multiFactor: seed.mfa ? { enrolledFactors: [{ uid: 'f_1', factorId: 'totp' }] } : undefined,
  };
}

function input(holderUid: string | null) {
  const sessionHolder = jest.fn(async () => holderUid);
  return {
    sessionHolder,
    value: { email: 'maria@example.com', displayName: 'Μαρία Δ.', sessionHolder },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  log.length = 0;
});

describe('Τ — η φύλαξη ΜΕΣΑ στην ακολουθία', () => {
  it('🔴 Τ1 — Η ΕΠΙΘΕΣΗ: αφαίρεση → ανάκληση → ΜΕΤΑ claims → κλειδί στο θύμα', async () => {
    getUserByEmailMock.mockResolvedValue(existing());
    const { value } = input(null);

    const outcome = await ensureCitizenIdentity(value);

    expect(outcome).toEqual({
      kind: 'ready', uid: 'uid_existing', customToken: 'tok_custom', born: false,
    });
    // 🔴 **Η ΣΕΙΡΑ ΑΝΑΜΕΣΑ ΣΤΑ ΔΥΟ ΑΡΧΕΙΑ**: claims **πριν** την ανάκληση θα άφηναν το
    //    παλιό refresh token του επιτιθέμενου να κόψει ID token **με** τον νέο ρόλο.
    expect(log).toEqual(['updateUser', 'revoke', 'claims', 'doc', 'token']);
    expect(updateUserMock).toHaveBeenCalledWith('uid_existing', {
      emailVerified: true,
      providersToUnlink: ['password'],
    });
  });

  it('🔑 Τ2 — Ο ΝΟΜΙΜΟΣ ΚΑΤΟΧΟΣ: μόνο επιβεβαίωση — ΚΑΜΙΑ ανάκληση, κωδικός ανέπαφος', async () => {
    getUserByEmailMock.mockResolvedValue(existing());
    const { value } = input('uid_existing');

    await ensureCitizenIdentity(value);

    expect(updateUserMock).toHaveBeenCalledWith('uid_existing', { emailVerified: true });
    expect(revokeMock).not.toHaveBeenCalled();
    expect(log).toEqual(['updateUser', 'claims', 'doc', 'token']);
  });

  it('🔐 Τ3 — 2ος παράγοντας: ΚΑΝΕΝΑ κλειδί, αλλά ταυτότητα ΕΤΟΙΜΗ (η πράξη θα γραφτεί)', async () => {
    getUserByEmailMock.mockResolvedValue(existing({
      emailVerified: true, mfa: true, claims: { globalRole: 'company_admin', companyId: 'comp_1' },
    }));
    const { value } = input(null);

    const outcome = await ensureCitizenIdentity(value);

    expect(outcome).toEqual({ kind: 'ready', uid: 'uid_existing', customToken: null, born: false });
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });

  it('Τ4 — απενεργοποιημένος: άρνηση, και ο κάτοχος ΔΕΝ ρωτιέται, ΚΑΜΙΑ γραφή', async () => {
    getUserByEmailMock.mockResolvedValue(existing({ disabled: true }));
    const { value, sessionHolder } = input(null);

    expect(await ensureCitizenIdentity(value)).toEqual({ kind: 'refused', reason: 'account-disabled' });
    expect(sessionHolder).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it('🔑 Τ5 — επιβεβαιωμένος: ο κάτοχος ΔΕΝ ρωτιέται (κόστος), κανένα διαπιστευτήριο δεν αγγίζεται', async () => {
    getUserByEmailMock.mockResolvedValue(existing({ emailVerified: true }));
    const { value, sessionHolder } = input(null);

    await ensureCitizenIdentity(value);

    expect(sessionHolder).not.toHaveBeenCalled();
    expect(log).toEqual(['claims', 'doc', 'token']);
  });

  it('Τ6 — γεννημένος τώρα: επιβεβαιωμένος εξ ορισμού — ο κάτοχος ΔΕΝ ρωτιέται', async () => {
    getUserByEmailMock.mockRejectedValue({ code: 'auth/user-not-found' });
    const { value, sessionHolder } = input(null);

    const outcome = await ensureCitizenIdentity(value);

    expect(outcome).toEqual({ kind: 'ready', uid: 'uid_born', customToken: 'tok_custom', born: true });
    expect(sessionHolder).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('🔴 Τ7 — ΚΛΕΙΣΤΑ ΣΕ ΑΠΟΤΥΧΙΑ: αν η εξουδετέρωση δεν έγινε, ΚΑΝΕΝΑΣ ρόλος, ΚΑΝΕΝΑ κλειδί', async () => {
    getUserByEmailMock.mockResolvedValue(existing());
    updateUserMock.mockRejectedValueOnce(new Error('auth/internal-error'));
    const { value } = input(null);

    expect(await ensureCitizenIdentity(value)).toEqual({
      kind: 'refused', reason: 'identity-unavailable',
    });
    expect(setClaimsMock).not.toHaveBeenCalled();
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });

  it('Τ8 — ανεπιβεβαίωτος ΜΕ ταυτότητα (π.χ. εγκεκριμένος από διαχειριστή): εξουδετερώνεται, ο ρόλος ΔΕΝ υποβαθμίζεται', async () => {
    getUserByEmailMock.mockResolvedValue(existing({
      claims: { globalRole: 'company_admin', companyId: 'comp_1' },
    }));
    const { value } = input(null);

    await ensureCitizenIdentity(value);

    expect(log).toEqual(['updateUser', 'revoke', 'token']);
    expect(setClaimsMock).not.toHaveBeenCalled();
  });
});
