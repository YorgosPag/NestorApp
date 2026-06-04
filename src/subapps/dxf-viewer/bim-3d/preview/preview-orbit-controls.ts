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

export class PreviewOrbitControls {
  private readonly controls: OrbitControls;
  /** Guards our own `update()` calls so they don't register as user input. */
  private programmatic = false;
  private userAdjusted = false;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement, onChange: () => void) {
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
    this.recenter();
  }

  /** True once the user has zoomed/panned/rotated — callers then preserve the view. */
  get adjusted(): boolean {
    return this.userAdjusted;
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
    this.controls.dispose();
  }
}
