/**
 * Regression anchor — stale-token auto-recovery in the enterprise API client.
 *
 * ΙΣΤΟΡΙΚΟ ΤΟΥ BUG: ο client κρατά δικό του `tokenCache`, ξεχωριστό από το Firebase
 * SDK. Όταν το cached ID token απορριπτόταν server-side (expired / revoked / claims
 * changed) ο server γύριζε HTTP 401 → χαρτογραφούνταν σε "Authentication required"
 * και το σφάλμα έβγαινε ΑΜΕΣΩΣ: το `shouldRetry` κάνει retry μόνο σε 5xx/network,
 * ΠΟΤΕ σε 401. Έτσι το Firebase Storage upload (φρέσκο SDK token) πετύχαινε αλλά το
 * επόμενο `POST /api/cad-files` έσκαγε 401 και «πετούσε τον χρήστη έξω» ενώ ήταν
 * κανονικά συνδεδεμένος (σύμπτωμα: DXF auto-save "Storage save failed").
 *
 * Η ΔΙΟΡΘΩΣΗ: σε 401 ο client κάνει force-refresh του ID token ΜΙΑ φορά και ξαναστέλνει
 * το request — ανεξάρτητα από το retry budget (δουλεύει και με retry:false). Idempotent:
 * το request που απορρίφθηκε με 401 δεν έφτασε ποτέ στον route handler.
 *
 * Τα tests περνούν από το PUBLIC API (`apiClient.post`) και ελέγχουν το observable
 * contract: «401 → getIdToken(forceRefresh=true) → retry με φρέσκο token → success»,
 * χωρίς infinite refresh loop σε επίμονο 401.
 */

// Firebase auth double — ο getIdToken γυρίζει διαφορετικό token ανά forceRefresh flag,
// ώστε να αποδεικνύεται ότι το retry έστειλε το ΦΡΕΣΚΟ token (όχι το μπαγιάτικο cache).
jest.mock('@/lib/firebase', () => {
  const getIdToken = jest.fn((forceRefresh?: boolean) =>
    Promise.resolve(forceRefresh ? 'fresh-token' : 'stale-token'),
  );
  return {
    auth: {
      currentUser: { uid: 'u1', getIdToken },
      onAuthStateChanged: jest.fn(),
    },
  };
});

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

let idempotencyKeySeq = 0;
jest.mock('@/services/enterprise-id.service', () => ({
  generateRequestId: () => 'req_test_1',
  generateIdempotencyKey: () => `idk_test_${++idempotencyKeySeq}`,
}));

// Defensive: the auth-refresh path uses `continue` without sleeping, but a plain
// 5xx retry would call sleep() with a real backoff — neutralise it so no test waits.
jest.mock('@/lib/async-utils', () => ({ sleep: () => Promise.resolve() }));

import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { auth } from '@/lib/firebase';

type MockGetIdToken = jest.Mock<Promise<string>, [boolean?]>;
const getIdTokenMock = (auth.currentUser as unknown as { getIdToken: MockGetIdToken }).getIdToken;

/** Reach the private tokenCache to reset singleton state between tests (no `any`). */
type TokenCacheHolder = { tokenCache: unknown };

interface FakeResponseBody {
  [key: string]: unknown;
}

function makeResponse(status: number, body: FakeResponseBody, extraHeaders: Record<string, string> = {}): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...extraHeaders };
  return {
    status,
    statusText: '',
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
    blob: async () => body,
  } as unknown as Response;
}

const OK_ENVELOPE: FakeResponseBody = {
  success: true,
  data: { fileId: 'f1', version: 2, created: false },
};

const UNAUTH_BODY: FakeResponseBody = {
  error: 'Authentication required',
  errorCode: 'AUTHENTICATION_REQUIRED',
};

let fetchMock: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

beforeEach(() => {
  (apiClient as unknown as TokenCacheHolder).tokenCache = null;
  getIdTokenMock.mockClear();
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('EnterpriseApiClient — stale-token 401 auto-recovery', () => {
  it('401 → force-refresh → retry → success (transparent to caller)', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, UNAUTH_BODY))
      .mockResolvedValueOnce(makeResponse(200, OK_ENVELOPE));

    const result = await apiClient.post('/api/cad-files', { fileId: 'f1' });

    expect(result).toEqual(OK_ENVELOPE.data);
    // Exactly one forced refresh — the recovery, not a loop.
    expect(getIdTokenMock).toHaveBeenCalledWith(true);
    expect(getIdTokenMock.mock.calls.filter(([f]) => f === true)).toHaveLength(1);
    // Two round-trips: the rejected one + the retried one.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The retry carried the FRESH token, not the stale cached one.
    const firstAuth = (fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization;
    const secondAuth = (fetchMock.mock.calls[1][1]?.headers as Record<string, string>).Authorization;
    expect(firstAuth).toBe('Bearer stale-token');
    expect(secondAuth).toBe('Bearer fresh-token');
  });

  it('persistent 401 → refreshes exactly once, then surfaces the error (no infinite loop)', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, UNAUTH_BODY))
      .mockResolvedValueOnce(makeResponse(401, UNAUTH_BODY));

    await expect(apiClient.post('/api/cad-files', { fileId: 'f1' })).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(getIdTokenMock.mock.calls.filter(([f]) => f === true)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('recovers even when retry is disabled (auth refresh is independent of retry budget)', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, UNAUTH_BODY))
      .mockResolvedValueOnce(makeResponse(200, OK_ENVELOPE));

    const result = await apiClient.post(
      '/api/cad-files',
      { fileId: 'f1' },
      { retry: false },
    );

    expect(result).toEqual(OK_ENVELOPE.data);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not refresh or retry on a successful first request', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, OK_ENVELOPE));

    const result = await apiClient.post('/api/cad-files', { fileId: 'f1' });

    expect(result).toEqual(OK_ENVELOPE.data);
    expect(getIdTokenMock.mock.calls.some(([f]) => f === true)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not attempt token refresh on a non-auth error (e.g. 409 conflict)', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(409, { error: 'Version conflict', errorCode: 'VERSION_CONFLICT' }),
    );

    await expect(
      apiClient.post('/api/cad-files', { fileId: 'f1' }, { retry: false }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(getIdTokenMock.mock.calls.some(([f]) => f === true)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * 🔴 ΑΓΚΥΡΑ ADR-835 §23.12 Ε2 — **η πολιτική cache ΦΤΑΝΕΙ στο `fetch`**. Χωρίς αυτήν, ο καταναλωτής που
 * ζητά «φρέσκο μετά από δική μου γραφή» παίρνει σιωπηλά την απάντηση του `stale-while-revalidate`
 * (μετρημένο ζωντανά: ο επισκέπτης έβλεπε τον κόσμο ΠΡΙΝ το αίτημα/την απόσυρσή του).
 */
describe('EnterpriseApiClient — RequestInit.cache passthrough', () => {
  it('`cache: reload` ⇒ φτάνει αυτούσιο στο fetch', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, OK_ENVELOPE));
    await apiClient.get('/api/public-listings/x/stay-nights', { skipAuth: true, cache: 'reload' });
    expect(fetchMock.mock.calls[0][1]?.cache).toBe('reload');
  });

  it('χωρίς `cache` ⇒ κανένα πεδίο — η προεπιλογή του browser μένει ανέγγιχτη', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, OK_ENVELOPE));
    await apiClient.get('/api/public-listings/x/stay-nights', { skipAuth: true });
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('cache');
  });
});

/**
 * 🔴 ΑΓΚΥΡΕΣ ADR-853 Ε3 — **η επανάληψη ΔΕΝ είναι ποτέ δεύτερη πράξη**.
 * Φάση 1: χωρίς κλειδί ξαναστέλνεται μόνο το `GET`. Φάση 2: κάθε άλλη πράξη φεύγει με `Idempotency-Key`,
 * **ίδιο** σε κάθε επανάληψη, και το σύνορο του διακομιστή εκτελεί μία φορά (Stripe · IETF draft-07).
 */
describe('EnterpriseApiClient — επανάληψη μόνο με ταυτότητα πράξης (ADR-853 Ε3)', () => {
  const UNAVAILABLE: FakeResponseBody = { error: 'Service unavailable', errorCode: 'UNAVAILABLE' };
  const keyOf = (call: number): string | undefined =>
    (fetchMock.mock.calls[call][1]?.headers as Record<string, string>)['Idempotency-Key'];

  it('Ρ1: POST σε 503 ⇒ ξαναστέλνεται με το ΙΔΙΟ κλειδί σε κάθε προσπάθεια', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(503, UNAVAILABLE))
      .mockResolvedValueOnce(makeResponse(200, OK_ENVELOPE));
    await expect(apiClient.post('/api/x', { a: 1 })).resolves.toEqual(OK_ENVELOPE.data);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(keyOf(0)).toMatch(/^idk_test_/);
    expect(keyOf(1)).toBe(keyOf(0));
  });

  it('Ρ2: POST σε κομμένο δίκτυο ⇒ ξαναστέλνεται με το ΙΔΙΟ κλειδί (το σύνορο αναπαράγει)', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(makeResponse(200, OK_ENVELOPE));
    await expect(apiClient.post('/api/x', { a: 1 })).resolves.toEqual(OK_ENVELOPE.data);
    expect(keyOf(1)).toBe(keyOf(0));
  });

  it.each(['put', 'patch', 'delete'] as const)('Ρ3: %s ⇒ φεύγει με κλειδί και ξαναστέλνεται με το ίδιο', async (verb) => {
    fetchMock.mockResolvedValueOnce(makeResponse(503, UNAVAILABLE)).mockResolvedValueOnce(makeResponse(200, OK_ENVELOPE));
    await (verb === 'delete' ? apiClient.delete('/api/x') : apiClient[verb]('/api/x', { a: 1 }));
    expect(keyOf(0)).toBeDefined();
    expect(keyOf(1)).toBe(keyOf(0));
  });

  it('Ρ4: GET ⇒ ΧΩΡΙΣ κλειδί, και ξαναδοκιμάζεται ως το όριο', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(503, UNAVAILABLE))
      .mockResolvedValueOnce(makeResponse(503, UNAVAILABLE))
      .mockResolvedValueOnce(makeResponse(200, OK_ENVELOPE));
    await expect(apiClient.get('/api/x')).resolves.toEqual(OK_ENVELOPE.data);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(keyOf(0)).toBeUndefined();
  });

  it('Ρ5: FormData ⇒ ΧΩΡΙΣ κλειδί και ΜΙΑ αποστολή (δεν ορίζεται αποτύπωμα πάνω σε ροή)', async () => {
    fetchMock.mockResolvedValue(makeResponse(503, UNAVAILABLE));
    await expect(apiClient.post('/api/x', new FormData())).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(keyOf(0)).toBeUndefined();
  });

  it('Ρ6: `retry: false` ⇒ ΜΙΑ αποστολή, ακόμη και με κλειδί', async () => {
    fetchMock.mockResolvedValue(makeResponse(503, UNAVAILABLE));
    await expect(apiClient.post('/api/x', { a: 1 }, { retry: false })).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Ρ7: δύο κλήσεις ⇒ δύο κλειδιά (δύο κλικ = δύο πράξεις)', async () => {
    fetchMock.mockResolvedValue(makeResponse(200, OK_ENVELOPE));
    await apiClient.post('/api/x', { a: 1 });
    await apiClient.post('/api/x', { a: 1 });
    expect(keyOf(1)).not.toBe(keyOf(0));
  });

  it('Ρ8: `409 IDEMPOTENCY_IN_FLIGHT` ⇒ ξαναστέλνεται με το ίδιο κλειδί', async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse(409, { error: 'busy', errorCode: 'IDEMPOTENCY_IN_FLIGHT' }, { 'retry-after': '2' }))
      .mockResolvedValueOnce(makeResponse(200, OK_ENVELOPE));
    await expect(apiClient.post('/api/x', { a: 1 })).resolves.toEqual(OK_ENVELOPE.data);
    expect(keyOf(1)).toBe(keyOf(0));
  });

  it.each([
    [409, 'IDEMPOTENCY_OUTCOME_UNKNOWN'],
    [409, 'IDEMPOTENCY_REPLAY_UNAVAILABLE'],
    [409, 'VERSION_CONFLICT'],
    [422, 'IDEMPOTENCY_KEY_REUSED'],
  ])('Ρ9: %i %s ⇒ ΜΙΑ αποστολή — κρίση, όχι παροδικό', async (status, errorCode) => {
    fetchMock.mockResolvedValue(makeResponse(status, { error: 'no', errorCode }));
    await expect(apiClient.post('/api/x', { a: 1 })).rejects.toMatchObject({ statusCode: status, errorCode });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Ρ10: κλειδί του καλούντος (οποιαδήποτε γραφή) ΜΕΝΕΙ — χωρίς δεύτερη κεφαλίδα', async () => {
    fetchMock.mockResolvedValue(makeResponse(200, OK_ENVELOPE));
    await apiClient.post('/api/x', { a: 1 }, { headers: { 'idempotency-key': 'mine-1' } });
    const sent = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(sent['Idempotency-Key']).toBe('mine-1');
    expect(Object.keys(sent).filter((name) => name.toLowerCase() === 'idempotency-key')).toHaveLength(1);
  });
});
