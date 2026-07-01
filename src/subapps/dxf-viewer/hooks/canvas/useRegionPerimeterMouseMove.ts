'use client';

import { useCallback, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { LevelManagerLike } from './canvas-click-types';
import {
  pickRegionPerimeterAt,
  isPerimeterOversized,
  perimeterExtentMm,
} from '../../bim/walls/perimeter-from-faces';
// Β (Giorgio 2026-07-01) — ο σκέτος «Τοίχος» χρησιμοποιεί ΤΟΝ ΙΔΙΟ detector με το
// click-fill (`findEnclosingRectangle`) ώστε preview ≡ commit (corner-graph — πιάνει
// ορθογώνια με κοινές κορυφές, όχι μόνο καθαρούς simple-cycles όπως το perimeter loop).
import { extractLineSegments, findEnclosingRectangle } from '../../bim/walls/wall-in-region';
import { resolveRegionLoopTolWorld } from '../../bim/walls/region-tolerance';
import { REGION_PERIMETER_LIMITS } from '../../config/tolerance-config';
import {
  setRegionPerimeterPreview,
  clearRegionPerimeterPreview,
} from '../../systems/region-preview/RegionPerimeterPreviewStore';
import { isRegionHoverPreviewTool } from '../../systems/tools/region-tool-ids';
import { wallToolBridgeStore } from '../../ui/ribbon/hooks/bridge/wall-tool-bridge-store';
import { resolveSceneUnits, mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

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

      const tool = toolRef.current;
      if (!isRegionPreviewActive(tool)) {
        clearPreviewIfShown();
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
      const sceneUnits = resolveSceneUnits(scene);
      const scale = mmToSceneUnits(sceneUnits);
      // Preview ≡ commit: ο σκέτος «Τοίχος» χρησιμοποιεί ΤΟΝ ΙΔΙΟ detector με το
      // click-fill (`findEnclosingRectangle`, corner-graph — πιάνει ορθογώνια με
      // κοινές κορυφές, όπως σε πραγματική κάτοψη). Τα region/perimeter εργαλεία
      // κρατούν το smallest-containing κλειστό loop (κοινό cache με το click τους).
      const preview =
        tool === 'wall'
          ? resolvePlainWallRectPreview(worldPos, entities, sceneUnits, scale)
          : resolvePerimeterPreview(worldPos, entities, sceneUnits, scale);
      if (!preview) {
        clearPreviewIfShown();
        return;
      }
      // Ίδιο περίγραμμα (signature-based) → μηδέν store write → μηδέν re-render
      // του overlay σε κάθε move μέσα στην ίδια περιοχή.
      if (preview.sig === _lastSig) return;
      _lastSig = preview.sig;
      setRegionPerimeterPreview({ polygon: preview.polygon, oversized: false, label: preview.label });
      _hadPreview = true;
    },
    [],
  );

  return { handleMouseMoveWithRegionPreview };
}

// ─── Per-tool preview resolvers ──────────────────────────────────────────────

interface PreviewPick {
  readonly polygon: Point2D[];
  readonly label: string;
  /** Φθηνή υπογραφή ταυτότητας (κβαντισμένο πολύγωνο) — dedup redundant store writes. */
  readonly sig: string;
}

function polygonSig(polygon: readonly Point2D[]): string {
  return polygon.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
}

/**
 * Region/perimeter εργαλεία — smallest-containing κλειστό loop (κοινό cache με το
 * click-inside commit). `null` όταν κανένα ή oversized (Layer 4 — το γιγάντιο
 * εξωτερικό περίγραμμα ΔΕΝ ζωγραφίζεται· warning μόνο στο κλικ).
 */
function resolvePerimeterPreview(
  worldPos: Point2D,
  entities: readonly Entity[],
  sceneUnits: SceneUnits,
  scale: number,
): PreviewPick | null {
  const { perimeter: pick } = pickRegionPerimeterAt(worldPos, entities, sceneUnits);
  if (!pick || isPerimeterOversized(pick, scale)) return null;
  const { width, height } = perimeterExtentMm(pick, scale);
  const polygon = [...pick.polygon];
  return {
    polygon,
    label: `${(width / 1000).toFixed(2)} × ${(height / 1000).toFixed(2)} m`,
    sig: polygonSig(polygon),
  };
}

/**
 * Σκέτος «Τοίχος» — ΙΔΙΟΣ detector με το click-fill (`findEnclosingRectangle`, ίδιο
 * tol) ώστε ό,τι φωτίζεται στο hover να είναι ΑΚΡΙΒΩΣ ό,τι γεμίζει στο κλικ. `null`
 * όταν δεν υπάρχει εσώκλειστο ορθογώνιο ή είναι oversized (ίδιο guard με
 * `fillEnclosingRectAt` → preview ≡ commit).
 */
function resolvePlainWallRectPreview(
  worldPos: Point2D,
  entities: readonly Entity[],
  sceneUnits: SceneUnits,
  scale: number,
): PreviewPick | null {
  const rect = findEnclosingRectangle(extractLineSegments(entities), worldPos, resolveRegionLoopTolWorld(sceneUnits));
  if (!rect || rect.shortSide / scale > REGION_PERIMETER_LIMITS.MAX_MEMBER_THICKNESS_MM) return null;
  const polygon = [...rect.polygon];
  return {
    polygon,
    label: `${(rect.longSide / scale / 1000).toFixed(2)} × ${(rect.shortSide / scale / 1000).toFixed(2)} m`,
    sig: polygonSig(polygon),
  };
}

/**
 * Β (Giorgio 2026-07-01) — δείξε τη region/perimeter hover preview για region/
 * perimeter εργαλεία ΠΑΝΤΑ, ΚΑΙ για τον σκέτο «Τοίχο» ΜΟΝΟ όταν το κλικ θα γεμίσει
 * (awaitingStart, ευθύς/freehand — `isRegionFillEligible`). Έτσι η διακεκομμένη
 * preview ≡ commit· δεν εμφανίζεται σε freehand awaitingEnd/curved/polyline.
 */
function isRegionPreviewActive(tool: string | undefined): boolean {
  if (!isRegionHoverPreviewTool(tool)) return false;
  if (tool === 'wall') return wallToolBridgeStore.get()?.isRegionFillEligible === true;
  return true;
}

// Module-local guard ώστε να καθαρίζουμε το preview μόνο όταν υπήρχε (αποφυγή
// περιττών store notifications σε κάθε move εκτός εργαλείου) + η υπογραφή του
// τελευταίου εμφανισμένου περιγράμματος (skip redundant store writes).
let _hadPreview = false;
let _lastSig: string | null = null;
function clearPreviewIfShown(): void {
  if (!_hadPreview) return;
  clearRegionPerimeterPreview();
  _hadPreview = false;
  _lastSig = null;
}
