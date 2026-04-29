import type { AuthContext } from '@/lib/auth';
import type { RfqLine, CreateRfqLineDTO } from '../../types/rfq-line';
import type { BOQItem } from '@/types/boq/boq';

// ============================================================================
// MOCKS
// ============================================================================

const mockTimestamp = () => ({ seconds: 1700000000, nanoseconds: 0 });
let lineIdCounter = 0;

jest.mock('firebase-admin', () => ({
  firestore: {
    Timestamp: { now: jest.fn(() => mockTimestamp()) },
    FieldPath: { documentId: jest.fn(() => '__name__') },
  },
}));

jest.mock('@/utils/firestore-sanitize', () => ({
  sanitizeForFirestore: jest.fn((x: unknown) => x),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateRfqLineId: jest.fn(() => `rfqln_${++lineIdCounter}`),
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn().mockResolvedValue(null) },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../data/trades', () => ({
  getTradeCodeForAtoeCategory: jest.fn((code: string) =>
    code.startsWith('OIK') ? 'concrete' : null,
  ),
}));

const mockBatch = {
  set: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};
const mockLineDocRef = {
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
};
const mockLinesCollection = {
  doc: jest.fn(() => mockLineDocRef),
  orderBy: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ docs: [] }),
  count: jest.fn().mockReturnThis(),
};
const mockRfqDocRef = {
  get: jest.fn(),
  collection: jest.fn(() => mockLinesCollection),
};
const mockBoqCollection = {
  where: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ docs: [] }),
};
const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === 'boq_items') return mockBoqCollection;
    return {
      doc: jest.fn(() => mockRfqDocRef),
      where: jest.fn().mockReturnThis(),
    };
  }),
  batch: jest.fn(() => mockBatch),
};

jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: jest.fn(async (op: (db: typeof mockDb) => Promise<unknown>) => op(mockDb)),
  getAdminFirestore: jest.fn(() => mockDb),
}));

// ============================================================================
// HELPERS
// ============================================================================

const ctx: AuthContext = { uid: 'u1', companyId: 'co1' } as AuthContext;

function makeRfqSnap(companyId = 'co1') {
  return { exists: true, id: 'rfq1', data: () => ({ companyId }) };
}

function makeLineSnap(overrides: Partial<RfqLine> = {}) {
  const line: RfqLine = {
    id: 'rfqln_1',
    rfqId: 'rfq1',
    companyId: 'co1',
    source: 'ad_hoc',
    boqItemId: null,
    description: 'Test line',
    trade: 'concrete',
    categoryCode: null,
    quantity: 10,
    unit: 'm²',
    unitPrice: 50,
    notes: null,
    displayOrder: 0,
    createdAt: mockTimestamp() as unknown as import('firebase/firestore').Timestamp,
    updatedAt: mockTimestamp() as unknown as import('firebase/firestore').Timestamp,
    ...overrides,
  };
  return { exists: true, id: line.id, data: () => line };
}

function makeBoqItem(overrides: Partial<BOQItem> = {}): BOQItem {
  return {
    id: 'boq1',
    companyId: 'co1',
    projectId: 'proj1',
    buildingId: 'bldg1',
    scope: 'building',
    linkedUnitId: null,
    categoryCode: 'OIK-2',
    title: 'Reinforced concrete',
    description: 'C20/25',
    unit: 'm³',
    estimatedQuantity: 100,
    actualQuantity: null,
    wasteFactor: 0.05,
    wastePolicy: 'inherited',
    materialUnitCost: 80,
    laborUnitCost: 40,
    equipmentUnitCost: 20,
    priceAuthority: 'master',
    linkedPhaseId: null,
    linkedTaskId: null,
    linkedInvoiceId: null,
    linkedContractorId: null,
    source: 'manual',
    measurementMethod: 'manual',
    status: 'draft',
    qaStatus: 'pending',
    notes: null,
    createdBy: null,
    approvedBy: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  } as BOQItem;
}

// ============================================================================
// TESTS
// ============================================================================

import {
  addRfqLine,
  addRfqLinesBulk,
  snapshotFromBoq,
  listRfqLines,
  listRfqLinesPublic,
  updateRfqLine,
  deleteRfqLine,
} from '../rfq-line-service';

beforeEach(() => {
  jest.clearAllMocks();
  lineIdCounter = 0;
  mockRfqDocRef.get.mockResolvedValue(makeRfqSnap());
  mockLinesCollection.count.mockReturnThis();
  mockLinesCollection.get.mockResolvedValue({
    docs: [],
    data: () => ({ count: 0 }),
  });
});

describe('addRfqLine', () => {
  it('denormalizes companyId on every line (CHECK 3.10)', async () => {
    const dto: CreateRfqLineDTO = {
      source: 'ad_hoc',
      description: 'Steel frame',
      trade: 'steel',
    };
    mockLinesCollection.get.mockResolvedValueOnce({ data: () => ({ count: 0 }) });

    const line = await addRfqLine(ctx, 'rfq1', dto);

    expect(line.companyId).toBe('co1');
    expect(line.rfqId).toBe('rfq1');
    expect(line.source).toBe('ad_hoc');
    expect(line.boqItemId).toBeNull();
  });

  it('rejects when RFQ belongs to another tenant', async () => {
    mockRfqDocRef.get.mockResolvedValueOnce(makeRfqSnap('co_other'));
    await expect(addRfqLine(ctx, 'rfq1', {
      source: 'ad_hoc',
      description: 'x',
      trade: 'concrete',
    })).rejects.toThrow('Forbidden');
  });
});

describe('addRfqLinesBulk', () => {
  it('assigns sequential displayOrder when not provided', async () => {
    const dtos: CreateRfqLineDTO[] = [
      { source: 'ad_hoc', description: 'A', trade: 'concrete' },
      { source: 'ad_hoc', description: 'B', trade: 'concrete' },
    ];
    mockLinesCollection.get.mockResolvedValueOnce({ data: () => ({ count: 2 }) });

    const lines = await addRfqLinesBulk(ctx, 'rfq1', dtos);

    expect(lines[0].displayOrder).toBe(2);
    expect(lines[1].displayOrder).toBe(3);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when dtos is empty', async () => {
    const lines = await addRfqLinesBulk(ctx, 'rfq1', []);
    expect(lines).toEqual([]);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

describe('snapshotFromBoq — Q29 snapshot semantics', () => {
  it('creates lines as frozen copy — source=boq, boqItemId set', async () => {
    const boqItem = makeBoqItem();
    mockBoqCollection.get.mockResolvedValueOnce({
      docs: [{ id: boqItem.id, data: () => boqItem }],
    });
    mockLinesCollection.get.mockResolvedValueOnce({ data: () => ({ count: 0 }) });

    const lines = await snapshotFromBoq(ctx, 'rfq1', ['boq1'], 'concrete');

    expect(lines[0].source).toBe('boq');
    expect(lines[0].boqItemId).toBe('boq1');
    expect(lines[0].description).toBe('Reinforced concrete');
    expect(lines[0].quantity).toBe(100);
    expect(lines[0].unitPrice).toBe(140); // 80 + 40 + 20
    expect(lines[0].companyId).toBe('co1'); // CHECK 3.10
  });

  it('filters out BOQ items from other tenants (CHECK 3.10)', async () => {
    const foreignItem = makeBoqItem({ companyId: 'co_other' });
    mockBoqCollection.get.mockResolvedValueOnce({
      docs: [{ id: foreignItem.id, data: () => foreignItem }],
    });
    mockLinesCollection.get.mockResolvedValueOnce({ data: () => ({ count: 0 }) });

    const lines = await snapshotFromBoq(ctx, 'rfq1', ['boq1'], 'concrete');
    expect(lines).toHaveLength(0);
  });

  it('uses trade fallback when categoryCode has no mapping', async () => {
    const boqItem = makeBoqItem({ categoryCode: 'UNKNOWN-9' });
    mockBoqCollection.get.mockResolvedValueOnce({
      docs: [{ id: boqItem.id, data: () => boqItem }],
    });
    mockLinesCollection.get.mockResolvedValueOnce({ data: () => ({ count: 0 }) });

    const lines = await snapshotFromBoq(ctx, 'rfq1', ['boq1'], 'plumbing');
    expect(lines[0].trade).toBe('plumbing');
  });
});

describe('listRfqLinesPublic — strips internal fields', () => {
  it('removes unitPrice, boqItemId, source, companyId from public projection', async () => {
    mockLinesCollection.get.mockResolvedValue({
      docs: [makeLineSnap({ unitPrice: 99, boqItemId: 'boq1', source: 'boq' })],
    });

    const lines = await listRfqLinesPublic(ctx, 'rfq1');
    const line = lines[0];

    expect((line as Record<string, unknown>).unitPrice).toBeUndefined();
    expect((line as Record<string, unknown>).boqItemId).toBeUndefined();
    expect((line as Record<string, unknown>).source).toBeUndefined();
    expect((line as Record<string, unknown>).companyId).toBeUndefined();
    expect(line.description).toBe('Test line');
  });
});

describe('updateRfqLine', () => {
  it('updates only provided fields, preserves others', async () => {
    mockLineDocRef.get.mockResolvedValueOnce(makeLineSnap({ quantity: 5, notes: 'original' }));

    const updated = await updateRfqLine(ctx, 'rfq1', 'rfqln_1', { quantity: 10 });

    expect(updated.quantity).toBe(10);
    expect(updated.notes).toBe('original');
  });

  it('rejects wrong companyId', async () => {
    mockLineDocRef.get.mockResolvedValueOnce(makeLineSnap({ companyId: 'co_other' }));
    await expect(updateRfqLine(ctx, 'rfq1', 'rfqln_1', { quantity: 10 })).rejects.toThrow(
      'Forbidden',
    );
  });
});

describe('deleteRfqLine', () => {
  it('deletes the line doc', async () => {
    mockLineDocRef.get.mockResolvedValueOnce(makeLineSnap());
    await deleteRfqLine(ctx, 'rfq1', 'rfqln_1');
    expect(mockLineDocRef.delete).toHaveBeenCalled();
  });
});

describe('listRfqLines', () => {
  it('orders by displayOrder ascending', async () => {
    const snap = {
      docs: [
        makeLineSnap({ id: 'l1', displayOrder: 0 }),
        makeLineSnap({ id: 'l2', displayOrder: 1 }),
      ],
    };
    mockLinesCollection.get.mockResolvedValueOnce(snap);

    const lines = await listRfqLines(ctx, 'rfq1');
    expect(lines[0].displayOrder).toBe(0);
    expect(lines[1].displayOrder).toBe(1);
    expect(mockLinesCollection.orderBy).toHaveBeenCalledWith('displayOrder', 'asc');
  });
});
