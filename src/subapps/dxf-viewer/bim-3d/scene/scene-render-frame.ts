// ============================================================================
// SCENE RENDER FRAME — per-RAF body extracted from `ThreeJsSceneManager`
// (ADR-366 Phase 4.5) to keep the manager under the 500-line cap. Pure
// function: receives a context object with the live scene services and
// stateful flags via closures.
// ============================================================================

import * as THREE from 'three';
import { useCameraTargetStore } from '../stores/CameraTargetStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { detectSnapCandidate } from '../viewport/view-snap-detector';
import type { ShadowModulator } from '../lighting/shadow-modulator';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';
import type { AnimationManager } from '../viewport/animation-manager';
import type { FocusOutlineRenderer } from '../accessibility/FocusOutlineRenderer';
import type { IdleDetector } from '../lighting/idle-detector';
import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import type { SectionSceneController } from './section-scene-controller';
import type { DxfBackdropCache } from './dxf-backdrop-cache';
import type { HoverBeautyCache } from './hover-beauty-cache';

export interface RenderFrameContext {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  /** ADR-516 Phase 2 — frozen DXF backdrop (entity-drag 1:1 follow); inert until armed. */
  readonly dxfBackdrop: DxfBackdropCache;
  /** ADR-549 Φ3 — beauty snapshot for the instant hover-only fast path (blit + outline, no re-render). */
  readonly hoverBeautyCache: HoverBeautyCache;
  readonly viewport: ViewportCamera;
  readonly viewCube: ViewCubeEngine;
  readonly animationManager: AnimationManager;
  readonly focusOutlineRenderer: FocusOutlineRenderer;
  readonly idleDetector: IdleDetector;
  readonly ssaoModulator: SSAOModulator;
  readonly shadowModulator: ShadowModulator;
  readonly pathTracerRenderer: PathTracerRenderer;
  readonly sectionController: SectionSceneController;
  readonly poi: {
    updateTarget(target: THREE.Vector3): void;
    updateCamera(camera: THREE.Camera): void;
    updateFade(delta: number): void;
  };
  readonly isInteracting: () => boolean;
}

export function renderSceneFrame(ctx: RenderFrameContext, now: number, delta: number): void {
  const { viewport, viewCube, animationManager, focusOutlineRenderer, idleDetector,
          ssaoModulator, pathTracerRenderer, sectionController, poi } = ctx;
  viewport.update();
  animationManager.tick(now);
  useCameraTargetStore.getState().syncFromCamera(viewport.camera, viewport.target);
  focusOutlineRenderer.syncWorldMatrix();
  const interacting = ctx.isInteracting();
  if (interacting) idleDetector.notifyActive();
  else idleDetector.notifyIdle();
  // ADR-366 §B.5 — adaptive shadows: OFF while the view moves (camera drag OR cursor sweep — the
  // ~40ms PCF cost that saturated the main thread → cursor «swim»), ON the instant it settles.
  // Pre-warmed (`ShadowModulator.warmUp`) so the toggle is a shader-cache hit, no recompile stall.
  // ADR-366 §B.5 — adaptive shadows: OFF while the view moves (camera drag / damping fed here;
  // cursor sweep self-detected inside the modulator), ON at rest. `dxf-no-shadows`='1' forces OFF.
  const diagNoShadows = typeof window !== 'undefined' && window.localStorage.getItem('dxf-no-shadows') === '1';
  ctx.shadowModulator.update(diagNoShadows || interacting || viewport.isAnimating);
  poi.updateTarget(viewport.target);
  poi.updateCamera(viewport.camera);
  poi.updateFade(delta);
  viewCube.sync(
    viewport.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
    viewport.target,
  );
  if (!interacting && !viewport.isAnimating) {
    detectSnapCandidate(viewport.camera.position, viewport.target);
  }
  if (ctx.dxfBackdrop.isActive()) {
    // ADR-516 Phase 2 — frozen DXF backdrop: blit the cached static underlay + render only the live
    // BIM and gizmo on top, so the thousands of underlay lines are NOT re-drawn each drag frame
    // (GPU back-pressure root). Camera is fixed during an entity drag → the cache stays valid.
    ctx.dxfBackdrop.renderFrame(ctx.renderer, ctx.scene, viewport.camera);
  } else if (pathTracerRenderer.isActive) {
    if (viewport.isAnimating) {
      pathTracerRenderer.cancel();
      useViewMode3DStore.getState().enterRasterMode();
    } else {
      try {
        pathTracerRenderer.renderSample();
      } catch {
        pathTracerRenderer.cancel();
        useViewMode3DStore.getState().enterRasterMode();
      }
    }
  } else if (sectionController.isStencilActive()) {
    sectionController.renderFrameWithCaps(viewport.camera, interacting);
  } else if (ssaoModulator.isSsaoActive()) {
    // Camera settled → full composer pass with SSAO (Revit-style refine-on-idle).
    try {
      ssaoModulator.render();
    } catch (err) {
      console.error('[3D] ssaoModulator.render() threw:', err);
      ssaoModulator.disableSSAO();
    }
  } else {
    // Navigating (or pre-idle window) → direct raster, no post-FX. Skips the
    // composer FBO round-trip + program churn that caused zoom/orbit lag.
    ssaoModulator.renderRaster();
  }
  // ADR-549 Φ3 — snapshot the CLEAN beauty (pre-outline) for the hover-only fast path, but ONLY on a
  // cacheable static frame. Any backdrop-drag / section / path-trace / camera-interaction / animation
  // frame INVALIDATES instead, so a later hover-only blit can never show a stale beauty.
  const cacheable = !ctx.dxfBackdrop.isActive() && !pathTracerRenderer.isActive
    && !sectionController.isStencilActive() && !interacting && !viewport.isAnimating;
  if (cacheable) ctx.hoverBeautyCache.capture(ctx.renderer);
  else ctx.hoverBeautyCache.invalidate();

  // ADR-536 — composite the selection silhouette ON TOP of whatever the scene path
  // rendered (raster / SSAO / section caps), so the outline looks identical on every
  // interactive path. No-op when nothing is selected. (Path-tracer is handled above
  // and intentionally excluded — final-render mode.)
  // ADR-516 — adaptive quality: the silhouette FBO + edge pass spikes to ~88ms on a weak
  // GPU and is the dominant drag cost; skip it while interacting (camera/gizmo drag), like
  // SSAO + shadows. Restored the instant the view settles (one crisp outlined frame).
  if (!pathTracerRenderer.isActive && !interacting) ssaoModulator.renderOutlineOverlayToScreen();
  // ADR-553 — ViewCube as a scissored sub-viewport of the MAIN renderer (single WebGL context).
  // Drawn LAST, into the corner of the final framebuffer, so it is untouched by SSAO/outline/post-FX
  // (AO-immune by construction, like the outline overlay above). Runs on every path incl. path-trace
  // (writes the screen AFTER the accumulation blit → no accumulation corruption).
  viewCube.composite();
}

/**
 * ADR-549 Φ3 — HOVER-ONLY fast path. When nothing but the hover changed, blit the cached beauty
 * (from a prior cacheable {@link renderSceneFrame}) and redraw ONLY the outline overlay (selection
 * gold + hover yellow) + the ViewCube — skipping the whole ~40ms beauty render. Returns false on a
 * cache MISS (no snapshot yet), so the caller falls back to a full `renderSceneFrame`.
 */
export function renderHoverOnlyFrame(ctx: RenderFrameContext): boolean {
  if (!ctx.hoverBeautyCache.blit(ctx.renderer)) return false;
  if (!ctx.pathTracerRenderer.isActive) ctx.ssaoModulator.renderOutlineOverlayToScreen();
  ctx.viewCube.composite();
  return true;
}
