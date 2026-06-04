/**
 * PreviewOrbitControls — shared zoom / pan / rotate navigation for the
 * «Edit Type» preview viewports (slab + wall). SSoT so the two near-identical
 * preview renderers do NOT duplicate camera-interaction wiring (ADR-412/ADR-414).
 *
 * RENDER-ON-DEMAND: the OrbitControls `change` event drives a single re-render
 * (no RAF loop, damping OFF — there is no inertia to animate).
 *
 * NAVIGATION (mirrors the main 3D viewport, SSoT convention — Giorgio):
 *  - **Alt + left drag = ROTATE**, orbiting around the point under the cursor at
 *    press time (`onAltPick` re-centres the orbit target there first). The Alt
 *    state flips `mouseButtons.LEFT` between ROTATE (Alt held) and PAN, since
 *    OrbitControls reads the button mapping at pointer-down.
 *  - left drag (no Alt) = pan · right drag = rotate · wheel = zoom-to-cursor.
 *
 * View-preservation: tracks whether the USER has moved the camera. Callers keep
 * auto-framing on every layer edit while `adjusted === false`, then preserve the
 * user's zoom/pan/rotate once they take over — so editing layers never snaps the
 * camera back.
 *
 * Standalone THREE — OUTSIDE the ADR-040 high-frequency canvas path.
 *
 * @see ./SlabTypePreviewRenderer.ts, ./WallTypePreviewRenderer.ts — consumers
 * @see ../viewport/tumble-rotation.ts — the main viewport's Alt+drag orbit (same UX)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class PreviewOrbitControls {
  private readonly controls: OrbitControls;
  private readonly dom: HTMLElement;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onAltKeyDown: (e: KeyboardEvent) => void;
  private readonly onAltKeyUp: (e: KeyboardEvent) => void;
  /** Guards our own `update()` calls so they don't register as user input. */
  private programmatic = false;
  private userAdjusted = false;

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
      LEFT: THREE.MOUSE.PAN, // flipped to ROTATE while Alt is held (see key listeners)
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.target.set(0, 0, 0);
    controls.addEventListener('change', () => {
      if (!this.programmatic) this.userAdjusted = true;
      onChange();
    });
    this.controls = controls;

    // Alt+left → orbit around the cursor point, matching the main viewport.
    // OrbitControls reads `mouseButtons.LEFT` at pointer-down, so we flip it to
    // ROTATE on the Alt keydown (window-level: the canvas need not be focused)
    // and back to PAN on keyup. On the Alt+left pointer-down we re-centre the
    // orbit target on the picked point FIRST (via `onAltPick`), so OrbitControls'
    // rotate then orbits around it — identical to the main tumble's `onAltPress`.
    this.onAltKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    };
    this.onAltKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    };
    this.onPointerDown = (e: PointerEvent): void => {
      if (e.altKey && e.button === 0) {
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE; // belt-and-suspenders if keydown was missed
        onAltPick(e.clientX, e.clientY);
      }
    };
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onAltKeyDown);
    window.addEventListener('keyup', this.onAltKeyUp);

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
    window.removeEventListener('keydown', this.onAltKeyDown);
    window.removeEventListener('keyup', this.onAltKeyUp);
    this.controls.dispose();
  }
}
