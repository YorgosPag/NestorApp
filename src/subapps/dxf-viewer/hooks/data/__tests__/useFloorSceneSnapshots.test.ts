/**
 * ADR-914 §2.14 — ο ΕΝΑΣ φορτωτής στιγμιοτύπων των aggregators «όλοι οι όροφοι».
 *
 * Κάθε κλάδος που πριν ζούσε σε έξι αντίγραφα έχει εδώ τη δοκιμή του:
 *  - φορτώνονται ΜΟΝΟ οι όροφοι που το ζητούν, μία φορά ο καθένας (ακόμη κι όταν γυρίσουν κενοί)
 *  - ο `load` που πετάει γράφει το `fallback` και δεν ρίχνει τους υπόλοιπους
 *  - ακύρωση στη μέση ⇒ τίποτα δεν γράφεται
 *  - `enabled: false` ⇒ κανένα αίτημα
 *  - ο φορτωτής με φράχτη ορόφου πέφτει στην εφεδρεία ανά οντότητα όταν το αρχείο είναι ξένο
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import {
  liveSceneOf,
  loadSnapshotScene,
  useFloorSceneSnapshots,
  useUnvisitedFloorPredicate,
  type FloorSnapshotTarget,
} from '../useFloorSceneSnapshots';
import { loadFloorScopedScene } from '../floor-scoped-scene-loader';
import type { SceneModel } from '../../../types/scene';

const mockLoadFileV2 = jest.fn();
const mockLoadFloorBimEntities = jest.fn();
const mockResolveScope = jest.fn();

jest.mock('../../../services/dxf-firestore.service', () => ({
  DxfFirestoreService: { loadFileV2: (...a: unknown[]) => mockLoadFileV2(...a) },
}));
jest.mock('../../../bim/persistence/cross-floor-bim-loader', () => ({
  loadFloorBimEntities: (...a: unknown[]) => mockLoadFloorBimEntities(...a),
}));
jest.mock('../../../bim/persistence/bim-floor-scope', () => ({
  resolveBimPersistenceScope: (...a: unknown[]) => mockResolveScope(...a),
}));

function scene(...ids: string[]): SceneModel {
  return { entities: ids.map((id) => ({ id, type: 'wall' })) } as unknown as SceneModel;
}

const T1: FloorSnapshotTarget = { levelId: 'L1', sceneFileId: 'file-1' };
const T2: FloorSnapshotTarget = { levelId: 'L2', sceneFileId: 'file-2' };
const ALWAYS = (): boolean => true;
const NOT_CANCELLED = (): boolean => false;

beforeEach(() => {
  mockLoadFileV2.mockReset();
  mockLoadFloorBimEntities.mockReset();
  mockResolveScope.mockReset();
});

describe('useFloorSceneSnapshots', () => {
  it('φορτώνει μόνο τους ορόφους που το ζητούν, μία φορά τον καθένα', async () => {
    const load = jest.fn(async (t: FloorSnapshotTarget) => `value:${t.levelId}`);
    const needsSnapshot = (t: FloorSnapshotTarget): boolean => t.levelId !== 'L1';
    const targets = [T1, T2];

    const { result, rerender } = renderHook(() =>
      useFloorSceneSnapshots({ enabled: true, targets, needsSnapshot, load, fallback: 'fallback' }),
    );

    await waitFor(() => expect(result.current.get('L2')).toBe('value:L2'));
    expect(result.current.has('L1')).toBe(false);

    rerender();
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('κενό αποτέλεσμα γράφεται και ΔΕΝ ξαναζητείται', async () => {
    const load = jest.fn(async () => null);
    const targets = [T1];

    const { result, rerender } = renderHook(() =>
      useFloorSceneSnapshots<FloorSnapshotTarget, string | null>({
        enabled: true, targets, needsSnapshot: ALWAYS, load, fallback: null,
      }),
    );

    await waitFor(() => expect(result.current.has('L1')).toBe(true));
    rerender();
    await act(async () => {});
    expect(result.current.get('L1')).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('ο load που πετάει γράφει το fallback και δεν ρίχνει τους υπόλοιπους', async () => {
    const load = jest.fn(async (t: FloorSnapshotTarget) => {
      if (t.levelId === 'L1') throw new Error('boom');
      return 'ok';
    });
    const targets = [T1, T2];

    const { result } = renderHook(() =>
      useFloorSceneSnapshots({ enabled: true, targets, needsSnapshot: ALWAYS, load, fallback: 'fallback' }),
    );

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.get('L1')).toBe('fallback');
    expect(result.current.get('L2')).toBe('ok');
  });

  it('enabled: false ⇒ κανένα αίτημα', async () => {
    const load = jest.fn(async () => 'x');
    const targets = [T1];

    const { result } = renderHook(() =>
      useFloorSceneSnapshots({ enabled: false, targets, needsSnapshot: ALWAYS, load, fallback: 'fallback' }),
    );

    await act(async () => {});
    expect(load).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  it('ακύρωση στη μέση (unmount) ⇒ τίποτα δεν γράφεται, και ο load το μαθαίνει', async () => {
    let release: (v: string) => void = () => {};
    let seenCancelled: (() => boolean) | null = null;
    const load = jest.fn(
      (_t: FloorSnapshotTarget, isCancelled: () => boolean) =>
        new Promise<string>((resolve) => {
          seenCancelled = isCancelled;
          release = resolve;
        }),
    );
    const targets = [T1];

    const { result, unmount } = renderHook(() =>
      useFloorSceneSnapshots({ enabled: true, targets, needsSnapshot: ALWAYS, load, fallback: 'fallback' }),
    );
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      release('late');
    });

    expect((seenCancelled as (() => boolean) | null)?.()).toBe(true);
    expect(result.current.size).toBe(0);
  });
});

describe('useUnvisitedFloorPredicate / liveSceneOf', () => {
  const getLevelScene = (id: string): SceneModel | null =>
    id === 'L-live' ? scene('w1') : id === 'L-empty' ? scene() : null;

  it('σκηνή χωρίς οντότητες ΔΕΝ είναι ζωντανή σκηνή', () => {
    expect(liveSceneOf(getLevelScene, 'L-live')).not.toBeNull();
    expect(liveSceneOf(getLevelScene, 'L-empty')).toBeNull();
    expect(liveSceneOf(undefined, 'L-live')).toBeNull();
  });

  it('ζητά στιγμιότυπο μόνο για όροφο με αρχείο, μη ενεργό, εκτός μνήμης', () => {
    const { result } = renderHook(() => useUnvisitedFloorPredicate('L-active', getLevelScene));
    const needs = result.current;

    expect(needs({ levelId: 'L2', sceneFileId: 'f' })).toBe(true);
    expect(needs({ levelId: 'L-empty', sceneFileId: 'f' })).toBe(true);
    expect(needs({ levelId: 'L2', sceneFileId: null })).toBe(false);
    expect(needs({ levelId: 'L-active', sceneFileId: 'f' })).toBe(false);
    expect(needs({ levelId: 'L-live', sceneFileId: 'f' })).toBe(false);
  });
});

describe('loadSnapshotScene', () => {
  it('χωρίς αρχείο ⇒ null, χωρίς αίτημα', async () => {
    await expect(loadSnapshotScene({ levelId: 'L1', sceneFileId: null })).resolves.toBeNull();
    expect(mockLoadFileV2).not.toHaveBeenCalled();
  });

  it('εγγραφή χωρίς έγκυρη σκηνή ⇒ null· με σκηνή ⇒ η σκηνή', async () => {
    mockLoadFileV2.mockResolvedValueOnce({ scene: { entities: 'not-an-array' } });
    await expect(loadSnapshotScene(T1)).resolves.toBeNull();

    const stored = scene('w1');
    mockLoadFileV2.mockResolvedValueOnce({ scene: stored });
    await expect(loadSnapshotScene(T1)).resolves.toBe(stored);
  });
});

describe('loadFloorScopedScene', () => {
  const target = { levelId: 'L2', sceneFileId: 'file-2', floorId: 'f2', projectId: 'p1' };
  const identity = { companyId: 'co1', userId: 'u1' };

  it('το στιγμιότυπο του ΔΙΚΟΥ ορόφου κερδίζει — καμία ανάγνωση ανά οντότητα', async () => {
    const stored = scene('w1');
    mockLoadFileV2.mockResolvedValue({ scene: stored, floorId: 'f2' });

    await expect(loadFloorScopedScene(target, identity, NOT_CANCELLED)).resolves.toBe(stored);
    expect(mockLoadFloorBimEntities).not.toHaveBeenCalled();
  });

  it('χωρίς σκηνή στο αρχείο ⇒ εφεδρεία ανά οντότητα, με την εμβέλεια του ορόφου', async () => {
    mockLoadFileV2.mockResolvedValue(null);
    mockResolveScope.mockReturnValue({ scope: 'f2' });
    mockLoadFloorBimEntities.mockResolvedValue([{ id: 'c1', type: 'column' }]);

    const result = await loadFloorScopedScene(target, identity, NOT_CANCELLED);

    expect(mockResolveScope).toHaveBeenCalledWith({
      companyId: 'co1', projectId: 'p1', userId: 'u1', floorId: 'f2', floorplanId: 'file-2',
    });
    expect(result?.entities).toEqual([{ id: 'c1', type: 'column' }]);
  });

  it('όροφος χωρίς αρχείο και χωρίς οντότητες ⇒ null', async () => {
    mockResolveScope.mockReturnValue(null);

    await expect(
      loadFloorScopedScene({ ...target, sceneFileId: null }, identity, NOT_CANCELLED),
    ).resolves.toBeNull();
    expect(mockLoadFileV2).not.toHaveBeenCalled();
    expect(mockLoadFloorBimEntities).not.toHaveBeenCalled();
  });

  it('ακύρωση μετά το στιγμιότυπο ⇒ δεν πληρώνεται δεύτερο αίτημα', async () => {
    mockLoadFileV2.mockResolvedValue(null);

    await expect(loadFloorScopedScene(target, identity, () => true)).resolves.toBeNull();
    expect(mockResolveScope).not.toHaveBeenCalled();
  });
});
