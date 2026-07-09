'use client';

/**
 * ADR-403 (3D BIM Element Placement) — useBim3DColumnPlacement hook.
 *
 * React glue that lets the user place a BIM column directly on the 3D canvas. The
 * interaction lifecycle (AbortController listeners, orbit-drag guard, cursor, arm-FSM)
 * is owned by the `usePlacementInteractionEffect` primitive (ADR-618); this hook
 * supplies ONLY the column controller — ghost + the ADR-544 2D-parity placement feedback
 * (grid/dimensions meta + OSNAP glyph). No `useSyncExternalStore` (store reads happen at
 * event time, ADR-040).
 *
 * Armed only while the column tool is active AND the viewport is in 3D — the SAME
 * `activeTool === 'column'` the 2D pipeline uses, so the existing column FSM stays the
 * single source of truth. On click the screen point is projected onto the active floor
 * plane, converted to scene units, and handed to the 2D `useColumnTool.onCanvasClick`
 * via the `bim:place-column-3d` EventBus bridge — reusing the whole commit path.
 *
 * OSNAP (ADR-403 Phase 2): when snap is ON the floor point is resolved against the
 * shared snap-engine SSoT in plan mm (`resolvePlacementSnapWithView`) BEFORE the
 * conversion, so the ghost — and the committed point — "click" onto the nearest
 * corner/endpoint/midpoint, with a 3D snap glyph shown on the target. The SAME snap runs
 * on move and on click, so ghost == commit (WYSIWYG).
 */

import { EventBus } from '../../systems/events/EventBus';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import type { ToolType } from '../../ui/toolbar/types';
import { type SceneUnits } from '../../utils/scene-units';
import { PLACEMENT_GHOST_3D_FACTORIES } from './placement-ghost-3d-contracts';
import { raycastFloorPoint, resolveActiveFloorElevationMm } from './raycast-floor-point';
import { worldToPlanMm, planMmToScenePoint } from './world-to-scene-point';
import { resolvePlacementSnapWithView } from './placement-snap';
// ADR-544 — ίδιο 2D meta (πλέγμα/διαστάσεις/οδηγοί) στο 3D μέσω του ΕΝΟΣ `generateColumnPreview`.
import { generateColumnPreview } from '../../hooks/drawing/column-preview-helpers';
import { extractPlacement3DMeta } from './placement-overlay-meta';
import { usePlacement3DOverlayStore } from '../stores/Placement3DOverlayStore';
// ADR-544 — ίδιο OSNAP glyph+label («Γωνία κολόνας») με το 2D, μέσω του κοινού ADR-542 overlay.
import { useSnap3DOverlayStore } from '../stores/Snap3DOverlayStore';
import type { SnapIndicatorView } from '../../snapping/extended-types';
import {
  usePlacementInteractionEffect,
  type PlacementInteractionContext,
  type PlacementInteractionController,
} from './use-placement-interaction-effect';
import type { UseBim3DPointPlacementParams } from './create-bim3d-point-placement-hook';

/** The column tool arms this 3D placement. */
const COLUMN_TOOLS: readonly ToolType[] = ['column'];

export type UseBim3DColumnPlacementParams = UseBim3DPointPlacementParams;

export function useBim3DColumnPlacement({ managerRef, canvasEl }: UseBim3DColumnPlacementParams): void {
  usePlacementInteractionEffect({
    managerRef,
    canvasEl,
    tools: COLUMN_TOOLS,
    createController: ({ manager, canvasEl: el }: PlacementInteractionContext): PlacementInteractionController => {
      const ghost = PLACEMENT_GHOST_3D_FACTORIES.column(manager.scene);

      // ADR-544 — καθάρισε ΟΛΟ το placement feedback (meta πλέγματος/διαστάσεων + OSNAP glyph).
      // Αυτό το hook είναι ο μοναδικός κάτοχος του snap glyph όσο το εργαλείο κολόνας είναι ενεργό.
      const clearOverlay = (): void => {
        usePlacement3DOverlayStore.getState().setMeta(null);
        useSnap3DOverlayStore.getState().setSnap(null);
      };

      const unitsNow = (): SceneUnits => columnToolBridgeStore.get()?.getSceneUnits() ?? 'mm';

      /**
       * Project a screen point to the active-floor plan point in **mm**, then apply OSNAP.
       * Returns the (possibly snapped) plan-mm point plus the marker view, or `null` when
       * the ray misses the floor. The SAME resolution feeds both the ghost (onMove) and
       * the commit (onCommit), so they cannot disagree (WYSIWYG).
       */
      const resolveFloorPlanMm = (
        clientX: number,
        clientY: number,
        elev: number,
      ): { planMm: { x: number; y: number }; view: SnapIndicatorView | null } | null => {
        const world = raycastFloorPoint(manager.getCamera(), el, clientX, clientY, elev);
        if (!world) return null;
        const rawMm = worldToPlanMm(world);
        // ADR-544 — ΜΙΑ engine query → snapped θέση + OSNAP view (glyph «Γωνία κολόνας»).
        const snap = resolvePlacementSnapWithView(rawMm);
        return snap ? { planMm: snap.snappedMm, view: snap.view } : { planMm: rawMm, view: null };
      };

      return {
        onMove: (e: PointerEvent): void => {
          const elev = resolveActiveFloorElevationMm();
          const hit = resolveFloorPlanMm(e.clientX, e.clientY, elev);
          if (!hit) {
            ghost.setVisible(false);
            clearOverlay();
            manager.markSceneDirty();
            return;
          }
          const units = unitsNow();
          const scenePt = planMmToScenePoint(hit.planMm, units);
          const levelId = useBim3DEntitiesStore.getState().activeLevelId ?? undefined;
          ghost.update(scenePt, elev, levelId);
          ghost.setVisible(true);
          // ADR-544/542 — ΙΔΙΟ OSNAP glyph+label με το 2D στο σημείο έλξης. `null` view = grid/no-snap.
          useSnap3DOverlayStore.getState().setSnap(hit.view ? { view: hit.view, elevMm: elev } : null);
          // ADR-544 — ΙΔΙΟ 2D placement feedback στο 3D: το ΕΝΑ `generateColumnPreview` με τον ΗΔΗ-snapped
          // 3D cursor παράγει πλέγμα/διαστάσεις στο σωστό σημείο.
          const preview = generateColumnPreview(scenePt, units, scenePt);
          usePlacement3DOverlayStore.getState().setMeta(extractPlacement3DMeta(preview, scenePt, elev, units));
          manager.markSceneDirty();
        },
        hideFeedback: (): void => {
          ghost.setVisible(false);
          clearOverlay();
          manager.markSceneDirty();
        },
        onCommit: (e: MouseEvent): void => {
          const elev = resolveActiveFloorElevationMm();
          const hit = resolveFloorPlanMm(e.clientX, e.clientY, elev);
          if (!hit) return;
          // Block the 3D selection handler underneath (React onClick on the overlay).
          e.preventDefault();
          e.stopPropagation();
          // SAME snapped point the ghost previewed → ghost == commit (WYSIWYG).
          EventBus.emit('bim:place-column-3d', { point: planMmToScenePoint(hit.planMm, unitsNow()) });
        },
        dispose: (): void => {
          ghost.dispose();
        },
      };
    },
  });
}
