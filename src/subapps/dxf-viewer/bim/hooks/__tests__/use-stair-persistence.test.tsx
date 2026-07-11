/**
 * ADR-420 regression — the stair persistence subscription MUST re-bind to the
 * freshly-created Firestore service whenever the durable `floorId` resolves on a
 * later render than the other scope ids.
 *
 * Root cause (2026-07-11): `useStairPersistence` was never migrated to the shared
 * `create-bim-entity-persistence-hook` scaffold and its subscription effect kept
 * deps `[levelManager, companyId, projectId, floorplanId, userId]` — WITHOUT
 * `floorId` — while the instantiation effect already keyed on `floorId`. On dev
 * Fast-Refresh/HMR remounts (agents editing code with a stair on canvas) the
 * scope ids settle across renders: the service was re-created for the correct
 * `floorId` scope but the live `onSnapshot` stayed bound to the stale service →
 * empty first snapshot → ADR-390 reconcile dropped the in-scene stair → it never
 * returned from `floorplan_stairs`. The stair was the last hook missing the fix
 * the other 12 BIM hooks got on 2026-06-17.
 *
 * This test fails WITHOUT the `floorId` dep (the newly-created service is never
 * subscribed) and passes WITH it.
 */

import { renderHook } from '@testing-library/react';

const mockServices: Array<{
  config: { floorId?: string };
  subscribeStairs: jest.Mock;
  unsubscribe: jest.Mock;
}> = [];

jest.mock('../../stairs/stair-firestore-service', () => ({
  createStairFirestoreService: jest.fn((config: { floorId?: string }) => {
    const unsubscribe = jest.fn();
    const svc = {
      config,
      unsubscribe,
      subscribeStairs: jest.fn(() => unsubscribe),
    };
    mockServices.push(svc);
    return svc;
  }),
  entityToSaveInput: (e: unknown) => e,
  StairFirestoreService: class {},
}));

jest.mock('../../stairs/stair-audit-client', () => ({ recordStairChange: jest.fn() }));
jest.mock('../../services/stair-boq-sync', () => ({
  upsertStairBoq: jest.fn(),
  deleteStairBoq: jest.fn(),
}));
jest.mock('../../stairs/stair-snapshot-merge', () => ({
  isStair: () => false,
  mergeStairSnapshot: () => ({ entities: [], mutated: false }),
}));
jest.mock('../../stairs/stair-create-tools', () => ({ isStairCreateTool: () => false }));
jest.mock('../../geometry/stairs/stair-host-resolver', () => ({
  makeStairHostResolverFromScene: () => undefined,
}));
jest.mock('../../../hooks/data/useBimEntityRestoredPersistEffect', () => ({
  useBimEntityRestoredPersistEffect: jest.fn(),
}));
jest.mock('../../../hooks/data/useBimEntityAttachedPersistEffect', () => ({
  useBimEntityAttachedPersistEffect: jest.fn(),
}));

import { useStairPersistence } from '../use-stair-persistence';

// Stable across rerenders — a fresh object every render would change the
// `levelManager` dep and mask the `floorId` dep under test (that was the bug).
const stableLevelManager = {
  currentLevelId: 'lvl',
  getLevelScene: () => ({ entities: [] }),
  setLevelScene: jest.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const baseParams = (floorId: string | undefined) => ({
  companyId: 'c1',
  projectId: 'p1',
  floorplanId: 'fp1',
  buildingId: 'b1',
  floorId,
  userId: 'u1',
  levelManager: stableLevelManager,
  primarySelectedStair: null,
});

describe('useStairPersistence — subscription re-binds on floorId change', () => {
  beforeEach(() => {
    mockServices.length = 0;
  });

  it('subscribes the newly-created service after floorId resolves late', () => {
    const { rerender, unmount } = renderHook(
      ({ floorId }: { floorId: string | undefined }) => useStairPersistence(baseParams(floorId)),
      { initialProps: { floorId: undefined as string | undefined } },
    );

    // Initial mount: floorId undefined → service #0 created + subscribed.
    expect(mockServices).toHaveLength(1);
    expect(mockServices[0].subscribeStairs).toHaveBeenCalledTimes(1);
    expect(mockServices[0].config.floorId).toBeUndefined();

    // Durable floorId resolves on a later render (the HMR/refresh race).
    rerender({ floorId: 'flr_x' });

    // A new service is created for the correct scope AND it must be subscribed —
    // otherwise the live snapshot stays on the stale (floorId-less) service.
    expect(mockServices).toHaveLength(2);
    expect(mockServices[1].config.floorId).toBe('flr_x');
    expect(mockServices[1].subscribeStairs).toHaveBeenCalledTimes(1);
    // The stale subscription is torn down.
    expect(mockServices[0].unsubscribe).toHaveBeenCalledTimes(1);

    unmount();
  });
});
