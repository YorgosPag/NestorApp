/**
 * @jest-environment node
 */

/**
 * ADR-884 Φ0.12 — the one token lookup, the one access counter, the per-link
 * password lock. In-memory Firestore (`test-utils/mock-firestore`).
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { COLLECTIONS } from '@/config/firestore-collections';
import { hashShareToken } from '@/lib/sharing/share-token';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { Firestore } from 'firebase-admin/firestore';

import { judgeShareAccess, recordShareAccess } from '../share-access';
import {
  attemptSharePassword,
  nextFailureState,
  SHARE_PASSWORD_LOCK_MS,
  SHARE_PASSWORD_MAX_FAILURES,
  SHARE_PASSWORD_WINDOW_MS,
} from '../share-password-attempt';
import { hashSharePassword } from '../share-password';
import { findActiveShareByToken, type StoredShare } from '../share-token-lookup';

const TOKEN = 'NewGenerationToken_abcdefghijklmnopqrstuvwxy';
const LEGACY_TOKEN = 'LegacyToken0123456789abcdefghijk';
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

let kit: MockFirestoreKit;
const db = (): Firestore => kit.instance as unknown as Firestore;

const unifiedDoc = async (extra: Record<string, unknown> = {}) => ({
  tokenHash: await hashShareToken(TOKEN),
  isActive: true,
  entityType: 'building_showcase',
  entityId: 'bld_1',
  companyId: 'comp_1',
  createdBy: 'usr_1',
  expiresAt: FUTURE,
  requiresPassword: false,
  maxAccesses: 0,
  accessCount: 0,
  ...extra,
});

beforeEach(() => {
  kit = createMockFirestore();
});

// =============================================================================
// findActiveShareByToken
// =============================================================================

describe('findActiveShareByToken', () => {
  it('finds a share by the FINGERPRINT — the raw token is never stored', async () => {
    kit.seedCollection(COLLECTIONS.SHARES, { share_1: await unifiedDoc() });

    const share = await findActiveShareByToken(db(), TOKEN);

    expect(share).toMatchObject({ id: 'share_1', source: 'shares', entityType: 'building_showcase' });
  });

  it('🔴 no longer opens a document that holds only the RAW token (fallback removed after migration)', async () => {
    const { tokenHash: _dropped, ...rest } = await unifiedDoc();
    kit.seedCollection(COLLECTIONS.SHARES, { share_1: { ...rest, token: LEGACY_TOKEN } });

    expect(await findActiveShareByToken(db(), LEGACY_TOKEN)).toBeNull();
  });

  it('normalises a legacy file_shares showcase into the one shape', async () => {
    kit.seedCollection(COLLECTIONS.FILE_SHARES, {
      fs_1: {
        tokenHash: await hashShareToken(LEGACY_TOKEN), isActive: true, showcaseMode: true, showcasePropertyId: 'prop_1',
        companyId: 'comp_1', expiresAt: FUTURE, pdfStoragePath: 'p.pdf', downloadCount: 2, maxDownloads: 5,
      },
    });

    expect(await findActiveShareByToken(db(), LEGACY_TOKEN)).toMatchObject({
      source: 'file_shares', entityType: 'property_showcase', entityId: 'prop_1',
      accessCount: 2, maxAccesses: 5, showcaseMeta: { pdfStoragePath: 'p.pdf' },
    });
  });

  it('ignores a revoked share', async () => {
    kit.seedCollection(COLLECTIONS.SHARES, { share_1: await unifiedDoc({ isActive: false }) });

    expect(await findActiveShareByToken(db(), TOKEN)).toBeNull();
  });

  it('refuses a share missing its tenant — never served, whatever the token', async () => {
    kit.seedCollection(COLLECTIONS.SHARES, { share_1: await unifiedDoc({ companyId: '' }) });

    expect(await findActiveShareByToken(db(), TOKEN)).toBeNull();
  });

  it('rejects garbage before touching the database', async () => {
    kit.seedCollection(COLLECTIONS.SHARES, { share_1: await unifiedDoc() });

    expect(await findActiveShareByToken(db(), '../x')).toBeNull();
  });
});

// =============================================================================
// recordShareAccess — the transactional counter
// =============================================================================

describe('judgeShareAccess (pure)', () => {
  const fields = { count: 'accessCount', max: 'maxAccesses', last: 'lastAccessedAt' } as const;
  const now = Date.now();

  it.each([
    ['a revoked share', { isActive: false, expiresAt: FUTURE }, 'gone'],
    ['an expired share', { isActive: true, expiresAt: PAST }, 'expired'],
    ['a share at its limit', { isActive: true, expiresAt: FUTURE, maxAccesses: 3, accessCount: 3 }, 'exhausted'],
    ['an unlimited share', { isActive: true, expiresAt: FUTURE, maxAccesses: 0, accessCount: 999 }, 'recorded'],
  ])('judges %s', (_label, data, verdict) => {
    expect(judgeShareAccess(data, fields, now)).toBe(verdict);
  });
});

describe('recordShareAccess', () => {
  const load = async () => (await findActiveShareByToken(db(), TOKEN)) as StoredShare;

  it('increments the counter and stamps the time', async () => {
    kit.seedCollection(COLLECTIONS.SHARES, { share_1: await unifiedDoc({ accessCount: 1 }) });

    await expect(recordShareAccess(db(), await load())).resolves.toBe('recorded');
    expect(kit.getData(COLLECTIONS.SHARES, 'share_1')).toMatchObject({ accessCount: 2 });
  });

  it('🔴 refuses the access that would cross the limit — judged on the FRESH read', async () => {
    kit.seedCollection(COLLECTIONS.SHARES, { share_1: await unifiedDoc({ maxAccesses: 2, accessCount: 1 }) });
    const share = await load(); // read at count 1

    await expect(recordShareAccess(db(), share)).resolves.toBe('recorded');
    // The stale in-memory `share` still says 1 — the transaction must not believe it.
    await expect(recordShareAccess(db(), share)).resolves.toBe('exhausted');
    expect(kit.getData(COLLECTIONS.SHARES, 'share_1')).toMatchObject({ accessCount: 2 });
  });

  it('writes the legacy vocabulary on a legacy share', async () => {
    kit.seedCollection(COLLECTIONS.FILE_SHARES, {
      fs_1: { tokenHash: await hashShareToken(LEGACY_TOKEN), isActive: true, fileId: 'f_1', companyId: 'comp_1', expiresAt: FUTURE, downloadCount: 4 },
    });
    const share = (await findActiveShareByToken(db(), LEGACY_TOKEN)) as StoredShare;

    await recordShareAccess(db(), share);

    expect(kit.getData(COLLECTIONS.FILE_SHARES, 'fs_1')).toMatchObject({ downloadCount: 5 });
  });
});

// =============================================================================
// attemptSharePassword — the per-link lock
// =============================================================================

describe('nextFailureState (pure)', () => {
  const now = Date.parse('2026-09-25T10:00:00.000Z');

  it('opens a window on the first failure', () => {
    expect(nextFailureState(0, null, now)).toEqual({
      passwordFailures: 1, passwordFailureWindowStart: new Date(now).toISOString(), passwordLockedUntil: null,
    });
  });

  it('starts over once the window has passed', () => {
    const stale = new Date(now - SHARE_PASSWORD_WINDOW_MS - 1).toISOString();

    expect(nextFailureState(9, stale, now).passwordFailures).toBe(1);
  });

  it(`locks for the lock period on failure #${SHARE_PASSWORD_MAX_FAILURES} inside the window`, () => {
    const start = new Date(now - 1000).toISOString();
    const next = nextFailureState(SHARE_PASSWORD_MAX_FAILURES - 1, start, now);

    expect(next.passwordLockedUntil).toBe(new Date(now + SHARE_PASSWORD_LOCK_MS).toISOString());
  });
});

describe('attemptSharePassword', () => {
  const seedProtected = async (extra: Record<string, unknown> = {}) => {
    kit.seedCollection(COLLECTIONS.SHARES, {
      share_1: await unifiedDoc({ requiresPassword: true, passwordHash: await hashSharePassword('right'), ...extra }),
    });
    return (await findActiveShareByToken(db(), TOKEN)) as StoredShare;
  };

  it('accepts the right password and clears earlier failures', async () => {
    const share = await seedProtected({ passwordFailures: 4 });

    await expect(attemptSharePassword(db(), share, 'right')).resolves.toBe('ok');
    expect(kit.getData(COLLECTIONS.SHARES, 'share_1')).toMatchObject({ passwordFailures: 0 });
  });

  it('counts a wrong password', async () => {
    const share = await seedProtected();

    await expect(attemptSharePassword(db(), share, 'wrong')).resolves.toBe('wrong-password');
    expect(kit.getData(COLLECTIONS.SHARES, 'share_1')).toMatchObject({ passwordFailures: 1 });
  });

  it('🔴 a locked link refuses even the RIGHT password until the lock expires', async () => {
    const share = await seedProtected({ passwordLockedUntil: FUTURE });

    await expect(attemptSharePassword(db(), share, 'right')).resolves.toBe('locked');
  });

  it('upgrades a legacy SHA-256 hash on the first right entry (rehash-on-verify)', async () => {
    const { createHash } = await import('crypto');
    const share = await seedProtected({ passwordHash: createHash('sha256').update('old').digest('hex') });

    await expect(attemptSharePassword(db(), share, 'old')).resolves.toBe('ok');
    expect(kit.getData(COLLECTIONS.SHARES, 'share_1')?.passwordHash).toMatch(/^scrypt\$1\$/);
  });
});
