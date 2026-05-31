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
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { BimGizmoOverlay, activeHandlesFor } from '../gizmo/bim-gizmo-overlay';
import { BimGizmoController } from '../gizmo/bim-gizmo-controller';
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
  onEditPointerDown,
  onEditPointerMove,
  onEditPointerUp,
  onEditPointerCancel,
  onEditWheel,
  type EditInteractionCtx,
} from './bim3d-edit-interaction-handlers';

export interface UseBim3DEditInteractionParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

export function useBim3DEditInteraction({ managerRef, canvasEl }: UseBim3DEditInteractionParams): void {
  const levels = useLevelsOptional();
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const overlay = new BimGizmoOverlay(manager.scene);
    const controller = new BimGizmoController(overlay);
    const ctx: EditInteractionCtx = {
      manager, canvasEl, overlay, controller,
      getLevels: () => levelsRef.current,
    };
    let activeAbort: AbortController | null = null;

    const teardownListeners = (): void => {
      activeAbort?.abort();
      activeAbort = null;
      if (controller.isDragging()) {
        controller.cancelDrag();
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
      canvasEl.addEventListener('wheel', () => onEditWheel(ctx), { signal, passive: true });
    };

    const applyActiveState = (): void => {
      const st = useBim3DEditStore.getState();
      const active = st.editToolActive && st.editEntityIds.length > 0;
      if (active && !levelsRef.current) {
        useBim3DEditStore.getState().deactivate(); // ADR-371 read-only — editing disabled
        return;
      }
      if (active) {
        const ok = computeEditAnchor(ctx, st.editEntityIds);
        // Multi-select: editBimType is null → only move + rotate handles (no resize).
        overlay.setActiveHandles(activeHandlesFor(st.editBimType));
        overlay.setVisible(ok);
        if (ok) setupListeners();
        else teardownListeners();
      } else {
        overlay.setVisible(false);
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
      if (controller.isDragging()) return;
      const st = useBim3DEditStore.getState();
      if (!st.editToolActive || st.editEntityIds.length === 0) return;
      overlay.setVisible(computeEditAnchor(ctx, st.editEntityIds));
      manager.markSceneDirty();
    });

    return () => {
      unsubActive();
      unsubEntity();
      unsubSelection();
      unsubEntities();
      teardownListeners();
      overlay.dispose();
    };
  }, [canvasEl, managerRef]);
}
