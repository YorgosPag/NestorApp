import { useMemo } from 'react';
import { useLevelScene } from './useSceneSelectors';
import { useActiveGroupId } from '../group/useActiveGroup';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneModel } from '../../types/scene';

/**
 * ADR-040/547 — the LOW-freq "live level scene → converted DxfScene" subscription shared by
 * canvas micro-leaves (the WebGL line leaf; the DxfCanvasSubscriber uses the same shape).
 *
 * Subscribes to the level's scene SSoT + drill-in group, reconverts through the shared
 * WeakMap cache ONLY on a real mutation / units / drill-in change (so this leaf's own
 * hover/selection re-renders reuse the cached ref), and falls back to the orchestrator
 * `fallbackScene` before the store has the level (first paint). Extracted so leaves don't
 * ship parallel copies of the block (N.18 / CHECK 3.28).
 */
export function useReactiveLevelScene(
  sceneLevelId: string | null,
  convertScene: (scene: SceneModel | null, activeGroupId?: string | null) => DxfScene,
  fallbackScene: DxfScene | null,
): DxfScene | null {
  const liveSceneModel = useLevelScene(sceneLevelId);
  const activeGroupId = useActiveGroupId();
  const liveScene = useMemo(
    () => (liveSceneModel ? convertScene(liveSceneModel, activeGroupId) : null),
    [liveSceneModel, convertScene, activeGroupId],
  );
  return liveScene ?? fallbackScene;
}
