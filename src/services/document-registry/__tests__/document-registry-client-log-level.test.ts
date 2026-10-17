/**
 * @tests ADR-915 §29.1 — ο πελάτης του μητρώου καταγράφει την άρνηση (4xx) ως `warn` και τη βλάβη ως `error`.
 *
 * Εύρημα σε browser 2026-10-17: «Αποστολή για έγκριση» σε υπεύθυνο χωρίς email ⇒ ο διακομιστής απαντά σωστά
 * `NO_EMAIL`, η οθόνη το λέει σωστά — και ο πελάτης το έγραφε `logger.error` ⇒ κόκκινο overlay στον dev server.
 */

const mockLog = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };
// Οκνηρή ανάθεση: ο logger του module φτιάχνεται στο import, πριν αρχικοποιηθεί το `mockLog` (hoisting του jest.mock).
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    warn: (...args: unknown[]) => mockLog.warn(...args),
    error: (...args: unknown[]) => mockLog.error(...args),
    info: (...args: unknown[]) => mockLog.info(...args),
    debug: (...args: unknown[]) => mockLog.debug(...args),
  }),
}));

const mockPost = jest.fn();
const mockPut = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => {
  const actual = jest.requireActual('@/lib/api/api-client-types');
  return {
    ApiClientError: actual.ApiClientError,
    isClientRefusal: actual.isClientRefusal,
    apiClient: { post: (...args: unknown[]) => mockPost(...args), put: (...args: unknown[]) => mockPut(...args), get: jest.fn() },
  };
});

import { ApiClientError } from '@/lib/api/api-client-types';
import type { IssuanceSendBody } from '@/lib/document-validity/issuance-request';
import { previewIssuanceMessage, saveObligorDesignation } from '../document-registry.client';

const BODY = {} as IssuanceSendBody;

beforeEach(() => jest.clearAllMocks());

describe('document-registry.client — επίπεδο log', () => {
  it('ονομασμένη άρνηση (4xx) ⇒ warn, ο κωδικός φτάνει στην οθόνη', async () => {
    mockPost.mockRejectedValueOnce(new ApiClientError('refused', 409, 'NO_EMAIL'));
    await expect(previewIssuanceMessage(BODY)).resolves.toEqual({ kind: 'failed', code: 'NO_EMAIL' });
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
    expect(mockLog.error).not.toHaveBeenCalled();
  });

  it('βλάβη (5xx) ⇒ error', async () => {
    mockPost.mockRejectedValueOnce(new ApiClientError('boom', 500));
    await expect(previewIssuanceMessage(BODY)).resolves.toEqual({ kind: 'failed', code: null });
    expect(mockLog.error).toHaveBeenCalledTimes(1);
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it('δίκτυο ⇒ error — και η ίδια κρίση για τις πράξεις PUT', async () => {
    mockPut.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(saveObligorDesignation('p1', null)).resolves.toEqual({ kind: 'failed', code: null });
    expect(mockLog.error).toHaveBeenCalledTimes(1);
    mockPut.mockRejectedValueOnce(new ApiClientError('refused', 403, 'FORBIDDEN'));
    await saveObligorDesignation('p1', null);
    expect(mockLog.warn).toHaveBeenCalledTimes(1);
  });
});
