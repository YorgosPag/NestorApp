/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΣΥΝΔΕΣΜΟΣ ΤΟΥ ΚΟΙΝΟΥ ΠΥΡΗΝΑ** (ADR-853 §20) — διάταξη `[id, nonce, expMs, ...locator]`.
 *
 * 🔴 Το συμβόλαιο που προστατεύει: οι σύνδεσμοι χώρου που **ήδη** κάθονται σε εισερχόμενα δεν αλλάζουν μορφή
 * με την εξαγωγή του πυρήνα (locator κενό ⇒ τρία πεδία, nonce στη θέση 1). Οι κύκλοι έκδοση→εξαργύρωση ζουν στις
 * σουίτες των ειδών (`workspace-invitation.test.ts` · `tour-capture-invitation.test.ts`).
 */

jest.mock('server-only', () => ({}));

import { decodeSignedToken } from '@/lib/tokens/signed-token';

import { mintInvitationToken, readInvitationToken } from '../invitation-token';

const ENV = 'INVITATION_TOKEN_TEST_SECRET';
const NOW = '2026-09-25T10:00:00.000Z';
const LATER_MS = Date.parse('2026-09-30T10:00:00.000Z');

beforeEach(() => {
  process.env[ENV] = 'μυστικό-δοκιμής-πυρήνα-πρόσκλησης';
});

describe('Δ — η διάταξη', () => {
  it('🔴 Δ1 — χωρίς locator: ΑΚΡΙΒΩΣ τρία πεδία, nonce στη θέση 1 (οι παλιοί σύνδεσμοι χώρου μένουν έγκυροι)', async () => {
    const { token } = await mintInvitationToken(ENV, { id: 'winv_1', expiresAtMs: LATER_MS, locator: [] });
    const verdict = decodeSignedToken(process.env[ENV] ?? '', token, 3);
    expect(verdict.ok && verdict.fields).toEqual(['winv_1', expect.stringMatching(/^[0-9a-f]{32}$/), String(LATER_MS)]);
  });

  it('Δ2 — με locator: ο locator επιστρέφει αυτούσιος, και το αποτύπωμα ταιριάζει με του εκδότη', async () => {
    const minted = await mintInvitationToken(ENV, { id: 'tcin_1', expiresAtMs: LATER_MS, locator: ['company-property', 'prop_1'] });
    const read = await readInvitationToken(ENV, minted.token, 2, NOW);
    expect(read).toEqual({
      kind: 'read', invitationId: 'tcin_1', nonceHash: minted.nonceHash, locator: ['company-property', 'prop_1'],
    });
  });

  it('🔴 Δ3 — λάθος πλήθος locator ⇒ `link-invalid` (σύνδεσμος ενός είδους δεν διαβάζεται ως άλλου)', async () => {
    const { token } = await mintInvitationToken(ENV, { id: 'tcin_1', expiresAtMs: LATER_MS, locator: ['a', 'b'] });
    expect(await readInvitationToken(ENV, token, 0, NOW)).toEqual({ kind: 'refused', reason: 'link-invalid' });
  });
});

describe('Λ — λήξη και μυστικό', () => {
  it('🔴 Λ1 — ληγμένος ⇒ `expired` (ο ΠΡΩΤΟΣ από τους δύο ελέγχους λήξης)', async () => {
    const { token } = await mintInvitationToken(ENV, { id: 'winv_1', expiresAtMs: Date.parse(NOW), locator: [] });
    expect(await readInvitationToken(ENV, token, 0, NOW)).toEqual({ kind: 'refused', reason: 'expired' });
  });

  it('🔴 Λ2 — λείπει ΔΙΚΟ ΜΑΣ μυστικό ⇒ `secret-missing`, ποτέ «πλαστός σύνδεσμος»', async () => {
    const { token } = await mintInvitationToken(ENV, { id: 'winv_1', expiresAtMs: LATER_MS, locator: [] });
    delete process.env[ENV];
    expect(await readInvitationToken(ENV, token, 0, NOW)).toEqual({ kind: 'secret-missing' });
  });

  it('Λ3 — άλλο κλειδί ⇒ `link-foreign` (άλλο περιβάλλον, όχι πλαστός)', async () => {
    const { token } = await mintInvitationToken(ENV, { id: 'winv_1', expiresAtMs: LATER_MS, locator: [] });
    process.env[ENV] = 'μυστικό-άλλου-περιβάλλοντος';
    expect(await readInvitationToken(ENV, token, 0, NOW)).toEqual({ kind: 'refused', reason: 'link-foreign' });
  });
});
