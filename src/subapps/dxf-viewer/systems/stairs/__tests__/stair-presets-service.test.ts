/**
 * ADR-358 Phase 7.5 — StairPresetsService unit tests.
 *
 * Covers: CRUD (save/list/delete), 3-scope filtering, 5min cache TTL,
 * cache invalidation on writes, tenant isolation guards.
 *
 * Firestore SDK is fully mocked: queries carry their own filter set so the
 * 3-scope `listPresets()` parallel reads do not race a shared module variable.
 */

import type {
  StairKind,
  StairParams,
  StairPresetDoc,
  StairPresetScope,
} from '../../../types/stair';

// ---------------------------------------------------------------------------
// Firestore mock — in-memory store with per-query filter capture
// ---------------------------------------------------------------------------

interface StoreDoc {
  readonly id: string;
  readonly data: Record<string, unknown>;
}
interface MockWhere {
  readonly __type: 'where';
  readonly field: string;
  readonly value: unknown;
}
interface MockQuery {
  readonly __query: true;
  readonly filters: readonly MockWhere[];
}

const store = new Map<string, StoreDoc>();

const mockSetDoc = jest.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
  store.set(ref.id, { id: ref.id, data });
});

const mockDeleteDoc = jest.fn(async (ref: { id: string }) => {
  store.delete(ref.id);
});

const mockGetDocs = jest.fn(async (q: MockQuery) => {
  const matches: StoreDoc[] = [];
  for (const docEntry of store.values()) {
    const ok = q.filters.every(({ field, value }) => docEntry.data[field] === value);
    if (ok) matches.push(docEntry);
  }
  return {
    empty: matches.length === 0,
    docs: matches.map((m) => ({ id: m.id, data: () => m.data })),
  };
});

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ..._segments: string[]) => ({ __collection: true })),
  doc: jest.fn((_db: unknown, ..._segments: string[]) => ({
    id: _segments[_segments.length - 1],
  })),
  setDoc: (...args: Parameters<typeof mockSetDoc>) => mockSetDoc(...args),
  deleteDoc: (...args: Parameters<typeof mockDeleteDoc>) => mockDeleteDoc(...args),
  getDocs: (q: MockQuery) => mockGetDocs(q),
  query: jest.fn((_col: unknown, ...constraints: unknown[]): MockQuery => ({
    __query: true,
    filters: constraints.filter(
      (c): c is MockWhere =>
        typeof c === 'object' && c !== null && (c as { __type?: string }).__type === 'where',
    ),
  })),
  where: jest.fn(
    (field: string, _op: string, value: unknown): MockWhere => ({
      __type: 'where',
      field,
      value,
    }),
  ),
  serverTimestamp: jest.fn(() => '__server_timestamp__'),
}));

jest.mock('@/lib/firebase', () => ({
  db: { __mockDb: true },
}));

let mockIdCounter = 0;
jest.mock('@/services/enterprise-id.service', () => ({
  generateStairPresetId: () => {
    mockIdCounter += 1;
    return `sprst_test${String(mockIdCounter).padStart(20, '0')}`;
  },
}));

// SUT import AFTER mocks
import { createStairPresetsService, StairPresetsService } from '../stair-presets-service';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const MINIMAL_PARAMS: Omit<StairParams, 'basePoint' | 'direction'> = {
  rise: 175,
  tread: 280,
  nosing: 20,
  nosingSide: 'front',
  width: 1000,
  stepCount: 16,
  totalRise: 2800,
  totalRun: 4480,
  pitch: 32,
  structureType: 'monolithic',
  riserType: 'closed',
  antiskidNosing: false,
  adaContrastStrip: false,
  variant: { kind: 'straight' },
  walklineOffset: 300,
  handrails: { inner: false, outer: true, height: 900 },
  upDirection: 'forward',
  treadNumberStart: 1,
  treadLabelDisplay: 'all',
  treadLabelRestartPerFlight: false,
  codeProfile: 'nok',
};

function seed(
  id: string,
  overrides: Partial<StairPresetDoc> & {
    companyId: string;
    scope: StairPresetScope;
    ownerId: string;
    projectId?: string;
    kind?: StairKind;
  },
): void {
  store.set(id, {
    id,
    data: {
      id,
      name: `preset-${id}`,
      kind: overrides.kind ?? 'straight',
      params: MINIMAL_PARAMS,
      ...overrides,
    },
  });
}

beforeEach(() => {
  store.clear();
  mockIdCounter = 0;
  mockSetDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockGetDocs.mockClear();
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('StairPresetsService — factory', () => {
  it('createStairPresetsService returns instance', () => {
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    expect(svc).toBeInstanceOf(StairPresetsService);
  });
});

describe('StairPresetsService.savePreset', () => {
  it('generates enterprise ID, sets doc, returns canonical payload', async () => {
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    const preset = await svc.savePreset({
      name: 'My Straight',
      kind: 'straight',
      scope: 'user',
      params: MINIMAL_PARAMS,
    });
    expect(preset.id).toMatch(/^sprst_test\d{20}$/);
    expect(preset.name).toBe('My Straight');
    expect(preset.scope).toBe('user');
    expect(preset.ownerId).toBe('u1');
    expect(preset.companyId).toBe('c1');
    expect(preset.kind).toBe('straight');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('trims preset name', async () => {
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    const preset = await svc.savePreset({
      name: '   Padded   ',
      kind: 'straight',
      scope: 'user',
      params: MINIMAL_PARAMS,
    });
    expect(preset.name).toBe('Padded');
  });

  it('rejects empty name', async () => {
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    await expect(
      svc.savePreset({
        name: '   ',
        kind: 'straight',
        scope: 'user',
        params: MINIMAL_PARAMS,
      }),
    ).rejects.toThrow('STAIR_PRESET_NAME_REQUIRED');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects project scope without projectId', async () => {
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    await expect(
      svc.savePreset({
        name: 'X',
        kind: 'straight',
        scope: 'project',
        params: MINIMAL_PARAMS,
      }),
    ).rejects.toThrow('STAIR_PRESET_PROJECT_SCOPE_REQUIRES_PROJECT_ID');
  });

  it('persists projectId only when scope=project', async () => {
    const svc = createStairPresetsService({
      companyId: 'c1',
      userId: 'u1',
      projectId: 'p1',
    });
    const userPreset = await svc.savePreset({
      name: 'U',
      kind: 'straight',
      scope: 'user',
      params: MINIMAL_PARAMS,
    });
    expect((userPreset as { projectId?: string }).projectId).toBeUndefined();

    const projectPreset = await svc.savePreset({
      name: 'P',
      kind: 'straight',
      scope: 'project',
      params: MINIMAL_PARAMS,
    });
    expect(projectPreset.projectId).toBe('p1');
  });
});

describe('StairPresetsService.listPresets — 3-scope resolution', () => {
  it('returns user-scope owned by current user', async () => {
    seed('sprst_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    seed('sprst_b', { companyId: 'c1', scope: 'user', ownerId: 'u2' }); // someone else
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    const presets = await svc.listPresets();
    expect(presets.map((p) => p.id)).toEqual(['sprst_a']);
  });

  it('returns all company-scope presets for tenant', async () => {
    seed('sprst_a', { companyId: 'c1', scope: 'company', ownerId: 'u1' });
    seed('sprst_b', { companyId: 'c1', scope: 'company', ownerId: 'u2' });
    seed('sprst_c', { companyId: 'c2', scope: 'company', ownerId: 'u3' }); // other tenant
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    const presets = await svc.listPresets();
    expect(presets.map((p) => p.id).sort()).toEqual(['sprst_a', 'sprst_b']);
  });

  it('returns project-scope presets only when projectId matches', async () => {
    seed('sprst_a', { companyId: 'c1', scope: 'project', ownerId: 'u1', projectId: 'p1' });
    seed('sprst_b', { companyId: 'c1', scope: 'project', ownerId: 'u1', projectId: 'p2' });
    const svc = createStairPresetsService({
      companyId: 'c1',
      userId: 'u1',
      projectId: 'p1',
    });
    const presets = await svc.listPresets();
    expect(presets.map((p) => p.id)).toEqual(['sprst_a']);
  });

  it('skips project-scope query entirely when projectId not configured', async () => {
    seed('sprst_a', { companyId: 'c1', scope: 'project', ownerId: 'u1', projectId: 'p1' });
    seed('sprst_b', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    const presets = await svc.listPresets();
    expect(presets.map((p) => p.id)).toEqual(['sprst_b']);
  });

  it('merges all 3 scopes', async () => {
    seed('sprst_user', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    seed('sprst_company', { companyId: 'c1', scope: 'company', ownerId: 'u9' });
    seed('sprst_project', {
      companyId: 'c1',
      scope: 'project',
      ownerId: 'u1',
      projectId: 'p1',
    });
    const svc = createStairPresetsService({
      companyId: 'c1',
      userId: 'u1',
      projectId: 'p1',
    });
    const presets = await svc.listPresets();
    expect(presets.map((p) => p.id).sort()).toEqual([
      'sprst_company',
      'sprst_project',
      'sprst_user',
    ]);
  });
});

describe('StairPresetsService — cache (5min TTL)', () => {
  it('serves second call from cache (no extra getDocs)', async () => {
    seed('sprst_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    await svc.listPresets();
    const callsAfterFirst = mockGetDocs.mock.calls.length;
    await svc.listPresets();
    expect(mockGetDocs.mock.calls.length).toBe(callsAfterFirst);
  });

  it('invalidateCache forces re-fetch', async () => {
    seed('sprst_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    await svc.listPresets();
    const calls1 = mockGetDocs.mock.calls.length;
    svc.invalidateCache();
    await svc.listPresets();
    expect(mockGetDocs.mock.calls.length).toBeGreaterThan(calls1);
  });

  it('savePreset invalidates cache', async () => {
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    await svc.listPresets();
    const calls1 = mockGetDocs.mock.calls.length;
    await svc.savePreset({
      name: 'X',
      kind: 'straight',
      scope: 'user',
      params: MINIMAL_PARAMS,
    });
    await svc.listPresets();
    expect(mockGetDocs.mock.calls.length).toBeGreaterThan(calls1);
  });

  it('deletePreset invalidates cache', async () => {
    seed('sprst_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    await svc.listPresets();
    const calls1 = mockGetDocs.mock.calls.length;
    await svc.deletePreset('sprst_a');
    await svc.listPresets();
    expect(mockGetDocs.mock.calls.length).toBeGreaterThan(calls1);
  });

  it('cache expires after TTL', async () => {
    seed('sprst_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    const originalNow = Date.now;
    let t = 1_000_000;
    Date.now = jest.fn(() => t);
    try {
      await svc.listPresets();
      const calls1 = mockGetDocs.mock.calls.length;
      t += 5 * 60 * 1000 + 1;
      await svc.listPresets();
      expect(mockGetDocs.mock.calls.length).toBeGreaterThan(calls1);
    } finally {
      Date.now = originalNow;
    }
  });
});

describe('StairPresetsService.deletePreset', () => {
  it('removes doc and invalidates cache', async () => {
    seed('sprst_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    await svc.deletePreset('sprst_a');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(store.has('sprst_a')).toBe(false);
  });
});

describe('StairPresetsService — tenant isolation', () => {
  it('queries always include companyId filter', async () => {
    seed('sprst_x', { companyId: 'c2', scope: 'company', ownerId: 'u1' });
    const svc = createStairPresetsService({ companyId: 'c1', userId: 'u1' });
    const presets = await svc.listPresets();
    expect(presets).toHaveLength(0);
  });
});
