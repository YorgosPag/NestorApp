'use client';

/**
 * ADR-363 «Δοκάρι από τοίχο» — useBim3DBeamFromWallPick: 3D viewport pick that
 * mirrors the 2D from-wall flow in three dimensions.
 *
 * Combines the two existing 3D-bridge patterns:
 *   - `useBim3DAttachPick` (ADR-401) — AbortController-gated DOM listeners on the
 *     renderer canvas, armed only while a specific tool is active AND the
 *     viewport is in 3D, raycast on click (no `useSyncExternalStore`, ADR-040).
 *   - `useBim3DColumnPlacement` (ADR-403) — a translucent WYSIWYG ghost that
 *     follows the pointer and previews exactly what the click will commit.
 *
 * Armed only while `activeTool === 'beam-from-wall'` AND `selectIs3D`. On pointer
 * move it raycasts the BIM meshes; a wall hit shows the `BeamFromWallGhost` on
 * that wall's axis. On click it emits `bim:beam-from-wall-picked-3d { wallId }`;
 * the 2D `useBeamTool` (still mounted) resolves the WallEntity and runs its
 * existing from-wall commit core (`buildBeamFromWall` + `onBeamCreated` → auto-
 * attaches the wall top, ADR-401 D) — reusing the whole commit + persist + 3D-
 * resync path with zero duplication. Mirror of the column `bim:place-column-3d`
 * bridge.
 *
 * The click is consumed in this mode (preventDefault + stopPropagation) so it
 * never falls through to the 3D selection handler underneath.
 */

import { useEffect, type MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { toolStateStore } from '../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import type { WallEntity } from '../../bim/types/wall-types';
import { PLACEMENT_GHOST_3D_FACTORIES } from '../placement/placement-ghost-3d-contracts';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

/** A click whose pointer moved more than this (px) since pointerdown was an
 *  orbit drag, not a pick — skip it. */
const ORBIT_DRAG_PX = 5;

export interface UseBim3DBeamFromWallPickParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

/** Resolve the hovered/clicked WallEntity from the live 3D store, or null. */
function resolveWallHit(manager: ThreeJsSceneManager, clientX: number, clientY: number): WallEntity | null {
  const hit = manager.raycastBimEntities(clientX, clientY);
  if (!hit || hit.bimType !== 'wall') return null;
  return useBim3DEntitiesStore.getState().walls.find((w) => w.id === hit.bimId) ?? null;
}

export function useBim3DBeamFromWallPick({ managerRef, canvasEl }: UseBim3DBeamFromWallPickParams): void {
  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const ghost = PLACEMENT_GHOST_3D_FACTORIES.beam(manager.scene);
    let abort: AbortController | null = null;
    let downPos: { x: number; y: number } | null = null;

    const onMove = (e: PointerEvent): void => {
      const wall = resolveWallHit(manager, e.clientX, e.clientY);
      if (wall) ghost.showForWall(wall);
      else ghost.hide();
      manager.markSceneDirty();
    };

    const onLeave = (): void => {
      ghost.hide();
      manager.markSceneDirty();
    };

    const onDown = (e: PointerEvent): void => {
      if (e.button === 0) downPos = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent): void => {
      const moved = downPos ? Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) : 0;
      downPos = null;
      if (moved > ORBIT_DRAG_PX) return; // orbit drag, not a pick
      const wall = resolveWallHit(manager, e.clientX, e.clientY);
      // Always block the 3D selection handler underneath while in pick mode.
      e.preventDefault();
      e.stopPropagation();
      if (!wall) return; // missed a wall — stay armed
      EventBus.emit('bim:beam-from-wall-picked-3d', { wallId: wall.id });
    };

    const setup = (): void => {
      if (abort) return;
      abort = new AbortController();
      const { signal } = abort;
      canvasEl.addEventListener('pointermove', onMove, { signal });
      canvasEl.addEventListener('pointerleave', onLeave, { signal });
      canvasEl.addEventListener('pointerdown', onDown, { signal });
      canvasEl.addEventListener('click', onClick, { signal });
      // Pick-mode cursor — signals "pick a wall", not the orbit-grab hand.
      canvasEl.style.cursor = 'copy';
    };

    const teardown = (): void => {
      abort?.abort();
      abort = null;
      downPos = null;
      ghost.hide();
      canvasEl.style.cursor = '';
      manager.markSceneDirty();
    };

    const apply = (): void => {
      const active =
        toolStateStore.get().activeTool === 'beam-from-wall' &&
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
