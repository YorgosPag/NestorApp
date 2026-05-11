/**
 * ADR-344 Phase 7.C — scope-builder unit tests.
 *
 * Verifies the server-only builder fetches the right Firestore docs,
 * enforces cross-tenant guards, and projects the right fields onto the
 * pure `PlaceholderScope` shape.
 */

// ── Infrastructure mocks ─────────────────────────────────────────────────────

jest.mock('server-only', () => ({}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: {
    COMPANIES: 'companies',
    PROJECTS: 'projects',
    USERS: 'users',
  },
}));

// ── Firestore Admin SDK mock ─────────────────────────────────────────────────

type CollectionStore = Map<string, Record<string, unknown> | null>;

const store: Record<string, CollectionStore> = {
  companies: new Map(),
  projects: new Map(),
  users: new Map(),
};

function makeDocRef(collection: string, id: string) {
  return {
    id,
    get: jest.fn(async () => {
      const data = store[collection]?.get(id);
      return {
        exists: data !== undefined && data !== null,
        data: () => (data ? { ...data } : undefined),
      };
    }),
  };
}

const mockCollection = jest.fn((name: string) => ({
  doc: jest.fn((id: string) => makeDocRef(name, id)),
}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: mockCollection }),
}));

// ── SUT (loaded after mocks) ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildPlaceholderScope } = require('../resolver/scope-builder');

// ── Helpers ──────────────────────────────────────────────────────────────────

function seed(collection: keyof typeof store, id: string, data: Record<string, unknown>) {
  store[collection].set(id, data);
}

function clearStore() {
  for (const map of Object.values(store)) map.clear();
}

beforeEach(() => {
  clearStore();
  mockCollection.mockClear();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('buildPlaceholderScope — company', () => {
  it('hydrates company.name when the doc exists', async () => {
    seed('companies', 'co_1', { name: 'Nestor Construct' });
    const scope = await buildPlaceholderScope({ companyId: 'co_1' });
    expect(scope.company?.name).toBe('Nestor Construct');
  });

  it('returns undefined company when the doc is missing', async () => {
    const scope = await buildPlaceholderScope({ companyId: 'co_missing' });
    expect(scope.company).toBeUndefined();
  });

  it('falls back to companyName field when name is absent', async () => {
    seed('companies', 'co_1', { companyName: 'Legacy Co' });
    const scope = await buildPlaceholderScope({ companyId: 'co_1' });
    expect(scope.company?.name).toBe('Legacy Co');
  });
});

describe('buildPlaceholderScope — project', () => {
  it('hydrates name + code + owner when project belongs to the tenant', async () => {
    seed('projects', 'pr_1', {
      companyId: 'co_1',
      name: 'Πολυκατοικία',
      projectCode: 'PRJ-001',
      linkedCompanyName: 'Δ. Παπαδόπουλος',
    });
    const scope = await buildPlaceholderScope({ companyId: 'co_1', projectId: 'pr_1' });
    expect(scope.project).toEqual({
      name: 'Πολυκατοικία',
      code: 'PRJ-001',
      owner: 'Δ. Παπαδόπουλος',
    });
  });

  it('returns undefined project when projectId is omitted', async () => {
    const scope = await buildPlaceholderScope({ companyId: 'co_1' });
    expect(scope.project).toBeUndefined();
  });

  it('drops project scope when companyId mismatches (cross-tenant guard)', async () => {
    seed('projects', 'pr_x', {
      companyId: 'co_other',
      name: 'Foreign Project',
    });
    const scope = await buildPlaceholderScope({ companyId: 'co_1', projectId: 'pr_x' });
    expect(scope.project).toBeUndefined();
  });

  it('returns undefined when project doc is missing', async () => {
    const scope = await buildPlaceholderScope({ companyId: 'co_1', projectId: 'pr_missing' });
    expect(scope.project).toBeUndefined();
  });
});

describe('buildPlaceholderScope — user', () => {
  it('hydrates user.fullName from displayName', async () => {
    seed('users', 'u_1', { displayName: 'Γ. Παγώνης', title: 'Αρχιτέκτων' });
    const scope = await buildPlaceholderScope({ companyId: 'co_1', userId: 'u_1' });
    expect(scope.user?.fullName).toBe('Γ. Παγώνης');
    expect(scope.user?.title).toBe('Αρχιτέκτων');
  });

  it('composes fullName from firstName + lastName when displayName is absent', async () => {
    seed('users', 'u_2', { firstName: 'Γιώργος', lastName: 'Παγώνης' });
    const scope = await buildPlaceholderScope({ companyId: 'co_1', userId: 'u_2' });
    expect(scope.user?.fullName).toBe('Γιώργος Παγώνης');
  });

  it('returns undefined user when no userId is supplied', async () => {
    const scope = await buildPlaceholderScope({ companyId: 'co_1' });
    expect(scope.user).toBeUndefined();
  });
});

describe('buildPlaceholderScope — checker', () => {
  it('merges checkerName into the user scope', async () => {
    seed('users', 'u_1', { displayName: 'Γ. Παγώνης' });
    seed('users', 'u_check', { displayName: 'Ν. Παγώνης' });
    const scope = await buildPlaceholderScope({
      companyId: 'co_1',
      userId: 'u_1',
      checkerUserId: 'u_check',
    });
    expect(scope.user?.fullName).toBe('Γ. Παγώνης');
    expect(scope.user?.checkerName).toBe('Ν. Παγώνης');
  });

  it('creates a user scope with only checkerName when userId is absent', async () => {
    seed('users', 'u_check', { displayName: 'Ν. Παγώνης' });
    const scope = await buildPlaceholderScope({ companyId: 'co_1', checkerUserId: 'u_check' });
    expect(scope.user?.checkerName).toBe('Ν. Παγώνης');
    expect(scope.user?.fullName).toBeUndefined();
  });
});

describe('buildPlaceholderScope — passthrough fields', () => {
  it('passes drawing facts through unchanged', async () => {
    const scope = await buildPlaceholderScope({
      companyId: 'co_1',
      drawing: { title: 'Κάτοψη', scale: '1:50', sheetNumber: 'A-101' },
    });
    expect(scope.drawing).toEqual({ title: 'Κάτοψη', scale: '1:50', sheetNumber: 'A-101' });
  });

  it('passes revision facts through unchanged', async () => {
    const date = new Date('2026-05-11T10:00:00Z');
    const scope = await buildPlaceholderScope({
      companyId: 'co_1',
      revision: { number: '3', date, author: 'Γ. Π.' },
    });
    expect(scope.revision?.number).toBe('3');
    expect(scope.revision?.date).toBe(date);
  });

  it('passes formatting overrides through unchanged', async () => {
    const today = new Date('2026-05-11T10:00:00Z');
    const scope = await buildPlaceholderScope({
      companyId: 'co_1',
      formatting: { locale: 'en', today },
    });
    expect(scope.formatting?.locale).toBe('en');
    expect(scope.formatting?.today).toBe(today);
  });
});

describe('buildPlaceholderScope — immutability', () => {
  it('returns a frozen scope object', async () => {
    seed('companies', 'co_1', { name: 'X' });
    const scope = await buildPlaceholderScope({ companyId: 'co_1' });
    expect(Object.isFrozen(scope)).toBe(true);
  });
});
