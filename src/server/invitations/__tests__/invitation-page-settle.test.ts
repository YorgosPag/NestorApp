/**
 * @jest-environment node
 *
 * ADR-915 §39.6 — **ο ΕΝΑΣ δρόμος κάθε σελίδας πρόσκλησης μετά την όψη** (`settleInvitationPage`): «ανοίχτηκε» μετά την
 * απόκριση · σύνδεσμος που δεν δείχνει πουθενά ⇒ 404 · βήμα λογαριασμού μόνο για θεατή που δεν είναι ο παραλήπτης.
 */

jest.mock('server-only', () => ({}));

const mockAfter = jest.fn();
const mockNotFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
jest.mock('next/server', () => ({ after: (task: () => Promise<void>) => mockAfter(task) }));
jest.mock('next/navigation', () => ({ notFound: () => mockNotFound() }));
jest.mock('@/server/auth/page-identity', () => ({ readPageIdentity: jest.fn() }));
jest.mock('@/server/invitations/invitation-account-step', () => ({
  pageAccountStepOf: jest.fn(async (source: { accountStep: () => Promise<unknown> } | null) => (source ? source.accountStep() : undefined)),
}));

import { settleInvitationPage } from '../invitation-page-request';
import type { AddressedInvitationPreviewOutcome } from '../invitation-preview-outcome';

const STEP = { kind: 'create', maskedEmail: 'm***a@office.gr', googleSuggested: false } as const;

function previewOutcome(): AddressedInvitationPreviewOutcome<{ readonly label: string }> {
  return {
    kind: 'preview',
    preview: { label: 'Διαμέρισμα Α2' },
    addressedToViewer: null,
    markOpened: jest.fn(async () => undefined),
    accountStep: jest.fn(async () => STEP),
  };
}

beforeEach(() => {
  mockAfter.mockClear();
  mockNotFound.mockClear();
});

describe('settleInvitationPage', () => {
  it('όψη ⇒ «ανοίχτηκε» προγραμματίζεται με after() (όχι τώρα) και επιστρέφει το βήμα', async () => {
    const outcome = previewOutcome();
    await expect(settleInvitationPage(outcome)).resolves.toEqual(STEP);
    expect(mockAfter).toHaveBeenCalledWith(outcome.kind === 'preview' ? outcome.markOpened : null);
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it('άρνηση που σημαίνει «δεν υπάρχει» (πλαστός σύνδεσμος) ⇒ 404', async () => {
    await expect(settleInvitationPage({ kind: 'refused', reason: 'link-invalid' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockAfter).not.toHaveBeenCalled();
  });

  it('άρνηση που ΠΕΡΙΓΡΑΦΕΙ υπαρκτή πρόσκληση (ανακλήθηκε) ⇒ όχι 404, κανένα βήμα', async () => {
    await expect(settleInvitationPage({ kind: 'refused', reason: 'revoked' })).resolves.toBeUndefined();
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it('«δεν μπόρεσα» ⇒ ούτε 404 ούτε βήμα', async () => {
    await expect(settleInvitationPage({ kind: 'unavailable' })).resolves.toBeUndefined();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockAfter).not.toHaveBeenCalled();
  });
});
