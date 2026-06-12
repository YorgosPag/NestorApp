/**
 * C4D-style quaternion tumble rotation (pole-free orbit).
 * PORT_AS_IS from GenArc tumbleRotation.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

import * as THREE from 'three';
import { TUMBLE_BASE_SPEED } from './viewport-constants';
import { orbitCameraAroundPivot } from './orbit-around-pivot';

export interface TumbleRotation {
  readonly update: () => void;
  readonly setSpeed: (speed: number) => void;
  readonly setEnabled: (enabled: boolean) => void;
  readonly dispose: () => void;
  readonly applyExternalRotation: (dxPx: number, dyPx: number) => void;
  /**
   * Set the orbit pivot to a WORLD point (Alt-press). The next Alt+drag orbits
   * rigidly around it — the point stays fixed on screen, no recenter jump. Pass
   * null to revert to orbiting about the look target.
   */
  readonly setPivot: (worldPoint: THREE.Vector3 | null) => void;
}

export interface TumbleOptions {
  readonly getCamera: () => THREE.Camera;
  readonly getTarget: () => THREE.Vector3;
  readonly domElement: HTMLElement;
  readonly onStart: () => void;
  readonly onChange: () => void;
  readonly onEnd: () => void;
  /**
   * ADR-366 §A.6.Q5 — fired on a STATIC Alt+left-click (Alt+pointerdown then
   * pointerup with no drag past threshold). The drag path still rotates; this
   * fires only when the gesture never crossed into a rotation. Tumble owns the
   * Alt+pointer gesture, so this is the reliable place to detect Alt-click
   * (the React `onClick` is suppressed by the intervening pointer drag).
   */
  readonly onAltClick?: (clientX: number, clientY: number) => void;
  /**
   * Fired on Alt+left pointer-DOWN, BEFORE any rotation. Re-centres the orbit
   * pivot on the point under the cursor so the drag that follows orbits around
   * THAT point (Giorgio: «το σημείο του κλικ = το σημείο περιστροφής»). Without
   * this the pivot only moved on a static click (pointer-up), so an Alt-press-
   * and-drag rotated around the stale scene centre.
   */
  readonly onAltPress?: (clientX: number, clientY: number) => void;
}

const DRAG_THRESHOLD_SQ = 9;

export function createTumbleRotation(opts: TumbleOptions): TumbleRotation {
  const { getCamera, getTarget, domElement, onStart, onChange, onEnd, onAltClick, onAltPress } = opts;

  let speed = TUMBLE_BASE_SPEED;
  let enabled = true;
  let customPivot: THREE.Vector3 | null = null;
  let pointerDown = false;
  let dragActive = false;
  let startX = 0;
  let startY = 0;
  let prevX = 0;
  let prevY = 0;

  /**
   * Rigid orbit around `pivot` (SSoT `orbitCameraAroundPivot`). The pivot stays
   * fixed on screen — no recenter jump — and `getTarget()` (controls.target) is
   * rotated along the forward axis so OrbitControls' per-frame `lookAt(target)`
   * is a no-op and never fights the orbit.
   */
  function orbit(dx: number, dy: number, pivot: THREE.Vector3): void {
    orbitCameraAroundPivot(getCamera(), pivot, getTarget(), dx, dy, speed);
    onChange();
  }

  /** Alt+drag — orbit around the Alt-clicked pivot (or the look target if none). */
  function applyRotation(dx: number, dy: number): void {
    orbit(dx, dy, customPivot ?? getTarget());
  }

  function onPointerDown(e: PointerEvent): void {
    if (!enabled || e.button !== 0 || !e.altKey) return;
    pointerDown = true;
    dragActive = false;
    startX = prevX = e.clientX;
    startY = prevY = e.clientY;
    // Re-centre the orbit pivot on the cursor point NOW, so the drag that
    // follows orbits around it (not the stale scene centre). applyRotation
    // reads getTarget() live, so this takes effect on the very first move.
    onAltPress?.(e.clientX, e.clientY);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!pointerDown) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    prevX = e.clientX;
    prevY = e.clientY;
    if (!dragActive) {
      const tx = e.clientX - startX;
      const ty = e.clientY - startY;
      if (tx * tx + ty * ty < DRAG_THRESHOLD_SQ) return;
      dragActive = true;
      onStart();
    }
    applyRotation(dx, dy);
  }

  function onPointerUp(e: PointerEvent): void {
    if (e.button !== 0 || !pointerDown) return;
    pointerDown = false;
    if (!dragActive) {
      // Static Alt+click (gesture never became a rotation) → orbit-pivot pick.
      onAltClick?.(e.clientX, e.clientY);
      return;
    }
    // No inertia (Giorgio 2026-06-12): the rotation stops the instant the pointer
    // is released — the drag fully drives the orbit, release ends it immediately.
    onEnd();
  }

  /**
   * Per-frame hook kept for the render loop / `TumbleRotation` interface. Inertia
   * was removed (2026-06-12) so there is no decay loop to advance — the orbit is
   * driven entirely by `onPointerMove`. Intentional no-op.
   */
  function update(): void { /* no-op — inertia removed */ }

  function setSpeed(s: number): void { speed = s; }
  function setEnabled(e: boolean): void { enabled = e; }
  function setPivot(worldPoint: THREE.Vector3 | null): void {
    customPivot = worldPoint ? worldPoint.clone() : null;
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);

  function dispose(): void {
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUp);
  }

  // ViewCube drag orbits around the look target (not the Alt-click pivot).
  function applyExternalRotation(dx: number, dy: number): void {
    orbit(dx, dy, getTarget());
  }

  return { update, setSpeed, setEnabled, dispose, applyExternalRotation, setPivot };
}
