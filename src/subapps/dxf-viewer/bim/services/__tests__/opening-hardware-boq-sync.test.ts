/**
 * Tests for opening-hardware-boq-sync (ADR-674 Φ C — priced «σιδερικά» take-off).
 *
 * Mirrors stair-boq-sync.test.ts Firestore-mock pattern. Focus:
 *   - a door explodes into one row per hardware component with the RIGHT
 *     per-component qty (lever 1, lockset 1, hinge 3) + OIK-5.3x codes, pcs.
 *   - hardware-less kinds (fixed/bay-window/overhead-door/revolving-door) write
 *     ZERO hardware rows.
 *   - the pure builder is exhaustive-safe (kind-change deletes stale rows via
 *     the universe sweep) and the κούφωμα row is left entirely to opening-boq-sync.
 *   - detach guard (skip), zero/absent component → delete-instead-of-write,
 *     createdAt preservation, missing buildingId → no write, delete cascade.
 */

import {
  upsertOpeningHardwareBoq,
  deleteOpeningHardwareBoq,
  buildOpeningHardwareBoqRows,
  openingHardwareBoqId,
  type OpeningForHardwareBoq,
} from '../opening-hardware-boq-sync';
import type { OpeningKind, OpeningParams } from '../../types/opening-types';

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
jest.mock('@/lib/date-local', () => ({ nowISO: () => '2026-07-17T00:00:00.000Z' }));
jest.mock('@/utils/firestore-sanitize', () => ({ stripUndefinedDeep: (v: unknown) => v }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const context = { companyId: 'c1', projectId: 'p1', buildingId: 'b1' };
const contextWithFloor = { ...context, floorId: 'floor-A' };

function makeParams(kind: OpeningKind, overrides: Partial<OpeningParams> = {}): OpeningParams {
  return {
    kind,
    wallId: 'wall-1',
    offsetFromStart: 500,
    width: 900,
    height: 2100,
    sillHeight: 0,
    ...overrides,
  } as OpeningParams;
}

function makeOpening(kind: OpeningKind, id = 'op-001'): OpeningForHardwareBoq {
  return { id, kind, params: makeParams(kind) };
}

function makeSnap(exists: boolean, data?: Record<string, unknown>) {
  return { exists: () => exists, data: () => data ?? {} };
}

function payloadById(id: string): Record<string, unknown> | undefined {
  const call = mockSetDoc.mock.calls.find((c) => (c[0] as { id: string }).id === id);
  return call?.[1] as Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Pure builder — buildOpeningHardwareBoqRows
// ---------------------------------------------------------------------------

describe('buildOpeningHardwareBoqRows (pure)', () => {
  it('a door explodes into lever×1 + lockset×1 + hinge×3 with OIK-5.3x pcs codes', () => {
    const rows = buildOpeningHardwareBoqRows(makeOpening('door'));
    const byComponent = new Map(rows.map((r) => [r.component, r]));

    expect(rows).toHaveLength(3);
    expect(byComponent.get('lever')!.quantity).toBe(1);
    expect(byComponent.get('lockset')!.quantity).toBe(1);
    expect(byComponent.get('hinge')!.quantity).toBe(3);

    expect(byComponent.get('hinge')!.mapping.categoryCode).toBe('OIK-5.36');
    expect(byComponent.get('lockset')!.mapping.categoryCode).toBe('OIK-5.35');
    for (const row of rows) expect(row.mapping.unit).toBe('pcs');
  });

  it('deterministic row ids are boq_bim_<openingId>_hw_<component>', () => {
    const rows = buildOpeningHardwareBoqRows(makeOpening('door', 'op-XYZ'));
    const hinge = rows.find((r) => r.component === 'hinge')!;
    expect(hinge.id).toBe('boq_bim_op-XYZ_hw_hinge');
    expect(openingHardwareBoqId('op-XYZ', 'hinge')).toBe('boq_bim_op-XYZ_hw_hinge');
  });

  it('a double-door sums 2 levers + 6 hinges + 2 flush-bolts + 1 lockset', () => {
    const rows = buildOpeningHardwareBoqRows(makeOpening('double-door'));
    const q = new Map(rows.map((r) => [r.component, r.quantity]));
    expect(q.get('lever')).toBe(2);
    expect(q.get('hinge')).toBe(6);
    expect(q.get('flush-bolt')).toBe(2);
    expect(q.get('lockset')).toBe(1);
  });

  it.each(['fixed', 'bay-window', 'overhead-door', 'revolving-door'] as const)(
    'hardware-less kind %s yields NO hardware rows',
    (kind) => {
      expect(buildOpeningHardwareBoqRows(makeOpening(kind))).toHaveLength(0);
    },
  );
});

// ---------------------------------------------------------------------------
// upsertOpeningHardwareBoq — Firestore I/O
// ---------------------------------------------------------------------------

describe('upsertOpeningHardwareBoq', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  it('writes exactly the door hardware rows (present components) with the right qty', async () => {
    await upsertOpeningHardwareBoq(makeOpening('door'), contextWithFloor, 'created');

    // 3 present components → 3 setDoc; absent 6 components → no write (never existed).
    expect(mockSetDoc).toHaveBeenCalledTimes(3);

    const hinge = payloadById('boq_bim_op-001_hw_hinge')!;
    expect(hinge.categoryCode).toBe('OIK-5.36');
    expect(hinge.unit).toBe('pcs');
    expect(hinge.estimatedQuantity).toBe(3);
    expect(hinge.sourceEntityType).toBe('opening');
    expect(hinge.sourceEntityId).toBe('op-001');
    expect(hinge.linkedFloorId).toBe('floor-A');
    expect(hinge.scope).toBe('floor');

    expect(payloadById('boq_bim_op-001_hw_lockset')!.estimatedQuantity).toBe(1);
    expect(payloadById('boq_bim_op-001_hw_lever')!.estimatedQuantity).toBe(1);
  });

  it('does NOT emit the κούφωμα row — hardware is additive-only (owned by opening-boq-sync)', async () => {
    await upsertOpeningHardwareBoq(makeOpening('door'), context, 'created');
    const koufoma = mockSetDoc.mock.calls.find((c) =>
      String((c[0] as { id: string }).id).startsWith('boq_bim_opening_sig_'),
    );
    expect(koufoma).toBeUndefined();
    // No plain single-entity κούφωμα id either.
    expect(payloadById('boq_bim_op-001')).toBeUndefined();
  });

  it('a hardware-less kind (fixed) writes nothing', async () => {
    await upsertOpeningHardwareBoq(makeOpening('fixed'), context, 'created');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('deletes stale rows when a component is absent for the kind (kind-change sweep)', async () => {
    // A sliding-door carries pull-handle + sliding-track — the door-only hinge
    // row from a previous kind must be zero-deleted. Simulate every row existing.
    mockGetDoc.mockResolvedValue(makeSnap(true, { createdAt: '2026-01-01T00:00:00.000Z' }));

    await upsertOpeningHardwareBoq(makeOpening('sliding-door'), context, 'updated');

    // 2 present → setDoc; the other 7 (incl. hinge/lockset/lever) → deleteDoc.
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(7);
    const deletedIds = mockDeleteDoc.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(deletedIds).toContain('boq_bim_op-001_hw_hinge');
    expect(deletedIds).toContain('boq_bim_op-001_hw_lever');
  });

  it('preserves createdAt on update', async () => {
    mockGetDoc.mockImplementation((ref: { id: string }) =>
      Promise.resolve(
        ref.id === 'boq_bim_op-001_hw_hinge'
          ? makeSnap(true, { createdAt: '2020-02-02T00:00:00.000Z' })
          : makeSnap(false),
      ),
    );
    await upsertOpeningHardwareBoq(makeOpening('door'), context, 'updated');
    expect(payloadById('boq_bim_op-001_hw_hinge')!.createdAt).toBe('2020-02-02T00:00:00.000Z');
  });

  it('detach guard: a detached row is never overwritten', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: true, createdAt: 'x' }));
    await upsertOpeningHardwareBoq(makeOpening('door'), context, 'updated');
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('missing buildingId → no write', async () => {
    await upsertOpeningHardwareBoq(makeOpening('door'), { companyId: 'c1', projectId: 'p1', buildingId: '' }, 'created');
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteOpeningHardwareBoq
// ---------------------------------------------------------------------------

describe('deleteOpeningHardwareBoq', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  it('cascades a delete over every hardware component row (skip detached)', async () => {
    mockGetDoc.mockImplementation((ref: { id: string }) =>
      Promise.resolve(
        ref.id === 'boq_bim_op-001_hw_lockset'
          ? makeSnap(true, { detached: true })
          : makeSnap(true, {}),
      ),
    );
    await deleteOpeningHardwareBoq('op-001');
    // 9 components: 8 deleted, the detached lockset skipped.
    expect(mockDeleteDoc).toHaveBeenCalledTimes(8);
    const deletedIds = mockDeleteDoc.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(deletedIds).not.toContain('boq_bim_op-001_hw_lockset');
  });
});
