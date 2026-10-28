/**
 * @fileoverview Οι κεφαλίδες των αιτημάτων της πύλης (ADR-876 §5 · ADR-872 · ADR-327 changelog 2026-10-28).
 *
 * Κ1 υποβολή (multipart): σύνδεσμος + `Idempotency-Key` — η ζωντανή δοκιμή έδειξε μία υποβολή να γράφει ΔΥΟ φορές ·
 * Κ2 πράξη JSON: σύνδεσμος + κλειδί + `content-type` ·
 * Κ3 ανάγνωση (GET): σύνδεσμος, ΧΩΡΙΣ κλειδί (ασφαλής μέθοδος — το σύνορο δεν εφαρμόζεται) ·
 * Κ4 κάθε πράξη έχει ΔΙΚΟ της κλειδί — δύο υποβολές δεν μοιράζονται απάντηση.
 */

import { IDEMPOTENCY_KEY_HEADER } from '@/lib/api/idempotency/idempotency-contract';
import { vendorPortalAction, vendorPortalFetch } from '../vendor-portal-api';

const TOKEN = 'tok.test';
const fetchMock = jest.fn(async () => new Response('{}'));

beforeEach(() => {
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function headersOfCall(index: number): Record<string, string> {
  const init = fetchMock.mock.calls[index] as unknown as [string, RequestInit];
  return init[1].headers as Record<string, string>;
}

describe('vendor-portal-api', () => {
  test('Κ1 — η υποβολή (multipart) κουβαλά σύνδεσμο ΚΑΙ κλειδί ιδεμποτίας', async () => {
    await vendorPortalFetch(TOKEN, { method: 'POST', body: new FormData() });
    const headers = headersOfCall(0);
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers[IDEMPOTENCY_KEY_HEADER]).toEqual(expect.any(String));
    expect(headers[IDEMPOTENCY_KEY_HEADER].length).toBeGreaterThan(0);
  });

  test('Κ2 — η πράξη JSON κουβαλά σύνδεσμο, κλειδί και content-type', async () => {
    await vendorPortalAction(TOKEN, '/decline', { reason: null });
    const headers = headersOfCall(0);
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers[IDEMPOTENCY_KEY_HEADER]).toEqual(expect.any(String));
    expect(headers['content-type']).toBe('application/json');
  });

  test('Κ3 — η ανάγνωση ΔΕΝ κουβαλά κλειδί', async () => {
    await vendorPortalFetch(TOKEN, { method: 'GET' });
    const headers = headersOfCall(0);
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers[IDEMPOTENCY_KEY_HEADER]).toBeUndefined();
  });

  test('Κ4 — δύο πράξεις, δύο διαφορετικά κλειδιά', async () => {
    await vendorPortalFetch(TOKEN, { method: 'POST', body: new FormData() });
    await vendorPortalFetch(TOKEN, { method: 'POST', body: new FormData() });
    expect(headersOfCall(0)[IDEMPOTENCY_KEY_HEADER]).not.toBe(headersOfCall(1)[IDEMPOTENCY_KEY_HEADER]);
  });
});
