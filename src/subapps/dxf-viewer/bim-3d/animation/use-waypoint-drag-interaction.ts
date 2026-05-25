'use client';

/**
 * ADR-366 §C.1.b — useWaypointDragInteraction hook.
 *
 * React glue between the React canvas + the pure `WaypointDragController`.
 * Wires DOM pointer events on the renderer canvas, drives the controller
 * FSM, and pipes drag results into `AnimationStore.updateWaypoint`.
 *
 * Lifecycle:
 *  - Mounts DOM listeners ONLY when `AnimationStore.toolActive === true`
 *    AND `canvasEl` + scene manager are both ready.
 *  - Listeners are removed via AbortController on tool deactivation or
 *    component unmount — never leaks across mount/unmount cycles.
 *  - During drag, hover state is suspended (controller already gates).
 *
 * Single-writer SSoT: only this hook writes drag results to AnimationStore.
 * TimelineEditor form fields remain the primary path for keyboard edits.
 */

import { useEffect, type MutableRefObject } from 'react';
import { useAnimationStore } from './AnimationStore';
import {
  WaypointDragController,
  type DragControllerEvents,
} from './waypoint-drag-controller';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import type { WaypointHandleRole } from './WaypointDragHandle';

export interface UseWaypointDragInteractionParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

export function useWaypointDragInteraction(params: UseWaypointDragInteractionParams): void {
  const { managerRef, canvasEl } = params;

  useEffect(() => {
    if (!canvasEl) return;

    const controller = new WaypointDragController();

    let activeAbort: AbortController | null = null;

    const teardownListeners = (): void => {
      activeAbort?.abort();
      activeAbort = null;
      controller.cancelDrag(makeEvents(managerRef));
    };

    const setupListeners = (): void => {
      if (activeAbort) return;
      const ac = new AbortController();
      activeAbort = ac;
      const { signal } = ac;
      const events = makeEvents(managerRef);

      canvasEl.addEventListener('pointermove', (e) => onPointerMove(e, controller, managerRef, events), { signal });
      canvasEl.addEventListener('pointerdown', (e) => onPointerDown(e, controller, managerRef, events), { signal });
      canvasEl.addEventListener('pointerup', (e) => onPointerUp(e, controller, events, canvasEl), { signal });
      canvasEl.addEventListener('pointercancel', () => onPointerCancel(controller, events, canvasEl), { signal });
      canvasEl.addEventListener('pointerleave', () => onPointerLeave(controller, events), { signal });
    };

    const syncFromStore = (): void => {
      const active = useAnimationStore.getState().toolActive;
      if (active) setupListeners();
      else teardownListeners();
    };

    syncFromStore();
    const unsub = useAnimationStore.subscribe(
      (s) => s.toolActive,
      syncFromStore,
    );

    return () => {
      unsub();
      teardownListeners();
    };
  }, [canvasEl, managerRef]);
}

// ──────────────────────────────────────────────────────────────────────────────
// Event handlers
// ──────────────────────────────────────────────────────────────────────────────

function onPointerMove(
  event: PointerEvent,
  controller: WaypointDragController,
  managerRef: MutableRefObject<ThreeJsSceneManager | null>,
  events: DragControllerEvents,
): void {
  const manager = managerRef.current;
  if (!manager) return;

  if (controller.getState() === 'dragging') {
    controller.updateDrag(manager.getCamera(), manager.getRendererCanvas(), event.clientX, event.clientY, events);
    return;
  }

  const handlesGroup = manager.getWaypointHandlesRoot();
  if (!handlesGroup) {
    controller.handleHover(null, events);
    return;
  }
  const pick = controller.pick(handlesGroup, manager.getCamera(), manager.getRendererCanvas(), event.clientX, event.clientY);
  controller.handleHover(pick?.role ?? null, events);
}

function onPointerDown(
  event: PointerEvent,
  controller: WaypointDragController,
  managerRef: MutableRefObject<ThreeJsSceneManager | null>,
  events: DragControllerEvents,
): void {
  if (event.button !== 0) return; // primary button only
  const manager = managerRef.current;
  if (!manager) return;
  const handlesGroup = manager.getWaypointHandlesRoot();
  if (!handlesGroup) return;

  const pick = controller.pick(handlesGroup, manager.getCamera(), manager.getRendererCanvas(), event.clientX, event.clientY);
  if (!pick) return;

  event.preventDefault();
  event.stopPropagation();
  (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
  controller.startDrag(pick.role, pick.worldPos, manager.getCamera(), events);
}

function onPointerUp(
  event: PointerEvent,
  controller: WaypointDragController,
  events: DragControllerEvents,
  canvasEl: HTMLCanvasElement,
): void {
  if (controller.getState() !== 'dragging') return;
  event.preventDefault();
  event.stopPropagation();
  canvasEl.releasePointerCapture?.(event.pointerId);
  controller.endDrag(events);
}

function onPointerCancel(
  controller: WaypointDragController,
  events: DragControllerEvents,
  canvasEl: HTMLCanvasElement,
): void {
  if (controller.getState() !== 'dragging') return;
  canvasEl.releasePointerCapture?.(0);
  controller.cancelDrag(events);
}

function onPointerLeave(
  controller: WaypointDragController,
  events: DragControllerEvents,
): void {
  if (controller.getState() === 'dragging') return;
  controller.handleHover(null, events);
}

// ──────────────────────────────────────────────────────────────────────────────
// Events factory — single source for controller → renderer + store bridges.
// ──────────────────────────────────────────────────────────────────────────────

function makeEvents(
  managerRef: MutableRefObject<ThreeJsSceneManager | null>,
): DragControllerEvents {
  return {
    onHoverChange: (role) => managerRef.current?.setWaypointHoverState(role),
    onDragStart: (role) => managerRef.current?.setWaypointHoverState(role),
    onDragMove: (role, worldPos) => writeWaypointPosition(role, worldPos),
    onDragEnd: () => managerRef.current?.setWaypointHoverState(null),
    onDragCancel: () => managerRef.current?.setWaypointHoverState(null),
  };
}

function writeWaypointPosition(
  role: WaypointHandleRole,
  worldPos: { x: number; y: number; z: number },
): void {
  const store = useAnimationStore.getState();
  const index = store.activeWaypointIndex;
  if (index === null) return;
  if (role === 'position') {
    store.updateWaypoint(index, {
      position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
    });
  } else {
    store.updateWaypoint(index, {
      target: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
    });
  }
}
