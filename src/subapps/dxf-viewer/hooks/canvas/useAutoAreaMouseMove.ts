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
// Ενοποιημένος room detector (ΙΔΙΟ με «Τοποθέτηση χώρου») → preview ≡ commit.
import { resolveHatchPickRegion } from '../../bim/hatch/hatch-region-detect';
import { resolveSceneUnits } from '../../utils/scene-units';

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
      const entities = scene?.entities ?? [];
      if (isHatchPick) {
        // Hatch pick-point: ΙΔΙΟΣ layered room detector με το click commit (region
        // δωμάτια από πολυγραμμές/τοίχους + holes) — preview ≡ commit. HPGAPTOL aware.
        const region = resolveHatchPickRegion({
          worldPoint: worldPos,
          entities,
          overlays: overlaysRef.current,
          scale: scaleRef.current,
          sceneUnits: resolveSceneUnits(scene),
          gapTolerance: getHatchDrawDefaults().gapTolerance,
        });
        setAutoAreaPreview(region ? { polygon: region.outer, holes: region.holes } : null);
        return;
      }
      // Μέτρηση εμβαδού — κλασικό auto-area hit (gap tolerance 0).
      const result = getAutoAreaHitResult(worldPos, entities, overlaysRef.current, scaleRef.current, 0);
      setAutoAreaPreview(result ? { polygon: result.polygon, holes: result.holes } : null);
    },
    [],
  );

  return { handleMouseMoveWithAutoArea };
}
