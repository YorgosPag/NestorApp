/**
 * Tests for BimToBoqBridge (ADR-363 Phase 6)
 *
 * Uses jest.mock to isolate Firestore. Tests focus on:
 *   - deterministic ID derivation
 *   - detach guard on update
 *   - detach guard on delete
 *   - createdAt preservation
 *   - missing mapping → no write
 *   - missing context → no write
 */

import { bimToBoqBridge } from '../BimToBoqBridge';

// ---------------------------------------------------------------------------
// Mock Firestore
// ---------------------------------------------------------------------------

const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockDoc = jest.fn((_, __, id) => ({ id, __ref: id }));
const mockQuery = jest.fn((..._args: unknown[]) => ({ __kind: 'query' }));
const mockWhere = jest.fn((field, op, value) => ({ __kind: 'where', field, op, value }));
const mockCollection = jest.fn((_, name) => ({ __kind: 'collection', name }));

jest.mock('firebase/firestore', () => ({
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: [string, string, unknown]) => mockWhere(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
}));

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { BOQ_ITEMS: 'boq_items' } }));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn() }) }));
jest.mock('@/lib/date-local', () => ({ nowISO: () => '2026-05-18T00:00:00.000Z' }));
jest.mock('@/utils/firestore-sanitize', () => ({
  stripUndefinedDeep: (v: unknown) => v,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const context = { companyId: 'c1', projectId: 'p1', buildingId: 'b1' };

function makeSnap(exists: boolean, data?: Record<string, unknown>) {
  return { exists: () => exists, data: () => data ?? {} };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bimToBoqBridge.upsertBoqItemForBim', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls setDoc with deterministic ID boq_bim_<entityId>', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim(
      'beam',
      { id: 'beam-001', kind: 'straight', geometry: { volume: 0.5 } },
      context,
      'created',
    );

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'boq_items', 'boq_bim_beam-001');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const payload = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.id).toBe('boq_bim_beam-001');
    expect(payload.categoryCode).toBe('OIK-2.04');
    expect(payload.unit).toBe('m3');
    expect(payload.estimatedQuantity).toBe(0.5);
    expect(payload.sourceType).toBe('bim-auto');
    expect(payload.sourceEntityId).toBe('beam-001');
    expect(payload.detached).toBeNull();
  });

  it('skips setDoc when item is detached on update', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: true, createdAt: '2026-01-01T00:00:00Z' }));

    await bimToBoqBridge.upsertBoqItemForBim(
      'beam',
      { id: 'beam-002', kind: 'straight' },
      context,
      'updated',
    );

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('does NOT skip on "created" action even if detached flag is present (first-save always wins)', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: true, createdAt: '2026-01-01T00:00:00Z' }));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim(
      'beam',
      { id: 'beam-003', kind: 'straight' },
      context,
      'created',
    );

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('preserves createdAt from existing doc', async () => {
    const originalCreatedAt = '2026-03-01T00:00:00Z';
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: false, createdAt: originalCreatedAt }));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim(
      'slab',
      { id: 'slab-001', kind: 'floor', geometry: { volume: 1.2 } },
      context,
      'updated',
    );

    const payload = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.createdAt).toBe(originalCreatedAt);
  });

  it('skips when mapping not found (unknown opening kind)', async () => {
    await bimToBoqBridge.upsertBoqItemForBim(
      'opening',
      { id: 'op-001', kind: 'skylight' },
      context,
      'created',
    );

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('skips when buildingId is missing from context', async () => {
    await bimToBoqBridge.upsertBoqItemForBim(
      'wall',
      { id: 'w-001', kind: 'straight', params: { category: 'exterior' } },
      { companyId: 'c1', projectId: 'p1', buildingId: '' },
      'created',
    );

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('uses quantity=1 for openings (unit=pcs)', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim(
      'opening',
      { id: 'op-002', kind: 'door', geometry: { area: 5 } },
      context,
      'created',
    );

    const payload = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.unit).toBe('pcs');
    expect(payload.estimatedQuantity).toBe(1);
  });
});

describe('bimToBoqBridge.deleteBoqItemForBim', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no multi-layer children (single-entry case)
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it('deletes the BOQ item when not detached', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: false }));
    mockDeleteDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.deleteBoqItemForBim('beam-004', 'c1');

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('skips delete when item is detached', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: true }));

    await bimToBoqBridge.deleteBoqItemForBim('beam-005', 'c1');

    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('skips delete when item does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));

    await bimToBoqBridge.deleteBoqItemForBim('beam-006', 'c1');

    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('cascades delete σε όλα τα multi-layer children (Phase 6.1)', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'boq_bim_wall-100_layer_L0' },
        { id: 'boq_bim_wall-100_layer_L1' },
        { id: 'boq_bim_wall-100_layer_L2' },
      ],
    });
    // All 4 rows (parent + 3 children) exist and are not detached
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: false }));
    mockDeleteDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.deleteBoqItemForBim('wall-100', 'c1');

    expect(mockDeleteDoc).toHaveBeenCalledTimes(4);
    expect(mockWhere).toHaveBeenCalledWith('parentBoqItemId', '==', 'boq_bim_wall-100');
  });

  it('skips detached child rows individually σε cascade', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'boq_bim_wall-101_layer_L0' },
        { id: 'boq_bim_wall-101_layer_L1' },
      ],
    });
    // parent + L1 not detached, L0 detached (user took ownership)
    mockGetDoc.mockImplementation((ref: { id?: string }) => {
      if (ref.id === 'boq_bim_wall-101_layer_L0') {
        return Promise.resolve(makeSnap(true, { detached: true }));
      }
      return Promise.resolve(makeSnap(true, { detached: false }));
    });
    mockDeleteDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.deleteBoqItemForBim('wall-101', 'c1');

    // parent + L1 deleted, L0 skipped
    expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
  });

  it('continues deletion even αν cascade query fails (best-effort parent delete)', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firestore query error'));
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: false }));
    mockDeleteDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.deleteBoqItemForBim('wall-102', 'c1');

    // Parent still deleted; orphaned children await manual recovery
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('bimToBoqBridge.upsertBoqItemForBim — multi-layer wall (Phase 6.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  const dna3Layer = {
    totalThickness: 250,
    layers: [
      { id: 'L0', name: 'Plaster Ext', thickness: 20, materialId: 'mat-plaster-ext', side: 'exterior' as const },
      { id: 'L1', name: 'Concrete',    thickness: 210, materialId: 'mat-concrete-c25', side: 'core' as const },
      { id: 'L2', name: 'Plaster Int', thickness: 20, materialId: 'mat-plaster-int', side: 'interior' as const },
    ],
  };

  function makeWall(dna: typeof dna3Layer | null = dna3Layer) {
    return {
      id: 'wall-200',
      kind: 'straight',
      params: { category: 'exterior', ...(dna ? { dna } : {}) },
      geometry: { area: 30 },
    };
  }

  it('παράγει 1 parent + 3 children για 3-layer wall (όλα setDoc)', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim('wall', makeWall(), context, 'created');

    expect(mockSetDoc).toHaveBeenCalledTimes(4);
    const ids = mockSetDoc.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(ids).toEqual(expect.arrayContaining([
      'boq_bim_wall-200',
      'boq_bim_wall-200_layer_L0',
      'boq_bim_wall-200_layer_L1',
      'boq_bim_wall-200_layer_L2',
    ]));
  });

  it('parent payload έχει isGroupParent=true + parentMapping category (OIK-3.05)', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim('wall', makeWall(), context, 'created');

    const parentCall = mockSetDoc.mock.calls.find((c) => (c[0] as { id: string }).id === 'boq_bim_wall-200');
    const payload = parentCall![1] as Record<string, unknown>;
    expect(payload.isGroupParent).toBe(true);
    expect(payload.parentBoqItemId).toBeNull();
    expect(payload.categoryCode).toBe('OIK-3.05');
    expect(payload.estimatedQuantity).toBe(30);
  });

  it('child concrete layer έχει volume quantity = area × thickness/1000', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim('wall', makeWall(), context, 'created');

    const childCall = mockSetDoc.mock.calls.find((c) => (c[0] as { id: string }).id === 'boq_bim_wall-200_layer_L1');
    const payload = childCall![1] as Record<string, unknown>;
    expect(payload.materialId).toBe('mat-concrete-c25');
    expect(payload.unit).toBe('m3');
    expect(payload.estimatedQuantity).toBeCloseTo(6.3, 6); // 30 × 0.210
    expect(payload.parentBoqItemId).toBe('boq_bim_wall-200');
    expect(payload.layerIndex).toBe(1);
  });

  it('per-layer detach guard — μόνο το detached child skips, τα υπόλοιπα ενημερώνονται', async () => {
    mockGetDoc.mockImplementation((ref: { id?: string }) => {
      // Parent fresh, L0 detached, L1+L2 fresh
      if (ref.id === 'boq_bim_wall-200_layer_L0') {
        return Promise.resolve(makeSnap(true, { detached: true, createdAt: '2026-01-01T00:00:00Z' }));
      }
      return Promise.resolve(makeSnap(false));
    });
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim('wall', makeWall(), context, 'updated');

    // 4 candidates - 1 detached child = 3 setDoc calls
    expect(mockSetDoc).toHaveBeenCalledTimes(3);
    const ids = mockSetDoc.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(ids).not.toContain('boq_bim_wall-200_layer_L0');
  });

  it('on action=created, detached flag δεν εμποδίζει upsert (first-save wins)', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: true }));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim('wall', makeWall(), context, 'created');

    expect(mockSetDoc).toHaveBeenCalledTimes(4);
  });

  it('wall με dna.layers.length=1 → single-entry path (no children)', async () => {
    const dnaSingle = {
      totalThickness: 150,
      layers: [{ id: 'L0', name: 'RC', thickness: 150, materialId: 'mat-concrete-c25', side: 'core' as const }],
    };
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim('wall', makeWall(dnaSingle), context, 'created');

    // Single-entry path — no multi-layer children
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const payload = mockSetDoc.mock.calls[0]![1] as Record<string, unknown>;
    expect(payload.id).toBe('boq_bim_wall-200');
    expect(payload.isGroupParent).toBeNull();
  });

  it('wall χωρίς dna → single-entry path (back-compat)', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim('wall', makeWall(null), context, 'created');

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('preserves createdAt για existing parent + each existing child', async () => {
    mockGetDoc.mockImplementation((ref: { id?: string }) => {
      if (ref.id === 'boq_bim_wall-200') {
        return Promise.resolve(makeSnap(true, { detached: false, createdAt: '2026-01-01T00:00:00Z' }));
      }
      if (ref.id === 'boq_bim_wall-200_layer_L0') {
        return Promise.resolve(makeSnap(true, { detached: false, createdAt: '2026-02-01T00:00:00Z' }));
      }
      return Promise.resolve(makeSnap(false));
    });
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim('wall', makeWall(), context, 'updated');

    const parentCall = mockSetDoc.mock.calls.find((c) => (c[0] as { id: string }).id === 'boq_bim_wall-200');
    const childL0Call = mockSetDoc.mock.calls.find((c) => (c[0] as { id: string }).id === 'boq_bim_wall-200_layer_L0');
    const childL1Call = mockSetDoc.mock.calls.find((c) => (c[0] as { id: string }).id === 'boq_bim_wall-200_layer_L1');

    expect((parentCall![1] as Record<string, unknown>).createdAt).toBe('2026-01-01T00:00:00Z');
    expect((childL0Call![1] as Record<string, unknown>).createdAt).toBe('2026-02-01T00:00:00Z');
    // L1 fresh → uses mocked nowISO
    expect((childL1Call![1] as Record<string, unknown>).createdAt).toBe('2026-05-18T00:00:00.000Z');
  });

  it('non-wall entity types δεν περνούν multi-layer path', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.upsertBoqItemForBim(
      'beam',
      { id: 'beam-300', kind: 'straight', params: { dna: dna3Layer } as never, geometry: { volume: 0.5 } },
      context,
      'created',
    );

    // Beam has no multi-layer branch; single-entry only
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });
});

describe('bimToBoqBridge — wall single-entry BOQ categories (Phase 1D-D)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);
  });

  const wallCases: Array<{ category: string; expectedCode: string }> = [
    { category: 'exterior',  expectedCode: 'OIK-3.05' },
    { category: 'parapet',   expectedCode: 'OIK-3.05' },
    { category: 'fence',     expectedCode: 'OIK-3.05' },
    { category: 'interior',  expectedCode: 'OIK-3.06' },
    { category: 'partition', expectedCode: 'OIK-3.06' },
  ];

  for (const { category, expectedCode } of wallCases) {
    it(`category '${category}' → categoryCode ${expectedCode}, unit m2, area as quantity`, async () => {
      await bimToBoqBridge.upsertBoqItemForBim(
        'wall',
        { id: `wall-cat-${category}`, kind: 'straight', params: { category }, geometry: { area: 12.5 } },
        context,
        'created',
      );

      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const payload = mockSetDoc.mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.categoryCode).toBe(expectedCode);
      expect(payload.unit).toBe('m2');
      expect(payload.estimatedQuantity).toBe(12.5);
      expect(payload.sourceEntityType).toBe('wall');
    });
  }

  it('wall χωρίς category → skip (no setDoc)', async () => {
    await bimToBoqBridge.upsertBoqItemForBim(
      'wall',
      { id: 'wall-nocat', kind: 'straight' },
      context,
      'created',
    );

    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('wall area=0 (χωρίς geometry) → estimatedQuantity=0, still writes', async () => {
    await bimToBoqBridge.upsertBoqItemForBim(
      'wall',
      { id: 'wall-nogeo', kind: 'straight', params: { category: 'exterior' } },
      context,
      'created',
    );

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const payload = mockSetDoc.mock.calls[0]![1] as Record<string, unknown>;
    expect(payload.estimatedQuantity).toBe(0);
  });

  it('cascade delete query χρησιμοποιεί companyId σωστά (regression ADR-363 Phase 1D-D)', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'boq_bim_wall-reg_layer_L0' },
        { id: 'boq_bim_wall-reg_layer_L1' },
      ],
    });
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: false }));
    mockDeleteDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.deleteBoqItemForBim('wall-reg', 'company-abc');

    expect(mockWhere).toHaveBeenCalledWith('companyId', '==', 'company-abc');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(3);
  });
});

describe('bimToBoqBridge.getBoqItemBySourceEntity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns BOQItem when doc exists', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { categoryCode: 'OIK-2.04', sourceEntityId: 'b1' }));

    const result = await bimToBoqBridge.getBoqItemBySourceEntity('b1');

    expect(result).not.toBeNull();
    expect(result!.categoryCode).toBe('OIK-2.04');
  });

  it('returns null when doc does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));

    const result = await bimToBoqBridge.getBoqItemBySourceEntity('missing');

    expect(result).toBeNull();
  });
});
