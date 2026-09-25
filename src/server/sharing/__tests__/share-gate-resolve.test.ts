/**
 * @jest-environment node
 */

/**
 * ADR-884 Φ0.12 — the one gate, the resolver, the access grant, the download.
 *
 * The load-bearing assertions:
 *   - a password-protected link yields NOTHING without the password or grant;
 *   - the visitor receives the resolver's projection, never tenant/hash fields;
 *   - a contact link opens for an anonymous visitor (it did not, before Κ4);
 *   - one opening = one access; preview/download inside the visit are not
 *     re-counted, and every byte goes out as a 15′ signed URL.
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/storage/signed-download-url', () => ({
  signedDownloadUrl: jest.fn(async () => ({ outcome: 'signed', url: 'https://signed.example/x', expiresAt: 0 })),
}));

import { COLLECTIONS } from '@/config/firestore-collections';
import { hashShareToken } from '@/lib/sharing/share-token';
import { signedDownloadUrl } from '@/lib/storage/signed-download-url';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { Firestore } from 'firebase-admin/firestore';

import { isShareAccessGrantValid, issueShareAccessGrant } from '../share-access-grant';
import { mayShareEntity } from '../share-entity-access';
import { issueShareDownload } from '../share-download';
import { hashSharePassword } from '../share-password';
import { resolvePublicShare } from '../share-resolve';
import { ShareEntityRegistry } from '@/services/sharing/share-entity-registry';

const TOKEN = 'NewGenerationToken_abcdefghijklmnopqrstuvwxy';
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

let kit: MockFirestoreKit;
const db = (): Firestore => kit.instance as unknown as Firestore;
const noGrant = () => false;

async function seedShare(extra: Record<string, unknown>): Promise<void> {
  kit.seedCollection(COLLECTIONS.SHARES, {
    share_1: {
      tokenHash: await hashShareToken(TOKEN),
      isActive: true,
      companyId: 'comp_1',
      createdBy: 'usr_1',
      expiresAt: FUTURE,
      requiresPassword: false,
      passwordHash: null,
      maxAccesses: 0,
      accessCount: 0,
      ...extra,
    },
  });
}

beforeEach(() => {
  kit = createMockFirestore();
  process.env.SHARE_ACCESS_SECRET = 'test-secret-with-enough-entropy-0123456789';
  (signedDownloadUrl as jest.Mock).mockClear();
});

// =============================================================================
// Access grant
// =============================================================================

describe('share access grant', () => {
  it('is valid for its own share only', () => {
    const grant = issueShareAccessGrant('share_1') as string;

    expect(isShareAccessGrantValid(grant, 'share_1')).toBe(true);
    expect(isShareAccessGrantValid(grant, 'share_2')).toBe(false);
  });

  it('expires after 15 minutes', () => {
    const issuedAt = Date.now();
    const grant = issueShareAccessGrant('share_1', issuedAt) as string;

    expect(isShareAccessGrantValid(grant, 'share_1', issuedAt + 14 * 60_000)).toBe(true);
    expect(isShareAccessGrantValid(grant, 'share_1', issuedAt + 16 * 60_000)).toBe(false);
  });

  it('rejects a forged grant', () => {
    expect(isShareAccessGrantValid('abcd1234.Zm9yZ2Vk', 'share_1')).toBe(false);
  });

  it('is not issued — and says so — when OUR secret is missing', () => {
    delete process.env.SHARE_ACCESS_SECRET;

    expect(issueShareAccessGrant('share_1')).toBeNull();
  });
});

// =============================================================================
// resolvePublicShare
// =============================================================================

describe('resolvePublicShare — contact', () => {
  beforeEach(() => {
    kit.seedCollection(COLLECTIONS.CONTACTS, {
      ct_1: { companyId: 'comp_1', displayName: 'Μαρία', emails: ['m@x.gr'], phones: ['+30 210'] },
    });
  });

  it('✅ opens for an ANONYMOUS visitor, publishing only the consented fields', async () => {
    await seedShare({ entityType: 'contact', entityId: 'ct_1', contactMeta: { includedFields: ['name', 'emails'] } });

    const { outcome } = await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: noGrant });

    expect(outcome).toMatchObject({
      status: 'resolved',
      share: { kind: 'contact', data: { name: 'Μαρία', emails: ['m@x.gr'], phones: null } },
    });
  });

  it('never sends tenant identity or hashes to the visitor', async () => {
    await seedShare({ entityType: 'contact', entityId: 'ct_1', contactMeta: { includedFields: ['name'] } });

    const { outcome } = await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: noGrant });
    const wire = JSON.stringify(outcome);

    for (const secret of ['comp_1', 'usr_1', 'tokenHash', 'passwordHash']) expect(wire).not.toContain(secret);
  });

  it('counts the opening', async () => {
    await seedShare({ entityType: 'contact', entityId: 'ct_1', contactMeta: { includedFields: ['name'] } });

    await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: noGrant });

    expect(kit.getData(COLLECTIONS.SHARES, 'share_1')).toMatchObject({ accessCount: 1 });
  });
});

describe('resolvePublicShare — password', () => {
  beforeEach(async () => {
    kit.seedCollection(COLLECTIONS.BUILDINGS, { bld_1: { companyId: 'comp_1', name: 'Άλφα' } });
    await seedShare({
      entityType: 'building_showcase', entityId: 'bld_1',
      requiresPassword: true, passwordHash: await hashSharePassword('right'),
    });
  });

  it('🔴 asks for the password and reveals NOTHING — and spends no access', async () => {
    const result = await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: noGrant });

    expect(result).toEqual({ outcome: { status: 'password-required' }, grant: null });
    expect(kit.getData(COLLECTIONS.SHARES, 'share_1')).toMatchObject({ accessCount: 0 });
  });

  it('refuses a wrong password by name', async () => {
    const { outcome } = await resolvePublicShare({ adminDb: db(), token: TOKEN, password: 'x', hasGrant: noGrant });

    expect(outcome).toEqual({ status: 'refused', reason: 'wrong-password' });
  });

  it('resolves with the right password and issues a grant for THIS share', async () => {
    const { outcome, grant } = await resolvePublicShare({ adminDb: db(), token: TOKEN, password: 'right', hasGrant: noGrant });

    expect(outcome).toMatchObject({ status: 'resolved', share: { kind: 'building_showcase' } });
    expect(grant?.shareId).toBe('share_1');
    expect(isShareAccessGrantValid(grant?.value as string, 'share_1')).toBe(true);
  });

  it('a valid grant stands in for the password (reload, PDF link)', async () => {
    const { outcome } = await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: (id) => id === 'share_1' });

    expect(outcome).toMatchObject({ status: 'resolved' });
  });

  it('answers «unavailable», never «wrong password», when our grant secret is missing', async () => {
    delete process.env.SHARE_ACCESS_SECRET;

    const { outcome } = await resolvePublicShare({ adminDb: db(), token: TOKEN, password: 'right', hasGrant: noGrant });

    expect(outcome).toEqual({ status: 'refused', reason: 'unavailable' });
  });
});

describe('resolvePublicShare — refusals', () => {
  it.each([
    ['unknown token', {}, 'not-found', 'Another_token_that_matches_nothing_000000000'],
    ['expired link', { expiresAt: new Date(Date.now() - 1000).toISOString() }, 'expired', TOKEN],
    ['exhausted link', { maxAccesses: 2, accessCount: 2 }, 'exhausted', TOKEN],
    ['revoked link — indistinguishable from never-existed', { isActive: false }, 'not-found', TOKEN],
  ])('%s', async (_label, extra, reason, token) => {
    await seedShare({ entityType: 'contact', entityId: 'ct_1', contactMeta: { includedFields: ['name'] }, ...extra });

    const { outcome } = await resolvePublicShare({ adminDb: db(), token, hasGrant: noGrant });

    expect(outcome).toEqual({ status: 'refused', reason });
  });
});

// =============================================================================
// issueShareDownload
// =============================================================================

describe('file links — one opening = one access (Google Drive model)', () => {
  beforeEach(async () => {
    kit.seedCollection(COLLECTIONS.FILES, {
      f_1: { companyId: 'comp_1', storagePath: 'companies/comp_1/f_1.pdf', originalFilename: 'Συμβόλαιο.pdf' },
    });
    await seedShare({ entityType: 'file', entityId: 'f_1', maxAccesses: 1 });
  });

  it('opening counts once, issues a visit grant and a signed INLINE preview URL', async () => {
    const { outcome, grant } = await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: noGrant });

    expect(outcome).toMatchObject({ status: 'resolved', share: { kind: 'file', data: { previewUrl: 'https://signed.example/x' } } });
    expect(signedDownloadUrl).toHaveBeenCalledWith({ storagePath: 'companies/comp_1/f_1.pdf' });
    expect(grant?.shareId).toBe('share_1');
    expect(kit.getData(COLLECTIONS.SHARES, 'share_1')).toMatchObject({ accessCount: 1 });
  });

  it('✅ downloading INSIDE the visit does not spend the limit of 1', async () => {
    await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: noGrant });

    await expect(issueShareDownload({ adminDb: db(), token: TOKEN, hasGrant: (id) => id === 'share_1' }))
      .resolves.toEqual({ status: 'signed', url: 'https://signed.example/x' });
    expect(signedDownloadUrl).toHaveBeenLastCalledWith({
      storagePath: 'companies/comp_1/f_1.pdf', downloadFileName: 'Συμβόλαιο.pdf',
    });
    expect(kit.getData(COLLECTIONS.SHARES, 'share_1')).toMatchObject({ accessCount: 1 });
  });

  it('a reload inside the visit is not a second access', async () => {
    await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: noGrant });

    const again = await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: (id) => id === 'share_1' });

    expect(again.outcome).toMatchObject({ status: 'resolved' });
    expect(kit.getData(COLLECTIONS.SHARES, 'share_1')).toMatchObject({ accessCount: 1 });
  });

  it('🔴 a download WITHOUT a visit counts — there is no uncounted path to the bytes', async () => {
    await expect(issueShareDownload({ adminDb: db(), token: TOKEN, hasGrant: noGrant }))
      .resolves.toMatchObject({ status: 'signed' });

    await expect(issueShareDownload({ adminDb: db(), token: TOKEN, hasGrant: noGrant }))
      .resolves.toEqual({ status: 'refused', reason: 'exhausted' });
  });

  it('a new visit after the limit is refused by name', async () => {
    await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: noGrant });

    const { outcome } = await resolvePublicShare({ adminDb: db(), token: TOKEN, hasGrant: noGrant });

    expect(outcome).toEqual({ status: 'refused', reason: 'exhausted' });
  });
});

// =============================================================================
// mayShareEntity — the server-side canShare
// =============================================================================

describe('mayShareEntity', () => {
  const contact = () => ShareEntityRegistry.get('contact') as NonNullable<ReturnType<typeof ShareEntityRegistry.get>>;

  it('grants only inside the entity’s own company', async () => {
    kit.seedCollection(COLLECTIONS.CONTACTS, { ct_1: { companyId: 'comp_1' } });

    await expect(mayShareEntity(db(), contact(), 'comp_1', 'ct_1')).resolves.toBe(true);
    await expect(mayShareEntity(db(), contact(), 'comp_2', 'ct_1')).resolves.toBe(false);
    await expect(mayShareEntity(db(), contact(), 'comp_1', 'missing')).resolves.toBe(false);
  });

  it('🔴 an entity without a tenant is never shareable — empty is not a company', async () => {
    kit.seedCollection(COLLECTIONS.CONTACTS, { ct_1: { companyId: '' } });

    await expect(mayShareEntity(db(), contact(), '', 'ct_1')).resolves.toBe(false);
  });
});
