'use client';

/**
 * ADR-680 (3D) — useBim3DDistMeasure: ο 3D click/keyboard bridge του εφήμερου «Μέτρημα Απόστασης».
 *
 * Thin mirror του `use-bim3d-column-placement`: ο interaction lifecycle (listeners, orbit-drag
 * guard, arm «μόνο όσο `activeTool==='dist'` ΚΑΙ 3D») ανήκει στο SSoT primitive
 * `usePlacementInteractionEffect` (ADR-618). Εδώ μόνο: raycast της ΕΠΙΦΑΝΕΙΑΣ γεωμετρίας →
 * OSNAP (ίδια global engine με 2D/κολόνα) → scene-unit 3D σημείο → γράφεται στον ΕΝΑΝ
 * `dist-ephemeral-store` (κοινός με το 2D· καμία εγγραφή entity/DB) → ζωγραφική μέσω `Dist3DOverlay`.
 *
 * Enter/Backspace/Escape/finish ΔΕΝ ζουν εδώ: τα χειρίζεται ο mode-agnostic `DistMeasureOverlayLeaf`
 * (window listeners + escape-bus) πάνω στον ΙΔΙΟ store, οπότε ο 3D overlay απλώς τα αντικατοπτρίζει
 * μέσω του `subscribeDist` re-render. Store reads at event time (ADR-040) — μηδέν `useSyncExternalStore`.
 *
 * @module subapps/dxf-viewer/bim-3d/measure/use-bim3d-dist-measure
 */

import type { RefObject } from 'react';
import type { ToolType } from '../../ui/toolbar/types';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { raycastWorldPointOrPlane } from '../systems/raycaster/BimEntityRaycaster';
import { worldToDxfPlan } from '../viewport/coordinate-transforms';
import { computeDxfGroundY } from '../scene/scene-manager-framing';
import { resolvePlacementSnapWithView } from '../placement/placement-snap';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { useSnap3DOverlayStore } from '../stores/Snap3DOverlayStore';
import {
  usePlacementInteractionEffect,
  type PlacementInteractionContext,
  type PlacementInteractionController,
} from '../placement/use-placement-interaction-effect';
import { addDistPoint, getDistSnapshot, subscribeDist, type DistPoint } from '../../systems/measure/dist-ephemeral-store';
import { Dist3DOverlay } from './Dist3DOverlay';

/** Το «Μέτρηση» εργαλείο οπλίζει αυτό το 3D placement. */
const DIST_TOOLS: readonly ToolType[] = ['dist'];

export interface UseBim3DDistMeasureParams {
  managerRef: RefObject<ThreeJsSceneManager | null>;
  canvasEl: HTMLCanvasElement | null;
}

export function useBim3DDistMeasure({ managerRef, canvasEl }: UseBim3DDistMeasureParams): void {
  usePlacementInteractionEffect({
    managerRef,
    canvasEl,
    tools: DIST_TOOLS,
    createController: ({ manager, canvasEl: el }: PlacementInteractionContext): PlacementInteractionController => {
      const overlay = new Dist3DOverlay(manager.scene);
      let liveCursorScene: DistPoint | null = null;
      let armed = false;

      // Ίδιο πεδίο μονάδων με το 2D `DistMeasureOverlayLeaf` (`dxfScene?.units`) → ίδιες μονάδες status-bar.
      const unitsNow = (): SceneUnits => useDxfOverlay3DStore.getState().dxfScene?.units ?? 'mm';

      /**
       * Screen point → snapped scene-unit 3D σημείο. Raycast της ΕΠΙΦΑΝΕΙΑΣ (geometry hit →
       * fallback επίπεδο ορόφου → camera-facing plane) ώστε να μετριέται αληθινό 3D (ύψος/διαγώνιος)·
       * OSNAP διορθώνει MONO x,y (κάτοψη), κρατώντας το z της επιφάνειας. Ίδιο glyph με 2D/κολόνα.
       */
      const resolveScenePoint = (clientX: number, clientY: number): DistPoint | null => {
        const camera = manager.getCamera();
        const world = raycastWorldPointOrPlane(
          manager.bimLayer.group, camera, manager.renderer.domElement, clientX, clientY,
          manager.viewport.target, computeDxfGroundY(manager.dxfConverter.getBounds()),
        );
        if (!world) return null;
        const planMm = worldToDxfPlan(world);
        const snap = resolvePlacementSnapWithView({ x: planMm.x, y: planMm.y });
        // Glyph μόνο όταν υπάρχει renderable view (Snap3DMarker.view = non-nullable)· το snappedMm
        // ισχύει ακόμη κι όταν το view είναι null (η έλξη έγινε, απλώς δεν ζωγραφίζεται σύμβολο).
        useSnap3DOverlayStore.getState().setSnap(snap?.view ? { view: snap.view, elevMm: planMm.z } : null);
        const f = mmToSceneUnits(unitsNow());
        const mm = snap ? snap.snappedMm : planMm;
        return { x: mm.x * f, y: mm.y * f, z: planMm.z * f };
      };

      const render = (): void => {
        if (!armed) { overlay.hide(); manager.markSceneDirty(); return; }
        overlay.update(getDistSnapshot(), liveCursorScene, unitsNow(), manager.getCamera(), el);
        manager.markSceneDirty();
      };

      // Enter/Backspace/Escape mutate τον κοινό store έξω από το 3D pointer path → reflect εδώ.
      const unsub = subscribeDist(render);

      return {
        onMove: (e: PointerEvent): void => {
          armed = true;
          liveCursorScene = resolveScenePoint(e.clientX, e.clientY);
          render();
        },
        hideFeedback: (): void => {
          armed = false;
          liveCursorScene = null;
          useSnap3DOverlayStore.getState().setSnap(null);
          overlay.hide();
          manager.markSceneDirty();
        },
        onCommit: (e: MouseEvent): void => {
          const scenePt = resolveScenePoint(e.clientX, e.clientY);
          if (!scenePt) return;
          // Μπλοκάρει τον 3D selection handler από κάτω (React onClick του viewport).
          e.preventDefault();
          e.stopPropagation();
          armed = true;
          addDistPoint(scenePt);
          render();
        },
        dispose: (): void => {
          unsub();
          useSnap3DOverlayStore.getState().setSnap(null);
          overlay.dispose();
        },
      };
    },
  });
}
