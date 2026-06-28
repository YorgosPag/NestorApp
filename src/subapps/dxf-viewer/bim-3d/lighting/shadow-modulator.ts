import * as THREE from 'three';
import { DXF_TIMING } from '../../config/dxf-timing';

/**
 * ShadowModulator — ADR-366 §B.5 adaptive shadows (Revit / Maxon Cinema4D viewport doctrine):
 * full soft shadows when the view is SETTLED, shadows OFF while the user navigates/scans.
 *
 * WHY: browser-verified (Giorgio 2026-06-28, `dxf-perf-trace`) that the per-fragment shadow PCF
 * sampling is ~40 ms/frame on a weak/integrated GPU — essentially the WHOLE 3D render cost (with
 * shadows off, `cursor.totalLag` 60 ms → 14 ms ≈ render-off). Because the render fires on every
 * cursor/camera move, that 40 ms saturates the main thread → the cursor «swims». Big players drop
 * shadows (and other quality) during navigation and restore them on settle.
 *
 * SELF-CONTAINED MOTION SIGNAL: it owns a window `mousemove` listener (capture) — the ONE signal we
 * proved always fires — instead of the `pointer-activity` chain (which, routed through the 3D
 * pointer handler, did not reliably reach this modulator). Camera-drag/animation is fed in via
 * {@link update}. A debounced settle timer requests ONE repaint when motion stops, so the shadowed
 * still frame is drawn.
 *
 * THE RECOMPILE TRAP: toggling `renderer.shadowMap.enabled` changes a shader `#define`, so the
 * affected materials recompile — a ~400 ms stall the first time each variant is built. {@link warmUp}
 * pre-compiles the OFF variant once (the ON one is built by the first real render), so every runtime
 * toggle is a program-cache hit — zero per-toggle stall.
 *
 * STATIC SHADOW MAP: the renderer runs with `shadowMap.autoUpdate=false` (scene-setup) so the depth
 * map is NOT regenerated every frame for a static scene. This modulator owns the rebuild triggers:
 * the OFF→ON {@link update} toggle (first crisp frame after navigation) and {@link invalidateShadowMap}
 * (called at the geometry/light mutation SSoT).
 *
 * Pure renderer/scene state, zero React. Complements `QualityModulator` (soft↔sharp radius ramp);
 * this owns only the ON↔OFF enable.
 */
export class ShadowModulator {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly onNeedsRender: () => void;
  private warmed = false;
  /** Mirrors `renderer.shadowMap.enabled` so we toggle (and invalidate materials) ONLY on change. */
  private enabled: boolean;
  /** Wall-clock of the last cursor move (own listener — guaranteed to fire). */
  private lastMoveMs = 0;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onMove = (): void => {
    this.lastMoveMs = (typeof performance !== 'undefined' ? performance.now() : 0);
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    // After the cursor STOPS, request ONE render so restored shadows draw on the still frame — but
    // ONLY when shadows are currently OFF (turned off by recent canvas navigation). If they are
    // already on, the scene is unchanged, so we must NOT spawn a 40ms shadowed render every time the
    // cursor merely pauses (e.g. drifting over the snap toolbar — Giorgio 2026-06-28: «rAF 50ms over
    // the snap bar»). This keeps the viewport truly on-demand off the canvas.
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      if (!this.enabled) this.onNeedsRender();
    }, DXF_TIMING.gesture.SHADOW_SETTLE);
  };

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, onNeedsRender: () => void = () => {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.onNeedsRender = onNeedsRender;
    this.enabled = renderer.shadowMap.enabled;
    if (typeof window !== 'undefined') window.addEventListener('mousemove', this.onMove, true);
  }

  /**
   * Pre-compile the OFF (unshadowed) program variant of every current material, so the runtime
   * {@link update} toggle is a program-cache hit (no recompile stall). Idempotent; call once after
   * the BIM geometry exists. Restores the entry shadow state.
   */
  warmUp(camera: THREE.Camera): void {
    if (this.warmed) return;
    this.warmed = true;
    const initial = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = !initial;
    this.invalidateMaterials();
    this.renderer.compile(this.scene, camera);
    this.renderer.shadowMap.enabled = initial;
    this.invalidateMaterials();
    this.enabled = initial;
  }

  /**
   * Per-frame driver. Shadows ON only when the view is settled, OFF while moving — camera (passed in)
   * OR cursor (own `lastMoveMs`). No-op when already in the desired state.
   */
  update(cameraMoving: boolean): void {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const moving = cameraMoving || now - this.lastMoveMs < DXF_TIMING.gesture.SHADOW_SETTLE;
    const want = !moving;
    if (want === this.enabled) return;
    this.enabled = want;
    this.renderer.shadowMap.enabled = want;
    if (want) this.renderer.shadowMap.needsUpdate = true; // rebuild the map for the first crisp frame
    this.invalidateMaterials();
  }

  /**
   * ADR-366 §B.5 — force a ONE-shot shadow depth-map rebuild on the next render. With the renderer's
   * `shadowMap.autoUpdate=false` (scene-setup) the map is otherwise frozen across renders; call this
   * whenever shadow-casting geometry or the sun changes (the geometry/light mutation SSoT in
   * `ThreeJsSceneManager`) so the shadows are never stale. The {@link update} OFF→ON toggle already
   * flags it for the first crisp frame after navigation; this covers mutations while shadows are ON.
   */
  invalidateShadowMap(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  dispose(): void {
    if (typeof window !== 'undefined') window.removeEventListener('mousemove', this.onMove, true);
    if (this.settleTimer !== null) { clearTimeout(this.settleTimer); this.settleTimer = null; }
  }

  /** Force the affected materials to re-acquire their program (cache hit after `warmUp`). */
  private invalidateMaterials(): void {
    this.scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material;
      if (!mat) return;
      (Array.isArray(mat) ? mat : [mat]).forEach((m) => { m.needsUpdate = true; });
    });
  }
}
