/**
 * @fileoverview **Η λογική της σελίδας ενεργειών email** (ADR-850).
 * @related auth/components/useAuthActionCode.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΡΩΤΟΥΝ ΑΥΤΕΣ ΟΙ ΑΓΚΥΡΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - **Λ1/Λ2** — μετά την αλλαγή email αποσυνδέεται **μόνο** ο κάτοχος του λογαριασμού που
 *   άλλαξε· άλλος συνδεδεμένος λογαριασμός **μένει**.
 * - **Λ3** — ο κωδικός μιας χρήσης εξαργυρώνεται **μία** φορά, και στο StrictMode.
 * - **Λ4** — η ανάκτηση προσφέρει νέο κωδικό στη διεύθυνση που **αποκαταστάθηκε**.
 * - **Λ7-Λ9** — ο **ξοδεμένος** σύνδεσμος επιβεβαίωσης (ADR-867 Β9(β) Ε7): επιβεβαιωμένος ⇒ επιτυχία
 *   «ήδη»· χωρίς συνεδρία ⇒ ουδέτερη φράση· ανεπιβεβαίωτος ⇒ το σφάλμα του κωδικού.
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';

const applyMock = jest.fn();
const checkMock = jest.fn();
const confirmResetMock = jest.fn();
const verifyResetMock = jest.fn();
jest.mock('firebase/auth', () => ({
  applyActionCode: (...args: unknown[]) => applyMock(...args),
  checkActionCode: (...args: unknown[]) => checkMock(...args),
  confirmPasswordReset: (...args: unknown[]) => confirmResetMock(...args),
  verifyPasswordResetCode: (...args: unknown[]) => verifyResetMock(...args),
}));

interface FakeUser {
  email: string | null;
  emailVerified?: boolean;
  reload?: () => Promise<void>;
}
const firebaseAuth: { currentUser: FakeUser | null } = { currentUser: null };
jest.mock('@/lib/firebase', () => ({
  get auth() {
    return firebaseAuth;
  },
}));

const signOutMock = jest.fn();
const resetPasswordMock = jest.fn();
jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuthOptional: () => ({ signOut: signOutMock, resetPassword: resetPasswordMock }),
}));

import { useAuthActionCode } from '../useAuthActionCode';
import type { AuthActionMode } from '../auth-action-modes';

const t = (key: string): string => key;

function render(mode: AuthActionMode | null, code: string | null = 'oob_1', strict = false) {
  return renderHook(() => useAuthActionCode(mode, code, t), {
    wrapper: strict ? React.StrictMode : undefined,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  firebaseAuth.currentUser = null;
  applyMock.mockResolvedValue(undefined);
  signOutMock.mockResolvedValue(undefined);
  resetPasswordMock.mockResolvedValue(undefined);
  checkMock.mockResolvedValue({ data: { email: 'new@example.com', previousEmail: 'old@example.com' } });
});

describe('Λ — αλλαγή και ανάκτηση email', () => {
  it('🔑 Λ1 — αλλαγή: ελέγχει → εφαρμόζει → αποσυνδέει ΤΟΝ ΚΑΤΟΧΟ, και ονομάζει τη ΝΕΑ διεύθυνση', async () => {
    firebaseAuth.currentUser = { email: 'Old@Example.com' };
    const { result } = render('verifyAndChangeEmail');

    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.state).toMatchObject({ mode: 'verifyAndChangeEmail', email: 'new@example.com' });
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(checkMock.mock.invocationCallOrder[0]).toBeLessThan(applyMock.mock.invocationCallOrder[0]);
  });

  it('🔴 Λ2 — ΑΛΛΟΣ λογαριασμός συνδεδεμένος σε αυτόν τον φυλλομετρητή: ΔΕΝ αποσυνδέεται', async () => {
    firebaseAuth.currentUser = { email: 'someone-else@example.com' };
    const { result } = render('verifyAndChangeEmail');

    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('🔴 Λ3 — ΜΙΑ εξαργύρωση του κωδικού μιας χρήσης, ΚΑΙ στο StrictMode', async () => {
    const { result } = render('verifyEmail', 'oob_1', true);

    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(applyMock).toHaveBeenCalledTimes(1);
  });

  it('🔑 Λ4 — ανάκτηση: νέος κωδικός στη διεύθυνση που ΑΠΟΚΑΤΑΣΤΑΘΗΚΕ', async () => {
    checkMock.mockResolvedValue({ data: { email: 'restored@example.com', previousEmail: 'attacker@example.com' } });
    const { result } = render('recoverEmail');
    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.state.email).toBe('restored@example.com');

    await act(async () => { await result.current.sendRecoveryReset(); });

    expect(resetPasswordMock).toHaveBeenCalledWith('restored@example.com');
    expect(result.current.recoveryReset).toBe('sent');
  });

  it('Λ5 — άγνωστο mode: ΚΑΜΙΑ κλήση στη Firebase', async () => {
    const { result } = render(null);

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.errorMessage).toBe('action.errors.unknownMode');
    expect(applyMock).not.toHaveBeenCalled();
  });

  it('Λ6 — η νέα διεύθυνση πιάστηκε στο μεταξύ: ο λόγος ΟΝΟΜΑΣΤΙΚΑ', async () => {
    applyMock.mockRejectedValue(Object.assign(new Error('in use'), { code: 'auth/email-already-in-use' }));
    const { result } = render('verifyAndChangeEmail');

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.errorMessage).toBe('action.errors.emailInUse');
    expect(signOutMock).not.toHaveBeenCalled();
  });
});

describe('Λ — ο ξοδεμένος σύνδεσμος επιβεβαίωσης', () => {
  const spent = () => Object.assign(new Error('used'), { code: 'auth/invalid-action-code' });

  it('🔴 Λ7 — συνδεδεμένος και ΗΔΗ επιβεβαιωμένος (μετά από reload): επιτυχία «ήδη», όχι «Σφάλμα»', async () => {
    applyMock.mockRejectedValue(spent());
    const user: FakeUser = { email: 'me@example.com', emailVerified: false };
    user.reload = jest.fn(async () => { user.emailVerified = true; });
    firebaseAuth.currentUser = user;
    const { result } = render('verifyEmail');

    await waitFor(() => expect(result.current.state.status).toBe('success'));
    expect(result.current.state).toMatchObject({ mode: 'verifyEmail', alreadyDone: true, errorMessage: null });
    expect(user.reload).toHaveBeenCalledTimes(1);
  });

  it('🔒 Λ8 — χωρίς συνεδρία: ουδέτερη φράση που λέει τι να κάνει, χωρίς ισχυρισμό για τον λογαριασμό', async () => {
    applyMock.mockRejectedValue(spent());
    const { result } = render('verifyEmail');

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.errorMessage).toBe('action.errors.verifyLinkSpent');
  });

  it('Λ9 — συνδεδεμένος αλλά ΑΝΕΠΙΒΕΒΑΙΩΤΟΣ: το σφάλμα του κωδικού, ποτέ ψεύτικη επιτυχία', async () => {
    applyMock.mockRejectedValue(spent());
    firebaseAuth.currentUser = { email: 'me@example.com', emailVerified: false, reload: jest.fn(async () => undefined) };
    const { result } = render('verifyEmail');

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.errorMessage).toBe('action.errors.invalidCode');
  });
});
