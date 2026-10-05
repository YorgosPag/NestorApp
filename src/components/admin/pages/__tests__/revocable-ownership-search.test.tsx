/**
 * ADR-900 §8 #2 Β6 — άγκυρες της καρτέλας «Επαληθευμένες» (ανάκληση), από τον ζωντανό έλεγχο 2026-10-05.
 *
 * Ρ1 ο διάλογος **μένει** όσο τρέχει η ανάκληση (πριν: το Radix τον έκλεινε στο κλικ ⇒ καμία ένδειξη προόδου
 *    επί ~10″ επαναλήψεων, εστίαση στο `<body>`) · Ρ2 ο διάλογος λέει **ποιον** αφορά · Ρ3 αποτυχία ⇒ κλείνει και
 *    το λέει η κάρτα · Ρ4 άκυρος ΚΑΕΚ ⇒ το πεδίο δηλώνεται άκυρο και **δεμένο** με το μήνυμα · Ρ5 (μέσα στο Ρ1) όσο
 *    τρέχει, το κουμπί επιβεβαίωσης **κρατά την εστίαση** (`aria-disabled`, όχι `disabled`) και αγνοεί δεύτερο πάτημα.
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

    const [cancel, confirm] = within(dialog).getAllByRole('button');
    confirm.focus();
    await act(async () => {
      fireEvent.click(confirm);
    });

    // Το αίτημα εκκρεμεί: ο διάλογος είναι ακόμη εκεί, και κανένα κουμπί του δεν πατιέται δεύτερη φορά.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(cancel).toBeDisabled();
    // Ρ5 🔴 (ζωντανά 2026-10-05): `disabled` έριχνε την εστίαση στο `<body>`, ΕΞΩ από τον διάλογο, όσο αυτός
    // έδειχνε πρόοδο. Το κουμπί μένει εστιάσιμο (`aria-disabled`), με όνομα, και αγνοεί δεύτερο πάτημα.
    expect(confirm).not.toBeDisabled();
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(confirm).toHaveAccessibleName(REVOCATION_ADMIN_KEYS.revoke);
    expect(document.activeElement).toBe(confirm);
    // Ρ9 (ζωντανά 2026-10-05: 94px → 50px) — η ετικέτα ΜΕΝΕΙ στο κουμπί (αόρατη) ώστε να κρατά το πλάτος του.
    expect(within(confirm).getByText(REVOCATION_ADMIN_KEYS.revoke)).toHaveClass('invisible');
    await act(async () => {
      fireEvent.click(confirm);
    });
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

  it('Ρ6 — ο επιλογέας λόγου έχει ΔΙΚΗ του ετικέτα, όχι το όνομα της πράξης', async () => {
    get.mockResolvedValue({ revocable: [ITEM] });
    render(<RevocableOwnershipSearch />);
    await search('050970103021');

    // Πριν (ζωντανά 2026-10-05): η ετικέτα έγραφε «Ανάκληση», ίδια με το κουμπί — δύο στοιχεία, ένα όνομα.
    expect(await screen.findByRole('combobox', { name: REVOCATION_ADMIN_KEYS.reasonFieldLabel })).toBeInTheDocument();
    expect(REVOCATION_ADMIN_KEYS.reasonFieldLabel).not.toBe(REVOCATION_ADMIN_KEYS.revoke);
    expect(screen.getAllByText(REVOCATION_ADMIN_KEYS.revoke)).toHaveLength(1);
    // Ρ8 — η κάρτα κρέμεται κατευθείαν από το `h1` της σελίδας: `h2`, όχι `h3` (ζωντανά: H1 → H3, χωρίς H2).
    expect(screen.getByRole('heading', { level: 2, name: /Μαρία Παπαδοπούλου/ })).toBeInTheDocument();
  });

  it('Ρ3 — αποτυχία ⇒ ο διάλογος κλείνει και η κάρτα το λέει με τον κλειστό κωδικό', async () => {
    post.mockRejectedValue(apiFailure(409, { reason: 'not-revocable' }));
    const dialog = await openDialog();

    await act(async () => {
      fireEvent.click(within(dialog).getAllByRole('button')[1]);
    });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(REVOKE_ERROR_KEYS['not-revocable']);
    // Ρ7 — η αποτυχία ΦΑΙΝΕΤΑΙ: εικονίδιο από το κεντρικό `Alert`, όχι σκέτο κείμενο στο χρώμα του σώματος.
    expect(alert.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('Ρ4 — άκυρος ΚΑΕΚ ⇒ πεδίο `aria-invalid`, δεμένο με την υπόδειξη ΚΑΙ με το μήνυμα', async () => {
    get.mockRejectedValue(apiFailure(400));
    render(<RevocableOwnershipSearch />);
    const field = screen.getByRole('textbox', { name: REVOCATION_ADMIN_KEYS.searchLabel });
    expect(field).toHaveAccessibleDescription(REVOCATION_ADMIN_KEYS.searchHint);

    await search('abc');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(REVOCATION_ADMIN_KEYS.searchMalformed);
    expect(alert.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(`${REVOCATION_ADMIN_KEYS.searchHint} ${REVOCATION_ADMIN_KEYS.searchMalformed}`);
  });
});
