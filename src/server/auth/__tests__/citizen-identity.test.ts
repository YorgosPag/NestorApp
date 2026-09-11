/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΚΟΛΟΥΘΙΑ ΤΗΣ ΤΑΥΤΟΤΗΤΑΣ ΤΟΥ ΠΟΛΙΤΗ** — με τη φύλαξη του ADR-844 §13 μέσα.
 * @related server/auth/citizen-identity.ts · server/auth/mailbox-proof-custody.ts ·
 *          server/auth/account-reprovision.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Η ΦΥΛΑΞΗ ΕΙΝΑΙ ΑΛΗΘΙΝΗ ΕΔΩ ΚΑΙ ΟΧΙ ΠΛΑΣΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ερώτημα που δεν απαντά καμία σουίτα μεμονωμένα είναι **η σειρά ΑΝΑΜΕΣΑ στα
 * αρχεία**: η εξουδετέρωση (επαναδημιουργία, ίδιο uid — §13.8) οφείλει να έχει γίνει
 * **πριν** τα claims. Γι' αυτό η επαναδημιουργία, τα claims και το έγγραφο γράφουν σε
 * **ΕΝΑ** ημερολόγιο, και η `mailbox-proof-custody` τρέχει **αυτούσια** πάνω τους.
 */

jest.mock('server-only', () => ({}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS' },
}));

const log: string[] = [];
const getUserByEmailMock = jest.fn();
const getUserMock = jest.fn();
const createUserMock = jest.fn(async (..._args: unknown[]) => ({ uid: 'uid_born' }));
const createCustomTokenMock = jest.fn(async (..._args: unknown[]) => {
  log.push('token');
  return 'tok_custom';
});
const updateUserMock = jest.fn(async (..._args: unknown[]) => { log.push('updateUser'); });
const docSetMock = jest.fn(async (..._args: unknown[]) => { log.push('doc'); });

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    getUserByEmail: (...args: unknown[]) => getUserByEmailMock(...args),
    getUser: (...args: unknown[]) => getUserMock(...args),
    createUser: (...args: unknown[]) => createUserMock(...args),
    createCustomToken: (...args: unknown[]) => createCustomTokenMock(...args),
    updateUser: (...args: unknown[]) => updateUserMock(...args),
    generatePasswordResetLink: async () => 'https://auth.example/__/auth/action?mode=resetPassword&oobCode=1',
  }),
  getAdminFirestore: () => ({
    collection: () => ({ doc: () => ({ set: (...args: unknown[]) => docSetMock(...args) }) }),
  }),
}));

const reprovisionMock = jest.fn(async (..._args: unknown[]) => {
  log.push('reprovision');
  return { removedProviders: ['password'] };
});
const resumeMock = jest.fn(async (..._args: unknown[]): Promise<string | null> => null);
jest.mock('../account-reprovision', () => ({
  reprovisionAuthAccount: (...args: unknown[]) => reprovisionMock(...args),
  resumeInterruptedReprovision: (...args: unknown[]) => resumeMock(...args),
}));

jest.mock('../auth-action-link', () => ({
  ownedActionLink: () => 'https://nestorconstruct.gr/auth/action?mode=resetPassword&oobCode=1',
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
  readonly uid?: string;
  readonly emailVerified?: boolean;
  readonly providers?: readonly string[];
  readonly mfa?: boolean;
  readonly claims?: Record<string, unknown>;
  readonly disabled?: boolean;
}

/** Ο λογαριασμός που «βρίσκει» το `getUserByEmail`. */
function existing(seed: RecordSeed = {}) {
  return {
    uid: seed.uid ?? 'uid_existing',
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
  it('🔴 Τ1 — Η ΕΠΙΘΕΣΗ: επαναδημιουργία → ΜΕΤΑ claims → κλειδί στο θύμα', async () => {
    getUserByEmailMock.mockResolvedValue(existing());
    const { value } = input(null);

    const outcome = await ensureCitizenIdentity(value);

    expect(outcome).toEqual({
      kind: 'ready', uid: 'uid_existing', customToken: 'tok_custom', born: false,
    });
    // 🔴 **Η ΣΕΙΡΑ ΑΝΑΜΕΣΑ ΣΤΑ ΑΡΧΕΙΑ**: claims **πριν** την επαναδημιουργία θα άφηναν το
    //    παλιό refresh token του επιτιθέμενου να κόψει ID token **με** τον νέο ρόλο.
    expect(log).toEqual(['reprovision', 'claims', 'doc', 'token']);
    expect(reprovisionMock).toHaveBeenCalledWith('uid_existing', 'maria@example.com');
  });

  it('🔑 Τ2 — Ο ΝΟΜΙΜΟΣ ΚΑΤΟΧΟΣ: μόνο επιβεβαίωση — τίποτα δεν ξαναχτίζεται', async () => {
    getUserByEmailMock.mockResolvedValue(existing());
    const { value } = input('uid_existing');

    await ensureCitizenIdentity(value);

    expect(updateUserMock).toHaveBeenCalledWith('uid_existing', { emailVerified: true });
    expect(reprovisionMock).not.toHaveBeenCalled();
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
    expect(resumeMock).toHaveBeenCalledWith('maria@example.com');
    expect(sessionHolder).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('🔴 Τ7 — ΚΛΕΙΣΤΑ ΣΕ ΑΠΟΤΥΧΙΑ: αν η εξουδετέρωση δεν έγινε, ΚΑΝΕΝΑΣ ρόλος, ΚΑΝΕΝΑ κλειδί', async () => {
    getUserByEmailMock.mockResolvedValue(existing());
    reprovisionMock.mockRejectedValueOnce(new Error('auth/internal-error'));
    const { value } = input(null);

    expect(await ensureCitizenIdentity(value)).toEqual({
      kind: 'refused', reason: 'identity-unavailable',
    });
    expect(setClaimsMock).not.toHaveBeenCalled();
    expect(createCustomTokenMock).not.toHaveBeenCalled();
  });

  it('Τ8 — ανεπιβεβαίωτος ΜΕ ταυτότητα (π.χ. εγκεκριμένος από διαχειριστή): ξαναχτίζεται, ο ρόλος ΔΕΝ υποβαθμίζεται', async () => {
    getUserByEmailMock.mockResolvedValue(existing({
      claims: { globalRole: 'company_admin', companyId: 'comp_1' },
    }));
    const { value } = input(null);

    await ensureCitizenIdentity(value);

    // Τα claims τα **επαναφέρει** η επαναδημιουργία (δική της άγκυρα Ρ3)· εδώ ΔΕΝ γράφονται νέα.
    expect(log).toEqual(['reprovision', 'token']);
    expect(setClaimsMock).not.toHaveBeenCalled();
  });

  it('🔴 Τ9 — ΔΙΑΚΟΠΕΙΣΑ ΔΙΕΚΔΙΚΗΣΗ: «δεν βρέθηκε» + ημερολόγιο ⇒ ΙΔΙΟ uid, ΚΑΝΕΝΑΣ νέος λογαριασμός', async () => {
    getUserByEmailMock.mockRejectedValue({ code: 'auth/user-not-found' });
    resumeMock.mockResolvedValueOnce('uid_victim');
    getUserMock.mockResolvedValue(existing({ uid: 'uid_victim', emailVerified: true, providers: [] }));
    const { value } = input(null);

    const outcome = await ensureCitizenIdentity(value);

    expect(outcome).toEqual({ kind: 'ready', uid: 'uid_victim', customToken: 'tok_custom', born: false });
    expect(createUserMock).not.toHaveBeenCalled();
  });
});
