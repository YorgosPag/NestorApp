/**
 * Tests — ταυτότητα στο σύνορο MCP (ADR-738 §7)
 *
 * Το κρισιμότερο suite της Φάσης 3β. Αν κάτι εδώ σπάσει σιωπηλά, ένα token που
 * ο χρήστης ενέκρινε για `boq:read` μπορεί να διαβάσει άλλον πελάτη, ή token
 * άλλου server να γίνει δεκτό εδώ.
 */

import type { NextRequest } from 'next/server';

jest.mock('@/lib/oauth/oauth-token-store', () => ({ lookupToken: jest.fn() }));
jest.mock('@/lib/auth/auth-context', () => ({ buildRequestContext: jest.fn() }));
jest.mock('@/services/enterprise-id.service', () => ({ generateRequestId: () => 'req_fixed' }));

import { lookupToken } from '@/lib/oauth/oauth-token-store';
import { buildRequestContext } from '@/lib/auth/auth-context';
import { getMcpResourceUri } from '@/lib/oauth/oauth-config';
import {
  buildInsufficientScopeChallenge,
  buildUnauthenticatedChallenge,
  extractBearerToken,
  resolveMcpIdentity,
} from '../mcp-identity';

const mockLookup = lookupToken as unknown as jest.Mock;
const mockBuildContext = buildRequestContext as unknown as jest.Mock;

function requestWith(headers: Record<string, string> = {}): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

function tokenRecord(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: 'oatok_x',
    tokenType: 'access',
    clientId: 'https://app.example.com/c.json',
    uid: 'usr_1',
    companyId: 'comp_owner',
    globalRole: 'company_admin',
    scopes: ['boq:read'],
    audience: getMcpResourceUri(),
    consentId: 'oacons_1',
    familyId: 'oatok_fam',
    issuedAt: 0,
    expiresAt: Date.now() + 60_000,
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockLookup.mockReset();
  mockBuildContext.mockReset();
});

describe('extractBearerToken', () => {
  it('εξάγει το token', () => {
    expect(extractBearerToken(requestWith({ authorization: 'Bearer abc' }))).toBe('abc');
  });

  it('δέχεται πεζό "bearer"', () => {
    expect(extractBearerToken(requestWith({ authorization: 'bearer abc' }))).toBe('abc');
  });

  it.each([
    ['', 'χωρίς header'],
    ['abc', 'χωρίς σχήμα'],
    ['Basic abc', 'λάθος σχήμα'],
    ['Bearer', 'χωρίς τιμή'],
    ['Bearer ', 'κενή τιμή'],
  ])('επιστρέφει null για "%s" (%s)', (header) => {
    const request = header === '' ? requestWith() : requestWith({ authorization: header });
    expect(extractBearerToken(request)).toBeNull();
  });
});

describe('resolveMcpIdentity — χωρίς διαπιστευτήρια', () => {
  it('401 με challenge που δείχνει στο PRM', async () => {
    const identity = await resolveMcpIdentity(requestWith());

    expect(identity.ok).toBe(false);
    if (!identity.ok) {
      expect(identity.failure.status).toBe(401);
      expect(identity.failure.challenge).toContain('resource_metadata=');
      expect(identity.failure.challenge).toContain('.well-known/oauth-protected-resource');
      expect(identity.failure.challenge).toContain('scope="boq:read"');
    }
  });

  it('ΔΕΝ αγγίζει το buildRequestContext χωρίς token', async () => {
    // Το buildRequestContext έχει σκόπιμο bypass σε NODE_ENV=development όταν
    // ΔΕΝ βρει διαπιστευτήρια. Καλώντας το χωρίς token, το MCP endpoint θα ήταν
    // τοπικά ορθάνοιχτο — και τα tests θα περνούσαν χωρίς να ελέγξουν τίποτα.
    await resolveMcpIdentity(requestWith());
    expect(mockBuildContext).not.toHaveBeenCalled();
  });
});

describe('resolveMcpIdentity — OAuth token', () => {
  it('έγκυρο token ⇒ context από το token', async () => {
    mockLookup.mockResolvedValue({ ok: true, record: tokenRecord() });

    const identity = await resolveMcpIdentity(requestWith({ authorization: 'Bearer good' }));

    expect(identity.ok).toBe(true);
    if (identity.ok) {
      expect(identity.context).toEqual({
        companyId: 'comp_owner',
        isAdmin: true,
        requestId: 'req_fixed',
      });
    }
  });

  it('ελέγχει ΠΑΝΤΑ το ακροατήριο — περνά το canonical URI στο lookup', async () => {
    mockLookup.mockResolvedValue({ ok: true, record: tokenRecord() });
    await resolveMcpIdentity(requestWith({ authorization: 'Bearer good' }));

    expect(mockLookup).toHaveBeenCalledWith('good', 'access', getMcpResourceUri());
  });

  it('token ΑΛΛΟΥ ακροατηρίου ⇒ 401, ΧΩΡΙΣ fallback σε Firebase', async () => {
    // Πέφτοντας σε fallback εδώ θα λέγαμε «δεν είσαι δεκτός ως πράκτορας, ας
    // δούμε μήπως περνάς ως χρήστης» — δηλαδή παράκαμψη του ελέγχου που μόλις
    // απέτυχε.
    mockLookup.mockResolvedValue({ ok: false, rejection: 'audience_mismatch' });

    const identity = await resolveMcpIdentity(requestWith({ authorization: 'Bearer foreign' }));

    expect(identity.ok).toBe(false);
    if (!identity.ok) expect(identity.failure.status).toBe(401);
    expect(mockBuildContext).not.toHaveBeenCalled();
  });

  it.each(['revoked', 'expired', 'wrong_type'])(
    'token %s ⇒ 401 χωρίς fallback',
    async (rejection) => {
      mockLookup.mockResolvedValue({ ok: false, rejection });
      const identity = await resolveMcpIdentity(requestWith({ authorization: 'Bearer x' }));

      expect(identity.ok).toBe(false);
      expect(mockBuildContext).not.toHaveBeenCalled();
    },
  );

  it('token χωρίς το απαιτούμενο scope ⇒ 403 insufficient_scope', async () => {
    mockLookup.mockResolvedValue({ ok: true, record: tokenRecord({ scopes: [] }) });

    const identity = await resolveMcpIdentity(requestWith({ authorization: 'Bearer scopeless' }));

    expect(identity.ok).toBe(false);
    if (!identity.ok) {
      expect(identity.failure.status).toBe(403);
      expect(identity.failure.kind).toBe('insufficient_scope');
      expect(identity.failure.challenge).toContain('error="insufficient_scope"');
      expect(identity.failure.challenge).toContain('scope="boq:read"');
    }
  });

  it('μη-admin ρόλος ⇒ isAdmin false (το registry θα κόψει)', async () => {
    mockLookup.mockResolvedValue({ ok: true, record: tokenRecord({ globalRole: 'viewer' }) });

    const identity = await resolveMcpIdentity(requestWith({ authorization: 'Bearer viewer' }));
    if (identity.ok) expect(identity.context.isAdmin).toBe(false);
  });

  it('super_admin θεωρείται admin', async () => {
    mockLookup.mockResolvedValue({ ok: true, record: tokenRecord({ globalRole: 'super_admin' }) });

    const identity = await resolveMcpIdentity(requestWith({ authorization: 'Bearer sa' }));
    if (identity.ok) expect(identity.context.isAdmin).toBe(true);
  });
});

describe('resolveMcpIdentity — fallback Firebase', () => {
  it('token που δεν είναι δικό μας OAuth ⇒ δοκιμάζει Firebase', async () => {
    mockLookup.mockResolvedValue({ ok: false, rejection: 'not_found' });
    mockBuildContext.mockResolvedValue({
      isAuthenticated: true,
      uid: 'usr_2',
      email: 'a@b.gr',
      companyId: 'comp_firebase',
      globalRole: 'company_admin',
      mfaEnrolled: false,
    });

    const identity = await resolveMcpIdentity(requestWith({ authorization: 'Bearer firebase-id' }));

    expect(identity.ok).toBe(true);
    if (identity.ok) expect(identity.context.companyId).toBe('comp_firebase');
  });

  it('άκυρο Firebase token ⇒ 401', async () => {
    mockLookup.mockResolvedValue({ ok: false, rejection: 'not_found' });
    mockBuildContext.mockResolvedValue({ isAuthenticated: false, reason: 'invalid_token' });

    const identity = await resolveMcpIdentity(requestWith({ authorization: 'Bearer junk' }));
    expect(identity.ok).toBe(false);
    if (!identity.ok) expect(identity.failure.status).toBe(401);
  });
});

describe('challenges', () => {
  it('το 401 φέρει resource_metadata — ο μόνος τρόπος να μάθει ο client πού να πάει', () => {
    expect(buildUnauthenticatedChallenge()).toMatch(
      /^Bearer resource_metadata="https?:\/\/.+\/\.well-known\/oauth-protected-resource", scope="boq:read"$/,
    );
  });

  it('το 403 φέρει error=insufficient_scope και resource_metadata', () => {
    const challenge = buildInsufficientScopeChallenge();
    expect(challenge).toContain('error="insufficient_scope"');
    expect(challenge).toContain('resource_metadata=');
  });
});
