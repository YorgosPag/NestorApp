import type { AuthContext } from '@/lib/auth';
import type { RFQ, CreateRfqDTO } from '../../types/rfq';

// ============================================================================
// MOCKS
// ============================================================================

const mockTimestamp = () => ({ seconds: 1700000000, nanoseconds: 0 });

jest.mock('firebase-admin', () => ({
  firestore: {
    Timestamp: {
      now: jest.fn(() => mockTimestamp()),
      fromDate: jest.fn((d: Date) => mockTimestamp()),
    },
    FieldPath: { documentId: jest.fn(() => '__name__') },
  },
}));

jest.mock('@/utils/firestore-sanitize', () => ({
  sanitizeForFirestore: jest.fn((x: unknown) => x),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateRfqId: jest.fn(() => 'rfq_test123'),
  generateVendorInviteId: jest.fn(() => 'vinv_test123'),
}));

jest.mock('@/services/vendor-portal/vendor-portal-token-service', () => ({
  generateVendorPortalToken: jest.fn((rfqId: string, vendorId: string) => ({
    token: `tok_${vendorId}`,
    expiresAt: '2026-12-31T00:00:00.000Z',
  })),
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

jest.mock('../../data/trades', () => ({
  getTradeCodeForAtoeCategory: jest.fn(() => null),
}));

// Sub-service mocks
const mockSnapshotFromBoq = jest.fn().mockResolvedValue([]);
const mockAddRfqLinesBulk = jest.fn().mockResolvedValue([]);
const mockRecomputeStatus = jest.fn().mockResolvedValue('partial');

jest.mock('../rfq-line-service', () => ({
  snapshotFromBoq: (...args: unknown[]) => mockSnapshotFromBoq(...args),
  addRfqLinesBulk: (...args: unknown[]) => mockAddRfqLinesBulk(...args),
}));

jest.mock('../sourcing-event-service', () => ({
  recomputeSourcingEventStatus: (...args: unknown[]) => mockRecomputeStatus(...args),
}));

// Firestore mocks
const mockBatch = {
  set: jest.fn(),
  update: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};
const mockDocRef = {
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};
const mockQuery = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ docs: [] }),
};
const mockCollection = jest.fn(() => ({ ...mockQuery, doc: jest.fn(() => mockDocRef) }));
const mockDb = {
  collection: mockCollection,
  batch: jest.fn(() => mockBatch),
};

jest.mock('@/lib/firebaseAdmin', () => ({
  // Transparent mock — errors propagate; !rfq guard in createRfq handles undefined
  safeFirestoreOperation: jest.fn(async (op: (db: typeof mockDb) => Promise<unknown>) => {
    try { return await op(mockDb); } catch { return undefined; }
  }),
  FieldValue: {
    arrayUnion: jest.fn((...args: unknown[]) => ({ _arrayUnion: args })),
    increment: jest.fn((n: number) => ({ _increment: n })),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const ctx: AuthContext = { uid: 'u1', companyId: 'co1' } as AuthContext;

function makeRfqSnap(overrides: Partial<RFQ> = {}) {
  const rfq: Partial<RFQ> = {
    id: 'rfq_test123',
    companyId: 'co1',
    projectId: 'proj1',
    status: 'draft',
    invitedVendorIds: [],
    lines: [],
    auditTrail: [],
    sourcingEventId: null,
    ...overrides,
  };
  return { exists: true, id: rfq.id, data: () => rfq };
}

// ============================================================================
// TESTS
// ============================================================================

import { createRfq, updateRfq } from '../rfq-service';

beforeEach(() => jest.clearAllMocks());

describe('createRfq — new optional fields (Q28-Q31)', () => {
  it('populates invitedVendorCount, respondedCount=0, linesStorage=null for empty dto', async () => {
    const dto: CreateRfqDTO = { projectId: 'proj1', title: 'Test RFQ' };
    const rfq = await createRfq(ctx, dto);

    expect(rfq.invitedVendorCount).toBe(0);
    expect(rfq.respondedCount).toBe(0);
    expect(rfq.linesStorage).toBeNull();
    expect(rfq.sourcingEventId).toBeNull();
  });

  it('sets linesStorage=inline_legacy when dto.lines provided', async () => {
    const dto: CreateRfqDTO = {
      projectId: 'proj1',
      title: 'Test',
      lines: [{ id: 'l1', description: 'x', trade: 'concrete', categoryCode: null, quantity: null, unit: null, notes: null }],
    };
    const rfq = await createRfq(ctx, dto);
    expect(rfq.linesStorage).toBe('inline_legacy');
  });

  it('sets linesStorage=boq when dto.boqItemIds provided', async () => {
    const dto: CreateRfqDTO = { projectId: 'proj1', title: 'Test', boqItemIds: ['boq1'] };
    const rfq = await createRfq(ctx, dto);
    expect(rfq.linesStorage).toBe('boq');
  });
});

describe('createRfq — Q28 atomic fan-out', () => {
  it('uses batch when invitedVendorIds is non-empty', async () => {
    const dto: CreateRfqDTO = {
      projectId: 'proj1',
      title: 'Multi-vendor RFQ',
      invitedVendorIds: ['v1', 'v2'],
    };
    await createRfq(ctx, dto);

    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(mockBatch.set).toHaveBeenCalledTimes(3); // 1 RFQ + 2 invites
  });

  it('creates vendor invite stubs with generated token per vendor', async () => {
    const dto: CreateRfqDTO = {
      projectId: 'proj1',
      title: 'RFQ',
      invitedVendorIds: ['v1', 'v2'],
    };
    await createRfq(ctx, dto);

    const batchSetCalls = mockBatch.set.mock.calls as Array<[unknown, Record<string, unknown>]>;
    const inviteStubs = batchSetCalls.slice(1).map(([, data]) => data);

    expect(inviteStubs[0]).toMatchObject({ vendorContactId: 'v1', token: 'tok_v1', status: 'sent', companyId: 'co1' });
    expect(inviteStubs[1]).toMatchObject({ vendorContactId: 'v2', token: 'tok_v2', status: 'sent', companyId: 'co1' });
  });

  it('links to sourcing event in same batch when sourcingEventId provided', async () => {
    const dto: CreateRfqDTO = {
      projectId: 'proj1',
      title: 'RFQ',
      sourcingEventId: 'sevent_abc',
    };
    await createRfq(ctx, dto);

    expect(mockBatch.commit).toHaveBeenCalled();
    expect(mockBatch.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rfqCount: expect.objectContaining({ _increment: 1 }) }),
    );
  });

  it('atomic: batch failure prevents any doc write', async () => {
    mockBatch.commit.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const dto: CreateRfqDTO = {
      projectId: 'proj1',
      title: 'RFQ',
      invitedVendorIds: ['v1'],
    };

    await expect(createRfq(ctx, dto)).rejects.toThrow('Failed to create RFQ');
    expect(mockSnapshotFromBoq).not.toHaveBeenCalled();
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });
});

describe('createRfq — Q29 sub-collection line writes', () => {
  it('calls snapshotFromBoq after RFQ is created', async () => {
    const dto: CreateRfqDTO = {
      projectId: 'proj1',
      title: 'RFQ',
      boqItemIds: ['boq1', 'boq2'],
    };
    await createRfq(ctx, dto);

    expect(mockSnapshotFromBoq).toHaveBeenCalledWith(ctx, 'rfq_test123', ['boq1', 'boq2'], 'materials_general');
  });

  it('calls addRfqLinesBulk for adHocLines', async () => {
    const adhocLines = [{ source: 'ad_hoc' as const, description: 'x', trade: 'concrete' as import('../../types/trade').TradeCode }];
    const dto: CreateRfqDTO = { projectId: 'proj1', title: 'RFQ', adHocLines: adhocLines };
    await createRfq(ctx, dto);

    expect(mockAddRfqLinesBulk).toHaveBeenCalledWith(ctx, 'rfq_test123', adhocLines);
  });

  it('boqItemIds takes precedence over adHocLines', async () => {
    const dto: CreateRfqDTO = {
      projectId: 'proj1',
      title: 'RFQ',
      boqItemIds: ['boq1'],
      adHocLines: [{ source: 'ad_hoc', description: 'x', trade: 'concrete' }],
    };
    await createRfq(ctx, dto);

    expect(mockSnapshotFromBoq).toHaveBeenCalled();
    expect(mockAddRfqLinesBulk).not.toHaveBeenCalled();
  });
});

describe('updateRfq — Q31 status propagation', () => {
  it('calls recomputeSourcingEventStatus when RFQ closes with parent event', async () => {
    mockDocRef.get.mockResolvedValueOnce(
      makeRfqSnap({ status: 'active', sourcingEventId: 'sevent_parent' }),
    );

    await updateRfq(ctx, 'rfq_test123', { status: 'closed' });

    expect(mockRecomputeStatus).toHaveBeenCalledWith(ctx, 'sevent_parent');
  });

  it('does not call recomputeStatus when no sourcingEventId', async () => {
    mockDocRef.get.mockResolvedValueOnce(
      makeRfqSnap({ status: 'active', sourcingEventId: null }),
    );

    await updateRfq(ctx, 'rfq_test123', { status: 'closed' });

    expect(mockRecomputeStatus).not.toHaveBeenCalled();
  });

  it('does not call recomputeStatus when status unchanged', async () => {
    mockDocRef.get.mockResolvedValueOnce(
      makeRfqSnap({ status: 'closed', sourcingEventId: 'sevent_parent' }),
    );

    await updateRfq(ctx, 'rfq_test123', { status: 'closed' });

    expect(mockRecomputeStatus).not.toHaveBeenCalled();
  });
});
