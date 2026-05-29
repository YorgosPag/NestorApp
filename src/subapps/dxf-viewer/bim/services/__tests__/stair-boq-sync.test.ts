/**
 * Tests for stair-boq-sync (ADR-395 Phase 2 / G1).
 *
 * Mirrors BimToBoqBridge.test.ts Firestore-mock pattern. Focus:
 *   - 3 deterministic rows (concrete/cladding/handrail)
 *   - ΑΤΟΕ codes + units + sourceEntityType 'stair'
 *   - per-floor stamping (linkedFloorId + scope)
 *   - detach guard (skip), zero-quantity → delete-instead-of-write
 *   - createdAt preservation, missing buildingId → no write
 *   - delete cascade of all 3 rows
 */

import { upsertStairBoq, deleteStairBoq, stairComponentBoqId } from '../stair-boq-sync';
import type { StairParams, StairStructureType } from '../../types/stair-types';

// ---------------------------------------------------------------------------
// Mock Firestore
// ---------------------------------------------------------------------------

const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockDoc = jest.fn((_, __, id) => ({ id, __ref: id }));

jest.mock('firebase/firestore', () => ({
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, unknown, unknown])),
}));

jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { BOQ_ITEMS: 'boq_items' } }));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn() }) }));
jest.mock('@/lib/date-local', () => ({ nowISO: () => '2026-05-29T00:00:00.000Z' }));
jest.mock('@/utils/firestore-sanitize', () => ({ stripUndefinedDeep: (v: unknown) => v }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const context = { companyId: 'c1', projectId: 'p1', buildingId: 'b1' };
const contextWithFloor = { ...context, floorId: 'floor-A' };

function makeParams(overrides: Partial<{
  inner: boolean;
  outer: boolean;
  structureType: StairStructureType;
}> = {}): StairParams {
  const { inner = true, outer = true, structureType = 'monolithic' } = overrides;
  return {
    stepCount: 10,
    tread: 280,
    rise: 175,
    width: 1000,
    structureType,
    handrails: { inner, outer, height: 900 },
  } as unknown as StairParams;
}

function makeStair(overrides = {}, id = 'stair-001') {
  return { id, kind: 'straight' as const, params: makeParams(overrides) };
}

function makeSnap(exists: boolean, data?: Record<string, unknown>) {
  return { exists: () => exists, data: () => data ?? {} };
}

function payloadById(id: string): Record<string, unknown> | undefined {
  const call = mockSetDoc.mock.calls.find((c) => (c[0] as { id: string }).id === id);
  return call?.[1] as Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// upsertStairBoq
// ---------------------------------------------------------------------------

describe('upsertStairBoq', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  it('writes 3 rows with deterministic ids + ΑΤΟΕ codes + units', async () => {
    await upsertStairBoq(makeStair(), contextWithFloor, 'created');

    expect(mockSetDoc).toHaveBeenCalledTimes(3);

    const concrete = payloadById('boq_bim_stair-001_concrete')!;
    const cladding = payloadById('boq_bim_stair-001_cladding')!;
    const handrail = payloadById('boq_bim_stair-001_handrail')!;

    expect(concrete.categoryCode).toBe('OIK-2.05');
    expect(concrete.unit).toBe('m3');
    expect(cladding.categoryCode).toBe('OIK-5.05');
    expect(cladding.unit).toBe('m2');
    expect(handrail.categoryCode).toBe('OIK-12.01');
    expect(handrail.unit).toBe('m');

    for (const p of [concrete, cladding, handrail]) {
      expect(p.sourceEntityType).toBe('stair');
      expect(p.sourceEntityId).toBe('stair-001');
      expect(p.source).toBe('bim-auto');
      expect(p.measurementMethod).toBe('bim');
      expect(p.detached).toBeNull();
    }
  });

  it('cladding quantity = 2.8 m² (10 × 280 × 1000)', async () => {
    await upsertStairBoq(makeStair(), context, 'created');
    expect(payloadById('boq_bim_stair-001_cladding')!.estimatedQuantity).toBeCloseTo(2.8, 6);
  });

  it('floorId in context → linkedFloorId + scope="floor"', async () => {
    await upsertStairBoq(makeStair(), contextWithFloor, 'created');
    const p = payloadById('boq_bim_stair-001_concrete')!;
    expect(p.linkedFloorId).toBe('floor-A');
    expect(p.scope).toBe('floor');
  });

  it('no floorId → linkedFloorId null + scope="building" (back-compat)', async () => {
    await upsertStairBoq(makeStair(), context, 'created');
    const p = payloadById('boq_bim_stair-001_concrete')!;
    expect(p.linkedFloorId).toBeNull();
    expect(p.scope).toBe('building');
  });

  it('no rails → handrail row deleted instead of written (when it exists)', async () => {
    mockGetDoc.mockImplementation((ref: { id?: string }) => {
      if (ref.id === 'boq_bim_stair-001_handrail') {
        return Promise.resolve(makeSnap(true, { detached: false }));
      }
      return Promise.resolve(makeSnap(false));
    });

    await upsertStairBoq(makeStair({ inner: false, outer: false }), context, 'updated');

    // concrete + cladding written, handrail (qty 0) deleted
    expect(payloadById('boq_bim_stair-001_handrail')).toBeUndefined();
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect((mockDeleteDoc.mock.calls[0][0] as { id: string }).id).toBe('boq_bim_stair-001_handrail');
  });

  it('steel-grating fresh stair → concrete skipped (qty 0, no existing doc), 2 rows written', async () => {
    await upsertStairBoq(makeStair({ structureType: 'steel-grating' }), context, 'created');
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(payloadById('boq_bim_stair-001_concrete')).toBeUndefined();
    expect(payloadById('boq_bim_stair-001_cladding')).toBeDefined();
    expect(payloadById('boq_bim_stair-001_handrail')).toBeDefined();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('detached row is never overwritten', async () => {
    mockGetDoc.mockImplementation((ref: { id?: string }) => {
      if (ref.id === 'boq_bim_stair-001_concrete') {
        return Promise.resolve(makeSnap(true, { detached: true, createdAt: '2026-01-01T00:00:00Z' }));
      }
      return Promise.resolve(makeSnap(false));
    });

    await upsertStairBoq(makeStair(), context, 'updated');

    expect(payloadById('boq_bim_stair-001_concrete')).toBeUndefined();
    expect(mockSetDoc).toHaveBeenCalledTimes(2); // cladding + handrail only
  });

  it('preserves createdAt from existing row', async () => {
    const created = '2026-03-01T00:00:00Z';
    mockGetDoc.mockImplementation((ref: { id?: string }) => {
      if (ref.id === 'boq_bim_stair-001_cladding') {
        return Promise.resolve(makeSnap(true, { detached: false, createdAt: created }));
      }
      return Promise.resolve(makeSnap(false));
    });

    await upsertStairBoq(makeStair(), context, 'updated');
    expect(payloadById('boq_bim_stair-001_cladding')!.createdAt).toBe(created);
    // fresh rows use mocked nowISO
    expect(payloadById('boq_bim_stair-001_concrete')!.createdAt).toBe('2026-05-29T00:00:00.000Z');
  });

  it('missing buildingId → no Firestore I/O', async () => {
    await upsertStairBoq(makeStair(), { companyId: 'c1', projectId: 'p1', buildingId: '' }, 'created');
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteStairBoq
// ---------------------------------------------------------------------------

describe('deleteStairBoq', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  it('deletes all 3 component rows when present + not detached', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: false }));
    await deleteStairBoq('stair-001');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(3);
  });

  it('skips detached rows individually', async () => {
    mockGetDoc.mockImplementation((ref: { id?: string }) => {
      if (ref.id === 'boq_bim_stair-001_handrail') {
        return Promise.resolve(makeSnap(true, { detached: true }));
      }
      return Promise.resolve(makeSnap(true, { detached: false }));
    });
    await deleteStairBoq('stair-001');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
  });

  it('skips rows that do not exist', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(false));
    await deleteStairBoq('stair-001');
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// stairComponentBoqId
// ---------------------------------------------------------------------------

describe('stairComponentBoqId', () => {
  it('builds boq_bim_<id>_<component>', () => {
    expect(stairComponentBoqId('s9', 'concrete')).toBe('boq_bim_s9_concrete');
    expect(stairComponentBoqId('s9', 'cladding')).toBe('boq_bim_s9_cladding');
    expect(stairComponentBoqId('s9', 'handrail')).toBe('boq_bim_s9_handrail');
  });
});
