/**
 * ADR-900 §8 #2 Β6 — άγκυρες της καρτέλας «Επαληθευμένες» (ανάκληση), από τον ζωντανό έλεγχο 2026-10-05.
 *
 * Ρ1 ο διάλογος **μένει** όσο τρέχει η ανάκληση (πριν: το Radix τον έκλεινε στο κλικ ⇒ καμία ένδειξη προόδου
 *    επί ~10″ επαναλήψεων, εστίαση στο `<body>`) · Ρ2 ο διάλογος λέει **ποιον** αφορά · Ρ3 αποτυχία ⇒ κλείνει και
 *    το λέει η κάρτα · Ρ4 άκυρος ΚΑΕΚ ⇒ το πεδίο δηλώνεται άκυρο και **δεμένο** με το μήνυμα.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));
jest.mock('@/lib/api/api-client-types', () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(public readonly statusCode: number, public readonly errorBody: unknown = null) {
      super('api');
    }
  },
}));

const get = jest.fn();
const post = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) },
}));

import { ApiClientError } from '@/lib/api/api-client-types';
import { REVOCATION_ADMIN_KEYS, REVOKE_ERROR_KEYS } from '@/components/owner-property/ownership-verification-labels';
import { RevocableOwnershipSearch } from '../RevocableOwnershipSearch';

const ITEM = {
  id: 'ovr_1', ownerPropertyId: 'ownp_a', kaek: '050970103021/0/0', reasons: [], sealSigner: null, sealSignedAt: null,
  sealValid: true, claimantName: 'Μαρία Παπαδοπούλου', claimantTaxIdLast3: '123', evidenceFileId: 'file_1',
  createdAt: '2026-09-30T10:00:00.000Z', status: 'verified', decidedAt: '2026-10-01T09:30:00.000Z',
};

/** Μια αποτυχία όπως τη γεννά ο πελάτης API (το mock του module έχει απλό κατασκευαστή). */
function apiFailure(statusCode: number, body: unknown = null): Error {
  const Failure = ApiClientError as unknown as new (statusCode: number, body: unknown) => Error;
  return new Failure(statusCode, body);
}

async function search(query: string): Promise<void> {
  fireEvent.change(screen.getByRole('textbox', { name: REVOCATION_ADMIN_KEYS.searchLabel }), { target: { value: query } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: REVOCATION_ADMIN_KEYS.search }));
  });
}

async function openDialog(): Promise<HTMLElement> {
  get.mockResolvedValue({ revocable: [ITEM] });
  render(<RevocableOwnershipSearch />);
  await search('050970103021');
  fireEvent.click(await screen.findByRole('button', { name: REVOCATION_ADMIN_KEYS.revoke }));
  return screen.findByRole('alertdialog');
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('Ρ — ανάκληση επαληθευμένης κατοχής', () => {
  it('Ρ1 🔴 — ο διάλογος ΜΕΝΕΙ όσο τρέχει η ανάκληση, και κλείνει όταν ολοκληρωθεί', async () => {
    let finish: () => void = () => undefined;
    post.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const dialog = await openDialog();

    await act(async () => {
      fireEvent.click(within(dialog).getAllByRole('button')[1]);
    });

    // Το αίτημα εκκρεμεί: ο διάλογος είναι ακόμη εκεί, και κανένα κουμπί του δεν πατιέται δεύτερη φορά.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    for (const button of within(screen.getByRole('alertdialog')).getAllByRole('button')) expect(button).toBeDisabled();
    expect(post).toHaveBeenCalledTimes(1);

    await act(async () => { finish(); });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    // Η λίστα ξαναδιαβάζεται από τον διακομιστή — όχι αισιόδοξη αφαίρεση μιας μη αναστρέψιμης πράξης.
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('Ρ2 — ο διάλογος λέει ΠΟΙΟΝ αφορά (όνομα · 3 ψηφία ΑΦΜ · ΚΑΕΚ)', async () => {
    const dialog = await openDialog();

    expect(within(dialog).getByText(/Μαρία Παπαδοπούλου · …123/)).toBeInTheDocument();
    expect(within(dialog).getByText('050970103021/0/0')).toBeInTheDocument();
  });

  it('Ρ3 — αποτυχία ⇒ ο διάλογος κλείνει και η κάρτα το λέει με τον κλειστό κωδικό', async () => {
    post.mockRejectedValue(apiFailure(409, { reason: 'not-revocable' }));
    const dialog = await openDialog();

    await act(async () => {
      fireEvent.click(within(dialog).getAllByRole('button')[1]);
    });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(REVOKE_ERROR_KEYS['not-revocable']);
  });

  it('Ρ4 — άκυρος ΚΑΕΚ ⇒ πεδίο `aria-invalid`, δεμένο με την υπόδειξη ΚΑΙ με το μήνυμα', async () => {
    get.mockRejectedValue(apiFailure(400));
    render(<RevocableOwnershipSearch />);
    const field = screen.getByRole('textbox', { name: REVOCATION_ADMIN_KEYS.searchLabel });
    expect(field).toHaveAccessibleDescription(REVOCATION_ADMIN_KEYS.searchHint);

    await search('abc');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(REVOCATION_ADMIN_KEYS.searchMalformed);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(`${REVOCATION_ADMIN_KEYS.searchHint} ${REVOCATION_ADMIN_KEYS.searchMalformed}`);
  });
});
