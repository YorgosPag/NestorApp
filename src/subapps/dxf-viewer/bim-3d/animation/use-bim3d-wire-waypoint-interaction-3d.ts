'use client';

/**
 * use-bim3d-wire-waypoint-interaction-3d — ADR-408 Φ7 FU#3 (3D editing).
 *
 * The 3D-viewport twin of the 2D `use-mep-wire-waypoint-interaction`: lets the
 * user insert / move / delete circuit wire waypoints directly in the 3D scene,
 * reusing the SAME plan-space SSoT (hit-test + orientation-aware editors +
 * `applyWaypointGesture` + `UpdateMepSystemParamsCommand` + optimistic
 * `upsertSystem`). The only 3D-specific work is raycasting (sphere handles for
 * nodes, the conduit tube for insertion) and converting world↔plan.
 *
 * Pattern mirrors the placement hooks (`use-bim3d-mep-fixture-placement`):
 *   - one `useEffect([canvasEl, managerRef])` with an AbortController,
 *   - store reads at event time (no `useSyncExternalStore`),
 *   - OrbitControls disabled only while actually dragging a node,
 *   - armed only in 3D + the `select` tool, scoped to the ACTIVE circuit.
 *
 * @see ../../hooks/canvas/use-mep-wire-waypoint-interaction.ts (2D twin)
 * @see ./WireWaypointHandles3D.ts (the spheres layer)
 */

import { useEffect, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { clientToNdc } from '../systems/raycaster/BimEntityRaycaster';
import { toolStateStore } from '../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../bim/mep-systems/mep-circuit-editor-store';
import { getGlobalCommandHistory } from '../../core/commands';
import { UpdateMepSystemParamsCommand } from '../../core/commands/entity-commands/UpdateMepSystemParamsCommand';
import {
  computeCircuitHostSegments,
  splicedSegmentInterior,
  type CircuitHostSegment,
} from '../../bim/mep-systems/mep-wire-routing';
import { resolverFromHosts, type WireHostXform } from '../../bim/mep-systems/mep-wire-resolver';
import { hitTestInsertion } from '../../bim/mep-systems/mep-wire-waypoint-hit';
import { getOrientedWaypoints, deleteWaypointOriented } from '../../bim/mep-systems/mep-wire-waypoints';
import { applyWaypointGesture, type WaypointGesture } from '../../bim/mep-systems/mep-wire-waypoint-gesture';
import { worldToPlanMm, planMmToScenePoint } from '../placement/world-to-scene-point';
import { resolveActiveFloorElevationMm } from '../placement/raycast-floor-point';
import { sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';
import type { MepSystemEntity, MepElectricalSystemParams } from '../../bim/types/mep-system-types';
import { isElectricalSystemParams } from '../../bim/types/mep-system-types';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import { WireWaypointHandles3D, type WireHandleNode } from './WireWaypointHandles3D';

const ORBIT_DRAG_PX = 5;

export interface UseBim3DWireWaypointInteractionParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

/** Per-event resolved context for the active circuit in 3D. */
interface Active3DContext {
  readonly system: MepSystemEntity;
  /** Narrowed electrical params (waypoints are an electrical-circuit feature). */
  readonly params: MepElectricalSystemParams;
  readonly segments: CircuitHostSegment[];
  readonly sceneToM: number;
  readonly sceneUnits: SceneUnits;
  readonly worldYBaseM: number; // world Y (m) of FFL = base + floor
}

export function useBim3DWireWaypointInteraction({ managerRef, canvasEl }: UseBim3DWireWaypointInteractionParams): void {
  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const handles = new WireWaypointHandles3D(manager.scene);
    const raycaster = new THREE.Raycaster();
    let abort: AbortController | null = null;
    let downPos: { x: number; y: number } | null = null;
    // Drag state (mirrors the 2D gesture refs).
    let gesture: WaypointGesture | null = null;
    let planeY = 0;
    let rafId: number | null = null;
    let pendingWorld: THREE.Vector3 | null = null;
    // ADR-549 Phase 1 — idempotent redraw guard. `onMove` used to call
    // `markSceneDirty()` on EVERY pointermove, forcing ~7 full 3D re-renders/s
    // (~26ms each) during a plain cursor sweep — the measured cause of the cursor
    // «swim». We now mark the scene dirty ONLY when the visible state (handles
    // shown / hovered node / insert ghost) actually changes.
    let shownHandles = false;
    let shownHovered: number | null = null;
    let shownInsert: string | null = null; // null = hidden; else rounded "x,y,z"

    /** Build the active-circuit context (hosts → resolver → host segments). */
    const getActiveContext = (): Active3DContext | null => {
      const activeId = useMepCircuitEditorStore.getState().activeSystemId;
      if (!activeId) return null;
      const system = useMepSystemStore.getState().systems.find((s) => s.id === activeId);
      if (!system) return null;
      // Waypoint editing applies only to electrical circuits (home-run wires).
      if (!isElectricalSystemParams(system.params)) return null;
      const { fixtures, panels } = useBim3DEntitiesStore.getState();
      const hosts = new Map<string, WireHostXform>();
      let sceneUnits: SceneUnits = 'mm';
      let captured = false;
      const add = (e: MepFixtureEntity | ElectricalPanelEntity): void => {
        hosts.set(e.id, {
          x: e.params.position.x,
          y: e.params.position.y,
          rotation: e.params.rotation,
          zMm: e.params.mountingElevationMm,
          connectors: e.params.connectors ?? [],
        });
        if (!captured) { sceneUnits = e.params.sceneUnits ?? 'mm'; captured = true; }
      };
      for (const f of fixtures ?? []) add(f);
      for (const p of panels ?? []) add(p);
      if (!captured) return null;
      const segments = computeCircuitHostSegments([system], resolverFromHosts(hosts));
      const sceneToM = sceneUnitsToMeters(sceneUnits);
      const worldYBaseM = resolveActiveFloorElevationMm() * 0.001;
      return { system, params: system.params, segments, sceneToM, sceneUnits, worldYBaseM };
    };

    /** Plan point (canvas units) + elevation (mm) → Three.js world point (m). */
    const planToWorld = (x: number, y: number, zMm: number, ctx: Active3DContext): THREE.Vector3 =>
      new THREE.Vector3(x * ctx.sceneToM, ctx.worldYBaseM + zMm * 0.001, -y * ctx.sceneToM);

    /** A raycast world point → plan point (canvas units), matching stored waypoints. */
    const worldToPlan = (world: THREE.Vector3, ctx: Active3DContext): { x: number; y: number } =>
      planMmToScenePoint(worldToPlanMm(world), ctx.sceneUnits);

    /** Node handles for every existing waypoint of the active circuit. */
    const collectHandleNodes = (ctx: Active3DContext): WireHandleNode[] => {
      const out: WireHandleNode[] = [];
      for (const seg of ctx.segments) {
        const wps = getOrientedWaypoints(ctx.params.wireWaypoints, seg.keyA, seg.keyB);
        // SSoT: the SAME spliced points the conduit is built from (arc-length z),
        // so the sphere sits exactly on the wire — not a separate index-fraction z
        // that floats off the line when the segment endpoints differ in height.
        const interior = splicedSegmentInterior(seg.a, seg.b, wps);
        for (let i = 0; i < interior.length; i++) {
          const p = interior[i]!;
          out.push({
            worldPos: planToWorld(p.x, p.y, p.zMm, ctx),
            systemId: ctx.system.id,
            keyA: seg.keyA,
            keyB: seg.keyB,
            orientedIndex: i,
          });
        }
      }
      return out;
    };

    const setRay = (e: PointerEvent | MouseEvent): boolean => {
      const ndc = clientToNdc(canvasEl, e.clientX, e.clientY);
      if (!ndc) return false;
      raycaster.setFromCamera(ndc, manager.getCamera());
      return true;
    };

    /** Raycast the active circuit's conduit tube; returns the world hit or null. */
    const raycastWire = (systemId: string): THREE.Vector3 | null => {
      const meshes: THREE.Object3D[] = [];
      manager.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.userData['mepWireSystemId'] === systemId) meshes.push(o);
      });
      if (meshes.length === 0) return null;
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return hit ? hit.point.clone() : null;
    };

    /** Intersect the horizontal plane at `planeY` (m); returns world point or null. */
    const raycastPlane = (y: number): THREE.Vector3 | null => {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
      const out = new THREE.Vector3();
      return raycaster.ray.intersectPlane(plane, out) ? out : null;
    };

    const pushOptimistic = (world: THREE.Vector3): void => {
      if (!gesture) return;
      const ctx = getActiveContext();
      if (!ctx) return;
      const nextParams = applyWaypointGesture(gesture, worldToPlan(world, ctx));
      useMepSystemStore.getState().upsertSystem({ ...gesture.system, params: nextParams });
      manager.markSceneDirty();
    };

    const flush = (): void => {
      rafId = null;
      const w = pendingWorld;
      pendingWorld = null;
      if (w) pushOptimistic(w);
    };

    const schedule = (world: THREE.Vector3): void => {
      pendingWorld = world;
      if (rafId === null) rafId = requestAnimationFrame(flush);
    };

    /** Rounded world-point signature for the insert ghost (null when hidden). */
    const insertSig = (w: THREE.Vector3): string =>
      `${w.x.toFixed(3)},${w.y.toFixed(3)},${w.z.toFixed(3)}`;

    const onMove = (e: PointerEvent): void => {
      if (gesture) {
        if (!setRay(e)) return;
        const world = raycastPlane(planeY);
        if (world) schedule(world);
        return;
      }
      const ctx = getActiveContext();
      if (!ctx) {
        // No editable circuit: hide handles; redraw ONLY if something was showing.
        if (shownHandles || shownHovered !== null || shownInsert !== null) {
          handles.hideAll();
          shownHandles = false; shownHovered = null; shownInsert = null;
          manager.markSceneDirty();
        }
        return;
      }
      handles.updateNodes(collectHandleNodes(ctx), manager.getCamera());
      if (!setRay(e)) return;
      let nextHovered: number | null = null;
      let nextInsert: string | null = null;
      const nodeHit = raycaster.intersectObjects(handles.getPickables(), false)[0];
      if (nodeHit) {
        nextHovered = handles.getPickables().indexOf(nodeHit.object);
        handles.setHoveredIndex(nextHovered);
        handles.hideInsert();
      } else {
        handles.setHoveredIndex(null);
        const wireHit = raycastWire(ctx.system.id);
        if (wireHit) { handles.showInsert(wireHit, manager.getCamera()); nextInsert = insertSig(wireHit); }
        else handles.hideInsert();
      }
      // Redraw only on a real visual change (handles just appeared, hover moved,
      // or the insert ghost moved/toggled) — never on a no-op hover.
      if (!shownHandles || nextHovered !== shownHovered || nextInsert !== shownInsert) {
        shownHandles = true; shownHovered = nextHovered; shownInsert = nextInsert;
        manager.markSceneDirty();
      }
    };

    const startDrag = (e: PointerEvent): boolean => {
      const ctx = getActiveContext();
      if (!ctx) return false;
      if (!setRay(e)) return false;
      // 1) An existing node sphere → move it.
      const nodeHit = raycaster.intersectObjects(handles.getPickables(), false)[0];
      if (nodeHit) {
        const ud = nodeHit.object.userData;
        gesture = {
          mode: 'move',
          system: ctx.system,
          startParams: ctx.params,
          keyA: ud['keyA'] as string,
          keyB: ud['keyB'] as string,
          orientedIndex: ud['orientedIndex'] as number,
        };
        planeY = nodeHit.object.position.y;
        return true;
      }
      // 2) The conduit tube → insert a vertex at the picked point, then drag it.
      const wireHit = raycastWire(ctx.system.id);
      if (!wireHit) return false;
      const ins = hitTestInsertion(worldToPlan(wireHit, ctx), ctx.segments, ctx.params.wireWaypoints, Number.POSITIVE_INFINITY);
      if (!ins) return false;
      gesture = { mode: 'insert', system: ctx.system, startParams: ctx.params, keyA: ins.keyA, keyB: ins.keyB, orientedIndex: ins.orientedInsertIndex };
      planeY = wireHit.y;
      pushOptimistic(wireHit); // show the new vertex immediately
      return true;
    };

    const onDown = (e: PointerEvent): void => {
      if (e.button === 2) {
        if (deleteNodeAt(e)) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (e.button !== 0) return;
      downPos = { x: e.clientX, y: e.clientY };
      if (!startDrag(e)) { gesture = null; return; }
      e.preventDefault();
      e.stopPropagation();
      manager.viewport.setControlsEnabled(false);
      try { canvasEl.setPointerCapture(e.pointerId); } catch { /* detached — non-fatal */ }
    };

    const commit = (): void => {
      const g = gesture;
      const last = pendingWorld;
      gesture = null;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      pendingWorld = null;
      if (!g) return;
      const ctx = getActiveContext();
      // Recompute final params from the last cursor world point (or keep optimistic).
      if (ctx && last) {
        const nextParams = applyWaypointGesture(g, worldToPlan(last, ctx));
        getGlobalCommandHistory().execute(new UpdateMepSystemParamsCommand(g.system.id, nextParams, g.startParams));
      } else {
        const current = useMepSystemStore.getState().systems.find((s) => s.id === g.system.id);
        if (current) getGlobalCommandHistory().execute(new UpdateMepSystemParamsCommand(g.system.id, current.params, g.startParams));
      }
    };

    const onUp = (e: PointerEvent): void => {
      if (!gesture) return;
      try { canvasEl.releasePointerCapture(e.pointerId); } catch { /* non-fatal */ }
      manager.viewport.setControlsEnabled(true);
      commit();
    };

    const onCancel = (): void => {
      if (!gesture) return;
      const g = gesture;
      gesture = null;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      pendingWorld = null;
      manager.viewport.setControlsEnabled(true);
      useMepSystemStore.getState().upsertSystem(g.system); // restore pre-gesture
      manager.markSceneDirty();
    };

    const deleteNodeAt = (e: PointerEvent | MouseEvent): boolean => {
      const ctx = getActiveContext();
      if (!ctx || !setRay(e)) return false;
      const nodeHit = raycaster.intersectObjects(handles.getPickables(), false)[0];
      if (!nodeHit) return false;
      const ud = nodeHit.object.userData;
      const nextMap = deleteWaypointOriented(
        ctx.params.wireWaypoints,
        ud['keyA'] as string,
        ud['keyB'] as string,
        ud['orientedIndex'] as number,
      );
      getGlobalCommandHistory().execute(
        new UpdateMepSystemParamsCommand(ctx.system.id, { ...ctx.params, wireWaypoints: nextMap }, ctx.params),
      );
      return true;
    };

    const onContextMenu = (e: MouseEvent): void => {
      const ctx = getActiveContext();
      if (!ctx || !setRay(e)) return;
      if (raycaster.intersectObjects(handles.getPickables(), false).length > 0) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onClick = (e: MouseEvent): void => {
      // Swallow the click that ends a drag so it never reaches selection/orbit.
      const moved = downPos ? Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) : 0;
      downPos = null;
      if (moved > ORBIT_DRAG_PX) { e.preventDefault(); e.stopPropagation(); }
    };

    const setup = (): void => {
      if (abort) return;
      abort = new AbortController();
      const { signal } = abort;
      canvasEl.addEventListener('pointermove', onMove, { signal });
      canvasEl.addEventListener('pointerdown', onDown, { signal });
      canvasEl.addEventListener('pointerup', onUp, { signal });
      canvasEl.addEventListener('pointercancel', onCancel, { signal });
      canvasEl.addEventListener('click', onClick, { signal, capture: true });
      canvasEl.addEventListener('contextmenu', onContextMenu, { signal });
    };

    const teardown = (): void => {
      abort?.abort();
      abort = null;
      downPos = null;
      gesture = null;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      pendingWorld = null;
      handles.hideAll();
      shownHandles = false; shownHovered = null; shownInsert = null;
      manager.markSceneDirty();
    };

    const apply = (): void => {
      // ADR-549 Phase 1 — arm ONLY when a circuit is actually being edited. In the
      // default `select` tool with no active circuit the hook was still listening
      // and force-redrawing on every move (spurious dirty). `getActiveContext()`
      // can still resolve to null even with an id (e.g. non-electrical), so the
      // in-handler idempotent guard remains the second line of defence.
      const armed =
        selectIs3D(useViewMode3DStore.getState()) &&
        toolStateStore.get().activeTool === 'select' &&
        useMepCircuitEditorStore.getState().activeSystemId !== null;
      if (armed) setup();
      else teardown();
    };

    apply();
    const unsubTool = toolStateStore.subscribe(apply);
    const unsubView = useViewMode3DStore.subscribe(apply);
    const unsubCircuit = useMepCircuitEditorStore.subscribe(apply);

    return () => {
      unsubTool();
      unsubView();
      unsubCircuit();
      teardown();
      handles.dispose();
    };
  }, [canvasEl, managerRef]);
}
