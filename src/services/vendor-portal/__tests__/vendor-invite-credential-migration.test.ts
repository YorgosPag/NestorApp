/**
 * @jest-environment node
 *
 * @fileoverview **MIGRATION ωμού token → διαπιστευτήριο `legacy`** (ADR-876 §5 Φ6).
 *
 * Μ1 🔴 ο σύνδεσμος που ΗΔΗ κρατά ο προμηθευτής ανοίγει και μετά: το διαπιστευτήριο της migration
 *    είναι ΑΚΡΙΒΩΣ αυτό που βρίσκει ο αναγνώστης (`parseVendorLink` + `credentialMatches`) ·
 * Μ2 ανάκληση από τη λίστα nonces ή από `'expired'` ⇒ `revokedAt` + revoke ·
 * Μ3 μη επαληθεύσιμο token ⇒ σβήνεται, χωρίς διαπιστευτήριο · Μ4 ιδεμποτία (δεύτερο τρέξιμο = noop) ·
 * Μ5 η αναφορά δίνει τη μέγιστη λήξη ΖΩΝΤΑΝΟΥ παλιού συνδέσμου (ανακλημένοι/ληγμένοι δεν μετράνε).
 */

import { encodeSignedToken, newTokenNonce } from '@/lib/tokens/signed-token';

import { VENDOR_PORTAL_SECRET_ENV, credentialMatches, parseVendorLink } from '../vendor-invite-credential';
import {
  planLegacyInvite,
  summarizeMigration,
  type LegacyInviteRecord,
  type MigrationContext,
} from '../vendor-invite-credential-migration';

const SECRET = 'test-vendor-portal-secret-0123456789abcdef';
const NOW = '2026-09-24T10:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;

const ctx = (revoked: string[] = []): MigrationContext => ({ secret: SECRET, nowIso: NOW, revokedNonces: new Set(revoked) });

function legacyToken(nonce: string, expiryMs: number, secret = SECRET): string {
  return encodeSignedToken(secret, ['rfq_1', 'cont_1', nonce, String(expiryMs)]);
}

const record = (overrides: Partial<LegacyInviteRecord> = {}): LegacyInviteRecord => ({
  id: 'vi_1',
  rfqId: 'rfq_1',
  companyId: 'co_1',
  status: 'sent',
  createdAtIso: '2026-09-20T00:00:00.000Z',
  ...overrides,
});

const saved = process.env[VENDOR_PORTAL_SECRET_ENV];
beforeAll(() => {
  process.env[VENDOR_PORTAL_SECRET_ENV] = SECRET;
});
afterAll(() => {
  if (saved === undefined) delete process.env[VENDOR_PORTAL_SECRET_ENV];
  else process.env[VENDOR_PORTAL_SECRET_ENV] = saved;
});

describe('planLegacyInvite', () => {
  it('Μ1 — 🔴 ο υπάρχων σύνδεσμος ανοίγει και μετά τη migration', async () => {
    const token = legacyToken(newTokenNonce(), Date.parse(NOW) + 3 * DAY);
    const plan = await planLegacyInvite(record({ token }), ctx());
    expect(plan.kind).toBe('migrate');
    const parsed = await parseVendorLink(token);
    if (plan.kind !== 'migrate' || !parsed.ok) throw new Error('unreachable');
    expect(parsed.credentialId).toBe(plan.credential.id);
    expect(credentialMatches(plan.credential, parsed.nonceHash)).toBe(true);
    expect(plan.credential).toMatchObject({ issuedVia: 'legacy', inviteId: 'vi_1', revokedAt: null });
    expect(JSON.stringify(plan.credential)).not.toContain(token);
  });

  it('Μ2 — nonce στη λίστα ανάκλησης ⇒ revoke', async () => {
    const nonce = newTokenNonce();
    const plan = await planLegacyInvite(record({ token: legacyToken(nonce, Date.parse(NOW) + DAY) }), ctx([nonce]));
    expect(plan).toMatchObject({ kind: 'migrate', revoke: true, credential: { revokedAt: NOW } });
  });

  it("Μ2 — status 'expired' (ήταν ανάκληση) ⇒ revoke", async () => {
    const plan = await planLegacyInvite(record({ status: 'expired', token: legacyToken(newTokenNonce(), Date.parse(NOW) + DAY) }), ctx());
    expect(plan).toMatchObject({ kind: 'migrate', revoke: true });
  });

  it('Μ3 — token άλλου κλειδιού ⇒ σβήνεται χωρίς διαπιστευτήριο', async () => {
    const foreign = legacyToken(newTokenNonce(), Date.parse(NOW) + DAY, 'another-environment-secret-xxxxxxxx');
    expect(await planLegacyInvite(record({ token: foreign }), ctx())).toEqual({ kind: 'strip_unverifiable', revoke: false });
  });

  it("Μ4 — ιδεμποτία: χωρίς token → noop· χωρίς token αλλά 'expired' → μόνο κατάσταση", async () => {
    expect(await planLegacyInvite(record({ status: 'revoked' }), ctx())).toEqual({ kind: 'noop' });
    expect(await planLegacyInvite(record({ status: 'expired' }), ctx())).toEqual({ kind: 'status_only' });
  });
});

describe('summarizeMigration', () => {
  it('Μ5 — μέγιστη λήξη ΖΩΝΤΑΝΟΥ παλιού συνδέσμου', async () => {
    const later = Date.parse(NOW) + 5 * DAY;
    const plans = await Promise.all([
      planLegacyInvite(record({ token: legacyToken(newTokenNonce(), Date.parse(NOW) + 2 * DAY) }), ctx()),
      planLegacyInvite(record({ token: legacyToken(newTokenNonce(), later) }), ctx()),
      planLegacyInvite(record({ status: 'expired', token: legacyToken(newTokenNonce(), later + DAY) }), ctx()),
      planLegacyInvite(record({ token: legacyToken(newTokenNonce(), Date.parse(NOW) - DAY) }), ctx()),
      planLegacyInvite(record({ status: 'submitted' }), ctx()),
    ]);
    expect(summarizeMigration(plans, NOW)).toEqual({
      total: 5,
      migrate: 4,
      statusOnly: 0,
      stripped: 0,
      noop: 1,
      maxLiveLegacyExpiry: new Date(later).toISOString(),
    });
  });
});
