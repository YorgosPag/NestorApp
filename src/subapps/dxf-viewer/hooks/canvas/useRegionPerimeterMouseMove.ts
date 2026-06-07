'use client';

import { useCallback, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { LevelManagerLike } from './canvas-click-types';
import {
  getCachedRegionPerimeters,
  pickSmallestContainingPerimeter,
  isPerimeterOversized,
  perimeterExtentMm,
  type ClosedPerimeter,
} from '../../bim/walls/perimeter-from-faces';
import { resolveRegionLoopTolWorld } from '../../bim/walls/region-tolerance';
import {
  setRegionPerimeterPreview,
  clearRegionPerimeterPreview,
} from '../../systems/region-preview/RegionPerimeterPreviewStore';
import { isBimRegionOrPerimeterTool } from '../../systems/tools/region-tool-ids';
import { resolveSceneUnits, mmToSceneUnits } from '../../utils/scene-units';

export interface UseRegionPerimeterMouseMoveParams {
  handleMouseMove: (worldPos: Point2D, screenPos: Point2D) => void;
  activeTool: string;
  levelManager: LevelManagerLike;
}

/**
 * ADR-419 Layer 3 — wraps the unified mouse-move handler to update the region/
 * perimeter hover preview (`RegionPerimeterPreviewStore`) όταν είναι ενεργό BIM
 * εργαλείο «σε περιοχή / από περίγραμμα» (κολώνες + τοίχοι). Mirror του
 * `useAutoAreaMouseMove`: refs για σταθερό callback + throttle 50ms.
 *
 * Δείχνει το ΙΔΙΟ smallest-containing περίγραμμα που θα δημιουργηθεί στο κλικ
 * (ίδιο SSoT detection + tol), με flag oversized (Layer 4) + διαστάσεις.
 */
export function useRegionPerimeterMouseMove(params: UseRegionPerimeterMouseMoveParams) {
  const handleRef = useRef(params.handleMouseMove);
  handleRef.current = params.handleMouseMove;
  const toolRef = useRef(params.activeTool);
  toolRef.current = params.activeTool;
  const lmRef = useRef(params.levelManager);
  lmRef.current = params.levelManager;
  const throttleRef = useRef(0);

  const handleMouseMoveWithRegionPreview = useCallback(
    (worldPos: Point2D, screenPos: Point2D) => {
      handleRef.current(worldPos, screenPos);

      if (!isBimRegionOrPerimeterTool(toolRef.current)) {
        if (getHadPreview()) {
          clearRegionPerimeterPreview();
          setHadPreview(false);
          _lastPick = null;
        }
        return;
      }

      const now = performance.now();
      if (now - throttleRef.current < 50) return;
      throttleRef.current = now;

      const lm = lmRef.current;
      const scene = lm.currentLevelId ? lm.getLevelScene(lm.currentLevelId) : null;
      const entities = scene?.entities ?? null;
      if (!entities || entities.length === 0) {
        if (getHadPreview()) {
          clearRegionPerimeterPreview();
          setHadPreview(false);
          _lastPick = null;
        }
        return;
      }
      const sceneUnits = resolveSceneUnits(scene);
      const tol = resolveRegionLoopTolWorld(sceneUnits);
      const scale = mmToSceneUnits(sceneUnits);
      // Cached (SSoT, κοινό με το click-inside commit) — η O(n²) ανίχνευση τρέχει
      // μία φορά ανά (γραμμές, tol)· μηδέν recompute σε κάθε move ή στο κλικ.
      const perimeters = getCachedRegionPerimeters(entities, tol);
      const pick = pickSmallestContainingPerimeter(worldPos, perimeters);
      // Δείχνουμε preview ΜΟΝΟ για έγκυρο (μη-oversized) περίγραμμα. Το γιγάντιο
      // εξωτερικό περίγραμμα ΔΕΝ ζωγραφίζεται (Revit-style: κανένα κόκκινο που
      // κυριαρχεί)· η προειδοποίηση δίνεται στο κλικ (toast «δεν ενώνονται»).
      if (!pick || isPerimeterOversized(pick, scale)) {
        if (getHadPreview()) {
          clearRegionPerimeterPreview();
          setHadPreview(false);
          _lastPick = null;
        }
        return;
      }
      // Ίδιο περίγραμμα (cached ref σταθερό όσο δεν αλλάζει scene/zoom) → μηδέν
      // store write → μηδέν re-render του overlay σε κάθε move μέσα στην ίδια περιοχή.
      if (pick === _lastPick) return;
      _lastPick = pick;
      const { width, height } = perimeterExtentMm(pick, scale);
      setRegionPerimeterPreview({
        polygon: [...pick.polygon],
        oversized: false,
        label: `${(width / 1000).toFixed(2)} × ${(height / 1000).toFixed(2)} m`,
      });
      setHadPreview(true);
    },
    [],
  );

  return { handleMouseMoveWithRegionPreview };
}

// Module-local guard ώστε να καθαρίζουμε το preview μόνο όταν υπήρχε (αποφυγή
// περιττών store notifications σε κάθε move εκτός εργαλείου).
let _hadPreview = false;
// Τελευταίο εμφανισμένο περίγραμμα (cached ref) — για skip redundant store writes.
let _lastPick: ClosedPerimeter | null = null;
function getHadPreview(): boolean {
  return _hadPreview;
}
function setHadPreview(v: boolean): void {
  _hadPreview = v;
}
