/**
 * ADR-641 — a BEDIT-aware cached entity getter for the transform-preview hooks.
 *
 * Returns a stable `(id) => entity` reader that, at the TOP level, keeps the O(1) map cache the Move /
 * Stretch previews rely on (rebuilt only when the scene array ref swaps, not every RAF frame), and,
 * while a Block Editor session is open, resolves the id to the active block's MEMBER forward-transformed
 * into the editor's VIEW frame (real-size/recentred) so the move/stretch ghost renders where the canvas
 * shows it. ONE SSoT for both previews (CHECK 3.28 — no parallel twin cached-getter).
 */

import { useCallback, useRef } from 'react';
import type { AnySceneEntity, Entity } from '../../types/entities';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { resolveEffectiveEntityById } from '../../systems/block/block-edit-scene';
import { getActiveBlockEditId } from '../../systems/block/ActiveBlockEditStore';

export function useBeditAwareEntityGetter(
  levelManager: LevelSceneReader,
): (id: string) => AnySceneEntity | null {
  // O(1) top-level lookup — map rebuilt only when the scene array ref swaps (not per RAF frame).
  const entityMapRef = useRef<Map<string, AnySceneEntity>>(new Map());
  const entityArrayRef = useRef<readonly AnySceneEntity[] | null>(null);

  return useCallback(
    (id: string): AnySceneEntity | null => {
      if (!levelManager.currentLevelId) return null;
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      if (!scene?.entities) return null;
      // Inside BEDIT the id is a MEMBER; resolve it in the editor's VIEW frame (the top-level cache
      // below can't hold members). Outside BEDIT this guard is false → cached O(1) path.
      if (getActiveBlockEditId()) {
        return resolveEffectiveEntityById(
          scene.entities as unknown as readonly Entity[], id,
        ) as unknown as AnySceneEntity | null;
      }
      if (scene.entities !== entityArrayRef.current) {
        entityArrayRef.current = scene.entities;
        entityMapRef.current = new Map(scene.entities.map((e) => [e.id, e]));
      }
      return entityMapRef.current.get(id) ?? null;
    },
    [levelManager],
  );
}
