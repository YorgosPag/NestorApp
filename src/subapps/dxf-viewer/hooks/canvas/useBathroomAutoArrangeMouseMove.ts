'use client';

import { useCallback, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { LevelManagerLike } from './canvas-click-types';
import {
  pickRegionPerimeterAt,
  isPerimeterOversized,
  perimeterExtentMm,
} from '../../bim/walls/perimeter-from-faces';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import {
  setRegionPerimeterPreview,
  singleZoneRegionPreview,
  clearRegionPerimeterPreview,
} from '../../systems/region-preview/RegionPerimeterPreviewStore';
// Ο ίδιος store οδηγείται και από το `useRegionPerimeterMouseMove` (τοίχος/κολόνα).
// Όταν φεύγουμε προς ΕΚΕΙΝΑ τα εργαλεία, ΕΚΕΙΝΟ το hook κατέχει το preview → μη το
// σβήσεις (αλλιώς one-frame flicker)· απλώς παράτησε το δικό μας guard.
import { isRegionHoverPreviewTool } from '../../systems/tools/region-tool-ids';

/** ADR-462 — canonical mm scene· region detection runs in `'mm'` (βλ. useBathroomAutoArrangeTool). */
const GEOMETRY_UNITS: SceneUnits = 'mm';
const BATHROOM_TOOL = 'bathroom-auto-arrange';

export interface UseBathroomAutoArrangeMouseMoveParams {
  handleMouseMove: (worldPos: Point2D, screenPos: Point2D) => void;
  activeTool: string;
  levelManager: LevelManagerLike;
}

/**
 * ADR-638 Στάδιο 2b — wraps the unified mouse-move handler to drive the
 * `RegionPerimeterPreviewStore` hover highlight όταν είναι ενεργό το εργαλείο
 * «Αυτόματη Διαρρύθμιση Μπάνιου». Δείχνει το ΙΔΙΟ smallest-containing περίγραμμα που
 * θα δεχτεί τα είδη στο κλικ (κοινό `pickRegionPerimeterAt` SSoT + tol → preview ≡ commit).
 *
 * Mirror `useRegionPerimeterMouseMove`: refs για σταθερό callback (ADR-040 — καμία
 * high-freq store subscription στον orchestrator), throttle 50ms, sig-dedup, module
 * guard ώστε το preview να καθαρίζεται ΜΟΝΟ όταν υπήρχε.
 */
export function useBathroomAutoArrangeMouseMove(params: UseBathroomAutoArrangeMouseMoveParams) {
  const handleRef = useRef(params.handleMouseMove);
  handleRef.current = params.handleMouseMove;
  const toolRef = useRef(params.activeTool);
  toolRef.current = params.activeTool;
  const lmRef = useRef(params.levelManager);
  lmRef.current = params.levelManager;
  const throttleRef = useRef(0);

  const handleMouseMoveWithBathroomPreview = useCallback(
    (worldPos: Point2D, screenPos: Point2D) => {
      handleRef.current(worldPos, screenPos);

      if (toolRef.current !== BATHROOM_TOOL) {
        // Ο region hook (τοίχος/κολόνα) κατέχει το preview για τα δικά του εργαλεία →
        // μη το σβήσεις, μόνο παράτησε το guard μας. Αλλιώς (π.χ. 'select') καθάρισε.
        if (isRegionHoverPreviewTool(toolRef.current)) dropGuard();
        else clearPreviewIfShown();
        return;
      }

      const now = performance.now();
      if (now - throttleRef.current < 50) return;
      throttleRef.current = now;

      const lm = lmRef.current;
      const scene = lm.currentLevelId ? lm.getLevelScene(lm.currentLevelId) : null;
      const entities = scene?.entities ?? null;
      if (!entities || entities.length === 0) {
        clearPreviewIfShown();
        return;
      }

      const scale = mmToSceneUnits(GEOMETRY_UNITS);
      // ADR-638 §wall-aware — `true` → preview ≡ commit: ίδια ανίχνευση με το click,
      // πιάνει δωμάτια από BIM τοίχους/κολόνες (όχι μόνο DXF γραμμές).
      const { perimeter: pick } = pickRegionPerimeterAt(worldPos, entities, GEOMETRY_UNITS, true);
      // Κανένα κλειστό δωμάτιο ή γιγάντιο εξωτερικό περίγραμμα (Layer 4) → μη highlight.
      if (!pick || isPerimeterOversized(pick, scale)) {
        clearPreviewIfShown();
        return;
      }

      // Ίδιο περίγραμμα → μηδέν store write → μηδέν overlay re-render μέσα στο δωμάτιο.
      const sig = polygonSig(pick.polygon);
      if (sig === _lastSig) return;
      _lastSig = sig;

      const { width, height } = perimeterExtentMm(pick, scale);
      const label = `${(width / 1000).toFixed(2)} × ${(height / 1000).toFixed(2)} m`;
      setRegionPerimeterPreview(singleZoneRegionPreview([...pick.polygon], label, false));
      _hadPreview = true;
    },
    [],
  );

  return { handleMouseMoveWithBathroomPreview };
}

// Module-local guards (mirror useRegionPerimeterMouseMove): καθαρισμός preview μόνο
// όταν υπήρχε + υπογραφή τελευταίου εμφανισμένου περιγράμματος (skip redundant writes).
let _hadPreview = false;
let _lastSig: string | null = null;

function polygonSig(polygon: readonly Point2D[]): string {
  return polygon.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
}

function clearPreviewIfShown(): void {
  if (!_hadPreview) return;
  clearRegionPerimeterPreview();
  dropGuard();
}

/** Παράτησε το guard ΧΩΡΙΣ να αγγίξεις τον store (όταν ο region hook κατέχει το preview). */
function dropGuard(): void {
  _hadPreview = false;
  _lastSig = null;
}
