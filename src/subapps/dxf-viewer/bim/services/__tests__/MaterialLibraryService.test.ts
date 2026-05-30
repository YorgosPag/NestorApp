/**
 * ADR-363 Phase 6.5 — MaterialLibraryService unit tests.
 *
 * Covers: CRUD (save/update/delete/getById), 3-scope merge (system + company
 * + project), 5min cache TTL + invalidation on writes, builtin guard,
 * system-scope client rejection, project-scope projectId requirement.
 *
 * Firestore SDK fully mocked με in-memory store (mirror StairPresetsService
 * test pattern). Subscribe path tested separately σε integration tests.
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import {
  BIM_MATERIAL_ERRORS,
  type BimMaterial,
} from '../../types/bim-material-types';

// ---------------------------------------------------------------------------
// Firestore mock — in-memory store με per-query filter capture
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

const mockSetDoc = jest.fn(
  async (ref: { id: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
    if (opts?.merge && store.has(ref.id)) {
      const existing = store.get(ref.id)!;
      store.set(ref.id, { id: ref.id, data: { ...existing.data, ...data } });
    } else {
      store.set(ref.id, { id: ref.id, data });
    }
  },
);

const mockDeleteDoc = jest.fn(async (ref: { id: string }) => {
  store.delete(ref.id);
});

const mockGetDoc = jest.fn(async (ref: { id: string }) => {
  const entry = store.get(ref.id);
  return {
    exists: () => entry !== undefined,
    data: () => entry?.data ?? {},
  };
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
  getDoc: (ref: { id: string }) => mockGetDoc(ref),
  getDocs: (q: MockQuery) => mockGetDocs(q),
  onSnapshot: jest.fn(() => () => {}),
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
  generateBimMaterialId: () => {
    mockIdCounter += 1;
    return `bmat_test${String(mockIdCounter).padStart(20, '0')}`;
  },
}));

// SUT import AFTER mocks
import { createMaterialLibraryService } from '../MaterialLibraryService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPANY_A = 'co_alpha';
const COMPANY_B = 'co_beta';
const USER_ID = 'usr_test';
const PROJECT_X = 'prj_x';

function seedDoc(partial: Partial<BimMaterial> & { id: string }): void {
  const full: BimMaterial = {
    id: partial.id,
    scope: partial.scope ?? 'system',
    nameEl: partial.nameEl ?? 'el',
    nameEn: partial.nameEn ?? 'en',
    category: partial.category ?? 'other',
    density: partial.density ?? null,
    defaultThickness: partial.defaultThickness ?? null,
    fireRating: partial.fireRating ?? 'none',
    atoeCategory: partial.atoeCategory ?? 'OIK-0.00',
    atoeArticle: partial.atoeArticle ?? null,
    defaultUnitCost: partial.defaultUnitCost ?? null,
    defaultUnit: partial.defaultUnit ?? 'pcs',
    brand: partial.brand ?? null,
    brandModel: partial.brandModel ?? null,
    notes: partial.notes ?? null,
    builtin: partial.builtin ?? false,
    companyId: partial.companyId ?? null,
    projectId: partial.projectId ?? null,
    createdBy: partial.createdBy ?? USER_ID,
    createdAt: partial.createdAt ?? ('__ts__' as unknown as BimMaterial['createdAt']),
    updatedBy: partial.updatedBy ?? USER_ID,
    updatedAt: partial.updatedAt ?? ('__ts__' as unknown as BimMaterial['updatedAt']),
  };
  store.set(full.id, { id: full.id, data: full as unknown as Record<string, unknown> });
}

beforeEach(() => {
  store.clear();
  mockIdCounter = 0;
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// listMaterials — 3-scope merge
// ---------------------------------------------------------------------------

describe('MaterialLibraryService.listMaterials', () => {
  it('merges system + company-A + project-X, excluding company-B + other projects', async () => {
    seedDoc({ id: 'sys-1', scope: 'system', companyId: null, projectId: null });
    seedDoc({ id: 'sys-2', scope: 'system', companyId: null, projectId: null });
    seedDoc({ id: 'co-a-1', scope: 'company', companyId: COMPANY_A });
    seedDoc({ id: 'co-b-1', scope: 'company', companyId: COMPANY_B });
    seedDoc({ id: 'prj-x-1', scope: 'project', companyId: COMPANY_A, projectId: PROJECT_X });
    seedDoc({ id: 'prj-y-1', scope: 'project', companyId: COMPANY_A, projectId: 'prj_y' });

    const svc = createMaterialLibraryService({
      companyId: COMPANY_A,
      userId: USER_ID,
      projectId: PROJECT_X,
    });

    const result = await svc.listMaterials();
    const ids = result.map((m) => m.id).sort();
    expect(ids).toEqual(['co-a-1', 'prj-x-1', 'sys-1', 'sys-2']);
  });

  it('omits project bucket when projectId not configured', async () => {
    seedDoc({ id: 'sys-1', scope: 'system' });
    seedDoc({ id: 'prj-1', scope: 'project', companyId: COMPANY_A, projectId: PROJECT_X });

    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    const result = await svc.listMaterials();
    expect(result.map((m) => m.id)).toEqual(['sys-1']);
  });

  it('caches results within 5min TTL', async () => {
    seedDoc({ id: 'sys-1', scope: 'system' });
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });

    await svc.listMaterials();
    expect(mockGetDocs).toHaveBeenCalledTimes(2); // system + company
    mockGetDocs.mockClear();

    await svc.listMaterials();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('invalidateCache forces refetch', async () => {
    seedDoc({ id: 'sys-1', scope: 'system' });
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });

    await svc.listMaterials();
    svc.invalidateCache();
    mockGetDocs.mockClear();

    await svc.listMaterials();
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// saveMaterial
// ---------------------------------------------------------------------------

describe('MaterialLibraryService.saveMaterial', () => {
  it('persists a new company-scope material με generated id + builtin=false', async () => {
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    const result = await svc.saveMaterial({
      scope: 'company',
      nameEl: 'Νέο υλικό',
      nameEn: 'New material',
      category: 'paint',
      atoeCategory: 'OIK-7.10',
      defaultUnit: 'm2',
    });

    expect(result.id).toMatch(/^bmat_test/);
    expect(result.builtin).toBe(false);
    expect(result.scope).toBe('company');
    expect(result.companyId).toBe(COMPANY_A);
    expect(result.projectId).toBeNull();
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('persists project-scope με projectId set', async () => {
    const svc = createMaterialLibraryService({
      companyId: COMPANY_A,
      userId: USER_ID,
      projectId: PROJECT_X,
    });
    const result = await svc.saveMaterial({
      scope: 'project',
      nameEl: 'Έργου',
      nameEn: 'Project mat',
      category: 'other',
      atoeCategory: 'OIK-0.00',
      defaultUnit: 'pcs',
    });
    expect(result.projectId).toBe(PROJECT_X);
  });

  it('rejects scope=project όταν projectId missing', async () => {
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await expect(
      svc.saveMaterial({
        scope: 'project',
        nameEl: 'x',
        nameEn: 'x',
        category: 'other',
        atoeCategory: 'OIK-0.00',
        defaultUnit: 'pcs',
      }),
    ).rejects.toThrow(BIM_MATERIAL_ERRORS.PROJECT_SCOPE_REQUIRES_PROJECT_ID);
  });

  it('rejects scope=system από client (belt-and-suspenders)', async () => {
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await expect(
      svc.saveMaterial({
        // Unsafe cast to bypass TS — runtime guard catches it.
        scope: 'system' as unknown as 'company',
        nameEl: 'x',
        nameEn: 'x',
        category: 'other',
        atoeCategory: 'OIK-0.00',
        defaultUnit: 'pcs',
      }),
    ).rejects.toThrow(BIM_MATERIAL_ERRORS.SYSTEM_SCOPE_CLIENT_FORBIDDEN);
  });

  it('rejects empty nameEl ή nameEn', async () => {
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await expect(
      svc.saveMaterial({
        scope: 'company',
        nameEl: '   ',
        nameEn: 'ok',
        category: 'other',
        atoeCategory: 'OIK-0.00',
        defaultUnit: 'pcs',
      }),
    ).rejects.toThrow(BIM_MATERIAL_ERRORS.NAME_REQUIRED);
    await expect(
      svc.saveMaterial({
        scope: 'company',
        nameEl: 'ok',
        nameEn: '',
        category: 'other',
        atoeCategory: 'OIK-0.00',
        defaultUnit: 'pcs',
      }),
    ).rejects.toThrow(BIM_MATERIAL_ERRORS.NAME_REQUIRED);
  });

  it('invalidates cache on save', async () => {
    seedDoc({ id: 'sys-1', scope: 'system' });
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await svc.listMaterials();
    mockGetDocs.mockClear();

    await svc.saveMaterial({
      scope: 'company',
      nameEl: 'Νέο',
      nameEn: 'New',
      category: 'paint',
      atoeCategory: 'OIK-7.10',
      defaultUnit: 'm2',
    });

    await svc.listMaterials();
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// updateMaterial / deleteMaterial — builtin guard
// ---------------------------------------------------------------------------

describe('MaterialLibraryService.updateMaterial', () => {
  it('rejects update σε builtin (system seed) material', async () => {
    seedDoc({ id: 'sys-1', scope: 'system', builtin: true });
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await expect(svc.updateMaterial('sys-1', { nameEl: 'altered' })).rejects.toThrow(
      BIM_MATERIAL_ERRORS.BUILTIN_NOT_MUTABLE,
    );
  });

  it('applies patch σε company material', async () => {
    seedDoc({ id: 'co-1', scope: 'company', companyId: COMPANY_A, builtin: false });
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await svc.updateMaterial('co-1', { nameEl: 'updated' });
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'co-1' }),
      expect.objectContaining({ nameEl: 'updated', updatedBy: USER_ID }),
      { merge: true },
    );
  });

  it('strips undefined από patch (Firestore rejects undefined)', async () => {
    seedDoc({ id: 'co-1', scope: 'company', companyId: COMPANY_A, builtin: false });
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await svc.updateMaterial('co-1', { nameEl: 'kept', density: undefined });
    const call = mockSetDoc.mock.calls[0];
    expect(call[1]).toEqual(
      expect.objectContaining({ nameEl: 'kept' }),
    );
    expect(call[1]).not.toHaveProperty('density');
  });

  it('throws NOT_FOUND για missing id', async () => {
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await expect(svc.updateMaterial('nonexistent', { nameEl: 'x' })).rejects.toThrow(
      BIM_MATERIAL_ERRORS.NOT_FOUND,
    );
  });
});

describe('MaterialLibraryService.deleteMaterial', () => {
  it('rejects delete σε builtin material', async () => {
    seedDoc({ id: 'sys-1', scope: 'system', builtin: true });
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await expect(svc.deleteMaterial('sys-1')).rejects.toThrow(
      BIM_MATERIAL_ERRORS.BUILTIN_NOT_MUTABLE,
    );
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('deletes non-builtin material', async () => {
    seedDoc({ id: 'co-1', scope: 'company', companyId: COMPANY_A, builtin: false });
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await svc.deleteMaterial('co-1');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('throws NOT_FOUND για missing id', async () => {
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    await expect(svc.deleteMaterial('nonexistent')).rejects.toThrow(
      BIM_MATERIAL_ERRORS.NOT_FOUND,
    );
  });
});

// ---------------------------------------------------------------------------
// getMaterialById
// ---------------------------------------------------------------------------

describe('MaterialLibraryService.getMaterialById', () => {
  it('returns null for non-existent id', async () => {
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    expect(await svc.getMaterialById('nope')).toBeNull();
  });

  it('returns the material for existing id', async () => {
    seedDoc({ id: 'sys-1', scope: 'system', nameEn: 'Concrete' });
    const svc = createMaterialLibraryService({ companyId: COMPANY_A, userId: USER_ID });
    const result = await svc.getMaterialById('sys-1');
    expect(result).not.toBeNull();
    expect(result?.nameEn).toBe('Concrete');
  });
});
