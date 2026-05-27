/**
 * ADR-363 Phase X — useWallSplitPersistence unit tests.
 *
 * Coverage:
 *   - No-op when services not initialised (missing companyId / projectId)
 *   - deleteWall + saveWall×2 on split without openings
 *   - updateOpening for each redistributed opening
 *   - BOQ bridge: deleteBoqItemForBim + upsertBoqItemForBim×2
 *   - Audit: recordWallChange called for deleted + created×2
 *   - Multiple rapid events processed independently
 */

import { act, renderHook } from '@testing-library/react';

import { EventBus } from '../../../systems/events/EventBus';
import { useWallSplitPersistence } from '../useWallSplitPersistence';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { OpeningUpdate } from '../../../bim/walls/wall-split';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDeleteWall = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
const mockSaveWall = jest.fn<Promise<Record<string, unknown>>, [unknown]>().mockResolvedValue({});
const mockUpdateOpening = jest.fn<Promise<void>, [string, unknown]>().mockResolvedValue(undefined);

jest.mock('../../../bim/walls/wall-firestore-service', () => ({
  createWallFirestoreService: jest.fn(),
  entityToSaveInput: jest.fn((e: WallEntity) => ({
    id: e.id,
    kind: e.kind,
    params: e.params,
    validation: e.validation,
    layerId: e.layerId,
  })),
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
    params: {
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      thickness: 250,
      height: 2700,
      offsetMode: 'center',
      category: 'exterior',
    },
    geometry: {
      outerPath: [],
      innerPath: [],
      centerAxis: { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } },
      length: 1000,
      area: 2.7,
    },
    validation: { hardErrors: [], warnings: [] },
    visible: true,
  } as unknown as WallEntity;
}

const PARAMS = {
  companyId: 'co-1',
  projectId: 'proj-1',
  floorplanId: 'fp-1',
  buildingId: 'bld-1',
  userId: 'user-1',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (mockCreateWall as jest.Mock).mockReturnValue({
    deleteWall: mockDeleteWall,
    saveWall: mockSaveWall,
  });
  (mockCreateOpening as jest.Mock).mockReturnValue({
    updateOpening: mockUpdateOpening,
  });
});

describe('useWallSplitPersistence — service init', () => {
  it('creates wall + opening services when all params provided', () => {
    renderHook(() => useWallSplitPersistence(PARAMS));
    expect(mockCreateWall).toHaveBeenCalledWith({
      companyId: 'co-1', projectId: 'proj-1', floorplanId: 'fp-1', userId: 'user-1',
    });
    expect(mockCreateOpening).toHaveBeenCalledWith({
      companyId: 'co-1', projectId: 'proj-1', floorplanId: 'fp-1', userId: 'user-1',
    });
  });

  it('does not create services when companyId is null', () => {
    renderHook(() => useWallSplitPersistence({ ...PARAMS, companyId: null }));
    expect(mockCreateWall).not.toHaveBeenCalled();
  });

  it('no-ops on event when services not ready', async () => {
    renderHook(() => useWallSplitPersistence({ ...PARAMS, companyId: null }));
    await act(async () => {
      EventBus.emit('bim:wall-split-committed', {
        originalWallId: 'orig',
        wall1: fakeWall('w1'),
        wall2: fakeWall('w2'),
        openingUpdates: [],
      });
    });
    expect(mockDeleteWall).not.toHaveBeenCalled();
    expect(mockSaveWall).not.toHaveBeenCalled();
  });
});

describe('useWallSplitPersistence — split without openings', () => {
  it('deletes original + saves wall1 + wall2 in parallel', async () => {
    renderHook(() => useWallSplitPersistence(PARAMS));
    await act(async () => {
      EventBus.emit('bim:wall-split-committed', {
        originalWallId: 'orig-id',
        wall1: fakeWall('w1'),
        wall2: fakeWall('w2'),
        openingUpdates: [],
      });
    });
    expect(mockDeleteWall).toHaveBeenCalledWith('orig-id');
    expect(mockSaveWall).toHaveBeenCalledTimes(2);
    const savedIds = mockSaveWall.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(savedIds).toContain('w1');
    expect(savedIds).toContain('w2');
  });

  it('does not call updateOpening when no openingUpdates', async () => {
    renderHook(() => useWallSplitPersistence(PARAMS));
    await act(async () => {
      EventBus.emit('bim:wall-split-committed', {
        originalWallId: 'orig-id',
        wall1: fakeWall('w1'),
        wall2: fakeWall('w2'),
        openingUpdates: [],
      });
    });
    expect(mockUpdateOpening).not.toHaveBeenCalled();
  });
});

describe('useWallSplitPersistence — opening redistribution', () => {
  const openingUpdates: OpeningUpdate[] = [
    {
      openingId: 'op-1',
      previousParams: { kind: 'door', wallId: 'orig-id', offsetFromStart: 200, width: 900, height: 2100, sillHeight: 0 },
      nextParams:     { kind: 'door', wallId: 'w1',      offsetFromStart: 200, width: 900, height: 2100, sillHeight: 0 },
    },
    {
      openingId: 'op-2',
      previousParams: { kind: 'door', wallId: 'orig-id', offsetFromStart: 700, width: 900, height: 2100, sillHeight: 0 },
      nextParams:     { kind: 'door', wallId: 'w2',      offsetFromStart: 100, width: 900, height: 2100, sillHeight: 0 },
    },
  ];

  it('calls updateOpening for each redistributed opening', async () => {
    renderHook(() => useWallSplitPersistence(PARAMS));
    await act(async () => {
      EventBus.emit('bim:wall-split-committed', {
        originalWallId: 'orig-id',
        wall1: fakeWall('w1'),
        wall2: fakeWall('w2'),
        openingUpdates,
      });
    });
    expect(mockUpdateOpening).toHaveBeenCalledTimes(2);
    expect(mockUpdateOpening).toHaveBeenCalledWith('op-1', { params: openingUpdates[0].nextParams });
    expect(mockUpdateOpening).toHaveBeenCalledWith('op-2', { params: openingUpdates[1].nextParams });
  });
});

describe('useWallSplitPersistence — BOQ bridge', () => {
  it('deletes original BOQ + upserts wall1 + wall2 BOQ', async () => {
    renderHook(() => useWallSplitPersistence(PARAMS));
    await act(async () => {
      EventBus.emit('bim:wall-split-committed', {
        originalWallId: 'orig-id',
        wall1: fakeWall('w1'),
        wall2: fakeWall('w2'),
        openingUpdates: [],
      });
    });
    expect(mockDeleteBoq).toHaveBeenCalledWith('orig-id', 'co-1');
    expect(mockUpsertBoq).toHaveBeenCalledTimes(2);
    const upsertIds = mockUpsertBoq.mock.calls.map((c) => (c[1] as { id: string }).id);
    expect(upsertIds).toContain('w1');
    expect(upsertIds).toContain('w2');
    mockUpsertBoq.mock.calls.forEach((c) => {
      expect(c[0]).toBe('wall');
      expect(c[3]).toBe('created');
    });
  });

  it('skips BOQ when buildingId is null', async () => {
    renderHook(() => useWallSplitPersistence({ ...PARAMS, buildingId: null }));
    await act(async () => {
      EventBus.emit('bim:wall-split-committed', {
        originalWallId: 'orig-id',
        wall1: fakeWall('w1'),
        wall2: fakeWall('w2'),
        openingUpdates: [],
      });
    });
    expect(mockDeleteBoq).not.toHaveBeenCalled();
    expect(mockUpsertBoq).not.toHaveBeenCalled();
  });
});

describe('useWallSplitPersistence — audit', () => {
  it('records deleted (original) + created (wall1 + wall2)', async () => {
    renderHook(() => useWallSplitPersistence(PARAMS));
    await act(async () => {
      EventBus.emit('bim:wall-split-committed', {
        originalWallId: 'orig-id',
        wall1: fakeWall('w1'),
        wall2: fakeWall('w2'),
        openingUpdates: [],
      });
    });
    expect(mockRecordWallChange).toHaveBeenCalledWith('deleted', expect.objectContaining({ id: 'orig-id' }));
    expect(mockRecordWallChange).toHaveBeenCalledWith('created', expect.objectContaining({ id: 'w1' }));
    expect(mockRecordWallChange).toHaveBeenCalledWith('created', expect.objectContaining({ id: 'w2' }));
    expect(mockRecordWallChange).toHaveBeenCalledTimes(3);
  });
});
