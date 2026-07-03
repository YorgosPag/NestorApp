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
// Giorgio 2026-07-01 — ο σκέτος «Κολόνα» δείχνει το ΙΔΙΟ σχήμα (ορθογώνιο ή Γ/Τ/Π)
// που θα υιοθετήσει το adopt-click → ΚΟΙΝΟΣ detector `findAdoptableColumnPerimeter`.
import {
  findAdoptableColumnPerimeter,
  resolvePerimeterAdoptInfo,
  shouldProposeAdopt,
} from '../../bim/columns/column-adopt-rect';
import { getKindDimensionDefaults } from '../drawing/column-completion';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import {
  setRegionPerimeterPreview,
  clearRegionPerimeterPreview,
  type RegionPerimeterZone,
} from '../../systems/region-preview/RegionPerimeterPreviewStore';
import { clearRegionGapMarkers } from '../../systems/region-preview/RegionGapMarkersStore';
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
        // ADR-419 Layer 5b — φεύγοντας από region/perimeter εργαλείο, σβήσε και τα gap markers.
        clearRegionGapMarkers();
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
          : tool === 'column'
            ? resolveColumnShapePreview(worldPos, entities, sceneUnits)
            : resolvePerimeterPreview(worldPos, entities, sceneUnits, scale);
      if (!preview) {
        clearPreviewIfShown();
        return;
      }
      // Ίδιο περίγραμμα (signature-based) → μηδέν store write → μηδέν re-render
      // του overlay σε κάθε move μέσα στην ίδια περιοχή.
      if (preview.sig === _lastSig) return;
      _lastSig = preview.sig;
      setRegionPerimeterPreview({ zones: preview.zones, oversized: false });
      _hadPreview = true;
    },
    [],
  );

  return { handleMouseMoveWithRegionPreview };
}

// ─── Per-tool preview resolvers ──────────────────────────────────────────────

interface PreviewPick {
  readonly zones: RegionPerimeterZone[];
  /** Φθηνή υπογραφή ταυτότητας (κβαντισμένες ζώνες) — dedup redundant store writes. */
  readonly sig: string;
}

function polygonSig(polygon: readonly Point2D[]): string {
  return polygon.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
}

function zonesSig(zones: readonly RegionPerimeterZone[]): string {
  return zones.map((z) => polygonSig(z.polygon)).join('|');
}

/** Ένα single-zone PreviewPick (σκέτος τοίχος/κολόνα — ΕΝΑ σχήμα, χωρίς split). */
function singleZone(polygon: Point2D[], label: string): PreviewPick {
  const zones: RegionPerimeterZone[] = [{ polygon, label }];
  return { zones, sig: zonesSig(zones) };
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
  // ADR-419 §thickness-zones — αν το περίγραμμα σπάει σε σκέλη σταθερού πλάτους
  // (`decomposeRectilinear`), δείξε ΚΑΘΕ σκέλος ξεχωριστά — ΑΚΡΙΒΩΣ όσους τοίχους θα
  // δημιουργήσει το commit (`buildFillingWalls` ένας τοίχος ανά σκέλος) → preview ≡ commit.
  // Μη-ορθογωνικό loop (rects=[]) → ένα σχήμα (το commit ούτως ή άλλως το αγνοεί).
  if (pick.rects.length > 0) {
    const zones: RegionPerimeterZone[] = pick.rects.map((r) => ({
      polygon: [...r.polygon],
      label: `${(r.longSide / scale / 1000).toFixed(2)} × ${(r.shortSide / scale / 1000).toFixed(2)} m`,
    }));
    return { zones, sig: zonesSig(zones) };
  }
  const { width, height } = perimeterExtentMm(pick, scale);
  return singleZone([...pick.polygon], `${(width / 1000).toFixed(2)} × ${(height / 1000).toFixed(2)} m`);
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
  return singleZone(
    [...rect.polygon],
    `${(rect.longSide / scale / 1000).toFixed(2)} × ${(rect.shortSide / scale / 1000).toFixed(2)} m`,
  );
}

/**
 * Σκέτος «Κολόνα» — ΙΔΙΟΣ detector με το adopt-click (`findAdoptableColumnPerimeter`):
 * ΚΑΘΕ κλειστό σχήμα (ορθογώνιο robust corner-graph ή Γ/Τ/Π/σύνθετο polygon-backed).
 * Δείχνει ΟΛΟΚΛΗΡΟ το πολύγωνο του σχήματος → ό,τι φωτίζεται = ό,τι θα υιοθετήσει το
 * κλικ (preview ≡ commit). `null` όταν δεν υπάρχει σχήμα ή είναι oversized.
 */
function resolveColumnShapePreview(
  worldPos: Point2D,
  entities: readonly Entity[],
  sceneUnits: SceneUnits,
): PreviewPick | null {
  const tol = resolveRegionLoopTolWorld(sceneUnits);
  const perimeter = findAdoptableColumnPerimeter(
    worldPos,
    sceneSnapTargetsStore.get().rectTargets,
    entities,
    tol,
    sceneUnits,
  );
  if (!perimeter) return null;
  const info = resolvePerimeterAdoptInfo(perimeter, sceneUnits);
  // preview ≡ commit: για ΟΡΘΟΓΩΝΙΟ ≈ default το adopt-click δεν υιοθετεί (κανονική
  // ροή) → μη δείχνεις διακεκομμένη. Τα Γ/Τ/Π ΠΑΝΤΑ υιοθετούνται. Effective defaults
  // = ribbon override → kind default (ίδιο με το `tryAdoptRectColumn`).
  if (info.isRectangle) {
    const handle = columnToolBridgeStore.get();
    const kindDims = getKindDimensionDefaults(handle?.kind ?? 'rectangular');
    const eff = {
      width: handle?.overrides.width ?? kindDims.width,
      depth: handle?.overrides.depth ?? kindDims.depth,
    };
    if (!shouldProposeAdopt(info, eff)) return null;
  }
  // Η κολόνα/τοιχίο = ΕΝΑ μέλος (δεν σπάει σε ζώνες) → single zone (ολόκληρο το σχήμα).
  return singleZone(
    [...perimeter.polygon],
    `${(info.widthMm / 1000).toFixed(2)} × ${(info.depthMm / 1000).toFixed(2)} m`,
  );
}

/**
 * Β (Giorgio 2026-07-01) — δείξε τη region/perimeter hover preview για region/
 * perimeter εργαλεία ΠΑΝΤΑ, ΚΑΙ για τους σκέτους «Τοίχο»/«Κολόνα» ΜΟΝΟ όταν το κλικ
 * θα δράσει (`isRegionFillEligible` του αντίστοιχου bridge: τοίχος awaitingStart /
 * κολόνα awaitingPosition). Έτσι η διακεκομμένη preview ≡ commit.
 */
function isRegionPreviewActive(tool: string | undefined): boolean {
  if (!isRegionHoverPreviewTool(tool)) return false;
  if (tool === 'wall') return wallToolBridgeStore.get()?.isRegionFillEligible === true;
  if (tool === 'column') return columnToolBridgeStore.get()?.isRegionFillEligible === true;
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
