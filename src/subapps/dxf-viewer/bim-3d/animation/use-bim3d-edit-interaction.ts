'use client';

/**
 * ADR-402 Phase 1 §Sub-Phase 2 — useBim3DEditInteraction hook.
 *
 * React glue between the 3D canvas and the BIM move gizmo. Owns the gizmo
 * renderer (`Bim3DEditMoveHandle`, added to the live scene) + the pure
 * `Bim3DEditDragController`, wires AbortController-gated pointer listeners, and
 * on pointerup commits ONE view-agnostic `MoveEntityCommand` — the same command
 * the 2D ribbon/grips use, so the 3D scene re-syncs automatically and hosted
 * openings cascade for free (the cascade lives inside the command).
 *
 * Why a single commit on release (not per-move): the command merge window sums
 * deltas, so per-move incremental dispatch double-counts. Committing once with
 * the total delta + `isDragging=false` mirrors the 2D drag-move SSoT and yields
 * exactly one clean undo step. The gizmo follows the cursor during the drag for
 * live feedback; the element snaps to the committed position on release.
 *
 * ADR-040: one `useEffect` + AbortController, no `useSyncExternalStore` (store
 * reads happen at event time). ADR-371: disabled when there is no levels context.
 * Pointer-handler bodies live in `bim3d-edit-interaction-handlers.ts`.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import { Vector3 } from 'three';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { Bim3DEditDragController } from './bim3d-edit-drag-controller';
import { Bim3DEditMoveHandle } from './Bim3DEditMoveHandle';
import {
  useBim3DEditStore,
  selectEditToolActive,
  selectEditEntityId,
  selectEditAxisLock,
} from '../stores/Bim3DEditStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import {
  computeEditAnchor,
  onEditPointerDown,
  onEditPointerMove,
  onEditPointerUp,
  onEditPointerCancel,
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

    const handle = new Bim3DEditMoveHandle(manager.scene);
    const controller = new Bim3DEditDragController();
    const ctx: EditInteractionCtx = {
      manager, canvasEl, handle, controller,
      anchor: new Vector3(),
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
    };

    const applyActiveState = (): void => {
      const st = useBim3DEditStore.getState();
      const active = st.editToolActive && st.editMode === 'move' && !!st.editEntityId;
      if (active && !levelsRef.current) {
        useBim3DEditStore.getState().deactivate(); // ADR-371 read-only — editing disabled
        return;
      }
      if (active && st.editEntityId) {
        const ok = computeEditAnchor(ctx, st.editEntityId);
        handle.setVisible(ok);
        handle.setAxisLockVisual(st.axisLock);
        if (ok) setupListeners();
        else teardownListeners();
      } else {
        handle.setVisible(false);
        teardownListeners();
      }
      manager.markSceneDirty();
    };

    applyActiveState();
    const unsubActive = useBim3DEditStore.subscribe(selectEditToolActive, applyActiveState);
    const unsubEntity = useBim3DEditStore.subscribe(selectEditEntityId, applyActiveState);
    const unsubAxis = useBim3DEditStore.subscribe(selectEditAxisLock, (axis) => {
      handle.setAxisLockVisual(axis);
      manager.markSceneDirty();
    });
    // Re-anchor the gizmo after auto-resync (move commit OR a panel param edit),
    // but never while the user is mid-drag.
    const unsubEntities = useBim3DEntitiesStore.subscribe(() => {
      if (controller.isDragging()) return;
      const st = useBim3DEditStore.getState();
      if (!st.editToolActive || !st.editEntityId) return;
      handle.setVisible(computeEditAnchor(ctx, st.editEntityId));
      manager.markSceneDirty();
    });

    return () => {
      unsubActive();
      unsubEntity();
      unsubAxis();
      unsubEntities();
      teardownListeners();
      handle.dispose();
    };
  }, [canvasEl, managerRef]);
}
