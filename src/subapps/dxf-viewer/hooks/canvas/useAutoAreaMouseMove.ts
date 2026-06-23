'use client';

import { useCallback, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Overlay } from '../../overlays/types';
import type { LevelManagerLike } from './canvas-click-types';
import { getAutoAreaHitResult } from '../../systems/auto-area/auto-area-hit';
import { setAutoAreaPreview } from '../../systems/auto-area/AutoAreaPreviewStore';
// ADR-507 Φ3 — το live ghost της pick-point γραμμοσκίασης reuse-άρει το ίδιο SSoT.
import { getHatchPickMode } from '../../bim/hatch/hatch-pick-mode-store';
import { getHatchDrawDefaults } from '../../bim/hatch/hatch-draw-defaults-store';

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

      // Το ghost preview ανάβει σε δύο εργαλεία που μοιράζονται το ίδιο SSoT:
      //   - 'auto-measure-area' (μέτρηση εμβαδού)
      //   - 'hatch' σε pick-point mode (ADR-507 Φ3, Τρόπος Β).
      const tool = toolRef.current;
      const isHatchPick = tool === 'hatch' && getHatchPickMode() === 'pick-point';
      if (tool !== 'auto-measure-area' && !isHatchPick) return;

      const now = performance.now();
      if (now - throttleRef.current < 50) return;
      throttleRef.current = now;

      const lm = lmRef.current;
      const scene = lm.currentLevelId ? lm.getLevelScene(lm.currentLevelId) : null;
      // Hatch pick-point σέβεται το HPGAPTOL (preview ≡ commit)· auto-measure = 0.
      const gapTolerance = isHatchPick ? getHatchDrawDefaults().gapTolerance : 0;
      const result = getAutoAreaHitResult(
        worldPos,
        scene?.entities ?? [],
        overlaysRef.current,
        scaleRef.current,
        gapTolerance,
      );
      setAutoAreaPreview(result ? { polygon: result.polygon, holes: result.holes } : null);
    },
    [],
  );

  return { handleMouseMoveWithAutoArea };
}
