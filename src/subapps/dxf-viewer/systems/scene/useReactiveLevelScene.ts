import { useMemo } from 'react';
import { useActiveGroupId } from '../group/useActiveGroup';
// ADR-641 — the EXCLUSIVE-render-scope scene (BEDIT-aware): the raw world scene, or — while a Block
// Editor is open — that block's block-local synthetic scene. The WebGL line leaf MUST scope to the
// SAME effective scene the Canvas2D `DxfCanvasSubscriber` renders, else the two line-drawing layers
// disagree around BEDIT: the GPU layer would keep the WORLD block's lines «owned» (so the Canvas2D
// renderer suppresses them, STEP 12) while the editor shows block-local space, and — the reported
// bug — on EXIT the world scene ref is UNCHANGED (the member add already mutated it mid-session), so
// the leaf never re-runs `manager.setScene` and the GPU buffers/owned-ids never rebuild: a member
// added inside BEDIT stays suppressed on Canvas2D yet absent from the GPU buffer → invisible until a
// hover overlay (which bypasses the suppression) repaints it. Reading the effective scene makes EXIT a
// real scene-identity change (block-local → world) → `setScene` → rebuild → the new member is drawn.
import { useEffectiveLevelScene } from '../block/useEffectiveLevelScene';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneModel } from '../../types/scene';

/**
 * ADR-040/547 — the LOW-freq "live level scene → converted DxfScene" subscription shared by
 * canvas micro-leaves (the WebGL line leaf; the DxfCanvasSubscriber uses the same shape).
 *
 * Subscribes to the EXCLUSIVE-render-scope scene SSoT (`useEffectiveLevelScene`, BEDIT-aware) +
 * drill-in group, reconverts through the shared WeakMap cache ONLY on a real mutation / units /
 * drill-in / block-edit-enter-exit change (so this leaf's own hover/selection re-renders reuse the
 * cached ref), and falls back to the orchestrator `fallbackScene` before the store has the level
 * (first paint). Extracted so leaves don't ship parallel copies of the block (N.18 / CHECK 3.28).
 */
export function useReactiveLevelScene(
  sceneLevelId: string | null,
  convertScene: (scene: SceneModel | null, activeGroupId?: string | null) => DxfScene,
  fallbackScene: DxfScene | null,
): DxfScene | null {
  const liveSceneModel = useEffectiveLevelScene(sceneLevelId);
  const activeGroupId = useActiveGroupId();
  const liveScene = useMemo(
    () => (liveSceneModel ? convertScene(liveSceneModel, activeGroupId) : null),
    [liveSceneModel, convertScene, activeGroupId],
  );
  return liveScene ?? fallbackScene;
}
