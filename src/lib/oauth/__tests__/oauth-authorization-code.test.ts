/**
 * Tests — authorization codes (ADR-738 §5)
 *
 * Το ερώτημα που κυριαρχεί: **τι σημαίνει η δεύτερη εξαργύρωση;** Το OAuth 2.1
 * §7.5 απαντά «κλοπή» και απαιτεί ανάκληση όσων εκδόθηκαν, όχι απλή απόρριψη.
 */

import { createHash } from 'node:crypto';

import { FakeFirestore } from './fake-firestore';

const fakeDb = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => fakeDb }));
jest.mock('@/services/enterprise-id.service', () => ({
  generateOAuthTokenId: () => 'oatok_family_fixed',
}));

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  issueAuthorizationCode,
  linkCodeToTokenFamily,
  redeemAuthorizationCode,
} from '../oauth-authorization-code';
import { issueTokenPair, lookupToken } from '../oauth-token-store';

const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = createHash('sha256').update(VERIFIER, 'ascii').digest('base64url');
const AUDIENCE = 'https://nestor.example/api/mcp';
const CLIENT_ID = 'https://app.example.com/c.json';
const REDIRECT = 'http://127.0.0.1:3000/callback';

function grant(overrides: Record<string, unknown> = {}) {
  return {
    clientId: CLIENT_ID,
    redirectUri: REDIRECT,
    codeChallenge: CHALLENGE,
    scopes: ['boq:read' as const],
    uid: 'usr_1',
    companyId: 'comp_1',
    globalRole: 'company_admin',
    audience: AUDIENCE,
    consentId: 'oacons_1',
    ...overrides,
  };
}

function redemption(code: string, overrides: Record<string, string> = {}) {
  return {
    code,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT,
    codeVerifier: VERIFIER,
    ...overrides,
  };
}

describe('issueAuthorizationCode', () => {
  it('ΔΕΝ γράφει το ωμό code στη βάση', async () => {
    const code = await issueAuthorizationCode(grant());
    const serialized = JSON.stringify([...fakeDb.dump(COLLECTIONS.OAUTH_CODES).entries()]);
    expect(serialized).not.toContain(code);
  });

  it('το doc id φέρει το enterprise πρόθεμα', async () => {
    await issueAuthorizationCode(grant());
    const ids = [...fakeDb.dump(COLLECTIONS.OAUTH_CODES).keys()];
    expect(ids.every((id) => /^oacode_[0-9a-f]{64}$/.test(id))).toBe(true);
  });
});

describe('redeemAuthorizationCode', () => {
  it('εξαργυρώνει με σωστό verifier', async () => {
    const code = await issueAuthorizationCode(grant());
    const result = await redeemAuthorizationCode(redemption(code));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.grant.companyId).toBe('comp_1');
      expect(result.grant.audience).toBe(AUDIENCE);
    }
  });

  it('απορρίπτει λάθος verifier', async () => {
    const code = await issueAuthorizationCode(grant());
    const result = await redeemAuthorizationCode(
      redemption(code, { codeVerifier: 'x'.repeat(43) }),
    );
    expect(result).toEqual({ ok: false, rejection: 'pkce_failed' });
  });

  it('απορρίπτει άλλο client_id', async () => {
    const code = await issueAuthorizationCode(grant());
    const result = await redeemAuthorizationCode(
      redemption(code, { clientId: 'https://evil.example/c.json' }),
    );
    expect(result).toEqual({ ok: false, rejection: 'client_mismatch' });
  });

  it('απορρίπτει άλλο redirect_uri', async () => {
    const code = await issueAuthorizationCode(grant());
    const result = await redeemAuthorizationCode(
      redemption(code, { redirectUri: 'http://127.0.0.1:3000/other' }),
    );
    expect(result).toEqual({ ok: false, rejection: 'redirect_uri_mismatch' });
  });

  it('απορρίπτει άγνωστο code', async () => {
    const result = await redeemAuthorizationCode(redemption('never-issued'));
    expect(result).toEqual({ ok: false, rejection: 'not_found' });
  });

  it('είναι ΜΙΑΣ ΧΡΗΣΗΣ', async () => {
    const code = await issueAuthorizationCode(grant());
    expect((await redeemAuthorizationCode(redemption(code))).ok).toBe(true);
    expect(await redeemAuthorizationCode(redemption(code))).toEqual({
      ok: false,
      rejection: 'already_redeemed',
    });
  });
});

describe('επανάληψη code ⇒ ανάκληση της οικογένειας (OAuth 2.1 §7.5)', () => {
  it('τα tokens που γεννήθηκαν από τον code πεθαίνουν στο replay', async () => {
    // Χωρίς αυτό, ο επιτιθέμενος κρατά λειτουργικό token από την ΠΡΩΤΗ, επιτυχή
    // εξαργύρωση — και η σιωπηλή απόρριψη της δεύτερης δεν τον ενοχλεί καθόλου.
    const code = await issueAuthorizationCode(grant({ consentId: 'oacons_replay' }));
    const redeemed = await redeemAuthorizationCode(redemption(code));
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;

    const issued = await issueTokenPair({
      clientId: redeemed.grant.clientId,
      uid: redeemed.grant.uid,
      companyId: redeemed.grant.companyId,
      globalRole: redeemed.grant.globalRole,
      scopes: redeemed.grant.scopes,
      audience: redeemed.grant.audience,
      consentId: redeemed.grant.consentId,
    });
    await linkCodeToTokenFamily(code, issued.familyId);

    expect(await lookupToken(issued.accessToken, 'access', AUDIENCE)).toMatchObject({ ok: true });

    await redeemAuthorizationCode(redemption(code));

    expect(await lookupToken(issued.accessToken, 'access', AUDIENCE)).toEqual({
      ok: false,
      rejection: 'revoked',
    });
  });

  it('replay πριν εκδοθεί token δεν σκάει', async () => {
    const code = await issueAuthorizationCode(grant({ consentId: 'oacons_early' }));
    await redeemAuthorizationCode(redemption(code));

    await expect(redeemAuthorizationCode(redemption(code))).resolves.toEqual({
      ok: false,
      rejection: 'already_redeemed',
    });
  });
});
