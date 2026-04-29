import type { AuthContext } from '@/lib/auth';
import type { SourcingEvent } from '../../types/sourcing-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockTimestamp = (sec = 1700000000) => ({ seconds: sec, nanoseconds: 0 });

jest.mock('firebase-admin', () => ({
  firestore: {
    Timestamp: {
      now: jest.fn(() => mockTimestamp()),
      fromDate: jest.fn((d: Date) => mockTimestamp(Math.floor(d.getTime() / 1000))),
    },
    FieldPath: { documentId: jest.fn(() => '__name__') },
  },
}));

jest.mock('@/utils/firestore-sanitize', () => ({
  sanitizeForFirestore: jest.fn((x: unknown) => x),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateSourcingEventId: jest.fn(() => 'sevent_abc123'),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('@/lib/date-local', () => ({
  normalizeToDate: jest.fn((v: unknown) => (v ? new Date('2026-12-31') : null)),
}));

const mockDocRef = {
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
};
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ docs: [] }),
};
const mockCollection = jest.fn(() => ({ ...mockQuery, doc: jest.fn(() => mockDocRef) }));
const mockTxGet = jest.fn();
const mockTxUpdate = jest.fn();
const mockDb = {
  collection: mockCollection,
  runTransaction: jest.fn(async (fn: (tx: { get: typeof mockTxGet; update: typeof mockTxUpdate }) => Promise<unknown>) =>
    fn({ get: mockTxGet, update: mockTxUpdate }),
  ),
};

jest.mock('@/lib/firebaseAdmin', () => ({
  // Transparent mock — errors propagate so we can test service logic directly
  safeFirestoreOperation: jest.fn(async (op: (db: typeof mockDb) => Promise<unknown>) => op(mockDb)),
  getAdminFirestore: jest.fn(() => mockDb),
  FieldValue: {
    arrayUnion: jest.fn((...args: unknown[]) => ({ _arrayUnion: args })),
    arrayRemove: jest.fn((...args: unknown[]) => ({ _arrayRemove: args })),
    increment: jest.fn((n: number) => ({ _increment: n })),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const ctx: AuthContext = { uid: 'u1', companyId: 'co1' } as AuthContext;

function makeEventSnap(overrides: Partial<SourcingEvent> = {}) {
  const data: SourcingEvent = {
    id: 'sevent_abc123',
    companyId: 'co1',
    projectId: 'proj1',
    buildingId: null,
    title: 'Test Event',
    description: null,
    status: 'draft',
    rfqIds: [],
    rfqCount: 0,
    closedRfqCount: 0,
    deadlineDate: null,
    createdAt: mockTimestamp() as unknown as import('firebase/firestore').Timestamp,
    updatedAt: mockTimestamp() as unknown as import('firebase/firestore').Timestamp,
    createdBy: 'u1',
    ...overrides,
  };
  return { exists: true, id: data.id, data: () => data };
}

// ============================================================================
// TESTS
// ============================================================================

import {
  createSourcingEvent,
  getSourcingEvent,
  updateSourcingEvent,
  addRfqToSourcingEvent,
  removeRfqFromSourcingEvent,
  recomputeSourcingEventStatus,
} from '../sourcing-event-service';

beforeEach(() => jest.clearAllMocks());

describe('createSourcingEvent', () => {
  it('creates doc with correct defaults', async () => {
    await createSourcingEvent(ctx, { projectId: 'proj1', title: 'Test Event' });

    const setCall = mockDocRef.set.mock.calls[0][0] as Partial<SourcingEvent>;
    expect(setCall.id).toBe('sevent_abc123');
    expect(setCall.companyId).toBe('co1');
    expect(setCall.status).toBe('draft');
    expect(setCall.rfqCount).toBe(0);
    expect(setCall.closedRfqCount).toBe(0);
    expect(setCall.createdBy).toBe('u1');
  });
});

describe('getSourcingEvent', () => {
  it('returns null for wrong companyId (tenant isolation)', async () => {
    mockDocRef.get.mockResolvedValueOnce(
      makeEventSnap({ companyId: 'co_other' }),
    );
    const result = await getSourcingEvent(ctx, 'sevent_abc123');
    expect(result).toBeNull();
  });

  it('returns event for correct companyId', async () => {
    mockDocRef.get.mockResolvedValueOnce(makeEventSnap());
    const result = await getSourcingEvent(ctx, 'sevent_abc123');
    expect(result?.id).toBe('sevent_abc123');
  });
});

describe('updateSourcingEvent — FSM transitions', () => {
  it('allows valid transition draft → active', async () => {
    mockDocRef.get.mockResolvedValueOnce(makeEventSnap({ status: 'draft' }));
    await expect(
      updateSourcingEvent(ctx, 'sevent_abc123', { status: 'active' }),
    ).resolves.not.toThrow();
  });

  it('rejects invalid transition closed → draft', async () => {
    mockDocRef.get.mockResolvedValueOnce(makeEventSnap({ status: 'closed' }));
    await expect(
      updateSourcingEvent(ctx, 'sevent_abc123', { status: 'draft' }),
    ).rejects.toThrow('Invalid transition');
  });
});

describe('addRfqToSourcingEvent', () => {
  it('increments rfqCount and transitions status atomically', async () => {
    const snap = makeEventSnap({ rfqCount: 1, closedRfqCount: 0, status: 'active' });
    mockTxGet.mockResolvedValueOnce(snap);

    await addRfqToSourcingEvent(ctx, 'sevent_abc123', 'rfq_new');

    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rfqCount: 2, status: 'active' }),
    );
  });

  it('is idempotent when rfqId already in rfqIds', async () => {
    const snap = makeEventSnap({ rfqIds: ['rfq_existing'], rfqCount: 1 });
    mockTxGet.mockResolvedValueOnce(snap);

    await addRfqToSourcingEvent(ctx, 'sevent_abc123', 'rfq_existing');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });
});

describe('removeRfqFromSourcingEvent', () => {
  it('decrements rfqCount and is idempotent', async () => {
    const snap = makeEventSnap({ rfqIds: ['rfq1'], rfqCount: 1, closedRfqCount: 0, status: 'active' });
    mockTxGet.mockResolvedValueOnce(snap);

    await removeRfqFromSourcingEvent(ctx, 'sevent_abc123', 'rfq1');

    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rfqCount: 0 }),
    );
  });

  it('no-ops when rfqId not in rfqIds', async () => {
    const snap = makeEventSnap({ rfqIds: [], rfqCount: 0 });
    mockTxGet.mockResolvedValueOnce(snap);

    await removeRfqFromSourcingEvent(ctx, 'sevent_abc123', 'rfq_missing');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });
});

describe('recomputeSourcingEventStatus', () => {
  it('increments closedRfqCount and derives partial status', async () => {
    const snap = makeEventSnap({ rfqCount: 2, closedRfqCount: 0, status: 'active' });
    mockTxGet.mockResolvedValueOnce(snap);

    const newStatus = await recomputeSourcingEventStatus(ctx, 'sevent_abc123');

    expect(newStatus).toBe('partial');
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ closedRfqCount: 1, status: 'partial' }),
    );
  });

  it('derives closed status when last rfq closes', async () => {
    const snap = makeEventSnap({ rfqCount: 1, closedRfqCount: 0, status: 'active' });
    mockTxGet.mockResolvedValueOnce(snap);

    const newStatus = await recomputeSourcingEventStatus(ctx, 'sevent_abc123');
    expect(newStatus).toBe('closed');
  });

  it('rejects wrong companyId', async () => {
    const snap = makeEventSnap({ companyId: 'co_other' });
    mockTxGet.mockResolvedValueOnce(snap);

    await expect(recomputeSourcingEventStatus(ctx, 'sevent_abc123')).rejects.toThrow('Forbidden');
  });
});
