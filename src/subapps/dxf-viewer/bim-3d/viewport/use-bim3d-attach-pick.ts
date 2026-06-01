'use client';

/**
 * ADR-401 — useBim3DAttachPick: 3D viewport pick-host for the manual «Attach
 * Top/Base to structural» ribbon action (wall / column / stair).
 *
 * Mirrors `useBim3DColumnPlacement` (ADR-403): one `useEffect` + AbortController-
 * gated DOM listeners on the renderer canvas, no `useSyncExternalStore` (store
 * reads happen at event time, ADR-040). Armed only while a `*-attach-top/-base`
 * tool is active AND the viewport is in 3D.
 *
 * On click it raycasts the BIM meshes; if an entity is hit it emits its id via
 * `bim:attach-host-picked-3d`. The 2D `useWallAttachTool` (still mounted, holding
 * the captured target snapshot fed by the 3D↔2D selection bridge) validates the
 * host (beam/slab) and dispatches the existing Attach{Walls|Columns|Stairs}
 * command — reusing the whole commit + persist + 3D-resync path with zero
 * duplication. Mirror of the column `bim:place-column-3d` bridge.
 *
 * Unlike column placement, arming does NOT clear the selection: the selected
 * element(s) ARE the attach target(s). The click is always consumed in attach
 * mode (preventDefault + stopPropagation) so it never falls through to the 3D
 * selection handler underneath (which would replace the target).
 */

import { useEffect, type MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { toolStateStore } from '../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

/** The six manual attach tools (wall / column / stair × top / base). */
const ATTACH_PICK_TOOLS: ReadonlySet<string> = new Set<string>([
  'wall-attach-top', 'wall-attach-base',
  'column-attach-top', 'column-attach-base',
  'stair-attach-top', 'stair-attach-base',
]);

/** A click whose pointer moved more than this (px) since pointerdown was an
 *  orbit drag, not a pick — skip it. */
const ORBIT_DRAG_PX = 5;

export interface UseBim3DAttachPickParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

export function useBim3DAttachPick({ managerRef, canvasEl }: UseBim3DAttachPickParams): void {
  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    let abort: AbortController | null = null;
    let downPos: { x: number; y: number } | null = null;

    const onDown = (e: PointerEvent): void => {
      if (e.button === 0) downPos = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent): void => {
      const moved = downPos ? Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) : 0;
      downPos = null;
      if (moved > ORBIT_DRAG_PX) return; // orbit drag, not a pick
      const hit = manager.raycastBimEntities(e.clientX, e.clientY);
      // Always block the 3D selection handler underneath while in attach mode.
      e.preventDefault();
      e.stopPropagation();
      if (!hit?.bimId) return; // missed a host — stay armed
      EventBus.emit('bim:attach-host-picked-3d', { hostId: hit.bimId });
    };

    const setup = (): void => {
      if (abort) return;
      abort = new AbortController();
      const { signal } = abort;
      canvasEl.addEventListener('pointerdown', onDown, { signal });
      canvasEl.addEventListener('click', onClick, { signal });
      // Pick-mode cursor — signals "pick a host", not the orbit-grab hand.
      canvasEl.style.cursor = 'copy';
    };

    const teardown = (): void => {
      abort?.abort();
      abort = null;
      downPos = null;
      canvasEl.style.cursor = '';
    };

    const apply = (): void => {
      const active =
        ATTACH_PICK_TOOLS.has(toolStateStore.get().activeTool) &&
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
    };
  }, [canvasEl, managerRef]);
}
