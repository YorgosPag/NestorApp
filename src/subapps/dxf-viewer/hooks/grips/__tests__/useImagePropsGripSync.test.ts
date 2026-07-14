/**
 * ADR-654 — live «Ιδιότητες» panel channel: store (equals guard + merge) + the release/non-image
 * CLEAR guard. The per-frame WRITER lives in `useGripGhostPreview` (RAF draw loop, effectiveCursor);
 * here we cover the channel semantics + the clear leaf.
 */

// Defensive: the grip type-barrel import chain may touch firebase auth (mirror other DXF hook tests).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { renderHook } from '@testing-library/react';
import type { ImageEntity } from '../../../types/image';
import type { DxfGripDragPreview } from '../../grip-computation';
import type { LevelSceneReader } from '../../../systems/levels/level-scene-accessor';
import { useImagePropsGripSync } from '../useImagePropsGripSync';
import { publishImageLivePreview } from '../../tools/publish-image-live-preview';
import { EntityBodyDragStore } from '../../../systems/drag/EntityBodyDragStore';
import {
  getEntityPropsLivePreview,
  setEntityPropsLivePreview,
  subscribeEntityPropsLivePreview,
  withEntityPropsLivePreview,
} from '../../../systems/grip/EntityPropsLivePreviewStore';

const IMG: ImageEntity = {
  id: 'img_rt', type: 'image', layerId: 'l', url: 'x/sofa.webp',
  position: { x: 100, y: 200 }, width: 640, height: 180, rotation: 0,
};
const LINE = { id: 'ln_1', type: 'line' };

function fakeLevelManager(...entities: ReadonlyArray<{ id: string; type: string }>): LevelSceneReader {
  return { currentLevelId: 'lvl-1', getLevelScene: () => ({ entities }) } as unknown as LevelSceneReader;
}

afterEach(() => { setEntityPropsLivePreview(null); EntityBodyDragStore.clear(); });

describe('EntityPropsLivePreviewStore', () => {
  it('equals guard drops a redundant same-geometry write (no 60fps re-render churn)', () => {
    let hits = 0;
    const unsub = subscribeEntityPropsLivePreview(() => { hits += 1; });
    setEntityPropsLivePreview({ entityId: 'a', patch: { position: { x: 1, y: 2 }, width: 5 } });
    // Identical VALUE (new object each frame, as the RAF loop constructs) → no notify.
    setEntityPropsLivePreview({ entityId: 'a', patch: { position: { x: 1, y: 2 }, width: 5 } });
    expect(hits).toBe(1);
    // A real change notifies.
    setEntityPropsLivePreview({ entityId: 'a', patch: { position: { x: 1, y: 2 }, width: 9 } });
    expect(hits).toBe(2);
    unsub();
  });

  it('withEntityPropsLivePreview merges only for the matching id (identity otherwise)', () => {
    const preview = { entityId: IMG.id, patch: { width: 999 } };
    expect(withEntityPropsLivePreview(IMG, preview).width).toBe(999);
    expect(withEntityPropsLivePreview(IMG, { entityId: 'other', patch: { width: 1 } })).toBe(IMG);
    expect(withEntityPropsLivePreview(IMG, null)).toBe(IMG);
  });
});

describe('useImagePropsGripSync — release/non-image clear guard', () => {
  it('leaves the channel untouched while an IMAGE is being dragged (writer owns it)', () => {
    setEntityPropsLivePreview({ entityId: IMG.id, patch: { width: 700 } });
    const dp = { entityId: IMG.id, gripIndex: 6, delta: { x: 40, y: 0 } } as unknown as DxfGripDragPreview;
    renderHook(() => useImagePropsGripSync({ dragPreview: dp, levelManager: fakeLevelManager(IMG) }));
    expect(getEntityPropsLivePreview()).toEqual({ entityId: IMG.id, patch: { width: 700 } });
  });

  it('clears on release (dragPreview → null)', () => {
    setEntityPropsLivePreview({ entityId: IMG.id, patch: { width: 700 } });
    renderHook(() => useImagePropsGripSync({ dragPreview: null, levelManager: fakeLevelManager(IMG) }));
    expect(getEntityPropsLivePreview()).toBeNull();
  });

  it('clears when a NON-image entity is being dragged', () => {
    setEntityPropsLivePreview({ entityId: IMG.id, patch: { width: 700 } });
    const dp = { entityId: LINE.id, gripIndex: 0, delta: { x: 5, y: 5 } } as unknown as DxfGripDragPreview;
    renderHook(() => useImagePropsGripSync({ dragPreview: dp, levelManager: fakeLevelManager(IMG, LINE) }));
    expect(getEntityPropsLivePreview()).toBeNull();
  });

  it('leaves the channel while an image BODY-drag is armed, clears on body release', () => {
    setEntityPropsLivePreview({ entityId: IMG.id, patch: { position: { x: 5, y: 5 } } });
    EntityBodyDragStore.arm({ anchor: { x: 0, y: 0 }, entityIds: [IMG.id], copy: false });
    const { rerender } = renderHook(() =>
      useImagePropsGripSync({ dragPreview: null, levelManager: fakeLevelManager(IMG) }),
    );
    // Image body-drag active → the RAF writer owns the channel· the guard must NOT clear it.
    expect(getEntityPropsLivePreview()).not.toBeNull();
    EntityBodyDragStore.clear();
    rerender();
    expect(getEntityPropsLivePreview()).toBeNull();
  });
});

describe('publishImageLivePreview — shared RAF writer', () => {
  it('publishes an image entity geometry to the channel', () => {
    publishImageLivePreview({ type: 'image', id: 'z', position: { x: 3, y: 4 }, width: 20, height: 10, rotation: 15 } as never);
    expect(getEntityPropsLivePreview()).toEqual({
      entityId: 'z',
      patch: { position: { x: 3, y: 4 }, width: 20, height: 10, rotation: 15 },
    });
  });

  it('is a no-op for a non-image entity', () => {
    setEntityPropsLivePreview(null);
    publishImageLivePreview({ type: 'wall', id: 'w' } as never);
    expect(getEntityPropsLivePreview()).toBeNull();
  });
});
