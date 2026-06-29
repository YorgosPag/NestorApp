'use client';

/**
 * ADR-403 (3D BIM Element Placement) — useBim3DColumnPlacement hook.
 *
 * React glue that lets the user place a BIM column directly on the 3D canvas.
 * Mirrors the `useBim3DEditInteraction` shape (ADR-402): one `useEffect` +
 * AbortController-gated DOM listeners on the renderer canvas, no
 * `useSyncExternalStore` (store reads happen at event time, ADR-040).
 *
 * Armed only while the column tool is active AND the viewport is in 3D — the
 * SAME `activeTool === 'column'` the 2D pipeline uses, so the existing column
 * FSM stays the single source of truth. On click the screen point is projected
 * onto the active floor plane, converted to the active scene units, and handed
 * to the 2D `useColumnTool.onCanvasClick` via the `bim:place-column-3d` EventBus
 * bridge — reusing the whole commit path (enterprise id, scene append, auto
 * 3D-resync, hosted-opening cascade) with zero duplication.
 *
 * OSNAP (ADR-403 Phase 2): when snap is ON the floor point is resolved against
 * the shared snap-engine SSoT in plan mm (`resolvePlacementSnap`) BEFORE the
 * conversion to scene units, so the ghost — and the committed point — "click"
 * onto the nearest corner/endpoint/midpoint of an existing element, with a 3D
 * snap marker shown on the target. The SAME snap runs on move and on click, so
 * ghost == commit (WYSIWYG); when snap misses (or is off) the raw point is used.
 */

import { useEffect, type MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { toolStateStore } from '../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { PLACEMENT_GHOST_3D_FACTORIES } from './placement-ghost-3d-contracts';
import { raycastFloorPoint, resolveActiveFloorElevationMm } from './raycast-floor-point';
import { worldToPlanMm, planMmToScenePoint } from './world-to-scene-point';
import { resolvePlacementSnapWithView } from './placement-snap';
import { acquirePlacementCursor, releasePlacementCursor } from './placement-cursor';
// ADR-544 — ίδιο 2D meta (πλέγμα/διαστάσεις/οδηγοί) στο 3D μέσω του ΕΝΟΣ `generateColumnPreview`.
import { generateColumnPreview } from '../../hooks/drawing/column-preview-helpers';
import { extractPlacement3DMeta } from './placement-overlay-meta';
import { usePlacement3DOverlayStore } from '../stores/Placement3DOverlayStore';
// ADR-544 — ίδιο OSNAP glyph+label («Γωνία κολόνας») με το 2D, μέσω του κοινού ADR-542 overlay.
import { useSnap3DOverlayStore } from '../stores/Snap3DOverlayStore';
import type { SnapIndicatorView } from '../../snapping/extended-types';

/** A click whose pointer moved more than this (px) since pointerdown was an
 *  orbit drag, not a placement — skip it (avoids accidental columns). */
const ORBIT_DRAG_PX = 5;

export interface UseBim3DColumnPlacementParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

export function useBim3DColumnPlacement({ managerRef, canvasEl }: UseBim3DColumnPlacementParams): void {
  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const ghost = PLACEMENT_GHOST_3D_FACTORIES.column(manager.scene);
    let abort: AbortController | null = null;
    let downPos: { x: number; y: number } | null = null;

    // ADR-544 — καθάρισε ΟΛΟ το placement feedback (meta πλέγματος/διαστάσεων + OSNAP glyph)
    // σε miss / leave / teardown. Αυτό το hook είναι ο μοναδικός κάτοχος του snap glyph όσο το
    // εργαλείο κολόνας είναι ενεργό (ο hover-handler `updateSnap3D` υποχωρεί — βλ. guard εκεί).
    const clearOverlay = (): void => {
      usePlacement3DOverlayStore.getState().setMeta(null);
      useSnap3DOverlayStore.getState().setSnap(null);
    };

    // The visible cursor is owned by the viewport interaction surface (the
    // `role="application"` overlay carries the Tailwind `cursor-grab`), NOT the
    // renderer <canvas> underneath it. Setting an inline cursor on that exact
    // element beats the class, so the placement crosshair actually shows.
    const cursorEl = (canvasEl.closest('[role="application"]') as HTMLElement | null) ?? canvasEl;

    const unitsNow = (): ReturnType<NonNullable<ReturnType<typeof columnToolBridgeStore.get>>['getSceneUnits']> =>
      columnToolBridgeStore.get()?.getSceneUnits() ?? 'mm';

    /**
     * Project a screen point to the active-floor plan point in **mm**, then apply
     * OSNAP. Returns the (possibly snapped) plan-mm point plus the marker target,
     * or `null` when the ray misses the floor. The SAME resolution feeds both the
     * ghost (onMove) and the commit (onClick), so they cannot disagree (WYSIWYG).
     */
    const resolveFloorPlanMm = (
      clientX: number,
      clientY: number,
      elev: number,
    ): { planMm: { x: number; y: number }; view: SnapIndicatorView | null } | null => {
      const world = raycastFloorPoint(manager.getCamera(), canvasEl, clientX, clientY, elev);
      if (!world) return null;
      const rawMm = worldToPlanMm(world);
      // ADR-544 — ΜΙΑ engine query → snapped θέση + OSNAP view (glyph «Γωνία κολόνας»). Ίδιος snap
      // engine με το 2D· το view δημοσιεύεται στο Snap3DOverlayStore για το κοινό ADR-542 overlay.
      const snap = resolvePlacementSnapWithView(rawMm);
      return snap
        ? { planMm: snap.snappedMm, view: snap.view }
        : { planMm: rawMm, view: null };
    };

    const onMove = (e: PointerEvent): void => {
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
      // ADR-544/542 — ΙΔΙΟ OSNAP glyph+label με το 2D (┘/▲/⊕ «Γωνία κολόνας») στο σημείο έλξης,
      // μέσω του κοινού Snap3DOverlayStore + BimSnapIndicatorOverlay3D. `null` view = grid/no-snap.
      useSnap3DOverlayStore.getState().setSnap(hit.view ? { view: hit.view, elevMm: elev } : null);
      // ADR-544 — ΙΔΙΟ 2D placement feedback στο 3D: το ΕΝΑ `generateColumnPreview` με τον ΗΔΗ-snapped
      // 3D cursor (override → ΟΧΙ stale 2D ImmediateSnap) παράγει πλέγμα/διαστάσεις στο σωστό σημείο.
      const preview = generateColumnPreview(scenePt, units, scenePt);
      usePlacement3DOverlayStore.getState().setMeta(extractPlacement3DMeta(preview, scenePt, elev, units));
      manager.markSceneDirty();
    };

    const onLeave = (): void => {
      ghost.setVisible(false);
      clearOverlay();
      manager.markSceneDirty();
    };

    const onDown = (e: PointerEvent): void => {
      if (e.button === 0) downPos = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent): void => {
      const moved = downPos ? Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) : 0;
      downPos = null;
      if (moved > ORBIT_DRAG_PX) return; // orbit drag, not a place
      const elev = resolveActiveFloorElevationMm();
      const hit = resolveFloorPlanMm(e.clientX, e.clientY, elev);
      if (!hit) return;
      // Block the 3D selection handler underneath (React onClick on the overlay).
      e.preventDefault();
      e.stopPropagation();
      // SAME snapped point the ghost previewed → ghost == commit (WYSIWYG).
      EventBus.emit('bim:place-column-3d', { point: planMmToScenePoint(hit.planMm, unitsNow()) });
    };

    const setup = (): void => {
      if (abort) return;
      // Industry standard (Revit / AutoCAD): arming a placement tool clears the
      // current selection, so the edit gizmo on a previously-selected entity
      // tears down (`useBim3DEditInteraction` reacts to Selection3DStore). Only
      // ONE mode is ever active — edit-selected OR place-new, never both.
      useSelection3DStore.getState().clearSelection();
      abort = new AbortController();
      const { signal } = abort;
      canvasEl.addEventListener('pointermove', onMove, { signal });
      canvasEl.addEventListener('pointerleave', onLeave, { signal });
      canvasEl.addEventListener('pointerdown', onDown, { signal });
      canvasEl.addEventListener('click', onClick, { signal });
      // Placement-mode cursor via the shared SSoT owner (mirrors the 2D DXF canvas
      // `crosshair`). Ref-counted so a sibling placement hook's teardown can't reset
      // the cursor while this tool is still armed (order-independent — placement-cursor.ts).
      acquirePlacementCursor(cursorEl);
    };

    const teardown = (): void => {
      const wasActive = abort !== null;
      abort?.abort();
      abort = null;
      downPos = null;
      ghost.setVisible(false);
      clearOverlay();
      // Release the placement cursor ONLY if we held it (balanced acquire/release).
      if (wasActive) releasePlacementCursor(cursorEl);
      manager.markSceneDirty();
    };

    const apply = (): void => {
      const active =
        toolStateStore.get().activeTool === 'column' &&
        selectIs3D(useViewMode3DStore.getState());
      if (active) setup();
      else teardown();
    };

    apply();
    const unsubTool = toolStateStore.subscribe(apply);
    const unsubView = useViewMode3DStore.subscribe(apply);

    return () => {
      unsubTool();
      unsubView();
      teardown();
      ghost.dispose();
    };
  }, [canvasEl, managerRef]);
}
