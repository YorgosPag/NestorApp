/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ ΤΗΣ ΠΥΛΗΣ** — γραμματική χωρίς βάση (ADR-876 §5).
 * @related services/vendor-portal/vendor-invite-credential.ts · lib/tokens/signed-token.ts
 *
 * Πραγματική υπογραφή, πραγματικό sha256, πραγματικό ID — **κανένα mock** στην κρυπτογραφία:
 * μια άγκυρα που μοκάρει τη σύγκριση δεν μπορεί να κοκκινίσει όταν η σύγκριση σπάσει.
 *
 * Δ1 κύκλος έκδοση→ανάγνωση · Δ2 αλλοιωμένος σύνδεσμος · Δ3 ΔΙΑΡΡΟΗ ΜΥΣΤΙΚΟΥ δεν αρκεί ·
 * Δ4 ΜΙΑ γραμματική (Φ7): παλιά μορφή 4 πεδίων, ακόμη και σωστά υπογεγραμμένη ⇒ invalid_link · Δ5 λήξη από το έγγραφο ·
 * Δ6 λείπει το μυστικό ⇒ server_config_error, ποτέ «άκυρος».
 */

import { encodeSignedToken, newTokenNonce } from '@/lib/tokens/signed-token';

import {
  VENDOR_PORTAL_SECRET_ENV,
  credentialMatches,
  isCredentialExpired,
  mintVendorInviteCredential,
  parseVendorLink,
  vendorLinkExpiryMs,
} from '../vendor-invite-credential';

const SECRET = 'test-vendor-portal-secret-0123456789abcdef';
const NOW = Date.parse('2026-09-24T10:00:00.000Z');

function mint() {
  return mintVendorInviteCredential({
    inviteId: 'vi_1',
    rfqId: 'rfq_1',
    companyId: 'co_1',
    issuedVia: 'copy_link',
    issuedBy: 'u_1',
    nowIso: new Date(NOW).toISOString(),
    expiresAtMs: vendorLinkExpiryMs(NOW),
  });
}

const saved = process.env[VENDOR_PORTAL_SECRET_ENV];
beforeEach(() => {
  process.env[VENDOR_PORTAL_SECRET_ENV] = SECRET;
});
afterAll(() => {
  if (saved === undefined) delete process.env[VENDOR_PORTAL_SECRET_ENV];
  else process.env[VENDOR_PORTAL_SECRET_ENV] = saved;
});

describe('Δ1 — έκδοση → ανάγνωση', () => {
  it('ο σύνδεσμος δείχνει ΑΚΡΙΒΩΣ το έγγραφο που εκδόθηκε, και ταιριάζει σε σταθερό χρόνο', async () => {
    const { credential, token } = await mint();
    const parsed = await parseVendorLink(token);
    expect(parsed).toEqual({ ok: true, credentialId: credential.id, nonceHash: credential.nonceHash });
    expect(credential.id.startsWith('vic_')).toBe(true);
    if (parsed.ok) expect(credentialMatches(credential, parsed.nonceHash)).toBe(true);
  });

  it('το έγγραφο ΔΕΝ περιέχει το token ούτε το nonce — μόνο hash', async () => {
    const { credential, token } = await mint();
    const stored = JSON.stringify(credential);
    expect(stored).not.toContain(token);
    expect(credential.nonceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('η λήξη του εγγράφου = 7 μέρες από την έκδοση', async () => {
    const { credential } = await mint();
    expect(Date.parse(credential.expiresAt) - NOW).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('Δ2 — αλλοιωμένος σύνδεσμος', () => {
  it('ένας χαρακτήρας αλλαγμένος ⇒ invalid_link, πριν από κάθε βάση', async () => {
    const { token } = await mint();
    const last = token.slice(-1) === 'A' ? 'B' : 'A';
    expect(await parseVendorLink(`${token.slice(0, -1)}${last}`)).toEqual({ ok: false, reason: 'invalid_link' });
  });

  it('σκουπίδι ⇒ invalid_link', async () => {
    expect(await parseVendorLink('not-a-link')).toEqual({ ok: false, reason: 'invalid_link' });
  });
});

describe('Δ3 — 🔴 διαρροή του ΜΥΣΤΙΚΟΥ δεν αρκεί', () => {
  it('σύνδεσμος υπογεγραμμένος σωστά, για υπαρκτό ID, με ΝΕΟ nonce ⇒ δεν ταιριάζει', async () => {
    const { credential } = await mint();
    // Ο επιτιθέμενος έχει το μυστικό και ξέρει το ID — όχι όμως το nonce της έκδοσης.
    const forged = encodeSignedToken(SECRET, [credential.id, newTokenNonce(), String(vendorLinkExpiryMs(NOW))]);
    const parsed = await parseVendorLink(forged);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.credentialId).toBe(credential.id);
      expect(credentialMatches(credential, parsed.nonceHash)).toBe(false);
    }
  });
});

describe('Δ4 — ΜΙΑ γραμματική συνδέσμου (ADR-876 §5 Φ7)', () => {
  it('🔴 η παλιά μορφή 4 πεδίων, ΣΩΣΤΑ υπογεγραμμένη, ΔΕΝ είναι σύνδεσμος', async () => {
    const legacy = encodeSignedToken(SECRET, ['rfq_1', 'cont_1', newTokenNonce(), String(NOW + 1000)]);
    expect(await parseVendorLink(legacy)).toEqual({ ok: false, reason: 'invalid_link' });
  });

  it('σύνδεσμος νέας μορφής με ΠΑΡΑΠΑΝΙΣΙΟ πεδίο ⇒ invalid_link (ακριβώς 3, όχι «τουλάχιστον»)', async () => {
    const { credential } = await mint();
    const padded = encodeSignedToken(SECRET, [credential.id, newTokenNonce(), String(NOW + 1000), 'extra']);
    expect(await parseVendorLink(padded)).toEqual({ ok: false, reason: 'invalid_link' });
  });

  it('3 πεδία ΧΩΡΙΣ πρόθεμα διαπιστευτηρίου ⇒ invalid_link (όχι μαντεψιά)', async () => {
    const odd = encodeSignedToken(SECRET, ['rfq_1', newTokenNonce(), String(NOW)]);
    expect(await parseVendorLink(odd)).toEqual({ ok: false, reason: 'invalid_link' });
  });
});

describe('Δ5 — λήξη: αυθεντία το έγγραφο', () => {
  it('ίση ή περασμένη λήξη = ληγμένο· μελλοντική = ζωντανό', () => {
    const at = new Date(NOW).toISOString();
    expect(isCredentialExpired({ expiresAt: at }, NOW)).toBe(true);
    expect(isCredentialExpired({ expiresAt: at }, NOW - 1)).toBe(false);
  });
});

describe('Δ6 — λείπει το μυστικό', () => {
  it('server_config_error, ποτέ «άκυρος σύνδεσμος» (ο παραλήπτης δεν φταίει)', async () => {
    const { token } = await mint();
    delete process.env[VENDOR_PORTAL_SECRET_ENV];
    expect(await parseVendorLink(token)).toEqual({ ok: false, reason: 'server_config_error' });
  });
});
