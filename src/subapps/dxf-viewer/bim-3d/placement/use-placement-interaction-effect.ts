'use client';

/**
 * ADR-618 — usePlacementInteractionEffect SSoT primitive.
 *
 * Every 3D placement hook (`create-bim3d-point-placement-hook` factory + the bespoke
 * column / wall / mep-segment hooks) carried a byte-identical copy of the SAME
 * interaction skeleton: one `useEffect` gated on `canvasEl` + `managerRef`, an
 * `AbortController`-scoped set of canvas DOM listeners, the orbit-drag click guard, the
 * ref-counted placement cursor, the "armed only while tool active AND viewport is 3D"
 * FSM (`toolStateStore` + `useViewMode3DStore` subscriptions), and the balanced
 * setup/teardown/dispose lifecycle — no `useSyncExternalStore` (store reads at event
 * time, ADR-040). This primitive is that single source; each hook supplies ONLY a
 * per-effect {@link PlacementInteractionController} (owns its ghost + snap/tracking
 * feedback + commit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-618-bim3d-placement-ssot.md
 * @see ./create-bim3d-point-placement-hook.ts — the high-level factory built on this
 */

import { useEffect, type MutableRefObject } from 'react';
import { toolStateStore } from '../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import type { ToolType } from '../../ui/toolbar/types';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { acquirePlacementCursor, releasePlacementCursor } from './placement-cursor';

/** A click whose pointer moved more than this (px) since pointerdown was an orbit drag,
 *  not a placement — skip it (avoids accidental commits while rotating the view). */
export const ORBIT_DRAG_PX = 5;

/** The live scene bindings handed to a controller once the canvas + manager exist. */
export interface PlacementInteractionContext {
  readonly manager: ThreeJsSceneManager;
  readonly canvasEl: HTMLCanvasElement;
  /**
   * The cursor-owning element — the `role="application"` overlay that carries the
   * Tailwind `cursor-grab`, NOT the renderer `<canvas>` underneath it (ADR-406). Setting
   * the placement cursor on this exact element beats the class.
   */
  readonly cursorEl: HTMLElement;
}

/** The per-effect strategy: ghost + feedback + commit for one placement domain. */
export interface PlacementInteractionController {
  /** Pointer moved over the canvas — update the ghost + snap/tracking feedback. */
  onMove(e: PointerEvent): void;
  /**
   * Hide the ghost + all feedback and mark the scene dirty. Called on `pointerleave`
   * AND on disarm/teardown (must be idempotent). Owns its own `markSceneDirty`.
   */
  hideFeedback(): void;
  /** A committing click (already past the orbit-drag guard) — emit the place event. */
  onCommit(e: MouseEvent): void;
  /** Effect cleanup — dispose the ghost + snap marker + any overlay handles. */
  dispose(): void;
}

export interface PlacementInteractionConfig {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
  /** Tool id(s) that arm this placement (armed only while one is active AND 3D). */
  readonly tools: readonly ToolType[];
  /** Build the per-effect controller once the canvas + manager exist. */
  createController(ctx: PlacementInteractionContext): PlacementInteractionController;
}

/**
 * Run the shared placement interaction lifecycle for a hook. The returned effect arms
 * the canvas listeners only while one of `tools` is the active tool AND the viewport is
 * in 3D — the SAME `activeTool` the 2D pipeline uses, so the per-tool FSM stays the
 * single source of truth.
 */
export function usePlacementInteractionEffect(config: PlacementInteractionConfig): void {
  const { managerRef, canvasEl, tools, createController } = config;

  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    // The visible cursor is owned by the viewport interaction surface, NOT the renderer
    // <canvas> underneath it (ADR-406 fixture lesson).
    const cursorEl = (canvasEl.closest('[role="application"]') as HTMLElement | null) ?? canvasEl;
    const controller = createController({ manager, canvasEl, cursorEl });

    let abort: AbortController | null = null;
    let downPos: { x: number; y: number } | null = null;

    const onDown = (e: PointerEvent): void => {
      if (e.button === 0) downPos = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent): void => {
      const moved = downPos ? Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) : 0;
      downPos = null;
      if (moved > ORBIT_DRAG_PX) return; // orbit drag, not a placement
      controller.onCommit(e);
    };

    const onLeave = (): void => controller.hideFeedback();

    const setup = (): void => {
      if (abort) return;
      // Industry standard (Revit / AutoCAD): arming a placement tool clears the current
      // selection so the edit gizmo on a previously-selected entity tears down. Only ONE
      // mode is ever active — edit-selected OR place-new, never both.
      useSelection3DStore.getState().clearSelection();
      abort = new AbortController();
      const { signal } = abort;
      canvasEl.addEventListener('pointermove', controller.onMove, { signal });
      canvasEl.addEventListener('pointerleave', onLeave, { signal });
      canvasEl.addEventListener('pointerdown', onDown, { signal });
      canvasEl.addEventListener('click', onClick, { signal });
      // Ref-counted so a sibling placement hook's teardown can't reset the cursor while
      // this tool is still armed (order-independent — placement-cursor.ts).
      acquirePlacementCursor(cursorEl);
    };

    const teardown = (): void => {
      const wasActive = abort !== null;
      abort?.abort();
      abort = null;
      downPos = null;
      controller.hideFeedback();
      // Release the placement cursor ONLY if we held it (balanced acquire/release).
      if (wasActive) releasePlacementCursor(cursorEl);
    };

    const apply = (): void => {
      const active =
        tools.includes(toolStateStore.get().activeTool) && selectIs3D(useViewMode3DStore.getState());
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
      controller.dispose();
    };
    // `tools` + `createController` are stable per placement domain (module-const config /
    // event-time store reads) — the effect re-arms only when the canvas or manager change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEl, managerRef]);
}
