/**
 * @jest-environment node
 */

/**
 * ADR-884 Φ0.12 — share creation and revocation on the server.
 *
 * Load-bearing: the database never holds the raw token; tenant and author come
 * from the session; an entity of another company is not shareable; expiry is
 * mandatory and bounded; revocation is tenant-bound, one-way and idempotent.
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/file-audit-admin.service', () => ({ recordFileAudit: jest.fn(async () => 'aud_1') }));
let idCounter = 0;
jest.mock('@/services/enterprise-id-convenience', () => ({ generateShareId: () => `share_${++idCounter}` }));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { hashShareToken } from '@/lib/sharing/share-token';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';

import { createShareOnServer, parseCreateShareRequest, SHARE_MAX_EXPIRY_HOURS } from '../share-create';
import { revokeShareOnServer } from '../share-revoke';
import { verifySharePassword } from '../share-password';

const CREATOR = { uid: 'usr_1', companyId: 'comp_1' };
let kit: MockFirestoreKit;
const db = (): Firestore => kit.instance as unknown as Firestore;

beforeEach(() => {
  kit = createMockFirestore();
  kit.seedCollection(COLLECTIONS.CONTACTS, { ct_1: { companyId: 'comp_1', displayName: 'Μαρία' } });
  kit.seedCollection(COLLECTIONS.FILES, { f_1: { companyId: 'comp_1' } });
  (recordFileAudit as jest.Mock).mockClear();
});

const contactRequest = (extra: Record<string, unknown> = {}) =>
  parseCreateShareRequest({ entityType: 'contact', entityId: 'ct_1', contactMeta: { includedFields: ['name'] }, ...extra });

describe('parseCreateShareRequest', () => {
  it.each([
    ['an unknown entity type', { entityType: 'vendor_rfq_invite', entityId: 'x' }],
    ['a missing entity id', { entityType: 'contact' }],
    ['an expiry beyond 30 days', { entityType: 'contact', entityId: 'x', expiresInHours: SHARE_MAX_EXPIRY_HOURS + 1 }],
    ['a zero expiry', { entityType: 'contact', entityId: 'x', expiresInHours: 0 }],
    ['an oversized password', { entityType: 'contact', entityId: 'x', password: 'p'.repeat(257) }],
    ['a non-object body', 'nope'],
  ])('rejects %s', (_label, body) => {
    expect(parseCreateShareRequest(body)).toBeNull();
  });
});

describe('createShareOnServer', () => {
  it('🔴 stores ONLY the fingerprint — the raw token exists in the response, never in the document', async () => {
    const outcome = await createShareOnServer(db(), CREATOR, contactRequest()!);
    if (!outcome.ok) throw new Error('expected ok');

    const stored = kit.getData(COLLECTIONS.SHARES, outcome.result.shareId)!;
    expect(stored.tokenHash).toBe(await hashShareToken(outcome.result.token));
    expect(JSON.stringify(stored)).not.toContain(outcome.result.token);
    expect('token' in stored).toBe(false);
  });

  it('takes tenant and author from the session', async () => {
    const outcome = await createShareOnServer(db(), CREATOR, contactRequest()!);
    if (!outcome.ok) throw new Error('expected ok');

    expect(kit.getData(COLLECTIONS.SHARES, outcome.result.shareId)).toMatchObject({ companyId: 'comp_1', createdBy: 'usr_1' });
  });

  it('hashes the password with scrypt — and it verifies', async () => {
    const outcome = await createShareOnServer(db(), CREATOR, contactRequest({ password: 'secret' })!);
    if (!outcome.ok) throw new Error('expected ok');
    const stored = kit.getData(COLLECTIONS.SHARES, outcome.result.shareId)!;

    expect(stored.requiresPassword).toBe(true);
    expect(stored.passwordHash).toMatch(/^scrypt\$1\$/);
    await expect(verifySharePassword('secret', stored.passwordHash as string)).resolves.toMatchObject({ ok: true });
  });

  it('🔴 refuses to share another company’s entity', async () => {
    const outcome = await createShareOnServer(db(), { uid: 'intruder', companyId: 'comp_2' }, contactRequest()!);

    expect(outcome).toEqual({ ok: false, refusal: 'forbidden' });
    expect(kit.writes()).toEqual([]);
  });

  it('applies the resolver’s own rule (contact without consented fields)', async () => {
    const request = parseCreateShareRequest({ entityType: 'contact', entityId: 'ct_1' })!;

    await expect(createShareOnServer(db(), CREATOR, request)).resolves.toMatchObject({ ok: false, refusal: 'invalid' });
  });

  it('bounds the expiry — the default is 72 hours', async () => {
    const before = Date.now();
    const outcome = await createShareOnServer(db(), CREATOR, contactRequest()!);
    if (!outcome.ok) throw new Error('expected ok');

    const hours = (Date.parse(outcome.result.expiresAt) - before) / 3_600_000;
    expect(hours).toBeGreaterThan(71.9);
    expect(hours).toBeLessThan(72.1);
  });

  it('leaves a «share» line in the FILE audit trail for file links', async () => {
    const request = parseCreateShareRequest({ entityType: 'file', entityId: 'f_1' })!;

    await createShareOnServer(db(), CREATOR, request);

    expect(recordFileAudit).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'f_1', action: 'share', performedBy: 'usr_1', companyId: 'comp_1',
    }));
  });
});

describe('revokeShareOnServer', () => {
  beforeEach(() => {
    kit.seedCollection(COLLECTIONS.SHARES, { share_x: { companyId: 'comp_1', isActive: true } });
    kit.seedCollection(COLLECTIONS.FILE_SHARES, { fs_x: { companyId: 'comp_1', isActive: true } });
  });

  it('revokes one-way, stamping who and when', async () => {
    await expect(revokeShareOnServer(db(), CREATOR, 'share_x')).resolves.toBe('revoked');
    expect(kit.getData(COLLECTIONS.SHARES, 'share_x')).toMatchObject({ isActive: false, revokedBy: 'usr_1' });
  });

  it('is idempotent', async () => {
    await revokeShareOnServer(db(), CREATOR, 'share_x');

    await expect(revokeShareOnServer(db(), CREATOR, 'share_x')).resolves.toBe('already-revoked');
  });

  it('also revokes a legacy file_shares link', async () => {
    await expect(revokeShareOnServer(db(), CREATOR, 'fs_x')).resolves.toBe('revoked');
  });

  it('🔴 another tenant gets «not-found» and nothing is written', async () => {
    kit.clearWrites();

    await expect(revokeShareOnServer(db(), { uid: 'x', companyId: 'comp_2' }, 'share_x')).resolves.toBe('not-found');
    expect(kit.writes()).toEqual([]);
  });
});
