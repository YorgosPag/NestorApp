/**
 * FirestoreQueryService — equality guard integration tests (ADR-361)
 *
 * Verifies that `subscribe`, `subscribeDoc`, `subscribeSubcollection` wire the
 * SSoT equality guard correctly: same-content snapshot re-emissions are
 * suppressed by default, with `skipEqualityGuard` and `equalityFn` honoured.
 */

// ===========================================================================
// firebase/firestore mock — captures the onSnapshot handlers for replay
// ===========================================================================

type SnapshotHandler<T> = (snap: T) => void;
let nextOnSnapshotHandlers: Array<SnapshotHandler<unknown>> = [];

const mockOnSnapshot = jest.fn(
  (_q: unknown, handler: SnapshotHandler<unknown>, _err?: (e: Error) => void) => {
    nextOnSnapshotHandlers.push(handler);
    return () => { /* unsubscribe noop */ };
  },
);

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...parts: string[]) => ({ __path: parts.join('/') })),
  doc: jest.fn((_db: unknown, name: string, id: string) => ({ __doc: `${name}/${id}` })),
  query: jest.fn((ref: unknown, ..._c: unknown[]) => ref),
  where: jest.fn((field: string, op: string, value: unknown) => ({ where: [field, op, value] })),
  limit: jest.fn((n: number) => ({ limit: n })),
  orderBy: jest.fn((field: string, dir: string) => ({ orderBy: [field, dir] })),
  documentId: jest.fn(() => '__id__'),
  serverTimestamp: jest.fn(() => '__ts__'),
  onSnapshot: (...args: Parameters<typeof mockOnSnapshot>) => mockOnSnapshot(...args),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

// ===========================================================================
// auth + tenant mocks — bypass tenant filtering and super-admin switcher
// ===========================================================================

jest.mock('../auth-context', () => ({
  requireAuthContext: jest.fn(async () => ({
    uid: 'u1',
    companyId: 'c1',
    isSuperAdmin: false,
    effectiveCompanyId: 'c1',
  })),
  waitForAuthReady: jest.fn(async () => true),
  resolveEffectiveCompanyId: jest.fn(() => 'c1'),
}));

jest.mock('../super-admin-active-company', () => ({
  onSuperAdminActiveCompanyChange: jest.fn(() => () => { /* unsub */ }),
}));

jest.mock('../tenant-config', () => ({
  getTenantConfig: jest.fn(() => ({ mode: 'companyId', fieldName: 'companyId' })),
  resolveTenantValue: jest.fn(() => 'c1'),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: new Proxy({}, { get: (_t, key) => String(key).toLowerCase() }),
  FIRESTORE_LIMITS: { IN_QUERY_MAX_ITEMS: 10 },
}));

jest.mock('@/lib/auth/query-middleware', () => ({
  AuthorizationError: class extends Error {},
  QueryExecutionError: class extends Error {},
}));

// ===========================================================================
// SUT
// ===========================================================================

import { firestoreQueryService } from '../firestore-query.service';

// Helpers ----

function makeSnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>): {
  docs: Array<{ id: string; data: () => Record<string, unknown> }>;
  size: number;
  empty: boolean;
} {
  return {
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
    size: docs.length,
    empty: docs.length === 0,
  };
}

async function flushMicrotasks(): Promise<void> {
  // Service uses `void rebuild().catch(...)` (microtasks) before attaching
  // the snapshot listener — we wait for the chain to drain.
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((r) => setTimeout(r, 0));
}

beforeEach(() => {
  nextOnSnapshotHandlers = [];
  mockOnSnapshot.mockClear();
});

// ===========================================================================
// subscribe (collection)
// ===========================================================================

describe('firestoreQueryService.subscribe — equality guard', () => {
  it('skips delivery when consecutive snapshots have identical content', async () => {
    const onData = jest.fn();
    const onError = jest.fn();
    firestoreQueryService.subscribe('CONTACTS' as never, onData, onError);
    await flushMicrotasks();

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    const handler = nextOnSnapshotHandlers[0];

    handler(makeSnapshot([{ id: 'a', data: { name: 'A', n: 1 } }]));
    handler(makeSnapshot([{ id: 'a', data: { name: 'A', n: 1 } }])); // identical
    handler(makeSnapshot([{ id: 'a', data: { name: 'A', n: 1 } }])); // identical

    expect(onData).toHaveBeenCalledTimes(1);
  });

  it('delivers when content changes', async () => {
    const onData = jest.fn();
    firestoreQueryService.subscribe('CONTACTS' as never, onData, jest.fn());
    await flushMicrotasks();
    const handler = nextOnSnapshotHandlers[0];

    handler(makeSnapshot([{ id: 'a', data: { n: 1 } }]));
    handler(makeSnapshot([{ id: 'a', data: { n: 1 } }])); // skipped
    handler(makeSnapshot([{ id: 'a', data: { n: 2 } }])); // delivered
    handler(makeSnapshot([{ id: 'a', data: { n: 2 } }])); // skipped

    expect(onData).toHaveBeenCalledTimes(2);
  });

  it('skipEqualityGuard=true bypasses the guard', async () => {
    const onData = jest.fn();
    firestoreQueryService.subscribe(
      'CONTACTS' as never,
      onData,
      jest.fn(),
      { skipEqualityGuard: true },
    );
    await flushMicrotasks();
    const handler = nextOnSnapshotHandlers[0];

    handler(makeSnapshot([{ id: 'a', data: { n: 1 } }]));
    handler(makeSnapshot([{ id: 'a', data: { n: 1 } }]));
    handler(makeSnapshot([{ id: 'a', data: { n: 1 } }]));

    expect(onData).toHaveBeenCalledTimes(3);
  });

  it('honours a custom equalityFn', async () => {
    const onData = jest.fn();
    // Custom fn: equal if both have the same number of items (regardless of content).
    const equalityFn = (
      prev: readonly { id: string }[] | null,
      next: readonly { id: string }[],
    ): boolean => prev != null && prev.length === next.length;

    firestoreQueryService.subscribe(
      'CONTACTS' as never,
      onData,
      jest.fn(),
      { equalityFn },
    );
    await flushMicrotasks();
    const handler = nextOnSnapshotHandlers[0];

    handler(makeSnapshot([{ id: 'a', data: { n: 1 } }]));
    // Same length 1 → skipped under custom fn even though content differs
    handler(makeSnapshot([{ id: 'b', data: { n: 2 } }]));
    // Different length → delivered
    handler(makeSnapshot([
      { id: 'a', data: { n: 1 } },
      { id: 'b', data: { n: 2 } },
    ]));

    expect(onData).toHaveBeenCalledTimes(2);
  });

  it('returns no-op unsubscribe and never calls onSnapshot when enabled=false', () => {
    const onData = jest.fn();
    const unsub = firestoreQueryService.subscribe(
      'CONTACTS' as never,
      onData,
      jest.fn(),
      { enabled: false },
    );
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });
});

// ===========================================================================
// subscribeDoc (single document)
// ===========================================================================

describe('firestoreQueryService.subscribeDoc — equality guard', () => {
  it('skips delivery when consecutive snapshots have identical document', async () => {
    const onData = jest.fn();
    firestoreQueryService.subscribeDoc('CONTACTS' as never, 'id1', onData, jest.fn());
    await flushMicrotasks();

    const handler = nextOnSnapshotHandlers[0];

    // single-doc snapshot shape: { exists, data, id }
    const snap = (exists: boolean, data: Record<string, unknown>): unknown => ({
      exists: () => exists,
      data: () => data,
      id: 'id1',
    });

    handler(snap(true, { name: 'A' }));
    handler(snap(true, { name: 'A' })); // identical → skip
    handler(snap(true, { name: 'A' })); // identical → skip
    handler(snap(true, { name: 'B' })); // changed → deliver
    handler(snap(false, {}));            // deleted → deliver
    handler(snap(false, {}));            // still deleted → skip

    expect(onData).toHaveBeenCalledTimes(3);
  });

  it('skipEqualityGuard=true delivers every snapshot', async () => {
    const onData = jest.fn();
    firestoreQueryService.subscribeDoc(
      'CONTACTS' as never,
      'id1',
      onData,
      jest.fn(),
      { skipEqualityGuard: true },
    );
    await flushMicrotasks();

    const handler = nextOnSnapshotHandlers[0];
    const snap = (data: Record<string, unknown>): unknown => ({
      exists: () => true,
      data: () => data,
      id: 'id1',
    });

    handler(snap({ n: 1 }));
    handler(snap({ n: 1 }));
    handler(snap({ n: 1 }));

    expect(onData).toHaveBeenCalledTimes(3);
  });
});

// ===========================================================================
// subscribeSubcollection
// ===========================================================================

describe('firestoreQueryService.subscribeSubcollection — equality guard', () => {
  it('skips identical-content re-emissions', async () => {
    const onData = jest.fn();
    firestoreQueryService.subscribeSubcollection(
      'CONTACTS' as never,
      'parent1',
      'children',
      onData,
      jest.fn(),
    );
    await flushMicrotasks();

    const handler = nextOnSnapshotHandlers[0];
    handler(makeSnapshot([{ id: 'a', data: { v: 1 } }]));
    handler(makeSnapshot([{ id: 'a', data: { v: 1 } }])); // skipped
    handler(makeSnapshot([{ id: 'a', data: { v: 2 } }])); // delivered

    expect(onData).toHaveBeenCalledTimes(2);
  });
});
