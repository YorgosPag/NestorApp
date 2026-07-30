/**
 * Tests — επικύρωση αιτήματος `/oauth/authorize` (ADR-738 §4)
 *
 * Το κεντρικό ερώτημα κάθε τεστ εδώ: **πότε επιτρέπεται redirect;** Ένα
 * σφάλμα που φεύγει με redirect πριν επικυρωθεί το `redirect_uri` μετατρέπει
 * τον authorization server σε εργαλείο phishing με το δικό μας domain από πίσω.
 */

jest.mock('../client-id-metadata', () => ({
  fetchClientMetadata: jest.fn(),
  matchRedirectUri: jest.requireActual('../client-id-metadata').matchRedirectUri,
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));

import { fetchClientMetadata } from '../client-id-metadata';
import { getMcpResourceUri } from '../oauth-config';
import {
  buildCodeRedirect,
  buildErrorRedirect,
  validateAuthorizeRequest,
} from '../authorize-request';

const mockFetchMetadata = fetchClientMetadata as unknown as jest.Mock;

const CLIENT_ID = 'https://app.example.com/oauth/client.json';
const REDIRECT = 'http://127.0.0.1:3000/callback';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

function baseParams(overrides: Record<string, string | null> = {}): URLSearchParams {
  const defaults: Record<string, string> = {
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    scope: 'boq:read',
    state: 'st-1',
    resource: getMcpResourceUri(),
  };

  const params = new URLSearchParams();
  Object.entries({ ...defaults, ...overrides }).forEach(([key, value]) => {
    if (value !== null) params.set(key, value);
  });
  return params;
}

beforeEach(() => {
  mockFetchMetadata.mockReset();
  mockFetchMetadata.mockResolvedValue({
    ok: true,
    document: {
      client_id: CLIENT_ID,
      client_name: 'Example MCP Client',
      redirect_uris: [REDIRECT],
    },
  });
});

describe('σφάλματα ΠΡΙΝ επικυρωθεί το redirect ⇒ fatal, ποτέ redirect', () => {
  it('χωρίς client_id', async () => {
    const result = await validateAuthorizeRequest(baseParams({ client_id: null }));
    expect(result).toMatchObject({ ok: false, disposition: 'fatal', error: 'invalid_request' });
  });

  it('CIMD που απορρίφθηκε', async () => {
    mockFetchMetadata.mockResolvedValue({ ok: false, rejection: 'client_id_mismatch' });
    const result = await validateAuthorizeRequest(baseParams());
    expect(result).toMatchObject({ ok: false, disposition: 'fatal', error: 'unauthorized_client' });
  });

  it('χωρίς redirect_uri', async () => {
    const result = await validateAuthorizeRequest(baseParams({ redirect_uri: null }));
    expect(result).toMatchObject({ ok: false, disposition: 'fatal' });
  });

  it('redirect_uri εκτός CIMD — ΔΕΝ γίνεται redirect εκεί', async () => {
    // Αυτό είναι το τεστ που κρατά το endpoint από το να γίνει open redirect.
    const result = await validateAuthorizeRequest(
      baseParams({ redirect_uri: 'https://evil.example/steal' }),
    );
    expect(result).toMatchObject({ ok: false, disposition: 'fatal' });
    expect(result).not.toHaveProperty('redirectUri');
  });
});

describe('σφάλματα ΜΕΤΑ την επικύρωση ⇒ redirectable', () => {
  it.each([
    ['response_type', { response_type: 'token' }, 'unsupported_response_type'],
    ['code_challenge_method plain', { code_challenge_method: 'plain' }, 'invalid_request'],
    ['code_challenge λείπει', { code_challenge: null }, 'invalid_request'],
    ['code_challenge κακοσχηματισμένο', { code_challenge: 'short' }, 'invalid_request'],
    ['scope άγνωστο', { scope: 'boq:write' }, 'invalid_scope'],
    ['resource ξένου server', { resource: 'https://other.example/api/mcp' }, 'invalid_request'],
  ])('%s ⇒ %s', async (_label, overrides, expectedError) => {
    const result = await validateAuthorizeRequest(baseParams(overrides));
    expect(result).toMatchObject({
      ok: false,
      disposition: 'redirectable',
      error: expectedError,
      redirectUri: REDIRECT,
      state: 'st-1',
    });
  });

  it('το plain PKCE απορρίπτεται ρητά, δεν σιωπάται', async () => {
    const result = await validateAuthorizeRequest(baseParams({ code_challenge_method: 'plain' }));
    expect(result).toMatchObject({ ok: false, error: 'invalid_request' });
    if (!result.ok) expect(result.description).toContain('S256');
  });
});

describe('επιτυχής επικύρωση', () => {
  it('επιστρέφει κανονικοποιημένο αίτημα', async () => {
    const result = await validateAuthorizeRequest(baseParams());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.clientId).toBe(CLIENT_ID);
      expect(result.request.scopes).toEqual(['boq:read']);
      expect(result.request.resource).toBe(getMcpResourceUri());
      expect(result.request.state).toBe('st-1');
    }
  });

  it('απουσία scope ⇒ το ελάχιστο απαιτούμενο, όχι «όλα»', async () => {
    const result = await validateAuthorizeRequest(baseParams({ scope: null }));
    if (result.ok) expect(result.request.scopes).toEqual(['boq:read']);
  });

  it('απουσία resource ⇒ ο δικός μας MCP endpoint', async () => {
    const result = await validateAuthorizeRequest(baseParams({ resource: null }));
    if (result.ok) expect(result.request.resource).toBe(getMcpResourceUri());
  });

  it('δέχεται loopback redirect με ΑΛΛΟ port (RFC 8252)', async () => {
    const result = await validateAuthorizeRequest(
      baseParams({ redirect_uri: 'http://127.0.0.1:51423/callback' }),
    );
    expect(result.ok).toBe(true);
  });

  it('απουσία state ⇒ null, όχι κενό string', async () => {
    const result = await validateAuthorizeRequest(baseParams({ state: null }));
    if (result.ok) expect(result.request.state).toBeNull();
  });
});

describe('κατασκευή redirects', () => {
  it('σφάλμα φέρει error, error_description και state', () => {
    const url = buildErrorRedirect(REDIRECT, 'access_denied', 'denied', 'st-1');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('error')).toBe('access_denied');
    expect(parsed.searchParams.get('error_description')).toBe('denied');
    expect(parsed.searchParams.get('state')).toBe('st-1');
  });

  it('χωρίς state δεν προσθέτει κενή παράμετρο', () => {
    const parsed = new URL(buildErrorRedirect(REDIRECT, 'access_denied', 'denied', null));
    expect(parsed.searchParams.has('state')).toBe(false);
  });

  it('επιτυχία φέρει code και state', () => {
    const parsed = new URL(buildCodeRedirect(REDIRECT, 'the-code', 'st-1'));
    expect(parsed.searchParams.get('code')).toBe('the-code');
    expect(parsed.searchParams.get('state')).toBe('st-1');
  });
});
