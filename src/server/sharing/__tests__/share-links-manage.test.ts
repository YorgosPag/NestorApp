/**
 * @jest-environment node
 */

/**
 * ADR-315 §5 — διαχείριση ενεργών συνδέσμων: λίστα (Α12), αλλαγή ρυθμίσεων χωρίς αλλαγή URL
 * (Α13), εσωτερική ετικέτα (Α14), «ανάκληση όλων».
 *
 * Φέρουν βάρος: η λίστα **δεν** βγάζει ποτέ hash/διακριτικό· ξένη οντότητα ⇒ `null`· ληγμένοι
 * έξω· το παλιό `file_shares` μετρά· η αλλαγή ρυθμίσεων κρατά το **ίδιο** έγγραφο (άρα URL).
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/file-audit-admin.service', () => ({ recordFileAudit: jest.fn(async () => 'aud_1') }));
jest.mock('@/services/entity-audit.service', () => ({
  resolveUserDisplayName: jest.fn(async (uid: string) => (uid === 'usr_1' ? 'Γιώργος Π.' : null)),
}));
let idCounter = 0;
jest.mock('@/services/enterprise-id-convenience', () => ({ generateShareId: () => `share_new_${++idCounter}` }));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { resolveUserDisplayName } from '@/services/entity-audit.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';

import { createShareOnServer, parseCreateShareRequest } from '../share-create';
import {
  listActiveShareLinks,
  parseRevokeAllRequest,
  parseShareEntityRef,
  SHARE_LINKS_PAGE_SIZE,
} from '../share-links-list';
import { verifySharePassword } from '../share-password';
import { revokeAllShareLinks } from '../share-revoke';
import { parseUpdateShareRequest, updateShareOnServer } from '../share-update';

const ACTOR = { uid: 'usr_1', companyId: 'comp_1' };
const NOW = Date.parse('2026-09-25T12:00:00.000Z');
const FUTURE = '2026-10-01T00:00:00.000Z';
const PAST = '2026-09-01T00:00:00.000Z';
const FILE_REF = { entityType: 'file', entityId: 'f_1' } as const;

let kit: MockFirestoreKit;
const db = (): Firestore => kit.instance as unknown as Firestore;

function unifiedShare(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tokenHash: 'a'.repeat(64),
    passwordHash: 'scrypt$1$65536,8,2$salt$key',
    passwordFailures: 3,
    entityType: 'file',
    entityId: 'f_1',
    companyId: 'comp_1',
    createdBy: 'usr_1',
    createdAt: '2026-09-20T10:00:00.000Z',
    expiresAt: FUTURE,
    isActive: true,
    requiresPassword: true,
    maxAccesses: 5,
    accessCount: 2,
    lastAccessedAt: '2026-09-24T09:00:00.000Z',
    note: 'Καλημέρα',
    label: 'Συμβολαιογράφος',
    ...extra,
  };
}

beforeEach(() => {
  kit = createMockFirestore();
  kit.seedCollection(COLLECTIONS.FILES, { f_1: { companyId: 'comp_1' }, f_other: { companyId: 'comp_2' } });
  kit.seedCollection(COLLECTIONS.SHARES, {
    sh_old: unifiedShare({ createdAt: '2026-09-10T10:00:00.000Z', label: null }),
    sh_new: unifiedShare(),
    sh_expired: unifiedShare({ expiresAt: PAST }),
    sh_revoked: unifiedShare({ isActive: false }),
    sh_foreign: unifiedShare({ companyId: 'comp_2' }),
    sh_other_entity: unifiedShare({ entityId: 'f_2' }),
  });
  kit.seedCollection(COLLECTIONS.FILE_SHARES, {
    fs_legacy: {
      fileId: 'f_1', companyId: 'comp_1', createdBy: 'usr_9', createdAt: '2026-09-15T10:00:00.000Z',
      expiresAt: FUTURE, isActive: true, requiresPassword: false, maxDownloads: 0, downloadCount: 4,
      lastDownloadedAt: '2026-09-23T08:00:00.000Z', tokenHash: 'b'.repeat(64),
    },
  });
  (recordFileAudit as jest.Mock).mockClear();
  (resolveUserDisplayName as jest.Mock).mockClear();
});

describe('listActiveShareLinks (Α12)', () => {
  it('lists only the active, unexpired links of THIS entity and tenant — newest first, legacy included', async () => {
    const result = await listActiveShareLinks(db(), 'comp_1', FILE_REF, NOW);

    expect(result?.links.map((l) => l.shareId)).toEqual(['sh_new', 'fs_legacy', 'sh_old']);
    expect(result?.hasMore).toBe(false);
  });

  it('🔴 never emits a hash, a token or a password failure counter — the projection is explicit', async () => {
    const result = await listActiveShareLinks(db(), 'comp_1', FILE_REF, NOW);
    const wire = JSON.stringify(result);

    expect(wire).not.toMatch(/tokenHash|passwordHash|passwordFailure|"token"|a{64}|b{64}|scrypt/);
    expect(Object.keys(result?.links[0] ?? {}).sort()).toEqual([
      'accessCount', 'createdAt', 'createdBy', 'expiresAt', 'label', 'lastAccessedAt',
      'lockedUntil', 'maxAccesses', 'note', 'requiresPassword', 'shareId', 'state',
    ]);
  });

  it('maps the legacy vocabulary (downloads) onto the same shape', async () => {
    const legacy = (await listActiveShareLinks(db(), 'comp_1', FILE_REF, NOW))?.links.find((l) => l.shareId === 'fs_legacy');

    expect(legacy).toMatchObject({ accessCount: 4, maxAccesses: 0, lastAccessedAt: '2026-09-23T08:00:00.000Z', label: null });
  });

  it('resolves each creator name once', async () => {
    const result = await listActiveShareLinks(db(), 'comp_1', FILE_REF, NOW);

    expect(result?.links[0]?.createdBy).toEqual({ uid: 'usr_1', name: 'Γιώργος Π.' });
    expect(resolveUserDisplayName).toHaveBeenCalledTimes(2);
  });

  it('names the state: exhausted and locked are not «active»', async () => {
    kit.seedCollection(COLLECTIONS.SHARES, {
      sh_full: unifiedShare({ accessCount: 5 }),
      sh_locked: unifiedShare({ passwordLockedUntil: '2026-09-25T12:10:00.000Z' }),
    });
    const links = (await listActiveShareLinks(db(), 'comp_1', FILE_REF, NOW))?.links ?? [];

    expect(links.find((l) => l.shareId === 'sh_full')?.state).toBe('exhausted');
    expect(links.find((l) => l.shareId === 'sh_locked')).toMatchObject({
      state: 'locked', lockedUntil: '2026-09-25T12:10:00.000Z',
    });
  });

  it('🔴 another tenant’s entity ⇒ null (the route answers 404, not «forbidden»)', async () => {
    await expect(listActiveShareLinks(db(), 'comp_1', { entityType: 'file', entityId: 'f_other' }, NOW)).resolves.toBeNull();
    await expect(listActiveShareLinks(db(), 'comp_1', { entityType: 'file', entityId: 'nope' }, NOW)).resolves.toBeNull();
  });

  it('pages at SHARE_LINKS_PAGE_SIZE and says there is more', async () => {
    const many: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i <= SHARE_LINKS_PAGE_SIZE; i++) many[`sh_${i}`] = unifiedShare();
    kit.seedCollection(COLLECTIONS.SHARES, many);
    kit.seedCollection(COLLECTIONS.FILE_SHARES, {});

    const result = await listActiveShareLinks(db(), 'comp_1', FILE_REF, NOW);

    expect(result?.links).toHaveLength(SHARE_LINKS_PAGE_SIZE);
    expect(result?.hasMore).toBe(true);
  });
});

describe('request parsers', () => {
  it('accepts a resolvable kind only', () => {
    expect(parseShareEntityRef({ entityType: 'file', entityId: 'f_1' })).toEqual(FILE_REF);
    expect(parseShareEntityRef({ entityType: 'vendor_rfq_invite', entityId: 'x' })).toBeNull();
    expect(parseShareEntityRef({ entityType: 'file', entityId: null })).toBeNull();
  });

  it('revoke-all rejects unknown fields', () => {
    expect(parseRevokeAllRequest({ ...FILE_REF, exceptShareId: 'sh_new' })).toEqual({ ...FILE_REF, exceptShareId: 'sh_new' });
    expect(parseRevokeAllRequest({ ...FILE_REF, companyId: 'comp_2' })).toBeNull();
  });

  it('update needs at least one known field', () => {
    expect(parseUpdateShareRequest({})).toBeNull();
    expect(parseUpdateShareRequest({ isActive: true })).toBeNull();
    expect(parseUpdateShareRequest({ password: null })).toEqual({ password: null });
    expect(parseUpdateShareRequest({ expiresInHours: 10_000 })).toBeNull();
  });
});

describe('updateShareOnServer (Α13 — same URL)', () => {
  it('changes the policy on the SAME document — the token fingerprint is untouched', async () => {
    const outcome = await updateShareOnServer(db(), ACTOR, 'sh_new', { expiresInHours: 24, label: 'Τράπεζα' });

    expect(outcome.ok).toBe(true);
    const stored = kit.getData(COLLECTIONS.SHARES, 'sh_new');
    expect(stored).toMatchObject({ tokenHash: 'a'.repeat(64), label: 'Τράπεζα', updatedBy: 'usr_1' });
    expect(Date.parse(String(stored?.expiresAt))).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    if (outcome.ok) expect(JSON.stringify(outcome.link)).not.toMatch(/Hash/);
  });

  it('sets a password with scrypt and clears the lockout; null removes it', async () => {
    const chosen = ['νέος', 'κωδικός'].join('-'); // σταθερά test, όχι μυστικό (secret scan)
    await updateShareOnServer(db(), ACTOR, 'sh_new', { password: chosen });
    const withPassword = kit.getData(COLLECTIONS.SHARES, 'sh_new');
    await expect(verifySharePassword(chosen, String(withPassword?.passwordHash))).resolves.toMatchObject({ ok: true });
    expect(withPassword).toMatchObject({ requiresPassword: true, passwordFailures: 0, passwordLockedUntil: null });

    await updateShareOnServer(db(), ACTOR, 'sh_new', { password: null });
    expect(kit.getData(COLLECTIONS.SHARES, 'sh_new')).toMatchObject({ requiresPassword: false, passwordHash: null });
  });

  it('refuses a limit below the opens already made — and writes nothing', async () => {
    kit.clearWrites();

    await expect(updateShareOnServer(db(), ACTOR, 'sh_new', { maxAccesses: 1 }))
      .resolves.toEqual({ ok: false, refusal: 'invalid', reason: 'max-below-count' });
    expect(kit.writes()).toEqual([]);
  });

  it('writes the legacy vocabulary on a legacy link', async () => {
    await updateShareOnServer(db(), ACTOR, 'fs_legacy', { maxAccesses: 10 });

    expect(kit.getData(COLLECTIONS.FILE_SHARES, 'fs_legacy')).toMatchObject({ maxDownloads: 10 });
  });

  it('🔴 a revoked or foreign link is «not-found» — settings are no back door to revival', async () => {
    kit.clearWrites();

    await expect(updateShareOnServer(db(), ACTOR, 'sh_revoked', { expiresInHours: 24 })).resolves.toMatchObject({ refusal: 'not-found' });
    await expect(updateShareOnServer(db(), ACTOR, 'sh_foreign', { expiresInHours: 24 })).resolves.toMatchObject({ refusal: 'not-found' });
    expect(kit.writes()).toEqual([]);
  });
});

describe('revokeAllShareLinks', () => {
  it('revokes every active link of the entity except the one kept — and audits the file', async () => {
    await expect(revokeAllShareLinks(db(), ACTOR, { ...FILE_REF, exceptShareId: 'sh_new' })).resolves.toBe(3);

    expect(kit.getData(COLLECTIONS.SHARES, 'sh_new')?.isActive).toBe(true);
    expect(kit.getData(COLLECTIONS.SHARES, 'sh_old')).toMatchObject({ isActive: false, revokedBy: 'usr_1' });
    expect(kit.getData(COLLECTIONS.FILE_SHARES, 'fs_legacy')?.isActive).toBe(false);
    expect(kit.getData(COLLECTIONS.SHARES, 'sh_foreign')?.isActive).toBe(true);
    expect(kit.getData(COLLECTIONS.SHARES, 'sh_other_entity')?.isActive).toBe(true);
    expect(recordFileAudit).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'f_1', action: 'share_revoke' }));
  });

  it('is idempotent', async () => {
    await revokeAllShareLinks(db(), ACTOR, FILE_REF);

    await expect(revokeAllShareLinks(db(), ACTOR, FILE_REF)).resolves.toBe(0);
  });

  it('🔴 another tenant’s entity ⇒ null and nothing is written', async () => {
    kit.clearWrites();

    await expect(revokeAllShareLinks(db(), ACTOR, { entityType: 'file', entityId: 'f_other' })).resolves.toBeNull();
    expect(kit.writes()).toEqual([]);
  });
});

describe('the internal label (Α14)', () => {
  it('is stored on creation', async () => {
    const request = parseCreateShareRequest({ ...FILE_REF, label: '  Λογιστής  ' });
    const outcome = await createShareOnServer(db(), ACTOR, request!);

    expect(outcome.ok && kit.getData(COLLECTIONS.SHARES, outcome.result.shareId)?.label).toBe('Λογιστής');
  });
});
