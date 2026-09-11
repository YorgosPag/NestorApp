/**
 * @fileoverview **Η ΑΛΛΑΓΗ EMAIL ΛΟΓΑΡΙΑΣΜΟΥ** — επαν-πιστοποίηση, σύνδεσμος, χωρίς απαρίθμηση (ADR-850).
 * @related auth/account-email-change.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΡΩΤΟΥΝ ΑΥΤΕΣ ΟΙ ΑΓΚΥΡΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - **Η σειρά**: κανένας σύνδεσμος χωρίς **επιτυχημένη** επαν-πιστοποίηση.
 * - **Η απαρίθμηση**: η κατειλημμένη διεύθυνση απαντά **ίδια** με την ελεύθερη.
 * - **Ο 2ος παράγοντας**: ένα λάθος ψηφίο δεν στέλνει σύνδεσμο.
 * - **Ποτέ `updateEmail`**: η άγκυρα διαβάζει την **πηγή**.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const reauthMock = jest.fn();
const verifyBeforeUpdateMock = jest.fn();
jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  reauthenticateWithCredential: (...args: unknown[]) => reauthMock(...args),
  verifyBeforeUpdateEmail: (...args: unknown[]) => verifyBeforeUpdateMock(...args),
}));

const getResolverMock = jest.fn();
const verifyTotpMock = jest.fn();
jest.mock('@/services/two-factor/EnterpriseTwoFactorService', () => ({
  twoFactorService: {
    getMfaResolver: (...args: unknown[]) => getResolverMock(...args),
    verifyTotpForSignIn: (...args: unknown[]) => verifyTotpMock(...args),
  },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { FirebaseError } from 'firebase/app';
import type { MultiFactorResolver, User } from 'firebase/auth';

import {
  completeEmailChangeWithSecondFactor,
  requestAccountEmailChange,
} from '../account-email-change';

const USER = { email: 'maria@example.com' } as User;
const RESOLVER = { hints: [] } as unknown as MultiFactorResolver;

function firebaseError(code: string): FirebaseError {
  return new FirebaseError(code, code);
}

beforeEach(() => {
  jest.clearAllMocks();
  reauthMock.mockResolvedValue({});
  verifyBeforeUpdateMock.mockResolvedValue(undefined);
  getResolverMock.mockReturnValue(null);
});

describe('Ψ — βήμα 1: έλεγχος, επαν-πιστοποίηση, σύνδεσμος', () => {
  it('Ψ1 — άκυρη διεύθυνση: τίποτα δεν φεύγει προς τη Firebase', async () => {
    await expect(requestAccountEmailChange(USER, 'δεν-είναι-email', 'pw'))
      .resolves.toEqual({ kind: 'issue', issue: 'invalid-email' });
    expect(reauthMock).not.toHaveBeenCalled();
  });

  it('Ψ2 — ΙΔΙΑ διεύθυνση, με κεφαλαία και κενά: τίποτα δεν φεύγει', async () => {
    await expect(requestAccountEmailChange(USER, '  MARIA@Example.com ', 'pw'))
      .resolves.toEqual({ kind: 'issue', issue: 'same-email' });
    expect(reauthMock).not.toHaveBeenCalled();
  });

  it('🔑 Ψ3 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: κωδικός → σύνδεσμος στη ΚΑΝΟΝΙΚΟΠΟΙΗΜΕΝΗ νέα διεύθυνση', async () => {
    await expect(requestAccountEmailChange(USER, ' New@Example.com ', 'pw'))
      .resolves.toEqual({ kind: 'sent', newEmail: 'new@example.com' });
    expect(reauthMock).toHaveBeenCalledWith(USER, { email: 'maria@example.com', password: 'pw' });
    expect(verifyBeforeUpdateMock).toHaveBeenCalledWith(USER, 'new@example.com');
  });

  it('🔴 Ψ4 — λάθος κωδικός: ΚΑΝΕΝΑΣ σύνδεσμος', async () => {
    reauthMock.mockRejectedValue(firebaseError('auth/invalid-credential'));

    await expect(requestAccountEmailChange(USER, 'new@example.com', 'wrong'))
      .resolves.toEqual({ kind: 'issue', issue: 'wrong-password' });
    expect(verifyBeforeUpdateMock).not.toHaveBeenCalled();
  });

  it('🔴 Ψ5 — ΧΩΡΙΣ ΑΠΑΡΙΘΜΗΣΗ: κατειλημμένη διεύθυνση απαντά ΙΔΙΑ με την ελεύθερη', async () => {
    verifyBeforeUpdateMock.mockRejectedValue(firebaseError('auth/email-already-in-use'));

    await expect(requestAccountEmailChange(USER, 'taken@example.com', 'pw'))
      .resolves.toEqual({ kind: 'sent', newEmail: 'taken@example.com' });
  });

  it('🔐 Ψ6 — λογαριασμός με MFA: στάση στο βήμα του κωδικού, ΚΑΝΕΝΑΣ σύνδεσμος ακόμη', async () => {
    reauthMock.mockRejectedValue(firebaseError('auth/multi-factor-auth-required'));
    getResolverMock.mockReturnValue(RESOLVER);

    await expect(requestAccountEmailChange(USER, 'new@example.com', 'pw'))
      .resolves.toEqual({ kind: 'second-factor', resolver: RESOLVER });
    expect(verifyBeforeUpdateMock).not.toHaveBeenCalled();
  });

  it('Ψ7 — πολλές προσπάθειες: ονομαστικά, όχι «κάτι πήγε στραβά»', async () => {
    reauthMock.mockRejectedValue(firebaseError('auth/too-many-requests'));

    await expect(requestAccountEmailChange(USER, 'new@example.com', 'pw'))
      .resolves.toEqual({ kind: 'issue', issue: 'too-many-attempts' });
  });
});

describe('Ω — βήμα 2 (MFA): ο 6ψήφιος κωδικός', () => {
  it('🔑 Ω1 — σωστός κωδικός ⇒ σύνδεσμος', async () => {
    verifyTotpMock.mockResolvedValue({ result: 'success' });

    await expect(completeEmailChangeWithSecondFactor(USER, RESOLVER, '123456', 'new@example.com'))
      .resolves.toEqual({ kind: 'sent', newEmail: 'new@example.com' });
    expect(verifyTotpMock).toHaveBeenCalledWith(RESOLVER, '123456', 0);
  });

  it('🔴 Ω2 — λάθος κωδικός ⇒ ΚΑΝΕΝΑΣ σύνδεσμος', async () => {
    verifyTotpMock.mockResolvedValue({ result: 'invalid_code' });

    await expect(completeEmailChangeWithSecondFactor(USER, RESOLVER, '000000', 'new@example.com'))
      .resolves.toEqual({ kind: 'issue', issue: 'wrong-code' });
    expect(verifyBeforeUpdateMock).not.toHaveBeenCalled();
  });
});

describe('Π — η πηγή', () => {
  it('🔴 Π1 — ΠΟΤΕ `updateEmail`: το email αλλάζει ΜΟΝΟ από σύνδεσμο στη νέα διεύθυνση', () => {
    const source = readFileSync(join(__dirname, '..', 'account-email-change.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

    expect(code).toMatch(/verifyBeforeUpdateEmail\(/);
    expect(code).not.toMatch(/\bupdateEmail\s*\(/);
  });
});
