/**
 * ADR-654 — live «Ιδιότητες» panel sync during an entourage IMAGE drag.
 *
 * Covers (α) the panel-side preview store (get/set/subscribe/merge) and (β) the sync leaf's
 * MOVE path end-to-end: a whole-entity move dragPreview → `applyImageGripDrag` → the store carries
 * the live `position` patch· release (`dragPreview=null`) → the channel clears.
 */

// Defensive: the grip-kinds import chain may touch firebase auth (mirror other DXF hook tests).
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
import {
  getEntityPropsLivePreview,
  setEntityPropsLivePreview,
  withEntityPropsLivePreview,
} from '../../../systems/grip/EntityPropsLivePreviewStore';

const IMG: ImageEntity = {
  id: 'img_rt', type: 'image', layerId: 'l', url: 'x/sofa.webp',
  position: { x: 100, y: 200 }, width: 640, height: 180, rotation: 0,
};

function fakeLevelManager(entity: ImageEntity): LevelSceneReader {
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: () => ({ entities: [entity] }),
  } as unknown as LevelSceneReader;
}

afterEach(() => setEntityPropsLivePreview(null));

describe('EntityPropsLivePreviewStore', () => {
  it('get/set round-trips and notifies subscribers', () => {
    let hits = 0;
    const unsub = (() => {
      const { subscribeEntityPropsLivePreview } = require('../../../systems/grip/EntityPropsLivePreviewStore');
      return subscribeEntityPropsLivePreview(() => { hits += 1; });
    })();
    setEntityPropsLivePreview({ entityId: 'a', patch: { width: 5 } });
    expect(getEntityPropsLivePreview()).toEqual({ entityId: 'a', patch: { width: 5 } });
    expect(hits).toBe(1);
    unsub();
  });

  it('withEntityPropsLivePreview merges only for the matching id (identity otherwise)', () => {
    const preview = { entityId: IMG.id, patch: { width: 999 } };
    expect(withEntityPropsLivePreview(IMG, preview).width).toBe(999);
    // Non-matching id → same reference (no needless re-render).
    expect(withEntityPropsLivePreview(IMG, { entityId: 'other', patch: { width: 1 } })).toBe(IMG);
    // Null preview → same reference.
    expect(withEntityPropsLivePreview(IMG, null)).toBe(IMG);
  });
});

describe('useImagePropsGripSync — MOVE path', () => {
  it('publishes the live translated position while a whole-entity move drags', () => {
    const preview: DxfGripDragPreview = {
      entityId: IMG.id, gripIndex: 0, delta: { x: 30, y: -10 }, movesEntity: true,
    } as DxfGripDragPreview;
    renderHook(({ dp }) => useImagePropsGripSync({ dragPreview: dp, levelManager: fakeLevelManager(IMG) }), {
      initialProps: { dp: preview },
    });
    const live = getEntityPropsLivePreview();
    expect(live?.entityId).toBe(IMG.id);
    // position += delta (applyImageGripDrag IMAGE_MOVE_KIND).
    expect(live?.patch).toEqual({ position: { x: 130, y: 190 } });
  });

  it('clears the channel on release (dragPreview → null)', () => {
    const preview: DxfGripDragPreview = {
      entityId: IMG.id, gripIndex: 0, delta: { x: 5, y: 5 }, movesEntity: true,
    } as DxfGripDragPreview;
    const { rerender } = renderHook(
      ({ dp }: { dp: DxfGripDragPreview | null }) =>
        useImagePropsGripSync({ dragPreview: dp, levelManager: fakeLevelManager(IMG) }),
      { initialProps: { dp: preview as DxfGripDragPreview | null } },
    );
    expect(getEntityPropsLivePreview()).not.toBeNull();
    rerender({ dp: null });
    expect(getEntityPropsLivePreview()).toBeNull();
  });

  it('ignores a drag targeting a non-image / zero delta', () => {
    setEntityPropsLivePreview(null);
    const zero: DxfGripDragPreview = {
      entityId: IMG.id, gripIndex: 0, delta: { x: 0, y: 0 }, movesEntity: true,
    } as DxfGripDragPreview;
    renderHook(() => useImagePropsGripSync({ dragPreview: zero, levelManager: fakeLevelManager(IMG) }));
    expect(getEntityPropsLivePreview()).toBeNull();
  });
});
