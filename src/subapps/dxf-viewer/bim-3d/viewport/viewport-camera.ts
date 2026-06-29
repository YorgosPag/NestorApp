/**
 * Unified viewport camera: PerspectiveCamera + OrthographicCamera + OrbitControls + tumble.
 * PORT_AS_IS from GenArc viewportCamera.ts (ADR-366 §8.2 SPEC-3D-004A).
 * Replaces plain OrbitControls placeholder from Phase 0.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ViewportCamera, ProjectionMode, SpeedModifier } from './viewport-types';
import { createViewportAnimation } from './viewport-animation';
import { computePerspectiveFraming, computeOrthoFraming } from './viewport-framing';
import { createTumbleRotation } from './tumble-rotation';
import {
  DEFAULT_PERSPECTIVE_FOV, DEFAULT_CAMERA_DISTANCE, DEFAULT_ORTHO_SIZE,
  CAMERA_NEAR, CAMERA_FAR, ZOOM_PRESETS,
  ORTHO_CAMERA_DIRECTIONS, ORTHO_CAMERA_UP,
  PERSP_MIN_DISTANCE, PERSP_MAX_DISTANCE, ORTHO_MIN_ZOOM, ORTHO_MAX_ZOOM,
  PROJECTION_SWITCH_DURATION_MS, FRAME_SCENE_DURATION_MS, PAN_ANIMATION_DURATION_MS,
  DEFAULT_PAN_SPEED, DEFAULT_ROTATE_SPEED, DEFAULT_ZOOM_SPEED,
  SPEED_MODIFIER_FAST, SPEED_MODIFIER_PRECISE,
  TUMBLE_BASE_SPEED,
  ZOOM_SURFACE_MARGIN, ZOOM_WHEEL_BASE, ZOOM_WHEEL_SENSITIVITY,
} from './viewport-constants';
import { computeSurfaceZoomPose, wheelZoomFactor } from './viewport-zoom-surface';
import { getPixelWorldSize } from './coordinate-transforms';
import { getAnimationDuration } from '../accessibility/reduced-motion-config';
import { DXF_TIMING } from '../../config/dxf-timing';

export interface ViewportCameraOptions {
  readonly initialPosition: THREE.Vector3;
  readonly initialTarget?: THREE.Vector3;
  readonly onRenderNeeded: () => void;
  readonly onInteractionStart: () => void;
  readonly onInteractionEnd: () => void;
  /** Returns true when reduced motion is active. Checked at animation call time. */
  readonly getReducedMotion?: () => boolean;
  /** ADR-366 §A.6.Q5 — static Alt+left-click in perspective (forwarded to tumble). */
  readonly onAltClick?: (clientX: number, clientY: number) => void;
  /** Alt+left pointer-down → re-centre orbit pivot on the cursor point (forwarded to tumble). */
  readonly onAltPress?: (clientX: number, clientY: number) => void;
  /**
   * ADR-363 Φ1G.5 / §empty-dxf — resolve the world ANCHOR point under the cursor for the Revit
   * surface-anchored wheel zoom. SSoT `raycastWorldPointOrPlane`: BIM surface hit → DXF ground-plane
   * → camera-facing plane through the orbit target. So a BIM surface, the DXF underlay AND empty
   * canvas all yield a real anchor → the ONE exponential dolly runs everywhere (Revit/Figma: zoom in
   * empty space anchors to a work/target plane, never switches to a different zoom mechanism).
   * Returns null only in degenerate cases (canvas not laid out) → the wheel falls back to the default
   * OrbitControls dolly. Optional / back-compat.
   */
  readonly resolveSurfacePoint?: (clientX: number, clientY: number) => THREE.Vector3 | null;
}

const _snapDir = new THREE.Vector3();
const _direction = new THREE.Vector3();

/**
 * ADR-452 v2.7 — how long after the last wheel tick we keep "interacting" true.
 * Wheel events arrive in bursts ~50–120 ms apart; this debounce keeps the cheap
 * navigation path alive across the whole zoom gesture, then lets it settle.
 */
const WHEEL_INTERACTION_IDLE_MS = DXF_TIMING.gesture.WHEEL_IDLE; // ADR-516

export function createViewportCamera(
  domElement: HTMLElement,
  options: ViewportCameraOptions,
): ViewportCamera {
  const {
    initialPosition,
    initialTarget = new THREE.Vector3(3, 1.5, 2),
    onRenderNeeded, onInteractionStart, onInteractionEnd,
  } = options;
  const aspect = domElement.clientWidth / Math.max(domElement.clientHeight, 1);

  const perspCamera = new THREE.PerspectiveCamera(DEFAULT_PERSPECTIVE_FOV, aspect, CAMERA_NEAR, CAMERA_FAR);
  perspCamera.position.copy(initialPosition);
  perspCamera.lookAt(initialTarget);

  const orthoHalfH = DEFAULT_ORTHO_SIZE;
  const orthoCamera = new THREE.OrthographicCamera(
    -orthoHalfH * aspect, orthoHalfH * aspect, orthoHalfH, -orthoHalfH, CAMERA_NEAR, CAMERA_FAR,
  );
  orthoCamera.position.copy(initialPosition);
  orthoCamera.lookAt(initialTarget);

  let activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspCamera;
  let currentMode: ProjectionMode = 'perspective';

  const controls = new OrbitControls(perspCamera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.zoomToCursor = true;
  controls.target.copy(initialTarget);
  controls.enableRotate = false;
  controls.minDistance = PERSP_MIN_DISTANCE;
  controls.maxDistance = PERSP_MAX_DISTANCE;
  controls.minZoom = ORTHO_MIN_ZOOM;
  controls.maxZoom = ORTHO_MAX_ZOOM;
  controls.addEventListener('change', onRenderNeeded);
  controls.addEventListener('start', onInteractionStart);
  controls.addEventListener('end', onInteractionEnd);

  /**
   * ADR-363 Φ1G.5 / §empty-dxf — Revit surface-anchored wheel zoom. Runs in the CAPTURE phase so it
   * pre-empts OrbitControls' own (bubble-phase) wheel listener: `resolveSurfacePoint` resolves an
   * anchor under the cursor — BIM surface, DXF ground-plane, or camera-facing plane through the orbit
   * target — and we dolly the camera ourselves (step ∝ distance-to-anchor, clamped → never crosses a
   * real face; on a plane it bottoms out at the same min distance) then `stopImmediatePropagation` so
   * OrbitControls does NOT also dolly. So empty canvas + DXF underlay + BIM all feel IDENTICAL. The
   * OrbitControls fallback now only runs in ortho / disabled nav / a degenerate null (no canvas size).
   */
  function onSurfaceWheel(e: WheelEvent): void {
    // ADR-452 v2.7 — flag interaction on EVERY wheel tick (before any early return,
    // so it also covers the ortho / OrbitControls-fallback dolly). Wheel-zoom marks
    // the scene dirty via `onRenderNeeded` but never fires OrbitControls 'start'/'end',
    // so without this the IdleDetector keeps SSAO active AND the section caps stay
    // full-quality on every zoom frame → heavy frames (the observed RAF jank). The
    // debounced end lets both refine once the wheel goes quiet.
    pulseWheelInteraction();
    if (currentMode !== 'perspective' || !controls.enabled || !controls.enableZoom) return;
    const hit = options.resolveSurfacePoint?.(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    animation.cancel();
    const factor = wheelZoomFactor(e.deltaY, ZOOM_WHEEL_BASE, ZOOM_WHEEL_SENSITIVITY, controls.zoomSpeed);
    // Revit zoom-to-cursor: dolly along cam→hit AND slide the target by the same
    // delta → view direction unchanged (no lookAt re-aim → no jump), while the point
    // under the cursor stays anchored. Snapping target = hit would swing the view.
    const pose = computeSurfaceZoomPose(
      activeCamera.position, controls.target, hit, factor, ZOOM_SURFACE_MARGIN, PERSP_MAX_DISTANCE,
    );
    activeCamera.position.copy(pose.position);
    controls.target.copy(pose.target);
    controls.update();           // resync OrbitControls' spherical from the new pose
    onRenderNeeded();
  }
  domElement.addEventListener('wheel', onSurfaceWheel, { capture: true, passive: false });

  // ADR-452 v2.7 — debounced "interacting" pulse for wheel-zoom (see onSurfaceWheel).
  let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null;
  function pulseWheelInteraction(): void {
    onInteractionStart();
    if (wheelIdleTimer !== null) clearTimeout(wheelIdleTimer);
    wheelIdleTimer = setTimeout(() => {
      wheelIdleTimer = null;
      onInteractionEnd();
    }, WHEEL_INTERACTION_IDLE_MS);
  }

  const tumble = createTumbleRotation({
    getCamera: () => activeCamera,
    getTarget: () => controls.target,
    domElement,
    onStart: onInteractionStart,
    onChange: onRenderNeeded,
    onEnd: onInteractionEnd,
    onAltClick: options.onAltClick,
    onAltPress: options.onAltPress,
  });

  const animation = createViewportAnimation();
  const rm = () => options.getReducedMotion?.() ?? false;

  function getZoom(): number {
    if (activeCamera instanceof THREE.OrthographicCamera) return activeCamera.zoom;
    const dist = activeCamera.position.distanceTo(controls.target);
    return dist > 0 ? DEFAULT_CAMERA_DISTANCE / dist : 1;
  }

  function setZoom(zoom: number): void {
    const clamped = Math.max(zoom, 0.001);
    if (activeCamera instanceof THREE.OrthographicCamera) {
      activeCamera.zoom = clamped;
      activeCamera.updateProjectionMatrix();
    } else {
      const newDist = DEFAULT_CAMERA_DISTANCE / clamped;
      _direction.subVectors(activeCamera.position, controls.target).normalize();
      activeCamera.position.copy(controls.target).addScaledVector(_direction, newDist);
    }
    onRenderNeeded();
  }

  function setZoomPreset(presetIndex: number): void {
    const preset = ZOOM_PRESETS[presetIndex];
    if (preset) setZoom(preset.value);
  }

  function frameBounds(min: THREE.Vector3, max: THREE.Vector3): void {
    animation.cancel();
    const viewDir = _direction.subVectors(controls.target, activeCamera.position).normalize();
    if (activeCamera instanceof THREE.PerspectiveCamera) {
      const result = computePerspectiveFraming(min, max, viewDir, activeCamera.aspect, DEFAULT_PERSPECTIVE_FOV);
      animation.start(
        { position: activeCamera.position.clone(), target: controls.target.clone(), zoom: getZoom() },
        { position: result.position, target: result.target, zoom: getZoom() },
        getAnimationDuration('camera', rm(), FRAME_SCENE_DURATION_MS),
        (pos, tgt) => { activeCamera.position.copy(pos); controls.target.copy(tgt); onRenderNeeded(); },
        () => { controls.enabled = true; },
      );
    } else {
      const up = orthoCamera.up.clone();
      const a = domElement.clientWidth / Math.max(domElement.clientHeight, 1);
      const result = computeOrthoFraming(min, max, viewDir, up, a);
      animation.start(
        { position: activeCamera.position.clone(), target: controls.target.clone(), zoom: orthoCamera.zoom },
        { position: result.position, target: result.target, zoom: result.orthoZoom },
        getAnimationDuration('camera', rm(), FRAME_SCENE_DURATION_MS),
        (pos, tgt, z) => {
          activeCamera.position.copy(pos); controls.target.copy(tgt);
          orthoCamera.zoom = z; updateOrthoFrustum(domElement.clientWidth, domElement.clientHeight);
          onRenderNeeded();
        },
        () => { controls.enabled = true; },
      );
    }
    controls.enabled = false;
  }

  function cancelAnimation(): void { animation.cancel(); controls.enabled = true; }

  function setSpeedModifier(modifier: SpeedModifier): void {
    const m = modifier === 'fast' ? SPEED_MODIFIER_FAST
      : modifier === 'precise' ? SPEED_MODIFIER_PRECISE : 1.0;
    controls.panSpeed = DEFAULT_PAN_SPEED * m;
    controls.zoomSpeed = DEFAULT_ZOOM_SPEED * m;
    tumble.setSpeed(TUMBLE_BASE_SPEED * DEFAULT_ROTATE_SPEED * m);
  }

  function setProjection(mode: ProjectionMode): void {
    if (mode === currentMode) return;
    animation.cancel();
    const target = controls.target.clone();
    if (mode === 'perspective') {
      const dist = DEFAULT_CAMERA_DISTANCE / Math.max(getZoom(), 0.001);
      _direction.subVectors(perspCamera.position, target).normalize();
      if (_direction.lengthSq() < 0.001) _direction.set(1, 0.8, 1).normalize();
      const finalPos = target.clone().addScaledVector(_direction, dist);
      perspCamera.position.copy(orthoCamera.position);
      perspCamera.lookAt(target);
      activeCamera = perspCamera;
      swapControlsCamera(perspCamera);
      tumble.setEnabled(true);
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      currentMode = mode;
      animation.start(
        { position: perspCamera.position.clone(), target: target.clone(), zoom: getZoom() },
        { position: finalPos, target, zoom: getZoom() },
        getAnimationDuration('camera', rm(), PROJECTION_SWITCH_DURATION_MS),
        (pos, tgt) => { perspCamera.position.copy(pos); controls.target.copy(tgt); perspCamera.lookAt(tgt); onRenderNeeded(); },
        () => { controls.enabled = true; },
      );
      controls.enabled = false;
    } else {
      const dir = ORTHO_CAMERA_DIRECTIONS[mode];
      const up = ORTHO_CAMERA_UP[mode];
      if (!dir || !up) return;
      const currentZoom = getZoom();
      const dist = DEFAULT_CAMERA_DISTANCE;
      const fromPos = activeCamera.position.clone();
      const fromTarget = controls.target.clone();
      const toPos = new THREE.Vector3(
        target.x + dir[0] * dist, target.y + dir[1] * dist, target.z + dir[2] * dist,
      );
      animation.start(
        { position: fromPos, target: fromTarget, zoom: currentZoom },
        { position: toPos, target, zoom: currentZoom },
        getAnimationDuration('camera', rm(), PROJECTION_SWITCH_DURATION_MS),
        (pos, tgt) => { activeCamera.position.copy(pos); controls.target.copy(tgt); activeCamera.lookAt(tgt); onRenderNeeded(); },
        () => {
          orthoCamera.position.copy(toPos);
          orthoCamera.up.set(up[0], up[1], up[2]);
          orthoCamera.lookAt(target);
          orthoCamera.zoom = currentZoom;
          updateOrthoFrustum(domElement.clientWidth, domElement.clientHeight);
          activeCamera = orthoCamera;
          swapControlsCamera(orthoCamera);
          tumble.setEnabled(false);
          controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
          controls.enabled = true;
          onRenderNeeded();
        },
      );
      controls.enabled = false;
      currentMode = mode;
    }
    onRenderNeeded();
  }

  function snapToViewDirection(dir: THREE.Vector3): void {
    animation.cancel();
    const target = controls.target.clone();
    const dist = activeCamera.position.distanceTo(target);
    _snapDir.copy(dir).normalize();
    if (_snapDir.lengthSq() < 0.001) return;
    const toPos = target.clone().addScaledVector(_snapDir, dist > 0 ? dist : DEFAULT_CAMERA_DISTANCE);
    if (currentMode !== 'perspective') {
      perspCamera.position.copy(activeCamera.position);
      perspCamera.lookAt(target);
      activeCamera = perspCamera;
      swapControlsCamera(perspCamera);
      tumble.setEnabled(true);
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      currentMode = 'perspective';
    }
    onInteractionStart();
    animation.start(
      { position: perspCamera.position.clone(), target: target.clone(), zoom: getZoom() },
      { position: toPos, target, zoom: getZoom() },
      getAnimationDuration('camera', rm(), PROJECTION_SWITCH_DURATION_MS),
      (pos, tgt) => { perspCamera.position.copy(pos); controls.target.copy(tgt); perspCamera.lookAt(tgt); onRenderNeeded(); },
      () => { controls.enabled = true; onInteractionEnd(); },
    );
    controls.enabled = false;
    onRenderNeeded();
  }

  /**
   * ViewCube roll arrows — roll the view ±90° around the viewing axis.
   *
   * A true roll rotates the camera's UP vector around the forward (view) axis,
   * leaving position, target AND projection mode unchanged — so the scene simply
   * appears to spin 90° on screen. (The previous wiring reused
   * `snapToViewDirection`, which always forced perspective + moved the camera —
   * hence the "flat → perspective" jump instead of a roll.) Instant, like the
   * Autodesk ViewCube roll.
   */
  function rollView(dirSign: 1 | -1): void {
    animation.cancel();
    const target = controls.target;
    const forward = _direction.subVectors(target, activeCamera.position).normalize();
    if (forward.lengthSq() < 0.001) return;
    const q = new THREE.Quaternion().setFromAxisAngle(forward, (dirSign * Math.PI) / 2);
    activeCamera.up.applyQuaternion(q).normalize();
    activeCamera.lookAt(target);
    controls.update();
    onRenderNeeded();
  }

  /**
   * ADR-366 Phase 4.5 / A.7.Q4 — Screen-space keyboard pan.
   *
   * `dxScreenPx` > 0 pans the view RIGHT, `dyScreenPx` > 0 pans UP (intuitive
   * arrow-key mapping). Mode-aware: perspective uses target-distance frustum
   * height, ortho uses zoomed visible height.
   *
   * Animated 150ms ease-in-out + repeat-key continuous flow:
   * Each call (including key-repeat events) reads the CURRENT camera position
   * (which is already mid-animation when repeating), cancels the old animation,
   * and starts a new 150ms transition to the next target. This creates smooth
   * continuous flow while the key is held down.
   */
  function pan(dxScreenPx: number, dyScreenPx: number): void {
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    activeCamera.matrixWorld.extractBasis(right, up, new THREE.Vector3());

    // World metres per screen pixel — SSoT `getPixelWorldSize` (mode-aware: ortho ignores
    // distance, perspective scales by cam→target distance). Distance only matters for perspective.
    const dist = activeCamera instanceof THREE.PerspectiveCamera
      ? activeCamera.position.distanceTo(controls.target)
      : 0;
    const pxToWorld = getPixelWorldSize(dist, activeCamera, domElement);

    const offset = new THREE.Vector3()
      .addScaledVector(right, dxScreenPx * pxToWorld)
      .addScaledVector(up, dyScreenPx * pxToWorld);

    const fromPos = activeCamera.position.clone();
    const fromTgt = controls.target.clone();
    const toPos = fromPos.clone().add(offset);
    const toTgt = fromTgt.clone().add(offset);
    const currentZoom = getZoom();

    animation.start(
      { position: fromPos, target: fromTgt, zoom: currentZoom },
      { position: toPos, target: toTgt, zoom: currentZoom },
      getAnimationDuration('camera', rm(), PAN_ANIMATION_DURATION_MS),
      (pos, tgt) => {
        activeCamera.position.copy(pos);
        controls.target.copy(tgt);
        activeCamera.lookAt(tgt);
        onRenderNeeded();
      },
      () => { /* no-op: controls stay enabled during pan */ },
    );
  }

  function goHome(): void {
    animation.cancel();
    const target = controls.target.clone();
    if (currentMode !== 'perspective') {
      perspCamera.position.copy(activeCamera.position);
      perspCamera.lookAt(target);
      activeCamera = perspCamera;
      swapControlsCamera(perspCamera);
      tumble.setEnabled(true);
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      currentMode = 'perspective';
    }
    onInteractionStart();
    animation.start(
      { position: perspCamera.position.clone(), target: target.clone(), zoom: getZoom() },
      { position: initialPosition.clone(), target: initialTarget.clone(), zoom: 1.0 },
      getAnimationDuration('camera', rm(), FRAME_SCENE_DURATION_MS),
      (pos, tgt) => { perspCamera.position.copy(pos); controls.target.copy(tgt); perspCamera.lookAt(tgt); onRenderNeeded(); },
      () => { controls.enabled = true; onInteractionEnd(); },
    );
    controls.enabled = false;
    onRenderNeeded();
  }

  /**
   * ADR-366 §A.6.Q5 — set the orbit pivot to a world point (Alt-press).
   *
   * Hands the point to tumble, which orbits RIGIDLY around it (the picked point
   * stays fixed on screen — no recenter jump). `controls.target` is left where it
   * is and gets carried along the camera's forward axis by the rigid orbit, so the
   * per-frame `controls.update()` `lookAt(target)` is a no-op and never fights it.
   * The POI cross (driven by `viewport.target` each frame) flashes at the target.
   */
  function setOrbitPivot(point: THREE.Vector3): void {
    animation.cancel();
    controls.enabled = true;
    // No recenter: hand the pivot to tumble, which orbits rigidly around it
    // (the point stays fixed on screen — no jump). controls.target is left where
    // it is and gets carried along the forward axis by the rigid orbit.
    tumble.setPivot(point);
    onRenderNeeded();
  }

  function swapControlsCamera(cam: THREE.PerspectiveCamera | THREE.OrthographicCamera): void {
    controls.object = cam;
    controls.update();
  }

  function updateOrthoFrustum(width: number, height: number): void {
    const a = width / Math.max(height, 1);
    const halfH = DEFAULT_ORTHO_SIZE / orthoCamera.zoom;
    orthoCamera.left = -halfH * a;
    orthoCamera.right = halfH * a;
    orthoCamera.top = halfH;
    orthoCamera.bottom = -halfH;
    orthoCamera.updateProjectionMatrix();
  }

  function updateAspect(width: number, height: number): void {
    perspCamera.aspect = width / Math.max(height, 1);
    perspCamera.updateProjectionMatrix();
    updateOrthoFrustum(width, height);
  }

  function update(): void {
    controls.update();
    tumble.update();
    // Phase 4.2: tick animation from main RAF (no separate requestAnimationFrame).
    animation.tick(performance.now());
  }

  /**
   * ADR-402 §Sub-Phase 2 — suspend camera navigation while a BIM edit gizmo
   * drag owns the pointer. OrbitControls' `onPointerMove` bails on
   * `enabled === false`, so toggling this mid-gesture cleanly stops orbit/pan
   * without stealing the pointer-capture the gizmo relies on. Tumble (Alt+drag)
   * is gated too, mirroring the controls flag.
   */
  function setControlsEnabled(enabled: boolean): void {
    controls.enabled = enabled;
    tumble.setEnabled(enabled);
  }

  function dispose(): void {
    controls.removeEventListener('change', onRenderNeeded);
    controls.removeEventListener('start', onInteractionStart);
    controls.removeEventListener('end', onInteractionEnd);
    domElement.removeEventListener('wheel', onSurfaceWheel, { capture: true });
    if (wheelIdleTimer !== null) { clearTimeout(wheelIdleTimer); wheelIdleTimer = null; }
    animation.dispose();
    tumble.dispose();
    controls.dispose();
  }

  return {
    get camera() { return activeCamera; },
    get target() { return controls.target; },
    get projectionMode() { return currentMode; },
    get isAnimating() { return animation.isAnimating; },
    setProjection, getZoom, setZoom, setZoomPreset,
    updateAspect, update, dispose,
    frameBounds, cancelAnimation, setSpeedModifier,
    snapToViewDirection, rollView, goHome,
    applyTumble: (dx: number, dy: number) => tumble.applyExternalRotation(dx, dy),
    pan,
    setOrbitPivot,
    setControlsEnabled,
  };
}
