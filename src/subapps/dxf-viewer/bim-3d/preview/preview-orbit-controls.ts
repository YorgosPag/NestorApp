/**
 * PreviewOrbitControls — shared zoom / pan / rotate navigation for the
 * «Edit Type» preview viewports (slab + wall). SSoT so the two near-identical
 * preview renderers do NOT duplicate camera-interaction wiring (ADR-412/ADR-414).
 *
 * RENDER-ON-DEMAND: a single re-render per gesture step (no RAF loop, damping OFF).
 *
 * NAVIGATION (mirrors the main 3D viewport, SSoT convention — Giorgio):
 *  - **Alt + left drag = ROTATE**, orbiting RIGIDLY around the point under the
 *    cursor at press time. The picked point stays FIXED on screen — the drawing
 *    does NOT jump to centre. Rotation uses the shared `orbitCameraAroundPivot`
 *    (same maths as the main tumble), NOT OrbitControls' rotate (which would
 *    `lookAt(target)` and recenter). While Alt is held we disable OrbitControls'
 *    left button so it does not also pan.
 *  - left drag (no Alt) = pan · wheel = zoom-to-cursor.
 *
 * View-preservation: tracks whether the USER has moved the camera. Callers keep
 * auto-framing on every layer edit while `adjusted === false`, then preserve the
 * user's zoom/pan/rotate once they take over.
 *
 * Standalone THREE — OUTSIDE the ADR-040 high-frequency canvas path.
 *
 * @see ./SlabTypePreviewRenderer.ts, ./WallTypePreviewRenderer.ts — consumers
 * @see ../viewport/orbit-around-pivot.ts — the shared rigid-orbit maths (SSoT)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { orbitCameraAroundPivot } from '../viewport/orbit-around-pivot';

/** Rotation speed (radians per pixel of drag) — tuned for the small preview. */
const PREVIEW_ROTATE_SPEED = 0.01;

export class PreviewOrbitControls {
  private readonly controls: OrbitControls;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly dom: HTMLElement;
  private readonly onChange: () => void;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onAltKeyDown: (e: KeyboardEvent) => void;
  private readonly onAltKeyUp: (e: KeyboardEvent) => void;
  /** Guards our own `update()` calls so they don't register as user input. */
  private programmatic = false;
  private userAdjusted = false;
  /** Alt-clicked rotation pivot (world); null → orbit about the look target. */
  private customPivot: THREE.Vector3 | null = null;
  private altDragActive = false;
  private lastX = 0;
  private lastY = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    onChange: () => void,
    onAltPick: (clientX: number, clientY: number) => void,
  ) {
    this.camera = camera;
    this.dom = dom;
    this.onChange = onChange;
    const controls = new OrbitControls(camera, dom);
    controls.enableRotate = false; // rotation is our rigid Alt+drag orbit, not OrbitControls
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.enableDamping = false; // render-on-demand — no inertia loop
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true; // pan in the screen plane (intuitive for a flat preview)
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, // no-op while Alt is held (pan disabled — see key listeners)
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.target.set(0, 0, 0);
    controls.addEventListener('change', () => {
      if (!this.programmatic) this.userAdjusted = true;
      onChange();
    });
    this.controls = controls;

    // While Alt is held, disable OrbitControls' pan (so left-drag does NOT pan) —
    // our pointer handlers own the Alt+left rigid orbit. A boolean toggle (clean,
    // no button-enum cast); zoom/dolly stay live. Window-level so the canvas need
    // not be focused for the modifier to register.
    this.onAltKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') controls.enablePan = false;
    };
    this.onAltKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') controls.enablePan = true;
    };
    this.onPointerDown = (e: PointerEvent): void => {
      if (!(e.altKey && e.button === 0)) return;
      controls.enablePan = false; // belt-and-suspenders if keydown was missed
      this.altDragActive = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      onAltPick(e.clientX, e.clientY); // set pivot (+ flash marker) under the cursor
    };
    this.onPointerMove = (e: PointerEvent): void => {
      if (!this.altDragActive) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.userAdjusted = true;
      orbitCameraAroundPivot(
        this.camera, this.customPivot ?? this.controls.target, this.controls.target,
        dx, dy, PREVIEW_ROTATE_SPEED,
      );
      this.onChange();
    };
    this.onPointerUp = (): void => { this.altDragActive = false; };
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onAltKeyDown);
    window.addEventListener('keyup', this.onAltKeyUp);

    this.recenter();
  }

  /** True once the user has zoomed/panned/rotated — callers then preserve the view. */
  get adjusted(): boolean {
    return this.userAdjusted;
  }

  /**
   * Set the rotation pivot to a world point (Alt-press). NO recenter: the next
   * Alt+drag orbits rigidly around it so the point stays fixed on screen — the
   * drawing does not jump to centre. SSoT maths in `orbit-around-pivot`.
   */
  setPivot(point: THREE.Vector3): void {
    this.customPivot = point.clone();
  }

  /**
   * Re-centre the orbit target on the origin and sync to the camera's current
   * position WITHOUT counting as user input. Call after the renderer's
   * `fitCamera()` so OrbitControls adopts the freshly-framed placement.
   */
  recenter(): void {
    this.programmatic = true;
    this.customPivot = null;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.programmatic = false;
  }

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onAltKeyDown);
    window.removeEventListener('keyup', this.onAltKeyUp);
    this.controls.dispose();
  }
}
