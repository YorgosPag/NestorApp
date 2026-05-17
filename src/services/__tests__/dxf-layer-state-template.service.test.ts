/**
 * ADR-358 §5.9 Q12 Phase 13B.1 — DxfLayerStateTemplateService unit tests.
 *
 * Covers: CRUD (save/list/get/update/softDelete/restore/hardDelete), category
 * catalog auto-create + idempotency, soft-delete filtering, cache TTL + write
 * invalidation, tenant isolation guards, validation errors.
 *
 * Firestore SDK fully mocked — queries carry their own filter set so multiple
 * service instances don't share state across describes.
 */

import type { LayerStateEntry } from '@/subapps/dxf-viewer/types/layer-state';

// ─── Firestore mock (in-memory) ──────────────────────────────────────────────

interface StoreDoc {
  readonly path: string;
  readonly id: string;
  data: Record<string, unknown>;
}
interface MockWhere {
  readonly __type: 'where';
  readonly field: string;
  readonly op: string;
  readonly value: unknown;
}
interface MockQuery {
  readonly __query: true;
  readonly collectionPath: string;
  readonly filters: readonly MockWhere[];
}

const store = new Map<string, StoreDoc>();

function matchOp(stored: unknown, op: string, value: unknown): boolean {
  if (op === '==') return stored === value;
  if (op === 'array-contains-any') {
    if (!Array.isArray(stored) || !Array.isArray(value)) return false;
    return value.some((v) => stored.includes(v));
  }
  return false;
}

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...segments: string[]) => ({
    __collection: true,
    path: segments.join('/'),
  })),
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join('/'),
    id: segments[segments.length - 1],
  })),
  setDoc: jest.fn(async (ref: { path: string; id: string }, data: Record<string, unknown>) => {
    store.set(ref.path, { path: ref.path, id: ref.id, data: { ...data } });
  }),
  updateDoc: jest.fn(async (ref: { path: string }, patch: Record<string, unknown>) => {
    const existing = store.get(ref.path);
    if (!existing) throw new Error(`updateDoc on missing path ${ref.path}`);
    existing.data = { ...existing.data, ...patch };
  }),
  deleteDoc: jest.fn(async (ref: { path: string }) => {
    store.delete(ref.path);
  }),
  getDoc: jest.fn(async (ref: { path: string; id: string }) => {
    const existing = store.get(ref.path);
    return {
      exists: () => Boolean(existing),
      data: () => (existing ? existing.data : undefined),
      id: ref.id,
    };
  }),
  getDocs: jest.fn(async (q: MockQuery) => {
    const matches: StoreDoc[] = [];
    for (const docEntry of store.values()) {
      if (!docEntry.path.startsWith(`${q.collectionPath}/`)) continue;
      const ok = q.filters.every((f) => matchOp(docEntry.data[f.field], f.op, f.value));
      if (ok) matches.push(docEntry);
    }
    return {
      empty: matches.length === 0,
      docs: matches.map((m) => ({ id: m.id, data: () => m.data })),
    };
  }),
  query: jest.fn(
    (col: { path: string }, ...constraints: unknown[]): MockQuery => ({
      __query: true,
      collectionPath: col.path,
      filters: constraints.filter(
        (c): c is MockWhere =>
          typeof c === 'object' && c !== null && (c as { __type?: string }).__type === 'where',
      ),
    }),
  ),
  where: jest.fn(
    (field: string, op: string, value: unknown): MockWhere => ({
      __type: 'where',
      field,
      op,
      value,
    }),
  ),
}));

jest.mock('@/lib/firebase', () => ({
  db: { __mockDb: true },
}));

let mockTemplateCounter = 0;
let mockCategoryCounter = 0;
jest.mock('@/services/enterprise-id-convenience', () => ({
  generateLayerStateTemplateId: () => {
    mockTemplateCounter += 1;
    return `lstpl_${String(mockTemplateCounter).padStart(24, '0')}`;
  },
  generateDxfTemplateCategoryId: () => {
    mockCategoryCounter += 1;
    return `lstcat_${String(mockCategoryCounter).padStart(22, '0')}`;
  },
}));

let mockNow = 1_700_000_000_000;
jest.mock('@/lib/date-local', () => ({
  nowISO: () => new Date(mockNow).toISOString(),
}));

// SUT — import AFTER mocks
import {
  createDxfLayerStateTemplateService,
  LayerStateTemplateCrossTenantError,
  LayerStateTemplateNotFoundError,
  LayerStateTemplateValidationError,
  type DxfLayerStateTemplateService,
} from '../dxf-layer-state-template.service';

const COMPANY_A = 'comp_companyA0000000000000';
const COMPANY_B = 'comp_companyB0000000000000';
const USER_X = 'usr_userX0000000000000';
const USER_Y = 'usr_userY0000000000000';

function makeEntry(layerName: string, visible = true): LayerStateEntry {
  return {
    layerId: '',
    layerName,
    visible,
    frozen: false,
    locked: false,
    color: '#FFFFFF',
    colorAci: 7,
    colorTrueColor: null,
    linetype: 'Continuous',
    lineweight: -3,
    transparency: 0,
    plottable: true,
  };
}

function freshService(opts?: { companyId?: string; userId?: string }): DxfLayerStateTemplateService {
  return createDxfLayerStateTemplateService({
    companyId: opts?.companyId ?? COMPANY_A,
    userId: opts?.userId ?? USER_X,
  });
}

function advanceTime(ms: number): void {
  mockNow += ms;
}

beforeEach(() => {
  store.clear();
  mockTemplateCounter = 0;
  mockCategoryCounter = 0;
  mockNow = 1_700_000_000_000;
  jest.clearAllMocks();
});

// ─── saveAsTemplate ──────────────────────────────────────────────────────────

describe('saveAsTemplate', () => {
  it('persists with companyId + createdBy + generated id + normalized category', async () => {
    const svc = freshService();
    const t = await svc.saveAsTemplate({
      name: '  MEP Coord  ',
      category: '  MEP  ',
      tags: ['hvac', 'plumbing'],
      snapshot: [makeEntry('A-WALL')],
    });
    expect(t.id).toMatch(/^lstpl_/);
    expect(t.companyId).toBe(COMPANY_A);
    expect(t.createdBy).toBe(USER_X);
    expect(t.name).toBe('MEP Coord');
    expect(t.category).toBe('mep');
    expect(t.tags).toEqual(['hvac', 'plumbing']);
    expect(t.deletedAt).toBeNull();
  });

  it('auto-creates category catalog entry on novel category', async () => {
    const svc = freshService();
    await svc.saveAsTemplate({ name: 'T1', category: 'landscape', snapshot: [makeEntry('A')] });
    const cats = await svc.listCategories();
    expect(cats.map((c) => c.value)).toEqual(['landscape']);
  });

  it('skips category catalog write when category already exists (idempotent)', async () => {
    const svc = freshService();
    await svc.saveAsTemplate({ name: 'T1', category: 'mep', snapshot: [makeEntry('A')] });
    svc.invalidateTemplatesCache();
    svc.invalidateCategoriesCache();
    await svc.saveAsTemplate({ name: 'T2', category: 'MEP', snapshot: [makeEntry('B')] });
    const cats = await svc.listCategories();
    expect(cats).toHaveLength(1);
    expect(cats[0].value).toBe('mep');
  });

  it('rejects empty name', async () => {
    const svc = freshService();
    await expect(
      svc.saveAsTemplate({ name: '   ', snapshot: [makeEntry('A')] }),
    ).rejects.toBeInstanceOf(LayerStateTemplateValidationError);
  });

  it('rejects empty snapshot', async () => {
    const svc = freshService();
    await expect(svc.saveAsTemplate({ name: 'T', snapshot: [] })).rejects.toBeInstanceOf(
      LayerStateTemplateValidationError,
    );
  });
});

// ─── listTemplateSummaries ───────────────────────────────────────────────────

describe('listTemplateSummaries', () => {
  it('returns summaries sorted by updatedAt DESC', async () => {
    const svc = freshService();
    await svc.saveAsTemplate({ name: 'A', snapshot: [makeEntry('1')] });
    advanceTime(60_000);
    await svc.saveAsTemplate({ name: 'B', snapshot: [makeEntry('1')] });
    advanceTime(60_000);
    await svc.saveAsTemplate({ name: 'C', snapshot: [makeEntry('1')] });
    const list = await svc.listTemplateSummaries();
    expect(list.map((s) => s.name)).toEqual(['C', 'B', 'A']);
  });

  it('excludes soft-deleted by default', async () => {
    const svc = freshService();
    const t1 = await svc.saveAsTemplate({ name: 'Keep', snapshot: [makeEntry('1')] });
    const t2 = await svc.saveAsTemplate({ name: 'Drop', snapshot: [makeEntry('1')] });
    await svc.softDeleteTemplate(t2.id);
    const visible = await svc.listTemplateSummaries();
    expect(visible.map((s) => s.id)).toEqual([t1.id]);
  });

  it('includes soft-deleted when includeDeleted: true', async () => {
    const svc = freshService();
    const t1 = await svc.saveAsTemplate({ name: 'Keep', snapshot: [makeEntry('1')] });
    const t2 = await svc.saveAsTemplate({ name: 'Drop', snapshot: [makeEntry('1')] });
    await svc.softDeleteTemplate(t2.id);
    const all = await svc.listTemplateSummaries({ includeDeleted: true });
    expect(all.map((s) => s.id).sort()).toEqual([t1.id, t2.id].sort());
  });

  it('filters by category', async () => {
    const svc = freshService();
    await svc.saveAsTemplate({ name: 'M', category: 'mep', snapshot: [makeEntry('1')] });
    await svc.saveAsTemplate({ name: 'S', category: 'structural', snapshot: [makeEntry('1')] });
    const mep = await svc.listTemplateSummaries({ category: 'MEP' });
    expect(mep.map((s) => s.name)).toEqual(['M']);
  });

  it('filters by tags via array-contains-any', async () => {
    const svc = freshService();
    await svc.saveAsTemplate({ name: 'H', tags: ['hvac'], snapshot: [makeEntry('1')] });
    await svc.saveAsTemplate({ name: 'P', tags: ['plumbing'], snapshot: [makeEntry('1')] });
    await svc.saveAsTemplate({ name: 'X', tags: ['demo'], snapshot: [makeEntry('1')] });
    const hp = await svc.listTemplateSummaries({ tags: ['hvac', 'plumbing'] });
    expect(hp.map((s) => s.name).sort()).toEqual(['H', 'P']);
  });
});

// ─── getTemplate ─────────────────────────────────────────────────────────────

describe('getTemplate', () => {
  it('returns full document', async () => {
    const svc = freshService();
    const created = await svc.saveAsTemplate({ name: 'T', snapshot: [makeEntry('A'), makeEntry('B')] });
    const fetched = await svc.getTemplate(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.snapshot).toHaveLength(2);
  });

  it('throws NotFound for missing id', async () => {
    const svc = freshService();
    await expect(svc.getTemplate('lstpl_missing')).rejects.toBeInstanceOf(
      LayerStateTemplateNotFoundError,
    );
  });

  it('throws CrossTenant when companyId mismatches', async () => {
    const svcA = freshService({ companyId: COMPANY_A });
    const created = await svcA.saveAsTemplate({ name: 'T', snapshot: [makeEntry('A')] });
    const svcB = freshService({ companyId: COMPANY_B });
    await expect(svcB.getTemplate(created.id)).rejects.toBeInstanceOf(
      LayerStateTemplateCrossTenantError,
    );
  });
});

// ─── updateTemplate ──────────────────────────────────────────────────────────

describe('updateTemplate', () => {
  it('patches name/description/category/tags + bumps updatedAt + updatedBy', async () => {
    const svc = freshService();
    const created = await svc.saveAsTemplate({ name: 'Old', snapshot: [makeEntry('A')] });
    advanceTime(5_000);
    const svc2 = freshService({ userId: USER_Y });
    await svc2.updateTemplate(created.id, {
      name: 'New',
      description: 'desc',
      category: 'STRUCTURAL',
      tags: ['steel'],
    });
    const fetched = await svc2.getTemplate(created.id);
    expect(fetched.name).toBe('New');
    expect(fetched.description).toBe('desc');
    expect(fetched.category).toBe('structural');
    expect(fetched.tags).toEqual(['steel']);
    expect(fetched.updatedBy).toBe(USER_Y);
    expect(fetched.updatedAt).not.toBe(created.updatedAt);
  });

  it('auto-creates catalog entry for novel category on update', async () => {
    const svc = freshService();
    const t = await svc.saveAsTemplate({ name: 'T', category: 'mep', snapshot: [makeEntry('A')] });
    await svc.updateTemplate(t.id, { category: 'as-built' });
    const cats = await svc.listCategories();
    expect(cats.map((c) => c.value).sort()).toEqual(['as-built', 'mep']);
  });
});

// ─── soft / restore / hard delete ────────────────────────────────────────────

describe('soft / restore / hard delete', () => {
  it('softDeleteTemplate sets deletedAt; restoreTemplate clears it', async () => {
    const svc = freshService();
    const t = await svc.saveAsTemplate({ name: 'T', snapshot: [makeEntry('A')] });
    await svc.softDeleteTemplate(t.id);
    expect((await svc.getTemplate(t.id)).deletedAt).not.toBeNull();
    await svc.restoreTemplate(t.id);
    expect((await svc.getTemplate(t.id)).deletedAt).toBeNull();
  });

  it('hardDeleteTemplate removes the document entirely', async () => {
    const svc = freshService();
    const t = await svc.saveAsTemplate({ name: 'T', snapshot: [makeEntry('A')] });
    await svc.hardDeleteTemplate(t.id);
    await expect(svc.getTemplate(t.id)).rejects.toBeInstanceOf(LayerStateTemplateNotFoundError);
  });
});

// ─── Cache TTL + invalidation ────────────────────────────────────────────────

describe('cache', () => {
  it('caches unfiltered listTemplateSummaries within TTL; invalidates on save', async () => {
    const svc = freshService();
    await svc.saveAsTemplate({ name: 'A', snapshot: [makeEntry('1')] });
    const first = await svc.listTemplateSummaries();
    expect(first).toHaveLength(1);
    // Hidden mutation outside service — cache must remain hit
    store.delete([...store.keys()].find((k) => k.includes('dxf_layer_state_templates'))!);
    const cached = await svc.listTemplateSummaries();
    expect(cached).toHaveLength(1);
    await svc.saveAsTemplate({ name: 'B', snapshot: [makeEntry('1')] });
    const refreshed = await svc.listTemplateSummaries();
    expect(refreshed.map((s) => s.name)).toEqual(['B']);
  });
});

// ─── Tenant isolation ────────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('listTemplateSummaries returns only docs of the configured companyId', async () => {
    const svcA = freshService({ companyId: COMPANY_A });
    const svcB = freshService({ companyId: COMPANY_B });
    await svcA.saveAsTemplate({ name: 'A', snapshot: [makeEntry('1')] });
    await svcB.saveAsTemplate({ name: 'B', snapshot: [makeEntry('1')] });
    const a = await svcA.listTemplateSummaries();
    const b = await svcB.listTemplateSummaries();
    expect(a.map((s) => s.companyId)).toEqual([COMPANY_A]);
    expect(b.map((s) => s.companyId)).toEqual([COMPANY_B]);
  });
});
