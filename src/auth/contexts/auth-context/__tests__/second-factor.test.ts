/**
 * ADR-859 — **Ο ΔΕΥΤΕΡΟΣ ΠΑΡΑΓΟΝΤΑΣ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ, ΟΧΙ ΕΠΙΤΥΧΙΑ.**
 *
 * 🔴 Μετρημένο ζωντανά 2026-09-14: λάθος κωδικός MFA **επέστρεφε κανονικά**, και η φόρμα
 * έφευγε από τη σελίδα (Console `21:41:16.907`). Ο έλεγχος ήταν γραμμένος **δύο φορές**
 * και κανένα test δεν εκτελούσε κανέναν από τους δύο.
 *
 * Μεταλλάξεις που ΠΡΕΠΕΙ να κοκκινίσουν:
 *   - `verify` επιστρέφει `SIGNED_IN` και σε αποτυχία ⇒ Σ2
 *   - `mfaRequired` σταθερό `false` ⇒ Σ1
 */

import { act, renderHook } from '@testing-library/react';
import type { MultiFactorResolver } from 'firebase/auth';
import { useSecondFactor, type SecondFactorService } from '../second-factor';

const RESOLVER = { hints: [{ uid: 'totp-1' }] } as unknown as MultiFactorResolver;

function setup(overrides: Partial<SecondFactorService> = {}) {
  const service: SecondFactorService = {
    getMfaResolver: jest.fn(() => RESOLVER),
    verifyTotpForSignIn: jest.fn(async () => ({ result: 'success' as const })),
    ...overrides,
  };
  const setError = jest.fn();
  const setLoading = jest.fn();
  const hook = renderHook(() => useSecondFactor({ twoFactorService: service, setLoading, setError }));
  return { hook, service, setError };
}

describe('ADR-859 — useSecondFactor', () => {
  it('Σ1 — αίτημα δεύτερου παράγοντα ⇒ υιοθετείται, `mfaRequired` αληθές', () => {
    const { hook } = setup();
    let adopted = false;
    act(() => {
      adopted = hook.result.current.challenge(new Error('mfa'));
    });
    expect(adopted).toBe(true);
    expect(hook.result.current.mfaRequired).toBe(true);
  });

  it('Σ1β — ΠΑΡΟΝΟΜΑΣΤΗΣ: άλλο σφάλμα ⇒ ΔΕΝ υιοθετείται', () => {
    const { hook } = setup({ getMfaResolver: jest.fn(() => null) });
    let adopted = true;
    act(() => {
      adopted = hook.result.current.challenge(new Error('network'));
    });
    expect(adopted).toBe(false);
    expect(hook.result.current.mfaRequired).toBe(false);
  });

  it('Σ2 — ΛΑΘΟΣ ΚΩΔΙΚΟΣ ⇒ ονομασμένη απόρριψη, η εκκρεμότητα ΜΕΝΕΙ, μήνυμα στην οθόνη', async () => {
    const { hook, setError } = setup({
      verifyTotpForSignIn: jest.fn(async () => ({ result: 'invalid_code' as const })),
    });
    act(() => {
      hook.result.current.challenge(new Error('mfa'));
    });
    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.verify('000000');
    });
    expect(outcome).toEqual({ kind: 'rejected', reason: 'invalid-code' });
    expect(hook.result.current.mfaRequired).toBe(true);
    expect(setError).toHaveBeenLastCalledWith(expect.any(String));
  });

  it('Σ3 — σωστός κωδικός ⇒ `signed-in`, η εκκρεμότητα κλείνει', async () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.challenge(new Error('mfa'));
    });
    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.verify('123456');
    });
    expect(outcome).toEqual({ kind: 'signed-in' });
    expect(hook.result.current.mfaRequired).toBe(false);
  });

  it('Σ4 — χωρίς εκκρεμή σύνδεση ⇒ απόρριψη, η υπηρεσία ΔΕΝ ρωτιέται', async () => {
    const { hook, service } = setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.verify('123456');
    });
    expect(outcome).toEqual({ kind: 'rejected', reason: 'no-pending-sign-in' });
    expect(service.verifyTotpForSignIn).not.toHaveBeenCalled();
  });

  it('Σ5 — η υπηρεσία πετά ⇒ `failed`, ποτέ επιτυχία', async () => {
    const { hook } = setup({
      verifyTotpForSignIn: jest.fn(async () => {
        throw new Error('boom');
      }),
    });
    act(() => {
      hook.result.current.challenge(new Error('mfa'));
    });
    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.verify('123456');
    });
    expect(outcome).toEqual({ kind: 'rejected', reason: 'failed' });
  });

  it('Σ6 — ακύρωση ⇒ η εκκρεμότητα κλείνει', () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.challenge(new Error('mfa'));
    });
    act(() => {
      hook.result.current.cancel();
    });
    expect(hook.result.current.mfaRequired).toBe(false);
  });
});
