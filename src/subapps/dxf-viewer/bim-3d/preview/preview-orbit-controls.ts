/**
 * PreviewOrbitControls — shared zoom / pan / rotate navigation for the
 * «Edit Type» preview viewports (slab + wall). SSoT so the two near-identical
 * preview renderers do NOT duplicate camera-interaction wiring (ADR-412/ADR-414).
 *
 * RENDER-ON-DEMAND: the OrbitControls `change` event drives a single re-render
 * (no RAF loop, damping OFF — there is no inertia to animate). Mapping per
 * Giorgio: LEFT drag = pan, RIGHT drag = rotate, wheel = zoom (zoom-to-cursor).
 *
 * View-preservation: tracks whether the USER has moved the camera. Callers keep
 * auto-framing on every layer edit while `adjusted === false`, then preserve the
 * user's zoom/pan/rotate once they take over — so editing layers never snaps the
 * camera back.
 *
 * Standalone THREE — OUTSIDE the ADR-040 high-frequency canvas path.
 *
 * @see ./SlabTypePreviewRenderer.ts, ./WallTypePreviewRenderer.ts — consumers
 * @see ../viewport/viewport-camera.ts — the main viewport's OrbitControls usage
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** A left-press that moves less than this (px) is a click, not a pan. */
const ALT_CLICK_SLOP_PX = 4;

export class PreviewOrbitControls {
  private readonly controls: OrbitControls;
  private readonly dom: HTMLElement;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  /** Guards our own `update()` calls so they don't register as user input. */
  private programmatic = false;
  private userAdjusted = false;
  private altArmed = false;
  private downX = 0;
  private downY = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    onChange: () => void,
    onAltPick: (clientX: number, clientY: number) => void,
  ) {
    this.dom = dom;
    const controls = new OrbitControls(camera, dom);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.enableDamping = false; // render-on-demand — no inertia loop
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true; // pan in the screen plane (intuitive for a flat preview)
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.target.set(0, 0, 0);
    controls.addEventListener('change', () => {
      if (!this.programmatic) this.userAdjusted = true;
      onChange();
    });
    this.controls = controls;

    // Alt + left-click (a STATIC click, not a drag) → set the orbit pivot to the
    // picked point. Detected on pointer-up so OrbitControls' (near-zero) left-pan
    // is a no-op; mirrors the main viewport's tumble Alt+click convention
    // (ADR-366 §A.6.Q5). Alt + left-DRAG stays a pan (gesture exceeded the slop).
    this.onPointerDown = (e: PointerEvent): void => {
      this.altArmed = e.altKey && e.button === 0;
      this.downX = e.clientX;
      this.downY = e.clientY;
    };
    this.onPointerUp = (e: PointerEvent): void => {
      if (!this.altArmed) return;
      this.altArmed = false;
      if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) < ALT_CLICK_SLOP_PX) {
        onAltPick(e.clientX, e.clientY);
      }
    };
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointerup', this.onPointerUp);

    this.recenter();
  }

  /** True once the user has zoomed/panned/rotated — callers then preserve the view. */
  get adjusted(): boolean {
    return this.userAdjusted;
  }

  /**
   * Set the orbit pivot (rotation centre) to a world point. OrbitControls
   * preserves the camera→target offset across `update()`, so the camera position
   * is unchanged and the next rotation orbits around `point` (ADR-366 §A.6.Q5).
   */
  setPivot(point: THREE.Vector3): void {
    this.controls.target.copy(point);
    this.controls.update();
  }

  /**
   * Re-centre the orbit target on the origin and sync to the camera's current
   * position WITHOUT counting as user input. Call after the renderer's
   * `fitCamera()` so OrbitControls adopts the freshly-framed placement.
   */
  recenter(): void {
    this.programmatic = true;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.programmatic = false;
  }

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    this.dom.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
  }
}
