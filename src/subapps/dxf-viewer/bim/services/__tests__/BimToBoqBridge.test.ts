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
const mockDoc = jest.fn((_, __, id) => ({ id }));

jest.mock('firebase/firestore', () => ({
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
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
  beforeEach(() => jest.clearAllMocks());

  it('deletes the BOQ item when not detached', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: false }));
    mockDeleteDoc.mockResolvedValue(undefined);

    await bimToBoqBridge.deleteBoqItemForBim('beam-004');

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('skips delete when item is detached', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: true }));

    await bimToBoqBridge.deleteBoqItemForBim('beam-005');

    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('skips delete when item does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));

    await bimToBoqBridge.deleteBoqItemForBim('beam-006');

    expect(mockDeleteDoc).not.toHaveBeenCalled();
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
