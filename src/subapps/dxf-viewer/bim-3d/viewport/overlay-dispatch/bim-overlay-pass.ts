'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-551 + ADR-555 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-551-canvas-viewport-census-2d-3d.md
 * docs/centralized-systems/reference/adrs/ADR-555-unified-3d-projected-overlay-dispatch-canvas.md
 *
 * bim-overlay-pass — the 3D sibling of the 2D `paintOverlayDispatchFrame` (ADR-552/554). It is the
 * ONE pull-model frame renderer that folds the 5 camera-projected Canvas2D overlays of the 3D
 * viewport (grip / DXF hover-glow / wall-HUD / tracking / placement) into ONE `<canvas>` with a
 * z-ordered multi-pass dispatch (ADR-551 §5.2 #4/#5 + §5.3 — «ισχυρότερο εύρημα»).
 *
 * Why a SIBLING and not the 2D primitive itself: the 2D dispatch takes the `transform` from a React
 * prop and repaints on a React effect / zero-lag scheduler. The 3D passes are driven by the LIVE
 * perspective camera every RAF frame and need a per-frame camera-motion gate + a shared GPU depth
 * occluder — concerns the 2D primitive has no notion of. The low-level pieces are already SSoT
 * (`sizeCanvasToContainerDpr`, `overlay-raf.ts` lifecycle, the `makeGripPlanToCanvas` projector); this
 * file only adds the 3D-specific frame loop. Two siblings of the same pull model, zero duplicate.
 *
 * **Pull model:** the dispatch sizes (DPR-aware) + clears the canvas ONCE, then calls every active
 * painter in array (z-) order. A painter NEVER clears/resizes (else painters would wipe each other).
 *
 * **Dirty/skip gate (generalises ADR-549 Phase 3 to the frame level):** the old `DxfHoverGlowOverlay2D`
 * deliberately did NOT re-clear+re-stroke+re-upload its full-DPR canvas every frame when nothing
 * changed (same hovered id, same size, static camera) — that GPU compositing work delayed the
 * crosshair's paint → the cursor «lagged» while hovering. To keep that win after the merge, the frame
 * skips entirely (no clear, no paint → last frame's pixels stay) when the camera is static, the active
 * set is unchanged, and no active pass reports itself dirty. A pass with no `isDirty` is conservative
 * (always repaint when active) — exactly the pre-merge behaviour of grips/wall-HUD/tracking/placement.
 */

import type * as THREE from 'three';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import type { GripDepthOccluder } from '../../grips/grip-3d-depth-occluder';
import { sizeCanvasToContainerDpr } from '../../../rendering/canvas/withCanvasState';

/**
 * Per-frame context handed to every pass. The dispatch resolves the live camera, the sized+cleared
 * 2D context, and the shared occluder once; passes read their own (non-reactive) high-frequency
 * payloads inside `paint`.
 */
export interface BimOverlayFrame {
  readonly ctx: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.Camera;
  readonly manager: ThreeJsSceneManager;
  readonly occluder: GripDepthOccluder | null;
}

/**
 * One overlay layer. `active` is the low-frequency gate (drives the dispatch RAF on/off). `paint`
 * draws this layer through the live-camera projector — it NEVER clears/resizes the shared canvas.
 * `hideOnMotion` skips the pass while the camera orbits/zooms/pans (the big-player «hide handles
 * during navigation» pattern); set it false to keep following the camera (hover-glow). `isDirty`
 * (optional) lets a pass opt into the frame-skip optimisation — omit it to always repaint when active.
 */
export interface BimOverlayPass {
  readonly active: boolean;
  readonly hideOnMotion: boolean;
  readonly isDirty?: () => boolean;
  readonly paint: (frame: BimOverlayFrame) => void;
}

/**
 * Size (DPR-aware) + clear ONCE, then paint each active pass in z-order. Skips the whole frame —
 * keeping the previous pixels — when nothing changed (see the dirty/skip gate in the file header).
 * Each pass is wrapped in `ctx.save()/restore()` so a pass that sets glow/shadow/alpha state (the
 * hover-glow pre-pass) cannot leak it into the next pass on the shared canvas. No-op when the camera
 * or the 2D context is unavailable.
 *
 * `isCameraMoving` is the shared `useCameraMotionGate()` callback — it stores the camera pose, so it
 * MUST be called exactly once per frame; the dispatch owns that single call here. `forcePaint` is
 * raised by the leaf when the active-pass set changed since the last painted frame (so a layer that
 * just turned off is cleared away, including a shrink to an empty set).
 *
 * Returns `true` when it actually sized+cleared+painted, `false` when it skipped (dirty gate) or
 * no-op'd (no camera / no 2D context). The leaf uses this to update its «last painted set» signature
 * only on a real paint — so a `forcePaint` frame that no-ops on a momentarily-null camera does not
 * lose the pending repaint.
 */
export function paintBimOverlayFrame(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  manager: ThreeJsSceneManager,
  passes: ReadonlyArray<BimOverlayPass>,
  occluder: GripDepthOccluder | null,
  isCameraMoving: (camera: THREE.Camera) => boolean,
  forcePaint: boolean,
): boolean {
  const camera = manager.getCamera();
  if (!camera) return false;

  // ONE motion-gate call per frame (it mutates the stored pose), shared by every pass.
  const moving = isCameraMoving(camera);
  const visible = passes.filter((p) => p.active && !(moving && p.hideOnMotion));

  // Dirty/skip gate (ADR-549 Phase 3 at frame level). A pass with no `isDirty` ⇒ `isDirty?.()` is
  // `undefined !== false` ⇒ dirty (conservative repaint). When visible is empty, `.some` is false ⇒
  // skip (canvas already cleared on the frame the set emptied, via `forcePaint`).
  if (!forcePaint && !moving && !visible.some((p) => p.isDirty?.() !== false)) return false;

  const ctx = sizeCanvasToContainerDpr(canvas, container);
  if (!ctx) return false;

  for (const pass of visible) {
    ctx.save();
    pass.paint({ ctx, canvas, camera, manager, occluder });
    ctx.restore();
  }
  return true;
}

/**
 * Stable key for the set of currently-active passes (their index positions). The leaf compares this
 * against the last painted signature to decide `forcePaint` — so turning a layer off triggers exactly
 * one clearing frame, then the frame-skip gate takes over.
 */
export function activePassSignature(passes: ReadonlyArray<BimOverlayPass>): string {
  let sig = '';
  for (let i = 0; i < passes.length; i++) sig += passes[i].active ? `${i},` : '';
  return sig;
}
