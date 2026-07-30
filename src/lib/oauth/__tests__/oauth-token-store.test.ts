/**
 * Tests — αποθήκη tokens (ADR-738 §5)
 *
 * Δύο ερωτήματα κυριαρχούν: **φεύγει ποτέ ωμό μυστικό προς τη βάση;** και
 * **τι συμβαίνει όταν εμφανιστεί refresh token που έχει ήδη χρησιμοποιηθεί;**
 */

import { FakeFirestore } from './fake-firestore';

const fakeDb = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => fakeDb,
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateOAuthTokenId: () => 'oatok_family_fixed',
}));

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  issueTokenPair,
  lookupToken,
  revokeTokensForConsent,
  rotateRefreshToken,
  tokenDocId,
} from '../oauth-token-store';

const AUDIENCE = 'https://nestor.example/api/mcp';

function grant(overrides: Record<string, unknown> = {}) {
  return {
    clientId: 'https://app.example.com/c.json',
    uid: 'usr_1',
    companyId: 'comp_1',
    globalRole: 'company_admin',
    scopes: ['boq:read' as const],
    audience: AUDIENCE,
    consentId: 'oacons_1',
    ...overrides,
  };
}

describe('issueTokenPair', () => {
  it('ΔΕΝ γράφει ποτέ το ωμό μυστικό στη βάση', async () => {
    const issued = await issueTokenPair(grant());
    const stored = fakeDb.dump(COLLECTIONS.OAUTH_TOKENS);

    const serialized = JSON.stringify([...stored.entries()]);
    expect(serialized).not.toContain(issued.accessToken);
    expect(serialized).not.toContain(issued.refreshToken);
  });

  it('το doc id είναι το SHA-256 του μυστικού με το enterprise πρόθεμα', async () => {
    const issued = await issueTokenPair(grant());
    const stored = fakeDb.dump(COLLECTIONS.OAUTH_TOKENS);

    const id = tokenDocId(issued.accessToken);
    expect(id).toMatch(/^oatok_[0-9a-f]{64}$/);
    expect(stored.has(id)).toBe(true);
  });

  it('access και refresh μοιράζονται οικογένεια', async () => {
    const issued = await issueTokenPair(grant());
    const stored = fakeDb.dump(COLLECTIONS.OAUTH_TOKENS);

    const access = stored.get(tokenDocId(issued.accessToken));
    const refresh = stored.get(tokenDocId(issued.refreshToken));
    expect(access?.familyId).toBe(refresh?.familyId);
    expect(issued.familyId).toBe(access?.familyId);
  });

  it('το refresh ζει πολύ περισσότερο από το access', async () => {
    const issued = await issueTokenPair(grant());
    const stored = fakeDb.dump(COLLECTIONS.OAUTH_TOKENS);

    const access = stored.get(tokenDocId(issued.accessToken)) as { expiresAt: { toMillis(): number } };
    const refresh = stored.get(tokenDocId(issued.refreshToken)) as { expiresAt: { toMillis(): number } };
    expect(refresh.expiresAt.toMillis()).toBeGreaterThan(access.expiresAt.toMillis());
  });
});

describe('lookupToken', () => {
  it('βρίσκει έγκυρο access token', async () => {
    const issued = await issueTokenPair(grant());
    const lookup = await lookupToken(issued.accessToken, 'access', AUDIENCE);

    expect(lookup.ok).toBe(true);
    if (lookup.ok) expect(lookup.record.companyId).toBe('comp_1');
  });

  it('ΑΠΟΡΡΙΠΤΕΙ token εκδομένο για άλλο ακροατήριο', async () => {
    // «MCP servers MUST only accept tokens specifically intended for themselves»
    const issued = await issueTokenPair(grant({ audience: 'https://other.example/api/mcp' }));
    const lookup = await lookupToken(issued.accessToken, 'access', AUDIENCE);

    expect(lookup).toEqual({ ok: false, rejection: 'audience_mismatch' });
  });

  it('απορρίπτει refresh token όταν ζητείται access', async () => {
    const issued = await issueTokenPair(grant());
    const lookup = await lookupToken(issued.refreshToken, 'access', AUDIENCE);

    expect(lookup).toEqual({ ok: false, rejection: 'wrong_type' });
  });

  it('απορρίπτει άγνωστο μυστικό', async () => {
    const lookup = await lookupToken('not-a-real-token', 'access', AUDIENCE);
    expect(lookup).toEqual({ ok: false, rejection: 'not_found' });
  });

  it('απορρίπτει ανακλημένο token', async () => {
    const issued = await issueTokenPair(grant({ consentId: 'oacons_revoke_me' }));
    await revokeTokensForConsent('oacons_revoke_me');

    const lookup = await lookupToken(issued.accessToken, 'access', AUDIENCE);
    expect(lookup).toEqual({ ok: false, rejection: 'revoked' });
  });
});

describe('rotateRefreshToken', () => {
  it('εκδίδει νέο ζεύγος και σκοτώνει το παλιό refresh', async () => {
    const first = await issueTokenPair(grant({ consentId: 'oacons_rot_1' }));
    const rotated = await rotateRefreshToken(first.refreshToken, AUDIENCE);

    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;

    expect(rotated.issued.refreshToken).not.toBe(first.refreshToken);
    // Το παλιό refresh δεν λειτουργεί πλέον ως τίποτα.
    const old = await lookupToken(first.refreshToken, 'refresh', AUDIENCE);
    expect(old).toEqual({ ok: false, rejection: 'revoked' });
  });

  it('κρατά την ίδια οικογένεια στην ανανέωση', async () => {
    const first = await issueTokenPair(grant({ consentId: 'oacons_rot_2' }));
    const rotated = await rotateRefreshToken(first.refreshToken, AUDIENCE);

    if (rotated.ok) expect(rotated.issued.familyId).toBe(first.familyId);
  });

  it('ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΗ ⇒ πέφτει ΟΛΗ η οικογένεια', async () => {
    // Αν ένα ήδη εξαργυρωμένο refresh εμφανιστεί ξανά, ή το αντίγραφο κλάπηκε ή
    // το δικό μας χάθηκε. Ημιμέτρα εδώ αφήνουν τον κλέφτη μέσα.
    const first = await issueTokenPair(grant({ consentId: 'oacons_reuse' }));
    const second = await rotateRefreshToken(first.refreshToken, AUDIENCE);
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const replay = await rotateRefreshToken(first.refreshToken, AUDIENCE);
    expect(replay).toEqual({ ok: false, rejection: 'reuse_detected' });

    // Το ΝΕΟ access token — που ήταν έγκυρο πριν το replay — έχει πλέον πεθάνει.
    const afterwards = await lookupToken(second.issued.accessToken, 'access', AUDIENCE);
    expect(afterwards).toEqual({ ok: false, rejection: 'revoked' });
  });

  it('απορρίπτει refresh για άλλο ακροατήριο', async () => {
    const issued = await issueTokenPair(
      grant({ audience: 'https://other.example/api/mcp', consentId: 'oacons_aud' }),
    );
    const rotated = await rotateRefreshToken(issued.refreshToken, AUDIENCE);
    expect(rotated).toEqual({ ok: false, rejection: 'audience_mismatch' });
  });

  it('απορρίπτει access token στη θέση refresh', async () => {
    const issued = await issueTokenPair(grant({ consentId: 'oacons_wrongtype' }));
    const rotated = await rotateRefreshToken(issued.accessToken, AUDIENCE);
    expect(rotated).toEqual({ ok: false, rejection: 'wrong_type' });
  });
});

describe('revokeTokensForConsent', () => {
  it('ανακαλεί κάθε ζωντανό token της συγκατάθεσης', async () => {
    await issueTokenPair(grant({ consentId: 'oacons_bulk' }));
    await issueTokenPair(grant({ consentId: 'oacons_bulk' }));

    const revoked = await revokeTokensForConsent('oacons_bulk');
    expect(revoked).toBe(4); // 2 ζεύγη × (access + refresh)
  });

  it('είναι idempotent — δεύτερη κλήση δεν βρίσκει τίποτα', async () => {
    await issueTokenPair(grant({ consentId: 'oacons_idem' }));
    await revokeTokensForConsent('oacons_idem');
    expect(await revokeTokensForConsent('oacons_idem')).toBe(0);
  });
});
