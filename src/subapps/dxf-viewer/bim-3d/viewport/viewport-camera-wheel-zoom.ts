/**
 * ADR-363 Φ1G.5 / §empty-dxf — Revit surface-anchored wheel zoom, extracted from
 * createViewportCamera (ADR-516 file-size split, byte-identical behaviour). Capture-phase
 * wheel listener that pre-empts OrbitControls' own (bubble-phase) dolly: resolves an anchor
 * under the cursor (BIM surface, DXF ground-plane, or camera-facing plane through the orbit
 * target) and dollies the camera ourselves (step ∝ distance-to-anchor, clamped → never crosses
 * a real face; on a plane it bottoms out at the same min distance) then `stopImmediatePropagation`
 * so OrbitControls does NOT also dolly. Empty canvas + DXF underlay + BIM all feel IDENTICAL.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ProjectionMode } from './viewport-types';
import { computeSurfaceZoomPose, wheelZoomFactor } from './viewport-zoom-surface';
import { PERSP_MAX_DISTANCE, ZOOM_SURFACE_MARGIN, ZOOM_WHEEL_BASE, ZOOM_WHEEL_SENSITIVITY } from './viewport-constants';
import { DXF_TIMING } from '../../config/dxf-timing';

/**
 * ADR-452 v2.7 — how long after the last wheel tick we keep "interacting" true. Wheel events
 * arrive in bursts ~50–120 ms apart; this debounce keeps the cheap navigation path alive across
 * the whole zoom gesture, then lets it settle.
 */
const WHEEL_INTERACTION_IDLE_MS = DXF_TIMING.gesture.WHEEL_IDLE; // ADR-516

export interface SurfaceWheelZoomDeps {
  readonly domElement: HTMLElement;
  readonly controls: OrbitControls;
  readonly getActiveCamera: () => THREE.PerspectiveCamera | THREE.OrthographicCamera;
  readonly getMode: () => ProjectionMode;
  readonly resolveSurfacePoint?: (clientX: number, clientY: number) => THREE.Vector3 | null;
  /** Cancel any running camera tween (the wheel takes over the pose imperatively). */
  readonly cancelAnimation: () => void;
  readonly onRenderNeeded: () => void;
  readonly onInteractionStart: () => void;
  readonly onInteractionEnd: () => void;
}

/** Attach the capture-phase wheel listener. Caller MUST call the returned `dispose()` on teardown. */
export function attachSurfaceWheelZoom(deps: SurfaceWheelZoomDeps): { dispose: () => void } {
  const { domElement, controls, getActiveCamera, getMode, resolveSurfacePoint,
    cancelAnimation, onRenderNeeded, onInteractionStart, onInteractionEnd } = deps;

  // ADR-452 v2.7 — debounced "interacting" pulse for wheel-zoom (see onSurfaceWheel).
  let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null;
  function pulseWheelInteraction(): void {
    onInteractionStart();
    if (wheelIdleTimer !== null) clearTimeout(wheelIdleTimer);
    wheelIdleTimer = setTimeout(() => { wheelIdleTimer = null; onInteractionEnd(); }, WHEEL_INTERACTION_IDLE_MS);
  }

  function onSurfaceWheel(e: WheelEvent): void {
    // ADR-452 v2.7 — flag interaction on EVERY wheel tick (before any early return), so it also
    // covers the ortho / OrbitControls-fallback dolly. Wheel-zoom never fires OrbitControls
    // 'start'/'end', so without this the IdleDetector keeps SSAO + section caps full-quality on
    // every zoom frame → heavy frames. The debounced end lets both refine once the wheel goes quiet.
    pulseWheelInteraction();
    if (getMode() !== 'perspective' || !controls.enabled || !controls.enableZoom) return;
    const hit = resolveSurfacePoint?.(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    cancelAnimation();
    const camera = getActiveCamera();
    const factor = wheelZoomFactor(e.deltaY, ZOOM_WHEEL_BASE, ZOOM_WHEEL_SENSITIVITY, controls.zoomSpeed);
    // Revit zoom-to-cursor: dolly along cam→hit AND slide the target by the same delta → view
    // direction unchanged (no lookAt re-aim → no jump), while the cursor point stays anchored.
    const pose = computeSurfaceZoomPose(
      camera.position, controls.target, hit, factor, ZOOM_SURFACE_MARGIN, PERSP_MAX_DISTANCE,
    );
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    controls.update();           // resync OrbitControls' spherical from the new pose
    onRenderNeeded();
  }

  domElement.addEventListener('wheel', onSurfaceWheel, { capture: true, passive: false });

  return {
    dispose() {
      domElement.removeEventListener('wheel', onSurfaceWheel, { capture: true });
      if (wheelIdleTimer !== null) { clearTimeout(wheelIdleTimer); wheelIdleTimer = null; }
    },
  };
}
