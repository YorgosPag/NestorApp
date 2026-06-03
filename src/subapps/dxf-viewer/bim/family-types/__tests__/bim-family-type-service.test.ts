/**
 * ADR-412 Φ1 — BimFamilyTypeService unit tests.
 *
 * Covers:
 *   - saveType: enterprise ID generated, setDoc called, correct payload shape,
 *     projectId persisted ONLY when scope=project, name trimmed, empty name
 *     rejected, project scope without projectId rejected.
 *   - listTypes: 3-scope merge (user/company/project), category filter applied
 *     in-memory, project scope skipped when no projectId configured.
 *   - updateType: updateDoc called (NOT setDoc), patch payload shape, immutable
 *     fields absent, name-only and typeParams-only patches.
 *   - deleteType: deleteDoc called, cache invalidated.
 *   - Cache: 5-min TTL, invalidated on every write.
 *   - SOS N.6: addDoc never called.
 *
 * Firestore SDK is fully mocked using the same in-memory store pattern as
 * stair-presets-service.test.ts and stair-firestore-service.test.ts.
 *
 * @see ../bim-family-type-service
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

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

const mockUpdateDoc = jest.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
  const existing = store.get(ref.id);
  store.set(ref.id, {
    id: ref.id,
    data: { ...(existing?.data ?? {}), ...data },
  });
});

const mockDeleteDoc = jest.fn(async (ref: { id: string }) => {
  store.delete(ref.id);
});

const mockAddDoc = jest.fn(); // SOS N.6 — should NEVER be called

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
  updateDoc: (...args: Parameters<typeof mockUpdateDoc>) => mockUpdateDoc(...args),
  deleteDoc: (...args: Parameters<typeof mockDeleteDoc>) => mockDeleteDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
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

// ---------------------------------------------------------------------------
// Enterprise ID mock
// ---------------------------------------------------------------------------

let mockIdCounter = 0;
jest.mock('@/services/enterprise-id.service', () => ({
  generateBimFamilyTypeId: () => {
    mockIdCounter += 1;
    return `bimft_test${String(mockIdCounter).padStart(20, '0')}`;
  },
}));

// ---------------------------------------------------------------------------
// SUT import AFTER mocks
// ---------------------------------------------------------------------------

import {
  BimFamilyTypeService,
  createBimFamilyTypeService,
} from '../bim-family-type-service';
import type { BimFamilyType } from '../../types/bim-family-type';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid WallTypeParams (mirrors WallTypeParamsSchema required fields). */
const WALL_TYPE_PARAMS = {
  category: 'exterior' as const,
  thickness: 250,
};

/**
 * Minimal valid StairTypeParams (mirrors StairTypeParamsSchema required fields).
 * Composite objects (variant, handrails) are opaque pass-throughs.
 */
const STAIR_TYPE_PARAMS = {
  rise: 175,
  tread: 280,
  nosing: 20,
  nosingSide: 'front' as const,
  width: 1000,
  stepCount: 16,
  totalRise: 2800,
  totalRun: 4480,
  pitch: 32,
  structureType: 'monolithic' as const,
  riserType: 'closed' as const,
  antiskidNosing: false,
  adaContrastStrip: false,
  variant: { kind: 'straight' },
  walklineOffset: 300,
  handrails: { inner: false, outer: true, height: 900 },
  upDirection: 'forward' as const,
  treadNumberStart: 1,
  treadLabelDisplay: 'all' as const,
  treadLabelRestartPerFlight: false,
  codeProfile: 'nok' as const,
};

/** Seeds a doc directly into the in-memory store. */
function seed(
  id: string,
  overrides: Partial<BimFamilyType> & {
    companyId: string;
    scope: BimFamilyType['scope'];
    ownerId: string;
    projectId?: string;
    category?: BimFamilyType['category'];
  },
): void {
  store.set(id, {
    id,
    data: {
      id,
      name: `type-${id}`,
      category: overrides.category ?? 'wall',
      origin: 'user',
      typeParams: WALL_TYPE_PARAMS,
      ...overrides,
    },
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  store.clear();
  mockIdCounter = 0;
  mockSetDoc.mockClear();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockAddDoc.mockClear();
  mockGetDocs.mockClear();
});

// ===========================================================================
// Factory
// ===========================================================================

describe('BimFamilyTypeService — factory', () => {
  it('createBimFamilyTypeService returns instance', () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    expect(svc).toBeInstanceOf(BimFamilyTypeService);
  });
});

// ===========================================================================
// saveType
// ===========================================================================

describe('BimFamilyTypeService.saveType — wall', () => {
  it('generates an enterprise ID, calls setDoc, returns canonical payload', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    const result = await svc.saveType({
      name: 'Standard Exterior',
      category: 'wall',
      scope: 'user',
      origin: 'user',
      typeParams: WALL_TYPE_PARAMS,
    });
    expect(result.id).toMatch(/^bimft_test\d{20}$/);
    expect(result.name).toBe('Standard Exterior');
    expect(result.category).toBe('wall');
    expect(result.scope).toBe('user');
    expect(result.origin).toBe('user');
    expect(result.companyId).toBe('c1');
    expect(result.ownerId).toBe('u1');
    expect(result.typeParams).toEqual(WALL_TYPE_PARAMS);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('trims whitespace from name', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    const result = await svc.saveType({
      name: '   Padded Name   ',
      category: 'wall',
      scope: 'company',
      origin: 'user',
      typeParams: WALL_TYPE_PARAMS,
    });
    expect(result.name).toBe('Padded Name');
  });

  it('stamps audit fields with userId + server timestamp', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.saveType({
      name: 'Wall',
      category: 'wall',
      scope: 'company',
      origin: 'user',
      typeParams: WALL_TYPE_PARAMS,
    });
    const payload = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload['createdBy']).toBe('u1');
    expect(payload['updatedBy']).toBe('u1');
    expect(payload['createdAt']).toBe('__server_timestamp__');
    expect(payload['updatedAt']).toBe('__server_timestamp__');
  });

  it('rejects empty name', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await expect(
      svc.saveType({
        name: '   ',
        category: 'wall',
        scope: 'user',
        origin: 'user',
        typeParams: WALL_TYPE_PARAMS,
      }),
    ).rejects.toThrow('BIM_FAMILY_TYPE_NAME_REQUIRED');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('rejects project scope without projectId in config', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await expect(
      svc.saveType({
        name: 'Wall',
        category: 'wall',
        scope: 'project',
        origin: 'user',
        typeParams: WALL_TYPE_PARAMS,
      }),
    ).rejects.toThrow('BIM_FAMILY_TYPE_PROJECT_SCOPE_REQUIRES_PROJECT_ID');
  });

  it('persists projectId ONLY when scope=project', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1', projectId: 'p1' });

    const userResult = await svc.saveType({
      name: 'User Wall',
      category: 'wall',
      scope: 'user',
      origin: 'user',
      typeParams: WALL_TYPE_PARAMS,
    });
    expect((userResult as { projectId?: string }).projectId).toBeUndefined();

    const projectResult = await svc.saveType({
      name: 'Project Wall',
      category: 'wall',
      scope: 'project',
      origin: 'user',
      typeParams: WALL_TYPE_PARAMS,
    });
    expect(projectResult.projectId).toBe('p1');
  });

  it('NEVER calls addDoc (SOS N.6 enforcement)', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.saveType({
      name: 'Wall',
      category: 'wall',
      scope: 'user',
      origin: 'user',
      typeParams: WALL_TYPE_PARAMS,
    });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

describe('BimFamilyTypeService.saveType — stair', () => {
  it('saves a stair family type with correct category', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    const result = await svc.saveType({
      name: 'Monolithic Straight',
      category: 'stair',
      scope: 'company',
      origin: 'built-in',
      typeParams: STAIR_TYPE_PARAMS,
    });
    expect(result.category).toBe('stair');
    expect(result.typeParams).toEqual(STAIR_TYPE_PARAMS);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid stair typeParams (missing required field)', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    const badParams = { ...STAIR_TYPE_PARAMS } as Record<string, unknown>;
    delete badParams['rise'];
    await expect(
      svc.saveType({
        name: 'Bad Stair',
        category: 'stair',
        scope: 'user',
        origin: 'user',
        typeParams: badParams as typeof STAIR_TYPE_PARAMS,
      }),
    ).rejects.toThrow('BIM_FAMILY_TYPE_INVALID_PARAMS');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// listTypes — 3-scope resolution
// ===========================================================================

describe('BimFamilyTypeService.listTypes — 3-scope resolution', () => {
  it('returns user-scope types owned by current user only', async () => {
    seed('bimft_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    seed('bimft_b', { companyId: 'c1', scope: 'user', ownerId: 'u2' }); // other user
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    const types = await svc.listTypes();
    expect(types.map((t) => t.id)).toEqual(['bimft_a']);
  });

  it('returns all company-scope types for the tenant', async () => {
    seed('bimft_a', { companyId: 'c1', scope: 'company', ownerId: 'u1' });
    seed('bimft_b', { companyId: 'c1', scope: 'company', ownerId: 'u9' });
    seed('bimft_c', { companyId: 'c2', scope: 'company', ownerId: 'u3' }); // other tenant
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    const types = await svc.listTypes();
    expect(types.map((t) => t.id).sort()).toEqual(['bimft_a', 'bimft_b']);
  });

  it('returns project-scope types only when projectId matches', async () => {
    seed('bimft_a', { companyId: 'c1', scope: 'project', ownerId: 'u1', projectId: 'p1' });
    seed('bimft_b', { companyId: 'c1', scope: 'project', ownerId: 'u1', projectId: 'p2' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1', projectId: 'p1' });
    const types = await svc.listTypes();
    expect(types.map((t) => t.id)).toEqual(['bimft_a']);
  });

  it('skips project-scope query entirely when projectId not configured', async () => {
    seed('bimft_proj', { companyId: 'c1', scope: 'project', ownerId: 'u1', projectId: 'p1' });
    seed('bimft_user', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    const types = await svc.listTypes();
    expect(types.map((t) => t.id)).toEqual(['bimft_user']);
  });

  it('merges all 3 scopes', async () => {
    seed('bimft_user', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    seed('bimft_company', { companyId: 'c1', scope: 'company', ownerId: 'u9' });
    seed('bimft_project', {
      companyId: 'c1',
      scope: 'project',
      ownerId: 'u1',
      projectId: 'p1',
    });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1', projectId: 'p1' });
    const types = await svc.listTypes();
    expect(types.map((t) => t.id).sort()).toEqual([
      'bimft_company',
      'bimft_project',
      'bimft_user',
    ]);
  });

  it('filters by category in-memory (no extra getDocs call)', async () => {
    seed('bimft_wall', { companyId: 'c1', scope: 'company', ownerId: 'u1', category: 'wall' });
    seed('bimft_stair', { companyId: 'c1', scope: 'company', ownerId: 'u1', category: 'stair' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    const callsBefore = mockGetDocs.mock.calls.length;

    const walls = await svc.listTypes('wall');
    const callsAfterFirst = mockGetDocs.mock.calls.length;

    // The second filtered call should hit the cache, no additional getDocs
    const stairs = await svc.listTypes('stair');
    expect(mockGetDocs.mock.calls.length).toBe(callsAfterFirst); // no extra calls

    expect(walls.map((t) => t.id)).toEqual(['bimft_wall']);
    expect(stairs.map((t) => t.id)).toEqual(['bimft_stair']);
    expect(callsAfterFirst).toBeGreaterThan(callsBefore);
  });
});

// ===========================================================================
// Cache
// ===========================================================================

describe('BimFamilyTypeService — cache (5min TTL)', () => {
  it('serves second call from cache without extra getDocs calls', async () => {
    seed('bimft_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.listTypes();
    const callsAfterFirst = mockGetDocs.mock.calls.length;
    await svc.listTypes();
    expect(mockGetDocs.mock.calls.length).toBe(callsAfterFirst);
  });

  it('invalidateCache forces re-fetch on next listTypes', async () => {
    seed('bimft_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.listTypes();
    const calls1 = mockGetDocs.mock.calls.length;
    svc.invalidateCache();
    await svc.listTypes();
    expect(mockGetDocs.mock.calls.length).toBeGreaterThan(calls1);
  });

  it('saveType invalidates cache', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.listTypes();
    const calls1 = mockGetDocs.mock.calls.length;
    await svc.saveType({
      name: 'New',
      category: 'wall',
      scope: 'user',
      origin: 'user',
      typeParams: WALL_TYPE_PARAMS,
    });
    await svc.listTypes();
    expect(mockGetDocs.mock.calls.length).toBeGreaterThan(calls1);
  });

  it('updateType invalidates cache', async () => {
    seed('bimft_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.listTypes();
    const calls1 = mockGetDocs.mock.calls.length;
    await svc.updateType('bimft_a', { name: 'Renamed' });
    await svc.listTypes();
    expect(mockGetDocs.mock.calls.length).toBeGreaterThan(calls1);
  });

  it('deleteType invalidates cache', async () => {
    seed('bimft_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.listTypes();
    const calls1 = mockGetDocs.mock.calls.length;
    await svc.deleteType('bimft_a');
    await svc.listTypes();
    expect(mockGetDocs.mock.calls.length).toBeGreaterThan(calls1);
  });

  it('cache expires after 5min TTL', async () => {
    seed('bimft_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    const originalNow = Date.now;
    let t = 1_000_000;
    Date.now = jest.fn(() => t);
    try {
      await svc.listTypes();
      const calls1 = mockGetDocs.mock.calls.length;
      t += 5 * 60 * 1000 + 1; // advance past TTL
      await svc.listTypes();
      expect(mockGetDocs.mock.calls.length).toBeGreaterThan(calls1);
    } finally {
      Date.now = originalNow;
    }
  });
});

// ===========================================================================
// updateType
// ===========================================================================

describe('BimFamilyTypeService.updateType', () => {
  it('calls updateDoc (not setDoc) with patch + audit fields', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.updateType('bimft_x', { name: 'Renamed' });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload['name']).toBe('Renamed');
    expect(payload['updatedBy']).toBe('u1');
    expect(payload['updatedAt']).toBe('__server_timestamp__');
  });

  it('includes typeParams in patch when provided with category', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.updateType('bimft_x', {
      category: 'wall',
      typeParams: { ...WALL_TYPE_PARAMS, thickness: 300 },
    });
    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect((payload['typeParams'] as { thickness: number }).thickness).toBe(300);
  });

  it('rejects typeParams update without category', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await expect(
      svc.updateType('bimft_x', { typeParams: WALL_TYPE_PARAMS }),
    ).rejects.toThrow('BIM_FAMILY_TYPE_CATEGORY_REQUIRED_FOR_PARAMS_UPDATE');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('rejects empty name in patch', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await expect(svc.updateType('bimft_x', { name: '   ' })).rejects.toThrow(
      'BIM_FAMILY_TYPE_NAME_REQUIRED',
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('does NOT include immutable fields (companyId, ownerId, createdAt, createdBy, scope)', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.updateType('bimft_x', { name: 'OK' });
    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('companyId');
    expect(payload).not.toHaveProperty('ownerId');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('createdBy');
    expect(payload).not.toHaveProperty('scope');
  });

  it('name-only patch does not include typeParams', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.updateType('bimft_x', { name: 'Just a rename' });
    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('typeParams');
  });

  it('rejects invalid wall typeParams in patch', async () => {
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await expect(
      svc.updateType('bimft_x', {
        category: 'wall',
        typeParams: { category: 'exterior' as const, thickness: -1 }, // negative thickness
      }),
    ).rejects.toThrow('BIM_FAMILY_TYPE_INVALID_PARAMS');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// deleteType
// ===========================================================================

describe('BimFamilyTypeService.deleteType', () => {
  it('calls deleteDoc with the correct id ref', async () => {
    seed('bimft_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.deleteType('bimft_a');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc.mock.calls[0][0].id).toBe('bimft_a');
  });

  it('removes the document from the in-memory store', async () => {
    seed('bimft_a', { companyId: 'c1', scope: 'user', ownerId: 'u1' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    await svc.deleteType('bimft_a');
    expect(store.has('bimft_a')).toBe(false);
  });
});

// ===========================================================================
// Tenant isolation
// ===========================================================================

describe('BimFamilyTypeService — tenant isolation', () => {
  it('queries always include companyId filter (cross-tenant docs not returned)', async () => {
    seed('bimft_x', { companyId: 'c2', scope: 'company', ownerId: 'u1' });
    const svc = createBimFamilyTypeService({ companyId: 'c1', userId: 'u1' });
    const types = await svc.listTypes();
    expect(types).toHaveLength(0);
  });
});
