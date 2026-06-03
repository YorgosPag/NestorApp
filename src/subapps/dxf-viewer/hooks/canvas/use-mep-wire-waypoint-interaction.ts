'use client';

/**
 * ADR-408 Φ7 FU#3 — MEP wire waypoint interaction (React DOM glue).
 *
 * Makes the derived home-run wire of the **active** circuit directly editable
 * (Revit "Wire Vertex"), without turning the wire into a scene entity. Mirror of
 * the ADR-376 C.1 opening-tag drag: raw pointer listeners on the viewport element
 * (`{capture:true}` + `setPointerCapture`), a pure FSM controller, RAF-coalesced
 * optimistic updates, and an undoable command on release.
 *
 * Gestures (direct-manipulation, no mode/tool):
 *   - drag on a segment → insert a vertex at the projection and drag it;
 *   - drag on an existing vertex → move it;
 *   - right-click on a vertex → delete it (Revit "Delete Wire Vertex").
 *
 * SSoT: waypoints live on `MepSystemParams.wireWaypoints` and are persisted via
 * the generic `UpdateMepSystemParamsCommand`. During a drag the system is
 * optimistically upserted into `mep-system-store`, so the existing
 * `HomeRunWiresOverlay` leaf re-routes + repaints — no new render path.
 *
 * ADR-040: mounted inside a leaf, DOM listeners on the viewport only, zero
 * `useSyncExternalStore` in any orchestrator (CHECK 6C safe).
 *
 * @see ./use-opening-tag-drag-interaction.ts (sibling pattern)
 * @see ../../bim/mep-systems/mep-wire-waypoints.ts (orientation-aware editors)
 */

import { useEffect, useRef } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/entities';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useCommandHistory } from '../../core/commands';
import { UpdateMepSystemParamsCommand } from '../../core/commands/entity-commands/UpdateMepSystemParamsCommand';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../bim/mep-systems/mep-circuit-editor-store';
import type { MepSystemEntity, MepSystemParams } from '../../bim/types/mep-system-types';
import type { MepConnector } from '../../bim/types/mep-connector-types';
import {
  computeCircuitHostSegments,
  type CircuitHostSegment,
  type ResolveWireHost,
} from '../../bim/mep-systems/mep-wire-routing';
import { resolverFromHosts, type WireHostXform } from '../../bim/mep-systems/mep-wire-resolver';
import {
  hitTestWaypointNode,
  hitTestInsertion,
} from '../../bim/mep-systems/mep-wire-waypoint-hit';
import {
  deleteWaypointOriented,
  type WirePlanPoint,
} from '../../bim/mep-systems/mep-wire-waypoints';
import {
  applyWaypointGesture,
  type WaypointGesture,
} from '../../bim/mep-systems/mep-wire-waypoint-gesture';
import { MepWireWaypointDragController } from '../../bim/services/mep-wire-waypoint-drag-controller';
import { setWireWaypointHover } from '../../bim/mep-systems/mep-wire-waypoint-ui-store';

/** Pixel tolerance for grabbing an existing node (tight — must be on the dot). */
const NODE_TOL_PX = 8;
/** Pixel tolerance for hovering / inserting on a wire segment (generous, like
 * DXF entity hover — the whole line lights up well before pixel-perfect). */
const WIRE_TOL_PX = 14;

export interface UseMepWireWaypointInteractionParams {
  readonly transform: ViewTransform;
  readonly getViewportElement: () => HTMLElement | null;
  readonly getCurrentLevelId: () => string | null;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
}

interface ActiveContext {
  readonly system: MepSystemEntity;
  readonly segments: CircuitHostSegment[];
  readonly resolve: ResolveWireHost;
}

/** Collect host transforms (fixtures + panels) from the level scene. */
function collectHosts(scene: SceneModel): Map<string, WireHostXform> {
  const hosts = new Map<string, WireHostXform>();
  for (const e of scene.entities) {
    if (e.type !== 'mep-fixture' && e.type !== 'electrical-panel') continue;
    const params = e.params as {
      position: { x: number; y: number };
      rotation: number;
      connectors?: readonly MepConnector[];
    };
    hosts.set(e.id, {
      x: params.position.x,
      y: params.position.y,
      rotation: params.rotation,
      connectors: params.connectors ?? [],
    });
  }
  return hosts;
}

export function useMepWireWaypointInteraction(
  params: UseMepWireWaypointInteractionParams,
): void {
  const { transform, getViewportElement, getCurrentLevelId, getLevelScene } = params;
  const { execute: executeCommand } = useCommandHistory();

  // Refs mirror props so handlers see latest values without effect teardown.
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const executeRef = useRef(executeCommand);
  executeRef.current = executeCommand;
  const getCurrentLevelIdRef = useRef(getCurrentLevelId);
  getCurrentLevelIdRef.current = getCurrentLevelId;
  const getLevelSceneRef = useRef(getLevelScene);
  getLevelSceneRef.current = getLevelScene;

  const controllerRef = useRef<MepWireWaypointDragController | null>(null);
  if (controllerRef.current === null) controllerRef.current = new MepWireWaypointDragController();
  const gestureRef = useRef<WaypointGesture | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingPointRef = useRef<WirePlanPoint | null>(null);

  useEffect(() => {
    const el = getViewportElement();
    if (!el) return;

    /** Build the active-circuit context (segments + resolver) at event time. */
    function getActiveContext(): ActiveContext | null {
      const activeId = useMepCircuitEditorStore.getState().activeSystemId;
      if (!activeId) return null;
      const system = useMepSystemStore.getState().systems.find((s) => s.id === activeId);
      if (!system) return null;
      const levelId = getCurrentLevelIdRef.current();
      if (!levelId) return null;
      const scene = getLevelSceneRef.current(levelId);
      if (!scene) return null;
      const resolve = resolverFromHosts(collectHosts(scene));
      const segments = computeCircuitHostSegments([system], resolve);
      return { system, segments, resolve };
    }

    function toWorld(e: PointerEvent | MouseEvent): { world: Point2D; scale: number } {
      const rect = el!.getBoundingClientRect();
      const viewport = { width: rect.width, height: rect.height };
      const world = CoordinateTransforms.screenToWorld(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        transformRef.current,
        viewport,
      );
      return { world, scale: transformRef.current.scale || 1 };
    }

    function pushOptimistic(point: WirePlanPoint): void {
      const gesture = gestureRef.current;
      if (!gesture) return;
      const nextParams = applyWaypointGesture(gesture, point);
      useMepSystemStore.getState().upsertSystem({ ...gesture.system, params: nextParams });
    }

    function flushPatch(): void {
      rafIdRef.current = null;
      const point = pendingPointRef.current;
      pendingPointRef.current = null;
      if (point) pushOptimistic(point);
    }

    function schedulePatch(point: WirePlanPoint): void {
      pendingPointRef.current = point;
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(flushPatch);
    }

    function beginGesture(e: PointerEvent): boolean {
      const ctx = getActiveContext();
      if (!ctx) return false;
      const { world, scale } = toWorld(e);
      const map = ctx.system.params.wireWaypoints;
      const node = hitTestWaypointNode(world, ctx.segments, map, NODE_TOL_PX / scale);
      let gesture: WaypointGesture;
      let startPoint: WirePlanPoint;
      if (node) {
        gesture = { mode: 'move', system: ctx.system, startParams: ctx.system.params, keyA: node.keyA, keyB: node.keyB, orientedIndex: node.orientedIndex };
        startPoint = node.point;
      } else {
        const ins = hitTestInsertion(world, ctx.segments, map, WIRE_TOL_PX / scale);
        if (!ins) return false;
        gesture = { mode: 'insert', system: ctx.system, startParams: ctx.system.params, keyA: ins.keyA, keyB: ins.keyB, orientedIndex: ins.orientedInsertIndex };
        startPoint = ins.point;
      }
      gestureRef.current = gesture;
      controllerRef.current!.startDrag(
        { systemId: gesture.system.id, keyA: gesture.keyA, keyB: gesture.keyB, orientedIndex: gesture.orientedIndex },
        startPoint,
      );
      pushOptimistic(startPoint); // insert shows the new vertex immediately
      return true;
    }

    function deleteNodeAt(e: PointerEvent | MouseEvent): boolean {
      const ctx = getActiveContext();
      if (!ctx) return false;
      const { world, scale } = toWorld(e);
      const node = hitTestWaypointNode(world, ctx.segments, ctx.system.params.wireWaypoints, NODE_TOL_PX / scale);
      if (!node) return false;
      const nextMap = deleteWaypointOriented(ctx.system.params.wireWaypoints, node.keyA, node.keyB, node.orientedIndex);
      const nextParams: MepSystemParams = { ...ctx.system.params, wireWaypoints: nextMap };
      executeRef.current(new UpdateMepSystemParamsCommand(ctx.system.id, nextParams, ctx.system.params));
      return true;
    }

    function onPointerDown(e: PointerEvent): void {
      if (e.button === 2) {
        if (deleteNodeAt(e)) {
          e.stopPropagation();
          e.preventDefault();
        }
        return;
      }
      if (e.button !== 0) return;
      if (!beginGesture(e)) return;
      e.stopPropagation();
      e.preventDefault();
      try {
        el!.setPointerCapture(e.pointerId);
      } catch {
        /* setPointerCapture can fail on detached elements — non-fatal. */
      }
    }

    function onPointerMove(e: PointerEvent): void {
      const controller = controllerRef.current!;
      if (controller.getState() === 'dragging') {
        const { world } = toWorld(e);
        const point = controller.updateDrag(world);
        if (point) schedulePatch(point);
        return;
      }
      // Idle hover affordance (active circuit only).
      const ctx = getActiveContext();
      if (!ctx) {
        setWireWaypointHover(null);
        return;
      }
      const { world, scale } = toWorld(e);
      const map = ctx.system.params.wireWaypoints;
      const node = hitTestWaypointNode(world, ctx.segments, map, NODE_TOL_PX / scale);
      if (node) {
        setWireWaypointHover({ systemId: ctx.system.id, x: node.point.x, y: node.point.y, kind: 'node' });
        return;
      }
      // Generous wire-hover: the whole circuit lights up + a "+" ghost appears
      // anywhere along the run (not just pixel-perfect on a sub-segment).
      const ins = hitTestInsertion(world, ctx.segments, map, WIRE_TOL_PX / scale);
      setWireWaypointHover(ins ? { systemId: ctx.system.id, x: ins.point.x, y: ins.point.y, kind: 'insert' } : null);
    }

    function commit(): void {
      const controller = controllerRef.current!;
      const gesture = gestureRef.current;
      const result = controller.endDrag();
      gestureRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingPointRef.current = null;
      if (!gesture || !result) return;
      const nextParams = applyWaypointGesture(gesture, result.point);
      executeRef.current(new UpdateMepSystemParamsCommand(gesture.system.id, nextParams, gesture.startParams));
    }

    function onPointerUp(e: PointerEvent): void {
      if (controllerRef.current!.getState() !== 'dragging') return;
      try {
        el!.releasePointerCapture(e.pointerId);
      } catch {
        /* releasePointerCapture can fail when capture was lost — non-fatal. */
      }
      commit();
    }

    function rollback(): void {
      const gesture = gestureRef.current;
      controllerRef.current!.cancelDrag();
      gestureRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingPointRef.current = null;
      if (gesture) useMepSystemStore.getState().upsertSystem(gesture.system); // restore pre-gesture
    }

    function onPointerCancel(): void {
      if (controllerRef.current!.getState() !== 'dragging') return;
      rollback();
    }

    function onContextMenu(e: MouseEvent): void {
      // Suppress the browser menu only when the cursor is over a deletable node;
      // the right-click delete already fired on pointerdown.
      const ctx = getActiveContext();
      if (!ctx) return;
      const { world, scale } = toWorld(e);
      if (hitTestWaypointNode(world, ctx.segments, ctx.system.params.wireWaypoints, NODE_TOL_PX / scale)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    el.addEventListener('pointerdown', onPointerDown, { capture: true });
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('contextmenu', onContextMenu, { capture: true });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown, { capture: true } as EventListenerOptions);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('contextmenu', onContextMenu, { capture: true } as EventListenerOptions);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setWireWaypointHover(null);
    };
  }, [getViewportElement]);
}
