/**
 * ADR-652 M2 — BlockLibraryService unit tests.
 *
 * Καλύπτει: geometry-blob-πρώτα-μετά-doc σειρά αποθήκευσης, enterprise id (`blklib_*`,
 * SOS N.6 — καμία `addDoc`), tenant/lifecycle πεδία από τον κοινό πυρήνα, multi-scope merge
 * (system + δικά μου + εταιρείας), builtin guard, και το **νομικό GATE**: κοινόχρηστο scope
 * απαιτεί `license.redistributable === true`.
 *
 * Firestore + Storage SDK πλήρως mocked με in-memory store (mirror του
 * `MaterialLibraryService.test.ts`).
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import {
  BLOCK_LIBRARY_ERRORS,
  type BlockLibraryItem,
} from '../../block-library/block-library-types';
import type { Entity } from '../../../types/entities';

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
  collection: jest.fn(() => ({ __collection: true })),
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

// ---------------------------------------------------------------------------
// Storage mock — καταγράφει τα ανεβασμένα bytes ανά path
// ---------------------------------------------------------------------------

const uploaded = new Map<string, string>();
const mockDeleteObject = jest.fn(async () => {});

jest.mock('firebase/storage', () => ({
  ref: jest.fn((_storage: unknown, path: string) => ({ __path: path })),
  uploadBytes: jest.fn(async (fileRef: { __path: string }, bytes: Uint8Array) => {
    uploaded.set(fileRef.__path, new TextDecoder().decode(bytes));
    return { ref: fileRef };
  }),
  getDownloadURL: jest.fn(async (fileRef: { __path: string }) => `https://storage.test/${fileRef.__path}`),
  getBytes: jest.fn(async () => new Uint8Array()),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...(args as [])),
}));

jest.mock('@/lib/firebase', () => ({
  db: { __mockDb: true },
  storage: { __mockStorage: true },
}));

let mockIdCounter = 0;
jest.mock('@/services/enterprise-id.service', () => ({
  generateBlockLibraryItemId: () => {
    mockIdCounter += 1;
    return `blklib_test${String(mockIdCounter).padStart(18, '0')}`;
  },
}));

// SUT import AFTER mocks
import { createBlockLibraryService } from '../BlockLibraryService';
import { parseBlockGeometryBlob } from '../../block-library/block-geometry-blob';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPANY_A = 'co_alpha';
const USER_ID = 'usr_test';
const OTHER_USER = 'usr_other';
const PROJECT_X = 'prj_x';

const BOUNDS = { minX: 0, minY: 0, maxX: 600, maxY: 450 };

function member(id: string): Entity {
  return {
    id,
    type: 'line',
    layerId: '0',
    start: { x: 0, y: 0 },
    end: { x: 600, y: 0 },
    visible: true,
  } as unknown as Entity;
}

function saveInput(overrides: Record<string, unknown> = {}) {
  return {
    scope: 'user' as const,
    name: 'CHAIR-01',
    category: 'furniture' as const,
    boundsMm: BOUNDS,
    localMembers: [member('e1'), member('e2')],
    provenance: {
      sourceType: 'user-import' as const,
      importedAt: 1_700_000_000_000,
      importedBy: USER_ID,
    },
    license: { type: 'unknown' as const, redistributable: false },
    ...overrides,
  };
}

function seedDoc(partial: Partial<BlockLibraryItem> & { id: string }): void {
  store.set(partial.id, {
    id: partial.id,
    data: {
      scope: 'user',
      companyId: COMPANY_A,
      createdBy: USER_ID,
      builtin: false,
      name: 'seed',
      category: 'other',
      boundsMm: BOUNDS,
      geometryUrl: 'https://storage.test/seed.json',
      ...partial,
    } as Record<string, unknown>,
  });
}

function makeService(projectId?: string) {
  return createBlockLibraryService({ companyId: COMPANY_A, userId: USER_ID, projectId });
}

beforeEach(() => {
  store.clear();
  uploaded.clear();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// saveBlock
// ---------------------------------------------------------------------------

describe('BlockLibraryService.saveBlock', () => {
  it('ανεβάζει τη γεωμετρία ΚΑΙ γράφει doc με enterprise id blklib_* (SOS N.6)', async () => {
    const item = await makeService().saveBlock(saveInput());

    expect(item.id).toMatch(/^blklib_/);
    // Το blob πήγε στο company-scoped path, keyed by blockId.
    const path = `companies/${COMPANY_A}/block-library/${item.id}.json`;
    expect(uploaded.has(path)).toBe(true);
    // …και το doc δείχνει σε αυτό.
    expect(item.geometryUrl).toBe(`https://storage.test/${path}`);
    expect(store.get(item.id)?.data.geometryUrl).toBe(`https://storage.test/${path}`);
  });

  it('το blob περιέχει τα BLOCK-LOCAL members (ίδιο σχήμα, όχι νέα αναπαράσταση)', async () => {
    const item = await makeService().saveBlock(saveInput());
    const raw = uploaded.get(`companies/${COMPANY_A}/block-library/${item.id}.json`)!;

    const blob = parseBlockGeometryBlob(raw);
    expect(blob).not.toBeNull();
    expect(blob!.name).toBe('CHAIR-01');
    expect(blob!.entities).toHaveLength(2);
    expect(blob!.boundsMm).toEqual(BOUNDS);
  });

  it('γράφει tenant + lifecycle πεδία και builtin=false', async () => {
    const item = await makeService().saveBlock(saveInput());
    const data = store.get(item.id)!.data;

    expect(data.companyId).toBe(COMPANY_A);
    expect(data.createdBy).toBe(USER_ID);
    expect(data.builtin).toBe(false);
    expect(data.scope).toBe('user');
    expect(data.projectId).toBeNull();
    expect(data.license).toEqual({ type: 'unknown', redistributable: false });
    expect(data.provenance).toMatchObject({ sourceType: 'user-import', importedBy: USER_ID });
  });

  it('⚖️ ΝΟΜΙΚΟ GATE: κοινόχρηστο scope χωρίς redistributable → reject', async () => {
    await expect(
      makeService(PROJECT_X).saveBlock(
        saveInput({ scope: 'company', license: { type: 'unknown', redistributable: false } }),
      ),
    ).rejects.toThrow(BLOCK_LIBRARY_ERRORS.SHARED_SCOPE_REQUIRES_REDISTRIBUTABLE);

    // Τίποτα δεν ανέβηκε — το gate τρέχει ΠΡΙΝ από κάθε εγγραφή.
    expect(uploaded.size).toBe(0);
    expect(store.size).toBe(0);
  });

  it('⚖️ κοινόχρηστο scope ΜΕ redistributable → επιτρέπεται', async () => {
    const item = await makeService().saveBlock(
      saveInput({ scope: 'company', license: { type: 'cc0', redistributable: true } }),
    );
    expect(store.get(item.id)?.data.scope).toBe('company');
  });

  it('ιδιωτικό (user) scope επιτρέπεται ΧΩΡΙΣ redistributable — εκεί μένει ό,τι είναι άγνωστης άδειας', async () => {
    const item = await makeService().saveBlock(saveInput());
    expect(store.get(item.id)?.data.scope).toBe('user');
  });

  it('rejects άδειο όνομα', async () => {
    await expect(makeService().saveBlock(saveInput({ name: '  ' }))).rejects.toThrow(
      BLOCK_LIBRARY_ERRORS.NAME_REQUIRED,
    );
  });

  it('rejects block χωρίς γεωμετρία', async () => {
    await expect(makeService().saveBlock(saveInput({ localMembers: [] }))).rejects.toThrow(
      BLOCK_LIBRARY_ERRORS.GEOMETRY_REQUIRED,
    );
  });

  it('rejects scope=system από client (belt-and-suspenders)', async () => {
    await expect(
      makeService().saveBlock(saveInput({ scope: 'system', license: { type: 'cc0', redistributable: true } })),
    ).rejects.toThrow(BLOCK_LIBRARY_ERRORS.SYSTEM_SCOPE_CLIENT_FORBIDDEN);
  });

  it('rejects scope=project όταν λείπει projectId', async () => {
    await expect(
      makeService().saveBlock(
        saveInput({ scope: 'project', license: { type: 'cc0', redistributable: true } }),
      ),
    ).rejects.toThrow(BLOCK_LIBRARY_ERRORS.PROJECT_SCOPE_REQUIRES_PROJECT_ID);
  });

  it('project scope → γράφει projectId', async () => {
    const item = await makeService(PROJECT_X).saveBlock(
      saveInput({ scope: 'project', license: { type: 'cc0', redistributable: true } }),
    );
    expect(store.get(item.id)?.data.projectId).toBe(PROJECT_X);
  });
});

// ---------------------------------------------------------------------------
// listBlocks — multi-scope merge
// ---------------------------------------------------------------------------

describe('BlockLibraryService.listBlocks', () => {
  it('ενώνει system + δικά μου (user) + εταιρείας, ΟΧΙ τα user blocks άλλου χρήστη', async () => {
    seedDoc({ id: 'blklib_system', scope: 'system', companyId: null, builtin: true });
    seedDoc({ id: 'blklib_mine', scope: 'user', createdBy: USER_ID });
    seedDoc({ id: 'blklib_theirs', scope: 'user', createdBy: OTHER_USER });
    seedDoc({ id: 'blklib_company', scope: 'company' });

    const ids = (await makeService().listBlocks()).map((b) => b.id);

    expect(ids).toContain('blklib_system');
    expect(ids).toContain('blklib_mine');
    expect(ids).toContain('blklib_company');
    expect(ids).not.toContain('blklib_theirs');
  });
});

// ---------------------------------------------------------------------------
// deleteBlock
// ---------------------------------------------------------------------------

describe('BlockLibraryService.deleteBlock', () => {
  it('σβήνει doc + geometry blob', async () => {
    seedDoc({ id: 'blklib_del' });
    await makeService().deleteBlock('blklib_del');

    expect(store.has('blklib_del')).toBe(false);
    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
  });

  it('rejects delete σε builtin (system seed)', async () => {
    seedDoc({ id: 'blklib_builtin', scope: 'system', builtin: true });
    await expect(makeService().deleteBlock('blklib_builtin')).rejects.toThrow(
      BLOCK_LIBRARY_ERRORS.BUILTIN_NOT_MUTABLE,
    );
    expect(store.has('blklib_builtin')).toBe(true);
  });

  it('throws NOT_FOUND για άγνωστο id', async () => {
    await expect(makeService().deleteBlock('blklib_ghost')).rejects.toThrow(
      BLOCK_LIBRARY_ERRORS.NOT_FOUND,
    );
  });
});

// ---------------------------------------------------------------------------
// promoteBlock (ADR-652 M3) — «Δημοσίευση» ιδιωτικού block σε κοινόχρηστο scope
// ---------------------------------------------------------------------------

describe('BlockLibraryService.promoteBlock', () => {
  it('προάγει user → company όταν η άδεια επιτρέπει αναδιανομή', async () => {
    seedDoc({
      id: 'blklib_p1',
      license: { type: 'cc0', redistributable: true },
    } as never);

    await makeService().promoteBlock({ blockId: 'blklib_p1', scope: 'company' });

    const doc = store.get('blklib_p1')!.data;
    expect(doc.scope).toBe('company');
    expect(doc.projectId).toBeNull();
    // Το ΙΔΙΟ doc — καμία δεύτερη εγγραφή, καμία δεύτερη γεωμετρία (ArchiCAD/Figma publish).
    expect(store.size).toBe(1);
    expect(doc.geometryUrl).toBe('https://storage.test/seed.json');
  });

  it('⚖️ ΜΠΛΟΚΑΡΕΙ την προαγωγή όταν λείπει το δικαίωμα αναδιανομής (ΙΔΙΟ gate με το saveBlock)', async () => {
    seedDoc({
      id: 'blklib_p2',
      license: { type: 'unknown', redistributable: false },
    } as never);

    await expect(
      makeService().promoteBlock({ blockId: 'blklib_p2', scope: 'company' }),
    ).rejects.toThrow(BLOCK_LIBRARY_ERRORS.SHARED_SCOPE_REQUIRES_REDISTRIBUTABLE);

    expect(store.get('blklib_p2')!.data.scope).toBe('user');
  });

  it('δέχεται διορθωμένη άδεια στην ίδια κίνηση (ο χρήστης δηλώνει το δικαίωμα)', async () => {
    seedDoc({
      id: 'blklib_p3',
      license: { type: 'unknown', redistributable: false },
    } as never);

    await makeService().promoteBlock({
      blockId: 'blklib_p3',
      scope: 'company',
      license: { type: 'cc-by', redistributable: true, attribution: 'Studio X' },
    });

    const doc = store.get('blklib_p3')!.data;
    expect(doc.scope).toBe('company');
    expect(doc.license).toEqual({
      type: 'cc-by',
      redistributable: true,
      attribution: 'Studio X',
    });
  });

  it('project scope: γράφει το projectId· χωρίς ενεργό έργο → σφάλμα', async () => {
    seedDoc({ id: 'blklib_p4', license: { type: 'cc0', redistributable: true } } as never);

    await expect(
      makeService().promoteBlock({ blockId: 'blklib_p4', scope: 'project' }),
    ).rejects.toThrow(BLOCK_LIBRARY_ERRORS.PROJECT_SCOPE_REQUIRES_PROJECT_ID);

    await makeService(PROJECT_X).promoteBlock({ blockId: 'blklib_p4', scope: 'project' });
    expect(store.get('blklib_p4')!.data.projectId).toBe(PROJECT_X);
  });

  it('rejects promote σε builtin (έτοιμη/partner βιβλιοθήκη = read-only)', async () => {
    seedDoc({
      id: 'blklib_sys_x',
      scope: 'system',
      builtin: true,
      license: { type: 'cc0', redistributable: true },
    } as never);

    await expect(
      makeService().promoteBlock({ blockId: 'blklib_sys_x', scope: 'company' }),
    ).rejects.toThrow(BLOCK_LIBRARY_ERRORS.BUILTIN_NOT_MUTABLE);
  });

  it('throws NOT_FOUND για άγνωστο id', async () => {
    await expect(
      makeService().promoteBlock({ blockId: 'blklib_ghost', scope: 'company' }),
    ).rejects.toThrow(BLOCK_LIBRARY_ERRORS.NOT_FOUND);
  });
});
