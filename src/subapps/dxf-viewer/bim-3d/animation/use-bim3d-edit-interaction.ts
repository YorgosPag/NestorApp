'use client';

/**
 * ADR-402 (3D Viewport BIM Element Editing) — useBim3DEditInteraction hook.
 *
 * React glue between the 3D canvas and the GenArc-port BIM gizmo (Phase A). Owns
 * the gizmo overlay (`BimGizmoOverlay`, added to the live scene) + the pure
 * `BimGizmoController`, wires AbortController-gated pointer listeners, and on
 * pointerup commits ONE view-agnostic command (`MoveEntityCommand` /
 * `RotateEntityCommand`) — the same commands the 2D ribbon/grips use, so the 3D
 * scene re-syncs automatically and hosted openings cascade for free.
 *
 * Auto-on-selection (Revit / Cinema-4D style): selecting a BIM entity in the 3D
 * viewport mounts the gizmo automatically (no key). The `G` shortcut stays as a
 * toggle; Escape / deselection tears it down.
 *
 * ADR-040: one `useEffect` + AbortController, no `useSyncExternalStore` (store
 * reads happen at event time). ADR-371: disabled when there is no levels context.
 * Pointer-handler bodies live in `bim3d-edit-interaction-handlers.ts`.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { BimGizmoOverlay, activeHandlesFor } from '../gizmo/bim-gizmo-overlay';
import { BimGizmoController } from '../gizmo/bim-gizmo-controller';
// ADR-535 — 3D per-vertex reshape grips (slab footprint), coexists with the gizmo.
// Φ5 — the grips are a Canvas2D overlay driven by `Grip3DOverlayStore` (no scene meshes).
import { BimGripController3D } from '../grips/bim-grip-controller-3d';
// ADR-516 — input prediction (latency compensation) for the gizmo-move drag.
import { createPointerPredictor } from '../gizmo/pointer-prediction';
import { DXF_TIMING } from '../../config/dxf-timing';
import { useGrip3DOverlayStore } from '../stores/Grip3DOverlayStore';
import { Bim3DEditLivePreview } from './bim3d-edit-live-preview';
import { TempWallMoveDimOverlay } from '../placement/TempWallMoveDimOverlay';
import { TempAlignmentLineOverlay } from '../placement/TempAlignmentLineOverlay';
import { TempSnapLabelOverlay } from '../placement/TempSnapLabelOverlay';
// ADR-363 — live move-distance readout (line base→current + distance label) for any drag.
import { TempMoveReadoutOverlay } from '../placement/TempMoveReadoutOverlay';
// ADR-363 Φ1G.5 Slice 2i — snap description/type → i18n label key (SSoT shared with 2D indicator).
import { resolveSnapLabelText } from '../../snapping/snap-description-keys';
import type { ExtendedSnapType } from '../../snapping/extended-types';
import {
  useBim3DEditStore,
  selectEditToolActive,
  selectEditEntityKey,
} from '../stores/Bim3DEditStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import {
  computeEditAnchor,
  refreshLinearEndpointHandles,
  onEditPointerDown,
  onEditPointerMove,
  onEditPointerUp,
  onEditPointerCancel,
  onEditContextMenu,
  onEditWheel,
  type EditInteractionCtx,
} from './bim3d-edit-interaction-handlers';
// ADR-535 — reshape-grip (re)seat on selection / auto-resync (extracted, file-size N.7.1).
import { refreshReshapeGrips } from './bim3d-grip-drag';

export interface UseBim3DEditInteractionParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

export function useBim3DEditInteraction({ managerRef, canvasEl }: UseBim3DEditInteractionParams): void {
  const levels = useLevelsOptional();
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  // ADR-363 Φ1G.5 Slice 2i — `t` via ref so it stays current without re-running the
  // listener effect on every language change (mirror of `levelsRef`).
  const { t } = useTranslation('dxf-viewer-shell');
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const overlay = new BimGizmoOverlay(manager.scene);
    const controller = new BimGizmoController(overlay);
    // ADR-535 Φ5 — 3D reshape-grip FSM (screen-space). The grips render on the Canvas2D
    // `BimGripOverlay2D` leaf (mounted in BimViewport3D) from the `Grip3DOverlayStore`.
    const gripController = new BimGripController3D();
    // ADR-516 — one predictor per interaction session; reset at each drag begin.
    const pointerPredictor = createPointerPredictor(DXF_TIMING.prediction);
    const preview = new Bim3DEditLivePreview();
    // ADR-363 Φ1G.5 Slice 2h — transient temp-dimensions overlay for a dragged wall.
    const wallMoveDim = new TempWallMoveDimOverlay(manager.scene);
    // ADR-363 Φ1G.5 Slice 2i — transient dashed alignment line + snap-type label for face magnetism.
    const alignmentLine = new TempAlignmentLineOverlay(manager.scene);
    const snapLabel = new TempSnapLabelOverlay(manager.scene);
    // ADR-363 — transient move-distance readout for ANY dragged entity (line + distance label).
    const moveReadout = new TempMoveReadoutOverlay(manager.scene);
    const resolveSnapLabel = (type?: string, description?: string): string => {
      if (!type && !description) return '';
      // ADR-370: composition-aware (BIM characteristic-point «Γωνία/Μέσο/Κέντρο X» labels).
      return resolveSnapLabelText(tRef.current, (type ?? '') as ExtendedSnapType, description);
    };
    const ctx: EditInteractionCtx = {
      manager, canvasEl, overlay, controller, gripController, pointerPredictor, preview,
      wallMoveDim, alignmentLine, snapLabel, moveReadout, resolveSnapLabel,
      getLevels: () => levelsRef.current,
    };
    let activeAbort: AbortController | null = null;

    const teardownListeners = (): void => {
      activeAbort?.abort();
      activeAbort = null;
      wallMoveDim.hide(); // ADR-363 Φ1G.5 Slice 2h — drop transient dims when listeners go.
      alignmentLine.hide(); // ADR-363 Φ1G.5 Slice 2i — drop the alignment line too.
      snapLabel.hide(); // …and the snap-type label.
      moveReadout.hide(); // ADR-363 — and the move-distance readout.
      if (controller.isDragging()) {
        controller.cancelDrag();
        preview.reset(); // ADR-402 — abort mid-drag: restore the live-preview meshes.
        manager.viewport.setControlsEnabled(true);
      }
    };

    const setupListeners = (): void => {
      if (activeAbort) return;
      activeAbort = new AbortController();
      const { signal } = activeAbort;
      canvasEl.addEventListener('pointerdown', (e) => onEditPointerDown(ctx, e), { signal });
      canvasEl.addEventListener('pointermove', (e) => onEditPointerMove(ctx, e), { signal });
      canvasEl.addEventListener('pointerup', (e) => onEditPointerUp(ctx, e), { signal });
      canvasEl.addEventListener('pointercancel', () => onEditPointerCancel(ctx), { signal });
      // ADR-535 Φ4 — right-click a reshape grip → per-vertex context menu (delete/insert).
      canvasEl.addEventListener('contextmenu', (e) => onEditContextMenu(ctx, e), { signal });
      canvasEl.addEventListener('wheel', () => onEditWheel(ctx), { signal, passive: true });
    };

    const applyActiveState = (): void => {
      const st = useBim3DEditStore.getState();
      const active = st.editToolActive && st.editEntityIds.length > 0;
      if (active && !levelsRef.current) {
        useBim3DEditStore.getState().deactivate(); // ADR-371 read-only — editing disabled
        return;
      }
      // ADR-363 Φ1G.5 Slice 2d — a hosted opening (door/window) does NOT use the generic
      // gizmo: its grab-mesh-slide preview spawns a confusing floating cube and never
      // moves the wall void live. The dedicated `useBim3DOpeningMove` drag (live ghost +
      // host-aware re-host) owns it instead. Suppress the gizmo for a single opening.
      if (active && st.editBimType === 'opening' && st.editEntityIds.length === 1) {
        overlay.setVisible(false);
        useGrip3DOverlayStore.getState().clear(); // ADR-535 — no reshape grips for a hosted opening.
        teardownListeners();
        manager.markSceneDirty();
        return;
      }
      if (active) {
        const ok = computeEditAnchor(ctx, st.editEntityIds);
        // Multi-select: editBimType is null → only move + rotate handles (no resize).
        overlay.setActiveHandles(activeHandlesFor(st.editBimType));
        // ADR-408 Φ-D/Φ1 — single-select linear element: place the endpoint shape handles.
        refreshLinearEndpointHandles(ctx, st.editEntityIds, st.editBimType);
        overlay.setVisible(ok);
        if (ok) {
          setupListeners();
          // ADR-535 — single-select slab → per-vertex reshape grips (cleared otherwise).
          refreshReshapeGrips(ctx, st.editEntityIds, st.editBimType);
        } else {
          teardownListeners();
          useGrip3DOverlayStore.getState().clear();
        }
      } else {
        overlay.setVisible(false);
        useGrip3DOverlayStore.getState().clear(); // ADR-535 — deselected → drop reshape grips.
        teardownListeners();
      }
      manager.markSceneDirty();
    };

    // Auto-on-selection: a 3D BIM selection mounts the gizmo; deselection tears it
    // down. ADR-402 Phase C — the gizmo anchors on the union centroid of the whole
    // multi-selection; editBimType is null for >1 (suppresses resize handles).
    const syncFromSelection = (): void => {
      const sel = useSelection3DStore.getState();
      const edit = useBim3DEditStore.getState();
      if (sel.selectedBimIds.length > 0 && levelsRef.current) {
        if (edit.editEntityIds.join('|') !== sel.selectedBimIds.join('|')) {
          const type = sel.selectedBimIds.length === 1 ? sel.selectedBimType : null;
          edit.activateMove([...sel.selectedBimIds], type);
        }
      } else if (edit.editToolActive) {
        edit.deactivate();
      }
    };

    syncFromSelection();
    applyActiveState();

    const unsubActive = useBim3DEditStore.subscribe(selectEditToolActive, applyActiveState);
    const unsubEntity = useBim3DEditStore.subscribe(selectEditEntityKey, applyActiveState);
    const unsubSelection = useSelection3DStore.subscribe(syncFromSelection);

    // Re-anchor the gizmo after auto-resync (move/rotate commit OR a panel param
    // edit), but never while the user is mid-drag.
    const unsubEntities = useBim3DEntitiesStore.subscribe(() => {
      // ADR-535 — a live grip drag owns the meshes; never re-seat mid-reshape.
      if (controller.isDragging() || gripController.isDragging()) return;
      const st = useBim3DEditStore.getState();
      if (!st.editToolActive || st.editEntityIds.length === 0) return;
      // ADR-363 Φ1G.5 Slice 2d — keep the gizmo suppressed for a single hosted opening
      // across a re-sync (the dedicated drag owns it); otherwise the commit's resync
      // would re-show the confusing cube.
      if (st.editBimType === 'opening' && st.editEntityIds.length === 1) {
        overlay.setVisible(false);
        useGrip3DOverlayStore.getState().clear();
        manager.markSceneDirty();
        return;
      }
      overlay.setVisible(computeEditAnchor(ctx, st.editEntityIds));
      // ADR-408 Φ-D/Φ1 — keep the endpoint handles on the element ends after a resync.
      refreshLinearEndpointHandles(ctx, st.editEntityIds, st.editBimType);
      // ADR-535 — re-seat the reshape grips on the new footprint (vertex insert changes count).
      refreshReshapeGrips(ctx, st.editEntityIds, st.editBimType);
      manager.markSceneDirty();
    });

    return () => {
      unsubActive();
      unsubEntity();
      unsubSelection();
      unsubEntities();
      teardownListeners();
      preview.dispose(); // ADR-550 — free the original-stays-as-ghost overlay.
      overlay.dispose();
      useGrip3DOverlayStore.getState().clear(); // ADR-535 Φ5 — drop the reshape-grip overlay state.
      wallMoveDim.dispose();
      alignmentLine.dispose();
      snapLabel.dispose();
      moveReadout.dispose();
    };
  }, [canvasEl, managerRef]);
}
