/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρα της μετάπτωσης διακριτικών κοινοποίησης (ADR-884 Φ0.12).
 *
 * Η μετάπτωση είναι η ΜΟΝΗ διαδρομή που γράφει `tokenHash` σε παλιά έγγραφα. Αν γράψει
 * άλλο αποτύπωμα από αυτό που υπολογίζει το lookup, **κάθε** παλιός σύνδεσμος παύει να
 * ανοίγει σιωπηλά. Κλειδώνουμε: ίδιο αποτύπωμα με το lookup, ιδεμποτησία, άρνηση σε σύγκρουση.
 */

jest.mock('firebase-admin', () => ({}));
jest.mock('../_shared/loadEnvLocal', () => ({ applyEnvLocal: jest.fn() }));
jest.mock('../_shared/firebaseAdminOps', () => ({ initAdminApp: jest.fn() }));

import { hashShareToken } from '../../src/lib/sharing/share-token';
import { hasLegacyPasswordHash, planTokenHash } from '../migrate-share-token-hash';

const TOKEN = 'LegacyToken0123456789abcdefghijk';

describe('planTokenHash', () => {
  it('raw token ⇒ write the SAME fingerprint the lookup computes', async () => {
    await expect(planTokenHash({ token: TOKEN })).resolves.toEqual({
      kind: 'write',
      tokenHash: await hashShareToken(TOKEN),
    });
  });

  it('already migrated (no raw token) ⇒ no write — idempotent', async () => {
    await expect(planTokenHash({ tokenHash: await hashShareToken(TOKEN) })).resolves.toEqual({ kind: 'noop' });
  });

  it('both present and agreeing ⇒ write (drops the raw token)', async () => {
    await expect(planTokenHash({ token: TOKEN, tokenHash: await hashShareToken(TOKEN) }))
      .resolves.toMatchObject({ kind: 'write' });
  });

  it('⛔ both present and DISAGREEING ⇒ conflict, never a write', async () => {
    await expect(planTokenHash({ token: TOKEN, tokenHash: 'deadbeef' })).resolves.toEqual({ kind: 'conflict' });
  });
});

describe('hasLegacyPasswordHash', () => {
  it('counts the unsalted SHA-256 generation only', () => {
    expect(hasLegacyPasswordHash({ passwordHash: 'a'.repeat(64) })).toBe(true);
    expect(hasLegacyPasswordHash({ passwordHash: 'scrypt$1$65536,8,2$c2FsdA$a2V5' })).toBe(false);
    expect(hasLegacyPasswordHash({ passwordHash: null })).toBe(false);
  });
});
