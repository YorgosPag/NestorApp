/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΤΩΝ EMAIL ΛΟΓΑΡΙΑΣΜΟΥ** (ADR-851 Φ2) — άγκυρες.
 * @related auth/account-mail.client.ts
 */

const postMock = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => {
  class ApiClientError extends Error {
    constructor(message: string, readonly statusCode: number) { super(message); }
  }
  return {
    ApiClientError,
    // Η ΠΡΑΓΜΑΤΙΚΗ σταθερά — ο ισχυρισμός κάτω ελέγχει την ΤΙΜΗ (`{ skipAuth: true }`), όχι το όνομα.
    PUBLIC_REQUEST: jest.requireActual('@/lib/api/api-client-types').PUBLIC_REQUEST,
    apiClient: { post: (...args: unknown[]) => postMock(...args) },
  };
});

import { ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { requestEmailVerificationMail, requestPasswordResetMail } from '../account-mail.client';

type ApiClientErrorCtor = new (message: string, statusCode: number) => Error;
const apiError = (status: number) => new (ApiClientError as unknown as ApiClientErrorCtor)('x', status);

beforeEach(() => jest.clearAllMocks());

describe('requestPasswordResetMail', () => {
  it('🔑 Μ1 — ΔΗΜΟΣΙΑ πόρτα (`skipAuth`): ο καλών μπορεί να μην έχει συνεδρία', async () => {
    postMock.mockResolvedValue({ accepted: true });
    await requestPasswordResetMail('maria@example.com', 'en');
    expect(postMock).toHaveBeenCalledWith(API_ROUTES.AUTH.PASSWORD_RESET, { email: 'maria@example.com', language: 'en' }, { skipAuth: true });
  });

  it('Μ2 — `pseudo` ταξιδεύει ως ανθρώπινη γλώσσα (η προεπιλογή)', async () => {
    postMock.mockResolvedValue({ accepted: true });
    await requestPasswordResetMail('maria@example.com', 'pseudo');
    expect(postMock.mock.calls[0][1]).toEqual({ email: 'maria@example.com', language: 'el' });
  });

  it.each([
    [429, 'auth/too-many-requests'],
    [400, 'auth/invalid-email'],
    [500, 'auth/network-request-failed'],
  ])('Μ3 — HTTP %s ⇒ `%s` (κωδικός που ο χάρτης μηνυμάτων ΗΔΗ ξέρει)', async (status, code) => {
    postMock.mockRejectedValue(apiError(status));
    await expect(requestPasswordResetMail('maria@example.com', 'el')).rejects.toMatchObject({ code });
  });
});

describe('requestEmailVerificationMail', () => {
  it('Μ4 — με ταυτότητα (ΧΩΡΙΣ `skipAuth`): αφορά τον ΙΔΙΟ τον συνδεδεμένο', async () => {
    postMock.mockResolvedValue({ outcome: 'sent' });
    await requestEmailVerificationMail('el');
    expect(postMock).toHaveBeenCalledWith(API_ROUTES.AUTH.EMAIL_VERIFICATION, { language: 'el' });
  });
});
