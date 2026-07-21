/**
 * SSoT harness — 2-click translation ghost preview scaffolding
 *
 * The shared skeleton every «pick base → pick destination» ghost preview needs,
 * so the Move and Copy previews (and any future translation tool) cannot diverge
 * on the boilerplate (N.18 — no parallel twins). Owns, once:
 *   - the preview deps bundle (getEntity / getBimPreview / getLayersById)
 *   - the always-on red base-point crosshair (drawn even before the cursor enters)
 *   - the `basePoint` / `effectiveCursor` guards
 *   - the RAF + DPR-clear lifecycle (delegates to `useCanvasGhostPreview`, ADR-398 §4)
 *
 * The caller supplies ONLY `drawFrame` — the per-tool difference (raw vs ORTHO/
 * AutoAlign destination, rubber band, entity ghost, overlays/clearance). It runs
 * after the base marker with a guaranteed non-null `basePoint` + `effectiveCursor`.
 *
 * @see hooks/tools/useMovePreview.ts · hooks/tools/useCopyPreview.ts
 * @module hooks/tools/use-translation-ghost-preview
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
// ADR-049 — red base-point ＋ crosshair SSoT (shared with the grip MOVE hot-grip preview).
import { drawMoveBasePointMarker } from '../../rendering/ui/move-base-point-marker';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import { useEntityTranslationPreviewDeps, type EntityTranslationPreviewDeps } from './use-entity-translation-preview-deps';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface TranslationGhostDrawFrame {
  ctx: CanvasRenderingContext2D;
  /** Guaranteed non-null — the committed base point of the gesture. */
  basePoint: Point2D;
  /** Guaranteed non-null — the live (snapped) cursor world position this frame. */
  effectiveCursor: Point2D;
  viewport: Viewport;
  transform: ViewTransform;
  deps: EntityTranslationPreviewDeps;
}

export interface UseTranslationGhostPreviewParams {
  isActive: boolean;
  basePoint: Point2D | null;
  levelManager: LevelSceneReader;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
  /** Per-tool draw, run after the base marker with non-null base + cursor. Wrap in
   *  useCallback so the RAF draw identity is stable across frames. */
  drawFrame: (frame: TranslationGhostDrawFrame) => void;
}

export function useTranslationGhostPreview(params: UseTranslationGhostPreviewParams): void {
  const { isActive, basePoint, levelManager, transform, getCanvas, getViewportElement, drawFrame } = params;
  const deps = useEntityTranslationPreviewDeps(levelManager);

  const draw = useCallback((frame: GhostDrawFrame) => {
    const { ctx, effectiveCursor, viewport, transform: t } = frame;
    if (!basePoint) return;
    // Base-point ＋ crosshair (red) — painted every frame while active, even before the
    // cursor enters the viewport, so the pivot is always visible.
    drawMoveBasePointMarker(ctx, basePoint, t, viewport);
    if (!effectiveCursor) return;
    drawFrame({ ctx, basePoint, effectiveCursor, viewport, transform: t, deps });
  }, [basePoint, deps, drawFrame]);

  useCanvasGhostPreview({ isActive, getCanvas, getViewportElement, transform, draw });
}
