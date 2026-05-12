'use client';

import { useCallback, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Overlay } from '../../overlays/types';
import type { LevelManagerLike } from './canvas-click-types';
import { getAutoAreaHitResult } from '../../systems/auto-area/auto-area-hit';
import { setAutoAreaPreview } from '../../systems/auto-area/AutoAreaPreviewStore';

export interface UseAutoAreaMouseMoveParams {
  handleMouseMove: (worldPos: Point2D, screenPos: Point2D) => void;
  activeTool: string;
  levelManager: LevelManagerLike;
  currentOverlays: Overlay[];
  transformScale: number;
}

/**
 * Wraps the unified mouse-move handler to update AutoAreaPreviewStore when
 * activeTool === 'auto-measure-area'. Uses refs so the returned callback is
 * stable (no re-creation on transform/overlay changes).
 */
export function useAutoAreaMouseMove(params: UseAutoAreaMouseMoveParams) {
  const handleRef = useRef(params.handleMouseMove);
  handleRef.current = params.handleMouseMove;
  const toolRef = useRef(params.activeTool);
  toolRef.current = params.activeTool;
  const lmRef = useRef(params.levelManager);
  lmRef.current = params.levelManager;
  const overlaysRef = useRef(params.currentOverlays);
  overlaysRef.current = params.currentOverlays;
  const scaleRef = useRef(params.transformScale);
  scaleRef.current = params.transformScale;
  const throttleRef = useRef(0);

  const handleMouseMoveWithAutoArea = useCallback(
    (worldPos: Point2D, screenPos: Point2D) => {
      handleRef.current(worldPos, screenPos);

      if (toolRef.current !== 'auto-measure-area') return;

      const now = performance.now();
      if (now - throttleRef.current < 50) return;
      throttleRef.current = now;

      const lm = lmRef.current;
      const scene = lm.currentLevelId ? lm.getLevelScene(lm.currentLevelId) : null;
      const result = getAutoAreaHitResult(
        worldPos,
        scene?.entities ?? [],
        overlaysRef.current,
        scaleRef.current,
      );
      setAutoAreaPreview(result ? { polygon: result.polygon, holes: result.holes } : null);
    },
    [],
  );

  return { handleMouseMoveWithAutoArea };
}
