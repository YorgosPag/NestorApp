/**
 * ADR-628 — useWallMergePersistence unit tests (thin binding over the
 * useWallBooleanOpPersistence primitive).
 *
 * Coverage:
 *   - Service init through resolveBimPersistenceScope (durable floorId)
 *   - No-op when services not initialised (missing companyId)
 *   - deleteWall(A) + deleteWall(B) + saveWall(merged) in parallel
 *   - updateOpening for each re-hosted opening
 *   - BOQ bridge: deleteBoqItemForBim(A) + deleteBoqItemForBim(B) + upsert merged
 *   - Audit: recordWallChange deleted(A) + deleted(B) + created(merged)
 *   - Reference-stable subscription: re-renders do NOT multiply the handler
 */

import { act, renderHook } from '@testing-library/react';

import { EventBus } from '../../../systems/events/EventBus';
import { useWallMergePersistence } from '../useWallMergePersistence';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { OpeningUpdate } from '../../../bim/walls/wall-split';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDeleteWall = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
const mockSaveWall = jest.fn<Promise<Record<string, unknown>>, [unknown]>().mockResolvedValue({});
const mockUpdateOpening = jest.fn<Promise<void>, [string, unknown]>().mockResolvedValue(undefined);

jest.mock('../../../bim/walls/wall-firestore-service', () => ({
  createWallFirestoreService: jest.fn(),
  entityToSaveInput: jest.fn((e: WallEntity) => ({ id: e.id, kind: e.kind, params: e.params, layerId: e.layerId })),
  WallFirestoreService: jest.fn(),
}));

jest.mock('../../../bim/walls/opening-firestore-service', () => ({
  createOpeningFirestoreService: jest.fn(),
  OpeningFirestoreService: jest.fn(),
}));

const mockRecordWallChange = jest.fn();
jest.mock('../../../bim/walls/wall-audit-client', () => ({
  recordWallChange: (...a: unknown[]) => mockRecordWallChange(...a),
}));

const mockDeleteBoq = jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined);
const mockUpsertBoq = jest.fn<Promise<void>, [string, unknown, unknown, string]>().mockResolvedValue(undefined);
jest.mock('../../../bim/services/BimToBoqBridge', () => ({
  bimToBoqBridge: {
    deleteBoqItemForBim: (...a: unknown[]) => mockDeleteBoq(...(a as [string, string])),
    upsertBoqItemForBim: (...a: unknown[]) => mockUpsertBoq(...(a as [string, unknown, unknown, string])),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import {
  createWallFirestoreService as mockCreateWall,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} from '../../../bim/walls/wall-firestore-service';
import {
  createOpeningFirestoreService as mockCreateOpening,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} from '../../../bim/walls/opening-firestore-service';

function fakeWall(id: string): WallEntity {
  return {
    id,
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    hostedOpeningIds: [],
    params: { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 250, height: 2700, offsetMode: 'center', category: 'exterior' },
    geometry: { outerPath: [], innerPath: [], centerAxis: { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } }, length: 1000, area: 2.7 },
    validation: { hardErrors: [], warnings: [] },
    visible: true,
  } as unknown as WallEntity;
}

const PARAMS = {
  companyId: 'co-1',
  projectId: 'proj-1',
  floorplanId: 'fp-1',
  buildingId: 'bld-1',
  floorId: 'floor-1',
  userId: 'user-1',
};

function emitMerge(openingUpdates: readonly OpeningUpdate[] = []) {
  return act(async () => {
    EventBus.emit('bim:wall-merge-committed', {
      wallAId: 'a-id',
      wallBId: 'b-id',
      merged: fakeWall('merged-id'),
      openingUpdates,
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockCreateWall as jest.Mock).mockReturnValue({ deleteWall: mockDeleteWall, saveWall: mockSaveWall });
  (mockCreateOpening as jest.Mock).mockReturnValue({ updateOpening: mockUpdateOpening });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWallMergePersistence — service init', () => {
  it('creates wall + opening services with the durable floor scope', () => {
    renderHook(() => useWallMergePersistence(PARAMS));
    const expected = { companyId: 'co-1', projectId: 'proj-1', floorplanId: 'fp-1', floorId: 'floor-1', userId: 'user-1' };
    expect(mockCreateWall).toHaveBeenCalledWith(expected);
    expect(mockCreateOpening).toHaveBeenCalledWith(expected);
  });

  it('no-ops on event when services not ready (companyId null)', async () => {
    renderHook(() => useWallMergePersistence({ ...PARAMS, companyId: null }));
    await emitMerge();
    expect(mockDeleteWall).not.toHaveBeenCalled();
    expect(mockSaveWall).not.toHaveBeenCalled();
  });
});

describe('useWallMergePersistence — merge without openings', () => {
  it('deletes both source walls + saves the merged wall', async () => {
    renderHook(() => useWallMergePersistence(PARAMS));
    await emitMerge();
    expect(mockDeleteWall).toHaveBeenCalledWith('a-id');
    expect(mockDeleteWall).toHaveBeenCalledWith('b-id');
    expect(mockSaveWall).toHaveBeenCalledTimes(1);
    expect((mockSaveWall.mock.calls[0][0] as { id: string }).id).toBe('merged-id');
  });

  it('does not call updateOpening when no openingUpdates', async () => {
    renderHook(() => useWallMergePersistence(PARAMS));
    await emitMerge();
    expect(mockUpdateOpening).not.toHaveBeenCalled();
  });
});

describe('useWallMergePersistence — opening re-host', () => {
  const openingUpdates: OpeningUpdate[] = [
    {
      openingId: 'op-1',
      previousParams: { kind: 'door', wallId: 'a-id', offsetFromStart: 200, width: 900, height: 2100, sillHeight: 0 },
      nextParams: { kind: 'door', wallId: 'merged-id', offsetFromStart: 200, width: 900, height: 2100, sillHeight: 0 },
    },
  ];

  it('calls updateOpening for each re-hosted opening', async () => {
    renderHook(() => useWallMergePersistence(PARAMS));
    await emitMerge(openingUpdates);
    expect(mockUpdateOpening).toHaveBeenCalledTimes(1);
    expect(mockUpdateOpening).toHaveBeenCalledWith('op-1', { params: openingUpdates[0].nextParams });
  });
});

describe('useWallMergePersistence — BOQ bridge', () => {
  it('deletes both source BOQ rows + upserts the merged wall row', async () => {
    renderHook(() => useWallMergePersistence(PARAMS));
    await emitMerge();
    expect(mockDeleteBoq).toHaveBeenCalledWith('a-id', 'co-1');
    expect(mockDeleteBoq).toHaveBeenCalledWith('b-id', 'co-1');
    expect(mockUpsertBoq).toHaveBeenCalledTimes(1);
    expect(mockUpsertBoq.mock.calls[0][0]).toBe('wall');
    expect((mockUpsertBoq.mock.calls[0][1] as { id: string }).id).toBe('merged-id');
    expect(mockUpsertBoq.mock.calls[0][3]).toBe('created');
  });

  it('skips BOQ when buildingId is null', async () => {
    renderHook(() => useWallMergePersistence({ ...PARAMS, buildingId: null }));
    await emitMerge();
    expect(mockDeleteBoq).not.toHaveBeenCalled();
    expect(mockUpsertBoq).not.toHaveBeenCalled();
  });
});

describe('useWallMergePersistence — audit', () => {
  it('records deleted(A) + deleted(B) + created(merged)', async () => {
    renderHook(() => useWallMergePersistence(PARAMS));
    await emitMerge();
    expect(mockRecordWallChange).toHaveBeenCalledWith('deleted', expect.objectContaining({ id: 'a-id' }));
    expect(mockRecordWallChange).toHaveBeenCalledWith('deleted', expect.objectContaining({ id: 'b-id' }));
    expect(mockRecordWallChange).toHaveBeenCalledWith('created', expect.objectContaining({ id: 'merged-id' }));
    expect(mockRecordWallChange).toHaveBeenCalledTimes(3);
  });
});

describe('useWallMergePersistence — reference-stable subscription (ADR-626)', () => {
  it('re-renders do not multiply the event handler', async () => {
    const { rerender } = renderHook(() => useWallMergePersistence(PARAMS));
    rerender();
    rerender();
    await emitMerge();
    // A single committed event → each source wall deleted exactly once (not per render).
    expect(mockDeleteWall).toHaveBeenCalledTimes(2);
    expect(mockSaveWall).toHaveBeenCalledTimes(1);
  });
});
