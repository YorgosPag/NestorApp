/**
 * Tests — Client ID Metadata Documents (ADR-738)
 */

import {
  clearClientMetadataCache,
  fetchClientMetadata,
  isAcceptableRedirectUri,
  isLoopbackRedirectUri,
  matchRedirectUri,
  validateMetadataDocument,
} from '../client-id-metadata';

jest.mock('@/lib/security/outbound-url-guard', () => ({
  fetchGuardedText: jest.fn(),
}));

import { fetchGuardedText } from '@/lib/security/outbound-url-guard';

const mockFetch = fetchGuardedText as unknown as jest.Mock;

const CLIENT_ID = 'https://app.example.com/oauth/client.json';

function validDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    client_id: CLIENT_ID,
    client_name: 'Example MCP Client',
    redirect_uris: ['http://127.0.0.1:3000/callback'],
    ...overrides,
  };
}

describe('validateMetadataDocument', () => {
  it('απορρίπτει έγγραφο που δηλώνει ΑΛΛΟ client_id', () => {
    // Χωρίς αυτόν τον έλεγχο, οποιοσδήποτε φιλοξενεί έγγραφο που *δηλώνει* ξένο
    // client_id δανείζεται το όνομά του στην οθόνη συγκατάθεσης.
    const result = validateMetadataDocument(
      validDocument({ client_id: 'https://other.example/c.json' }),
      CLIENT_ID,
    );
    expect(result).toEqual({ ok: false, rejection: 'client_id_mismatch' });
  });

  it.each([
    ['client_name', { client_name: undefined }],
    ['redirect_uris', { redirect_uris: undefined }],
    ['client_id', { client_id: undefined }],
  ])('απορρίπτει έγγραφο χωρίς %s', (_field, overrides) => {
    const result = validateMetadataDocument(validDocument(overrides), CLIENT_ID);
    expect(result).toEqual({ ok: false, rejection: 'missing_required_fields' });
  });

  it('απορρίπτει όταν κανένα redirect_uri δεν είναι αποδεκτό', () => {
    const result = validateMetadataDocument(
      validDocument({ redirect_uris: ['http://evil.example/cb'] }),
      CLIENT_ID,
    );
    expect(result).toEqual({ ok: false, rejection: 'no_valid_redirect_uris' });
  });

  it('φιλτράρει τα μη αποδεκτά redirect_uris και κρατά τα υπόλοιπα', () => {
    const result = validateMetadataDocument(
      validDocument({
        redirect_uris: ['http://evil.example/cb', 'https://app.example.com/cb'],
      }),
      CLIENT_ID,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.redirect_uris).toEqual(['https://app.example.com/cb']);
  });

  it('απορρίπτει μη-αντικείμενο', () => {
    expect(validateMetadataDocument('not an object', CLIENT_ID)).toEqual({
      ok: false,
      rejection: 'not_json',
    });
  });
});

describe('isAcceptableRedirectUri', () => {
  it('δέχεται https', () => {
    expect(isAcceptableRedirectUri('https://app.example.com/cb')).toBe(true);
  });

  it('δέχεται http ΜΟΝΟ σε loopback', () => {
    expect(isAcceptableRedirectUri('http://127.0.0.1:9000/cb')).toBe(true);
    expect(isAcceptableRedirectUri('http://localhost:9000/cb')).toBe(true);
    expect(isAcceptableRedirectUri('http://example.com/cb')).toBe(false);
  });

  it('απορρίπτει redirect με fragment', () => {
    expect(isAcceptableRedirectUri('https://app.example.com/cb#x')).toBe(false);
  });
});

describe('matchRedirectUri', () => {
  it('ταιριάζει ακριβώς', () => {
    expect(matchRedirectUri(['https://app.example.com/cb'], 'https://app.example.com/cb')).toBe(true);
  });

  it('ΔΕΝ κάνει prefix matching σε https', () => {
    // Το prefix matching εδώ θα άνοιγε πραγματική τρύπα σε κάθε redirect URI.
    expect(
      matchRedirectUri(['https://app.example.com/cb'], 'https://app.example.com/cb/evil'),
    ).toBe(false);
  });

  it('αγνοεί το port σε loopback (RFC 8252 §7.3)', () => {
    // Ο native client δεσμεύει ΤΥΧΑΙΟ ελεύθερο port τη στιγμή της σύνδεσης και
    // δεν μπορεί να το ξέρει όταν δημοσιεύει το CIMD του.
    expect(
      matchRedirectUri(['http://127.0.0.1:3000/callback'], 'http://127.0.0.1:51423/callback'),
    ).toBe(true);
  });

  it('ΔΕΝ αγνοεί το path σε loopback', () => {
    expect(
      matchRedirectUri(['http://127.0.0.1:3000/callback'], 'http://127.0.0.1:3000/other'),
    ).toBe(false);
  });

  it('δεν ταιριάζει loopback αίτημα με μη-loopback δηλωμένο', () => {
    expect(
      matchRedirectUri(['https://app.example.com/callback'], 'http://127.0.0.1:80/callback'),
    ).toBe(false);
  });

  it('αναγνωρίζει localhost, 127.0.0.1 και [::1] ως loopback', () => {
    expect(isLoopbackRedirectUri('http://localhost:1/cb')).toBe(true);
    expect(isLoopbackRedirectUri('http://127.0.0.1:1/cb')).toBe(true);
    expect(isLoopbackRedirectUri('http://[::1]:1/cb')).toBe(true);
    expect(isLoopbackRedirectUri('https://app.example.com/cb')).toBe(false);
  });
});

describe('fetchClientMetadata', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    clearClientMetadataCache();
  });

  it('απορρίπτει client_id χωρίς path', async () => {
    // Σκέτο origin ⇒ κάθε σελίδα του domain θα διεκδικούσε την ταυτότητα.
    const result = await fetchClientMetadata('https://app.example.com');
    expect(result).toEqual({ ok: false, rejection: 'client_id_no_path' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('απορρίπτει client_id που δεν είναι https', async () => {
    const result = await fetchClientMetadata('http://app.example.com/c.json');
    expect(result).toEqual({ ok: false, rejection: 'client_id_not_https' });
  });

  it('περνά το κατέβασμα από τον outbound guard', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: JSON.stringify(validDocument()),
      contentType: 'application/json',
      cacheControl: '',
    });

    const result = await fetchClientMetadata(CLIENT_ID);
    expect(mockFetch).toHaveBeenCalledWith(CLIENT_ID);
    expect(result.ok).toBe(true);
  });

  it('απορρίπτει σώμα που δεν είναι JSON', async () => {
    mockFetch.mockResolvedValue({ ok: true, body: '<html>', contentType: '', cacheControl: '' });
    const result = await fetchClientMetadata(CLIENT_ID);
    expect(result).toEqual({ ok: false, rejection: 'not_json' });
  });

  it('απορρίπτει όταν ο guard απορρίψει', async () => {
    mockFetch.mockResolvedValue({ ok: false, rejection: 'address_not_public' });
    const result = await fetchClientMetadata(CLIENT_ID);
    expect(result).toEqual({ ok: false, rejection: 'fetch_failed' });
  });

  it('χρησιμοποιεί μνήμη — δεύτερη κλήση δεν ξανακατεβάζει', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: JSON.stringify(validDocument()),
      contentType: 'application/json',
      cacheControl: 'max-age=600',
    });

    await fetchClientMetadata(CLIENT_ID);
    await fetchClientMetadata(CLIENT_ID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('δεν κρατά στη μνήμη όταν ο εκδότης λέει no-store', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: JSON.stringify(validDocument()),
      contentType: 'application/json',
      cacheControl: 'no-store',
    });

    await fetchClientMetadata(CLIENT_ID);
    clearClientMetadataCache();
    await fetchClientMetadata(CLIENT_ID);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
