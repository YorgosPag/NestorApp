/**
 * @fileoverview **Ο διάλογος και το πεδίο της αλλαγής email** — τι ΒΛΕΠΕΙ ο άνθρωπος (ADR-850).
 * @related AccountEmailChangeDialog.tsx · AccountEmailField.tsx
 *
 * 🔴 Η άγκυρα που καμία σουίτα υπηρεσίας δεν μπορεί να κάνει είναι η **Ω1β**: ο διάλογος
 * ζει σε portal, αλλά τα γεγονότα του React ανεβαίνουν στο **δέντρο του React** — δηλαδή
 * στη φόρμα του προφίλ. Χωρίς `stopPropagation`, το «Αποστολή συνδέσμου» θα αποθήκευε
 * **και** το προφίλ. Εδώ ο διάλογος αποδίδεται μέσα σε εξωτερική `<form>` και ρωτιέται.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const requestMock = jest.fn();
const completeMock = jest.fn();
jest.mock('@/auth/account-email-change', () => ({
  requestAccountEmailChange: (...args: unknown[]) => requestMock(...args),
  completeEmailChangeWithSecondFactor: (...args: unknown[]) => completeMock(...args),
}));

const USER = { email: 'maria@example.com' };
jest.mock('@/lib/firebase', () => ({ auth: { currentUser: { email: 'maria@example.com' } } }));

const resetPasswordMock = jest.fn();
let providerIds: string[] = ['password'];
jest.mock('@/auth', () => ({
  useAuth: () => ({ resetPassword: resetPasswordMock }),
  useAuthProviderInfo: () => ({ providerIds }),
}));

import { AccountEmailChangeDialog } from '../AccountEmailChangeDialog';
import { AccountEmailField } from '../AccountEmailField';
import { EMAIL_CHANGE_ISSUE_KEYS, EMAIL_CHANGE_KEYS, EMAIL_CHANGE_ROUTE_HINT_KEYS } from '../email-change-labels';

const outerSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());

function renderDialog(): void {
  render(
    <form onSubmit={outerSubmit}>
      <AccountEmailChangeDialog open currentEmail="maria@example.com" onClose={jest.fn()} />
    </form>,
  );
}

async function fillCredentials(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(EMAIL_CHANGE_KEYS.newLabel), 'new@example.com');
  await user.type(screen.getByLabelText(EMAIL_CHANGE_KEYS.currentPassword), 'pw');
  await user.click(screen.getByRole('button', { name: EMAIL_CHANGE_KEYS.submit }));
}

beforeEach(() => {
  jest.clearAllMocks();
  providerIds = ['password'];
  resetPasswordMock.mockResolvedValue(undefined);
});

describe('Ω — ο διάλογος', () => {
  it('🔑 Ω1 — στοιχεία → «κοιτάξτε τα εισερχόμενα της νέας διεύθυνσης»', async () => {
    requestMock.mockResolvedValue({ kind: 'sent', newEmail: 'new@example.com' });
    renderDialog();

    await fillCredentials();

    expect(requestMock).toHaveBeenCalledWith(USER, 'new@example.com', 'pw');
    expect(await screen.findByText(EMAIL_CHANGE_KEYS.sentTitle)).toBeInTheDocument();
  });

  it('🔴 Ω1β — η υποβολή του διαλόγου ΔΕΝ πατά τη φόρμα του προφίλ (portal ≠ δέντρο React)', async () => {
    requestMock.mockResolvedValue({ kind: 'sent', newEmail: 'new@example.com' });
    renderDialog();

    await fillCredentials();

    await waitFor(() => expect(requestMock).toHaveBeenCalled());
    expect(outerSubmit).not.toHaveBeenCalled();
  });

  it('Ω2 — λάθος κωδικός: ο λόγος ονομαστικά, και ο άνθρωπος μένει στο ίδιο βήμα', async () => {
    requestMock.mockResolvedValue({ kind: 'issue', issue: 'wrong-password' });
    renderDialog();

    await fillCredentials();

    expect(await screen.findByText(EMAIL_CHANGE_ISSUE_KEYS['wrong-password'])).toBeInTheDocument();
    expect(screen.getByLabelText(EMAIL_CHANGE_KEYS.newLabel)).toBeInTheDocument();
  });

  it('🔐 Ω3 — MFA: βήμα κωδικού, και ο κωδικός φτάνει με την ΙΔΙΑ νέα διεύθυνση', async () => {
    requestMock.mockResolvedValue({ kind: 'second-factor', resolver: { hints: [] } });
    completeMock.mockResolvedValue({ kind: 'sent', newEmail: 'new@example.com' });
    renderDialog();

    await fillCredentials();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(EMAIL_CHANGE_KEYS.codeLabel), '123456');
    await user.click(screen.getByRole('button', { name: EMAIL_CHANGE_KEYS.verify }));

    expect(completeMock).toHaveBeenCalledWith(USER, { hints: [] }, '123456', 'new@example.com');
    expect(await screen.findByText(EMAIL_CHANGE_KEYS.sentTitle)).toBeInTheDocument();
  });
});

describe('Φ — το πεδίο του προφίλ, ανά πάροχο', () => {
  it('🔑 Φ1 — λογαριασμός με κωδικό: «Αλλαγή email», ΤΙΠΟΤΑ «δεν μπορεί να αλλάξει»', () => {
    render(<AccountEmailField email="maria@example.com" />);

    expect(screen.getByRole('button', { name: EMAIL_CHANGE_KEYS.open })).toHaveAttribute('type', 'button');
    expect(screen.getByText(EMAIL_CHANGE_ROUTE_HINT_KEYS.password)).toBeInTheDocument();
  });

  it('🔴 Φ2 — ΜΟΝΟ Google: ΚΑΝΕΝΑ κουμπί αλλαγής (διπλός πάροχος) — πρώτα κωδικός (Figma)', async () => {
    providerIds = ['google.com'];
    render(<AccountEmailField email="maria@example.com" />);

    expect(screen.queryByRole('button', { name: EMAIL_CHANGE_KEYS.open })).toBeNull();
    expect(screen.getByText(EMAIL_CHANGE_ROUTE_HINT_KEYS['provider-managed'])).toBeInTheDocument();

    // ⚠️ `findBy`: η ενέργεια φορτώνεται **τεμπέλικα** (όριο κλειστότητας, CHECK 3.34).
    await userEvent.setup().click(await screen.findByRole('button', { name: EMAIL_CHANGE_KEYS.setPassword }));

    expect(resetPasswordMock).toHaveBeenCalledWith('maria@example.com');
    expect(await screen.findByText(EMAIL_CHANGE_KEYS.setPasswordSent)).toBeInTheDocument();
  });

  it('Φ3 — πολίτης χωρίς πάροχο: η δική του υπόδειξη', () => {
    providerIds = [];
    render(<AccountEmailField email="maria@example.com" />);

    expect(screen.getByText(EMAIL_CHANGE_ROUTE_HINT_KEYS['needs-password'])).toBeInTheDocument();
  });
});
