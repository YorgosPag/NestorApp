/**
 * Tests for opening-hardware-boq-sync (ADR-674 Φ C rev.2 — AGGREGATED priced «σιδερικά»).
 *
 * Big-player parity: hardware is measured as ONE line per article summed over the
 * whole floorplan, NOT per instance. Focus:
 *   - pure `sumFloorplanHardware`: per-component totals across many openings
 *     (2 doors → 6 hinges), hardware-less kinds contribute nothing.
 *   - `recomputeFloorplanHardwareBoq`: one row per component with the floorplan
 *     TOTAL, id `boq_bim_hw_<floorplanId>_<component>`, sourceEntityId = floorplanId,
 *     OIK-5.3x / pcs; absent components zero-deleted (universe sweep); the κούφωμα
 *     row is left entirely to opening-boq-sync; detach + createdAt + missing-scope guards.
 */

import {
  recomputeFloorplanHardwareBoq,
  sumFloorplanHardware,
  openingHardwareBoqId,
  type HardwareBoqOpening,
} from '../opening-hardware-boq-sync';
import type { OpeningKind, OpeningParams } from '../../types/opening-types';

// ---------------------------------------------------------------------------
// Mocks — Firestore I/O (syncManagedBoqRow) + the shared floorplan fetch SSoT
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
jest.mock('@/lib/date-local', () => ({ nowISO: () => '2026-07-18T00:00:00.000Z' }));
jest.mock('@/utils/firestore-sanitize', () => ({ stripUndefinedDeep: (v: unknown) => v }));

// The aggregated recompute reads the floorplan's openings via opening-boq-sync's
// exported fetch SSoT — stub it so the sum is driven by the test's opening list.
const mockFetchAll = jest.fn();
jest.mock('../opening-boq-sync', () => ({
  fetchAllOpeningsForFloorplan: (...args: unknown[]) => mockFetchAll(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const context = { companyId: 'c1', projectId: 'p1', buildingId: 'b1', floorplanId: 'fp1' };
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

function op(kind: OpeningKind): HardwareBoqOpening {
  return { params: makeParams(kind) };
}

function makeSnap(exists: boolean, data?: Record<string, unknown>) {
  return { exists: () => exists, data: () => data ?? {} };
}

function payloadById(id: string): Record<string, unknown> | undefined {
  const call = mockSetDoc.mock.calls.find((c) => (c[0] as { id: string }).id === id);
  return call?.[1] as Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Pure — sumFloorplanHardware
// ---------------------------------------------------------------------------

describe('sumFloorplanHardware (pure)', () => {
  it('one door → lever1 + lockset1 + hinge3', () => {
    const totals = sumFloorplanHardware([op('door')]);
    expect(totals.get('lever')).toBe(1);
    expect(totals.get('lockset')).toBe(1);
    expect(totals.get('hinge')).toBe(3);
  });

  it('aggregates across openings: 2 doors → 6 hinges, 2 locksets, 2 levers', () => {
    const totals = sumFloorplanHardware([op('door'), op('door')]);
    expect(totals.get('hinge')).toBe(6);
    expect(totals.get('lockset')).toBe(2);
    expect(totals.get('lever')).toBe(2);
  });

  it('mixes kinds: door + sliding-door → door set + pull-handle1 + sliding-track1', () => {
    const totals = sumFloorplanHardware([op('door'), op('sliding-door')]);
    expect(totals.get('hinge')).toBe(3);
    expect(totals.get('pull-handle')).toBe(1);
    expect(totals.get('sliding-track')).toBe(1);
  });

  it('50 identical doors → 150 hinges (contractor total)', () => {
    const totals = sumFloorplanHardware(Array.from({ length: 50 }, () => op('door')));
    expect(totals.get('hinge')).toBe(150);
    expect(totals.get('lockset')).toBe(50);
  });

  it.each(['fixed', 'bay-window', 'overhead-door', 'revolving-door'] as const)(
    'hardware-less kind %s contributes nothing',
    (kind) => {
      expect(sumFloorplanHardware([op(kind)]).size).toBe(0);
    },
  );

  it('deterministic row id = boq_bim_hw_<floorplanId>_<component>', () => {
    expect(openingHardwareBoqId('fp-XYZ', 'hinge')).toBe('boq_bim_hw_fp-XYZ_hinge');
  });
});

// ---------------------------------------------------------------------------
// recomputeFloorplanHardwareBoq — Firestore I/O
// ---------------------------------------------------------------------------

describe('recomputeFloorplanHardwareBoq', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDoc.mockResolvedValue(makeSnap(false));
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockFetchAll.mockResolvedValue([op('door'), op('door')]); // 2 doors default
  });

  it('writes one row per present component with the floorplan TOTAL', async () => {
    await recomputeFloorplanHardwareBoq(contextWithFloor);

    // 3 present components (lever/lockset/hinge) → 3 setDoc; other 6 absent → no write.
    expect(mockSetDoc).toHaveBeenCalledTimes(3);

    const hinge = payloadById('boq_bim_hw_fp1_hinge')!;
    expect(hinge.estimatedQuantity).toBe(6); // 2 doors × 3
    expect(hinge.categoryCode).toBe('OIK-5.36');
    expect(hinge.unit).toBe('pcs');
    expect(hinge.sourceEntityType).toBe('opening');
    expect(hinge.sourceEntityId).toBe('fp1'); // aggregation scope = floorplan
    expect(hinge.linkedFloorId).toBe('floor-A');
    expect(hinge.scope).toBe('floor');

    expect(payloadById('boq_bim_hw_fp1_lockset')!.estimatedQuantity).toBe(2);
    expect(payloadById('boq_bim_hw_fp1_lever')!.estimatedQuantity).toBe(2);
  });

  it('does NOT emit the κούφωμα signature row — that is opening-boq-sync\'s job', async () => {
    await recomputeFloorplanHardwareBoq(context);
    const nonHardware = mockSetDoc.mock.calls
      .map((c) => String((c[0] as { id: string }).id))
      .filter((id) => !id.startsWith('boq_bim_hw_'));
    expect(nonHardware).toHaveLength(0);
  });

  it('floorplan with only hardware-less openings writes nothing', async () => {
    mockFetchAll.mockResolvedValue([op('fixed'), op('bay-window')]);
    await recomputeFloorplanHardwareBoq(context);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('zero-deletes stale component rows (all openings removed / re-kinded)', async () => {
    mockFetchAll.mockResolvedValue([op('sliding-door')]); // pull-handle + sliding-track only
    mockGetDoc.mockResolvedValue(makeSnap(true, { createdAt: '2026-01-01T00:00:00.000Z', status: 'draft' }));

    await recomputeFloorplanHardwareBoq(context);

    // 2 present → setDoc; the other 7 (hinge/lever/lockset/…) exist → deleteDoc.
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(7);
    const deletedIds = mockDeleteDoc.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(deletedIds).toContain('boq_bim_hw_fp1_hinge');
    expect(deletedIds).toContain('boq_bim_hw_fp1_lever');
  });

  it('preserves createdAt on update', async () => {
    mockGetDoc.mockImplementation((ref: { id: string }) =>
      Promise.resolve(
        ref.id === 'boq_bim_hw_fp1_hinge'
          ? makeSnap(true, { createdAt: '2020-02-02T00:00:00.000Z', status: 'draft' })
          : makeSnap(false),
      ),
    );
    await recomputeFloorplanHardwareBoq(context);
    expect(payloadById('boq_bim_hw_fp1_hinge')!.createdAt).toBe('2020-02-02T00:00:00.000Z');
  });

  it('detach guard: a detached component row is never overwritten', async () => {
    mockGetDoc.mockResolvedValue(makeSnap(true, { detached: true, createdAt: 'x' }));
    await recomputeFloorplanHardwareBoq(context);
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('missing floorplanId → no fetch, no write', async () => {
    await recomputeFloorplanHardwareBoq({ companyId: 'c1', projectId: 'p1', buildingId: 'b1', floorplanId: '' });
    expect(mockFetchAll).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('missing buildingId → no fetch, no write', async () => {
    await recomputeFloorplanHardwareBoq({ companyId: 'c1', projectId: 'p1', buildingId: '', floorplanId: 'fp1' });
    expect(mockFetchAll).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
