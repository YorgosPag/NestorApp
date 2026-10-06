/**
 * @jest-environment jsdom
 *
 * @fileoverview **«ΕΙΣΤΕ ΟΝΤΩΣ ΕΣΕΙΣ;»** — η επαν-πιστοποίηση πριν από τον δεύτερο παράγοντα (ADR-851 Φ2).
 * @related auth/account-reauthentication.ts · components/account/identity-confirmation/*
 *
 * 🔴 Το περιστατικό (2026-10-06): διαχειριστής με σύνδεση δύο ωρών πάτησε «Ενεργοποίηση 2FA», η Firebase απάντησε
 * `auth/requires-recent-login` και η οθόνη είπε «Αποτυχία εκκίνησης εγγραφής 2FA» — χωρίς γιατί, χωρίς δρόμο.
 * Κάθε test κρατά έναν όρο: **ζητείται ο κωδικός επιτόπου** · **η πράξη συνεχίζει μόνη της** · **το λάθος λέγεται
 * με το όνομά του** · **όποιος δεν έχει κωδικό δεν βλέπει πεδίο κωδικού**.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import el from '@/i18n/locales/el/common-account.json';
import common from '@/i18n/locales/el/common.json';

function lookup(source: unknown, key: string): unknown {
  let node: unknown = source;
  for (const step of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[step];
  return node;
}

function resolve(key: string): string {
  const found = lookup(el, key) ?? lookup(common, key);
  return typeof found === 'string' ? found : `⛔ ΑΛΥΤΟ: ${key}`;
}

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => resolve(key), i18n: { language: 'el' } }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const reauthMock = jest.fn();
jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  reauthenticateWithCredential: (...args: unknown[]) => reauthMock(...args),
}));

const getResolverMock = jest.fn();
jest.mock('@/services/two-factor/EnterpriseTwoFactorService', () => ({
  twoFactorService: { getMfaResolver: (...args: unknown[]) => getResolverMock(...args) },
}));

interface FakeUser {
  email: string;
  providerData: { providerId: string }[];
}

const firebase: { currentUser: FakeUser | null } = { currentUser: null };
jest.mock('@/lib/firebase', () => ({
  auth: {
    get currentUser() {
      return firebase.currentUser;
    },
  },
}));

import { FirebaseError } from 'firebase/app';

import { RECENT_SIGN_IN_REQUIRED_CODE } from '@/auth/account-reauthentication';

import { IdentityConfirmationStep } from '../identity-confirmation/IdentityConfirmationStep';
import { useIdentityConfirmation } from '../identity-confirmation/useIdentityConfirmation';

const START = 'ΕΝΕΡΓΟΠΟΙΗΣΗ';
const STARTED = 'ΞΕΚΙΝΗΣΕ';
const TEST_PASSWORD = 'σωστός-κωδικός';

/** Ο πάροχος αρνείται την πρώτη φορά (παλιά σύνδεση) και δέχεται μετά την επιβεβαίωση — όπως η Firebase. */
const sensitiveAct = jest.fn<Promise<string | null>, []>();

function Host(): React.JSX.Element {
  const identity = useIdentityConfirmation();
  const [started, setStarted] = React.useState(false);

  async function start(): Promise<void> {
    const refusal = await sensitiveAct();
    if (refusal === RECENT_SIGN_IN_REQUIRED_CODE) identity.request();
    else setStarted(true);
  }

  if (started) return <p>{STARTED}</p>;
  if (identity.prompt.kind === 'open') {
    return (
      <IdentityConfirmationStep
        prompt={identity.prompt}
        busy={identity.busy}
        onSubmit={async (password) => { if (await identity.submit(password)) await start(); }}
        onCancel={identity.cancel}
      />
    );
  }
  return <button type="button" onClick={() => { void start(); }}>{START}</button>;
}

const TITLE = resolve('twoFactor.identity.title');
const CONFIRM = resolve('twoFactor.identity.confirm');
const PASSWORD_LABEL = resolve('account.security.currentPassword');

function passwordUser(): FakeUser {
  return { email: 'grafeio@example.com', providerData: [{ providerId: 'password' }] };
}

async function refuseThenType(password: string): Promise<void> {
  render(<Host />);
  fireEvent.click(screen.getByText(START));
  fireEvent.change(await screen.findByLabelText(PASSWORD_LABEL), { target: { value: password } });
  fireEvent.click(screen.getByText(CONFIRM));
}

beforeEach(() => {
  jest.clearAllMocks();
  reauthMock.mockResolvedValue({});
  getResolverMock.mockReturnValue(null);
  sensitiveAct.mockResolvedValueOnce(RECENT_SIGN_IN_REQUIRED_CODE).mockResolvedValue(null);
  firebase.currentUser = passwordUser();
});

describe('Τ — ο κωδικός ζητείται ΕΠΙΤΟΠΟΥ και η πράξη ΣΥΝΕΧΙΖΕΙ', () => {
  it('🔑 Τ1 — άρνηση «πρόσφατη σύνδεση» ⇒ το βήμα, όχι ένα γενικό «αποτυχία»', async () => {
    render(<Host />);
    fireEvent.click(screen.getByText(START));

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(screen.getByText(resolve('twoFactor.identity.body'))).toBeTruthy();
  });

  it('🔑 Τ2 — σωστός κωδικός ⇒ επαν-πιστοποίηση με ΑΥΤΟΝ, και η πράξη ξανατρέχει χωρίς δεύτερο πάτημα', async () => {
    await refuseThenType(TEST_PASSWORD);

    expect(await screen.findByText(STARTED)).toBeTruthy();
    expect(reauthMock).toHaveBeenCalledWith(firebase.currentUser, { email: 'grafeio@example.com', password: TEST_PASSWORD });
    expect(sensitiveAct).toHaveBeenCalledTimes(2);
  });

  it('Τ3 — «Άκυρο» ⇒ πίσω στο κουμπί, καμία επαν-πιστοποίηση', async () => {
    render(<Host />);
    fireEvent.click(screen.getByText(START));
    await screen.findByText(TITLE);

    fireEvent.click(screen.getByText(resolve('buttons.cancel')));

    expect(screen.getByText(START)).toBeTruthy();
    expect(reauthMock).not.toHaveBeenCalled();
  });
});

describe('Λ — το λάθος λέγεται ΜΕ ΤΟ ΟΝΟΜΑ ΤΟΥ, και η πράξη ΔΕΝ ξανατρέχει', () => {
  it.each([
    ['auth/invalid-credential', 'twoFactor.identity.issues.wrong-password'],
    ['auth/wrong-password', 'twoFactor.identity.issues.wrong-password'],
    ['auth/too-many-requests', 'twoFactor.identity.issues.too-many-attempts'],
    ['auth/network-request-failed', 'twoFactor.identity.issues.failed'],
  ])('🔑 Λ1 — %s ⇒ %s', async (code, key) => {
    reauthMock.mockRejectedValue(new FirebaseError(code, code));
    await refuseThenType('λάθος');

    expect(await screen.findByText(resolve(key))).toBeTruthy();
    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(sensitiveAct).toHaveBeenCalledTimes(1);
  });

  it('Λ2 — ζητήθηκε 2ος παράγοντας ⇒ ΠΟΤΕ «επιβεβαιώθηκε»', async () => {
    reauthMock.mockRejectedValue(new FirebaseError('auth/multi-factor-auth-required', 'mfa'));
    getResolverMock.mockReturnValue({ hints: [] });
    await refuseThenType(TEST_PASSWORD);

    expect(await screen.findByText(resolve('twoFactor.identity.issues.failed'))).toBeTruthy();
    expect(sensitiveAct).toHaveBeenCalledTimes(1);
  });
});

describe('Χ — χωρίς πάροχο κωδικού', () => {
  it('🔑 Χ1 — λογαριασμός μόνο-Google ⇒ ο δρόμος που ΥΠΑΡΧΕΙ, ποτέ πεδίο κωδικού που θα αποτύχει', async () => {
    firebase.currentUser = { email: 'grafeio@example.com', providerData: [{ providerId: 'google.com' }] };
    render(<Host />);
    fireEvent.click(screen.getByText(START));

    expect(await screen.findByText(resolve('twoFactor.identity.signInAgain'))).toBeTruthy();
    await waitFor(() => expect(screen.queryByLabelText(PASSWORD_LABEL)).toBeNull());
    expect(screen.queryByText(CONFIRM)).toBeNull();
  });
});
