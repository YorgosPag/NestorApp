/**
 * UnifiedSharingService unit tests (ADR-315 Phase M1)
 *
 * Covers token lifecycle only — no resolvers, no dispatch, no bcrypt.
 * Firestore SDK fully mocked.
 */

// Node 18+ has TextEncoder + webcrypto, but jest's default env may not expose
// them on globalThis. Polyfill before SUT import.
import { TextEncoder as NodeTextEncoder } from 'util';
import { webcrypto as nodeWebCrypto } from 'crypto';
if (typeof globalThis.TextEncoder === 'undefined') {
  (globalThis as unknown as { TextEncoder: typeof NodeTextEncoder }).TextEncoder = NodeTextEncoder;
}
// crypto.subtle is not exposed in default node/jest env — force-assign webcrypto.
Object.defineProperty(globalThis, 'crypto', {
  value: nodeWebCrypto,
  configurable: true,
  writable: true,
});

import type {
  CreateShareInput,
  ShareEntityType,
  ShareRecord,
} from '@/types/sharing';

// ---------------------------------------------------------------------------
// Firestore mock — module-level in-memory store
// ---------------------------------------------------------------------------

type StoreDoc = { id: string; data: Record<string, unknown> };
const store = new Map<string, StoreDoc>();

const mockSetDoc = jest.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
  store.set(ref.id, { id: ref.id, data });
});

const mockGetDoc = jest.fn(async (ref: { id: string }) => {
  const doc = store.get(ref.id);
  return {
    exists: () => !!doc,
    data: () => doc?.data ?? {},
    id: ref.id,
  };
});

const mockUpdateDoc = jest.fn(async (ref: { id: string }, patch: Record<string, unknown>) => {
  const doc = store.get(ref.id);
  if (!doc) return;
  store.set(ref.id, { id: ref.id, data: { ...doc.data, ...patch } });
});

let lastQueryFilters: Array<{ field: string; value: unknown }> = [];

const mockGetDocs = jest.fn(async () => {
  const matches: StoreDoc[] = [];
  for (const doc of store.values()) {
    const ok = lastQueryFilters.every(
      ({ field, value }) => doc.data[field] === value,
    );
    if (ok) matches.push(doc);
  }
  return {
    empty: matches.length === 0,
    docs: matches.map((m) => ({
      id: m.id,
      data: () => m.data,
    })),
  };
});

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ __collection: name })),
  doc: jest.fn((_db: unknown, _name: string, id: string) => ({ id })),
  setDoc: (...args: Parameters<typeof mockSetDoc>) => mockSetDoc(...args),
  getDoc: (...args: Parameters<typeof mockGetDoc>) => mockGetDoc(...args),
  updateDoc: (...args: Parameters<typeof mockUpdateDoc>) => mockUpdateDoc(...args),
  getDocs: (...args: Parameters<typeof mockGetDocs>) => mockGetDocs(...args),
  query: jest.fn((_col: unknown, ...constraints: unknown[]) => {
    lastQueryFilters = constraints
      .filter(
        (c): c is { __type: 'where'; field: string; value: unknown } =>
          typeof c === 'object' && c !== null && (c as { __type?: string }).__type === 'where',
      )
      .map((c) => ({ field: c.field, value: c.value }));
    return { __query: true };
  }),
  where: jest.fn((field: string, _op: string, value: unknown) => ({
    __type: 'where',
    field,
    value,
  })),
  orderBy: jest.fn(() => ({ __type: 'orderBy' })),
  limit: jest.fn(() => ({ __type: 'limit' })),
  serverTimestamp: jest.fn(() => '__server_timestamp__'),
}));

jest.mock('@/lib/firebase', () => ({
  db: { __mockDb: true },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

let shareIdCounter = 0;
jest.mock('@/services/enterprise-id-convenience', () => ({
  generateShareId: jest.fn(() => `share_test_${++shareIdCounter}`),
}));

// ---------------------------------------------------------------------------
// SUT
// ---------------------------------------------------------------------------

import { UnifiedSharingService } from '@/services/sharing/unified-sharing.service';
import { ShareEntityRegistry } from '@/services/sharing/share-entity-registry';

const baseInput: CreateShareInput = {
  entityType: 'file',
  entityId: 'file_abc',
  companyId: 'comp_1',
  createdBy: 'usr_1',
};

function seedShare(overrides: Partial<ShareRecord> = {}): string {
  const id = `share_seed_${store.size + 1}`;
  store.set(id, {
    id,
    data: {
      token: 'tok_seed',
      entityType: 'file' satisfies ShareEntityType,
      entityId: 'file_abc',
      companyId: 'comp_1',
      createdBy: 'usr_1',
      createdAt: '2026-04-18T00:00:00Z',
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      isActive: true,
      requiresPassword: false,
      passwordHash: null,
      maxAccesses: 0,
      accessCount: 0,
      note: null,
      ...overrides,
    },
  });
  return id;
}

beforeEach(() => {
  store.clear();
  lastQueryFilters = [];
  shareIdCounter = 0;
  ShareEntityRegistry.clear();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createShare
// ---------------------------------------------------------------------------

describe('UnifiedSharingService.createShare', () => {
  it('persists a share with enterprise ID and random token', async () => {
    const result = await UnifiedSharingService.createShare(baseInput);

    expect(result.shareId).toBe('share_test_1');
    expect(result.token).toHaveLength(32);
    expect(result.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(store.get('share_test_1')?.data.isActive).toBe(true);
    expect(store.get('share_test_1')?.data.requiresPassword).toBe(false);
  });

  it('hashes password when provided and sets requiresPassword flag', async () => {
    const result = await UnifiedSharingService.createShare({
      ...baseInput,
      password: 'hunter2',
    });
    const saved = store.get(result.shareId)!.data;
    expect(saved.requiresPassword).toBe(true);
    expect(typeof saved.passwordHash).toBe('string');
    expect((saved.passwordHash as string).length).toBe(64);
  });

  it('respects custom expiresInHours', async () => {
    const before = Date.now();
    const result = await UnifiedSharingService.createShare({
      ...baseInput,
      expiresInHours: 1,
    });
    const delta = new Date(result.expiresAt).getTime() - before;
    expect(delta).toBeGreaterThan(59 * 60 * 1000);
    expect(delta).toBeLessThan(61 * 60 * 1000);
  });

  it('rejects invalid input via registry validator when registered', async () => {
    ShareEntityRegistry.register('file', {
      validateCreateInput: () => ({ valid: false, reason: 'no permission' }),
      canShare: async () => true,
      resolve: async () => ({}),
      safePublicProjection: () => ({}) as never,
      renderPublic: () => null,
    });

    await expect(UnifiedSharingService.createShare(baseInput)).rejects.toThrow(
      /no permission/,
    );
  });
});

// ---------------------------------------------------------------------------
// validateShare
// ---------------------------------------------------------------------------

describe('UnifiedSharingService.validateShare', () => {
  it('returns valid=false when token not found', async () => {
    const result = await UnifiedSharingService.validateShare('missing_token');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not found/);
  });

  it('returns valid share when token matches and is active', async () => {
    seedShare({ token: 'tok_valid' });
    const result = await UnifiedSharingService.validateShare('tok_valid');
    expect(result.valid).toBe(true);
    expect(result.share?.token).toBe('tok_valid');
  });

  it('returns expired reason when past expiresAt', async () => {
    seedShare({
      token: 'tok_expired',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const result = await UnifiedSharingService.validateShare('tok_expired');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/);
  });

  it('returns limit reason when access count reaches maxAccesses', async () => {
    seedShare({
      token: 'tok_limit',
      maxAccesses: 2,
      accessCount: 2,
    });
    const result = await UnifiedSharingService.validateShare('tok_limit');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/limit/i);
  });

  it('treats maxAccesses=0 as unlimited', async () => {
    seedShare({
      token: 'tok_unlim',
      maxAccesses: 0,
      accessCount: 9999,
    });
    const result = await UnifiedSharingService.validateShare('tok_unlim');
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------

describe('UnifiedSharingService.verifyPassword', () => {
  it('returns true when share does not require password', async () => {
    const share = { requiresPassword: false, passwordHash: null } as ShareRecord;
    expect(await UnifiedSharingService.verifyPassword(share, '')).toBe(true);
  });

  it('returns true for matching password, false for mismatch', async () => {
    const created = await UnifiedSharingService.createShare({
      ...baseInput,
      password: 'correct',
    });
    const saved = store.get(created.shareId)!.data;
    const share = {
      requiresPassword: true,
      passwordHash: saved.passwordHash,
    } as ShareRecord;

    expect(await UnifiedSharingService.verifyPassword(share, 'correct')).toBe(true);
    expect(await UnifiedSharingService.verifyPassword(share, 'wrong')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// incrementAccessCount / revoke
// ---------------------------------------------------------------------------

describe('UnifiedSharingService.incrementAccessCount', () => {
  it('increments count by 1 and sets lastAccessedAt', async () => {
    const id = seedShare({ accessCount: 3 });
    await UnifiedSharingService.incrementAccessCount(id);
    const saved = store.get(id)!.data;
    expect(saved.accessCount).toBe(4);
    expect(saved.lastAccessedAt).toBe('__server_timestamp__');
  });

  it('is a no-op for unknown share id', async () => {
    await expect(
      UnifiedSharingService.incrementAccessCount('nonexistent'),
    ).resolves.toBeUndefined();
  });
});

describe('UnifiedSharingService.revoke', () => {
  it('deactivates share and records revokedBy', async () => {
    const id = seedShare({ isActive: true });
    await UnifiedSharingService.revoke(id, 'usr_admin');
    const saved = store.get(id)!.data;
    expect(saved.isActive).toBe(false);
    expect(saved.revokedBy).toBe('usr_admin');
    expect(saved.revokedAt).toBe('__server_timestamp__');
  });
});

// ---------------------------------------------------------------------------
// listing
// ---------------------------------------------------------------------------

describe('UnifiedSharingService.listSharesForEntity', () => {
  it('filters by companyId + entityType + entityId + isActive', async () => {
    seedShare({ token: 'a', entityType: 'file', entityId: 'f1', companyId: 'comp_1', isActive: true });
    seedShare({ token: 'b', entityType: 'file', entityId: 'f1', companyId: 'comp_2', isActive: true });
    seedShare({ token: 'c', entityType: 'contact', entityId: 'f1', companyId: 'comp_1', isActive: true });
    seedShare({ token: 'd', entityType: 'file', entityId: 'f1', companyId: 'comp_1', isActive: false });

    const result = await UnifiedSharingService.listSharesForEntity(
      'file',
      'f1',
      'comp_1',
    );
    expect(result).toHaveLength(1);
    expect(result[0].token).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// canShare (registry delegation)
// ---------------------------------------------------------------------------

describe('UnifiedSharingService.canShare', () => {
  it('returns false when no resolver registered', async () => {
    const ok = await UnifiedSharingService.canShare(
      { uid: 'u1', companyId: 'comp_1' },
      'file',
      'file_abc',
    );
    expect(ok).toBe(false);
  });

  it('delegates to registered resolver', async () => {
    const canShare = jest.fn(async () => true);
    ShareEntityRegistry.register('file', {
      validateCreateInput: () => ({ valid: true }),
      canShare,
      resolve: async () => ({}),
      safePublicProjection: () => ({}) as never,
      renderPublic: () => null,
    });

    const ok = await UnifiedSharingService.canShare(
      { uid: 'u1', companyId: 'comp_1' },
      'file',
      'file_abc',
    );
    expect(ok).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ uid: 'u1', companyId: 'comp_1' }, 'file_abc');
  });
});
