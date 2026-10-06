/**
 * @jest-environment jsdom
 *
 * @fileoverview **Η ΠΥΛΗ ΕΠΙΒΕΒΑΙΩΣΗΣ EMAIL** πριν από τον δεύτερο παράγοντα (ADR-851 Φ2).
 * @related components/account/email-verification/useEmailVerificationGate.ts · EmailVerificationGate.tsx
 *
 * 🔴 Το περιστατικό (2026-10-06): διαχειριστής νέου γραφείου με ανεπιβεβαίωτο email πάτησε «Ενεργοποίηση 2FA»,
 * η Firebase απάντησε `auth/unverified-email`, η οθόνη **δεν έδειξε τίποτα** και **κανένα** κουμπί δεν ξανάστελνε
 * το μήνυμα. Κάθε test εδώ κρατά έναν από τους τρεις όρους που έλειπαν: **λέγεται πριν** · **στέλνεται ξανά** ·
 * **ανοίγει μόνη της**.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import el from '@/i18n/locales/el/common-account.json';

function resolve(key: string, vars?: Record<string, string>): string {
  let node: unknown = el;
  for (const step of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[step];
  if (typeof node !== 'string') return `⛔ ΑΛΥΤΟ: ${key}`;
  return node.replace(/\{(\w+)\}/g, (_, name: string) => vars?.[name] ?? `{${name}}`);
}

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, vars?: Record<string, string>) => resolve(key, vars), i18n: { language: 'el' } }),
}));

const EMAIL = 'grafeio@example.com';

interface FakeUser {
  emailVerified: boolean;
  reload: jest.Mock<Promise<void>, []>;
  getIdToken: jest.Mock<Promise<string>, [boolean?]>;
}

const firebase: { currentUser: FakeUser | null } = { currentUser: null };
jest.mock('@/lib/firebase', () => ({
  auth: {
    get currentUser() {
      return firebase.currentUser;
    },
  },
}));

const sendVerificationEmail = jest.fn<Promise<void>, []>();
jest.mock('@/auth', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: EMAIL }, sendVerificationEmail }),
}));

let becameVisible: () => void = () => undefined;
jest.mock('@/hooks/useTabVisibilityRefresh', () => ({
  useTabVisibilityRefresh: (onVisible: () => void) => {
    becameVisible = onVisible;
  },
}));

import { EmailVerificationGate } from '../email-verification/EmailVerificationGate';
import { useEmailVerificationGate } from '../email-verification/useEmailVerificationGate';

const OPEN = 'ΑΝΟΙΧΤΗ';
const UNKNOWN = 'ΑΓΝΩΣΤΟ';

function Host(): React.JSX.Element {
  const gate = useEmailVerificationGate();
  if (gate.standing === 'unverified') return <EmailVerificationGate gate={gate} />;
  return <p>{gate.standing === 'verified' ? OPEN : UNKNOWN}</p>;
}

function userWith(emailVerified: boolean, verifiedAfterReload = emailVerified): FakeUser {
  const user: FakeUser = {
    emailVerified,
    reload: jest.fn(async () => {
      user.emailVerified = verifiedAfterReload;
    }),
    getIdToken: jest.fn(async () => 'token'),
  };
  return user;
}

const TITLE = resolve('twoFactor.emailGate.title');
const RESEND = resolve('twoFactor.emailGate.resend');
const RECHECK = resolve('twoFactor.emailGate.recheck');

beforeEach(() => {
  sendVerificationEmail.mockReset();
  sendVerificationEmail.mockResolvedValue(undefined);
});

describe('Π — λέγεται ΠΡΙΝ από το κουμπί', () => {
  it('Π1 — ανεπιβεβαίωτο email ⇒ η πύλη, με τη διεύθυνση γραμμένη', async () => {
    firebase.currentUser = userWith(false);
    render(<Host />);

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(screen.getByText(resolve('twoFactor.emailGate.body', { email: EMAIL }))).toBeTruthy();
  });

  it('🔑 Π2 — επιβεβαιωμένο ⇒ ΠΟΤΕ η πύλη, και καμία ερώτηση στο δίκτυο', async () => {
    const user = userWith(true);
    firebase.currentUser = user;
    render(<Host />);

    expect(await screen.findByText(OPEN)).toBeTruthy();
    expect(user.reload).not.toHaveBeenCalled();
  });

  it('🔑 Π3 — ΑΓΝΩΣΤΟ ≠ ΑΝΕΠΙΒΕΒΑΙΩΤΟ: χωρίς χρήστη η πύλη δεν ισχυρίζεται τίποτα', async () => {
    firebase.currentUser = null;
    render(<Host />);

    await waitFor(() => expect(screen.getByText(UNKNOWN)).toBeTruthy());
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('🔑 Π4 — το cache λέει «όχι» αλλά το Auth «ναι» ⇒ ανοιχτή, ΚΑΙ το token ανανεώνεται', async () => {
    const user = userWith(false, true);
    firebase.currentUser = user;
    render(<Host />);

    expect(await screen.findByText(OPEN)).toBeTruthy();
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });
});

describe('Σ — στέλνεται ΞΑΝΑ', () => {
  it('Σ1 — «στείλτε ξανά» ⇒ ο ΕΝΑΣ δρόμος του context, και ο άνθρωπος μαθαίνει πού πήγε', async () => {
    firebase.currentUser = userWith(false);
    render(<Host />);

    fireEvent.click(await screen.findByText(RESEND));

    expect(await screen.findByText(resolve('twoFactor.emailGate.sent', { email: EMAIL }))).toBeTruthy();
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('Σ2 — φρένο του διακομιστή ⇒ λέγεται ως φρένο, όχι ως αποτυχία', async () => {
    firebase.currentUser = userWith(false);
    sendVerificationEmail.mockRejectedValue({ code: 'auth/too-many-requests' });
    render(<Host />);

    fireEvent.click(await screen.findByText(RESEND));

    expect(await screen.findByText(resolve('twoFactor.emailGate.throttled'))).toBeTruthy();
  });

  it('Σ3 — δεν έφυγε ⇒ σφάλμα, και το κουμπί μένει ΑΝΟΙΧΤΟ για νέα προσπάθεια', async () => {
    firebase.currentUser = userWith(false);
    sendVerificationEmail.mockRejectedValue({ code: 'auth/network-request-failed' });
    render(<Host />);

    fireEvent.click(await screen.findByText(RESEND));

    expect(await screen.findByText(resolve('twoFactor.emailGate.failed'))).toBeTruthy();
    expect((screen.getByText(RESEND).closest('button') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('Α — ανοίγει ΜΟΝΗ ΤΗΣ', () => {
  it('🔑 Α1 — ο σύνδεσμος πατήθηκε σε άλλη καρτέλα· στην επιστροφή η πύλη φεύγει χωρίς πάτημα', async () => {
    const user = userWith(false);
    firebase.currentUser = user;
    render(<Host />);
    await screen.findByText(TITLE);

    user.reload.mockImplementation(async () => {
      user.emailVerified = true;
    });
    await act(async () => {
      becameVisible();
    });

    expect(await screen.findByText(OPEN)).toBeTruthy();
  });

  it('Α2 — «Το επιβεβαίωσα» χωρίς να ισχύει ⇒ η αλήθεια, και η πύλη ΜΕΝΕΙ', async () => {
    firebase.currentUser = userWith(false);
    render(<Host />);

    fireEvent.click(await screen.findByText(RECHECK));

    expect(await screen.findByText(resolve('twoFactor.emailGate.stillUnverified'))).toBeTruthy();
    expect(screen.getByText(TITLE)).toBeTruthy();
  });
});
