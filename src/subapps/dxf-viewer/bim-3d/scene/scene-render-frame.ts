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

export interface RenderFrameContext {
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
  if (pathTracerRenderer.isActive) {
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
  // ADR-536 — composite the selection silhouette ON TOP of whatever the scene path
  // rendered (raster / SSAO / section caps), so the outline looks identical on every
  // interactive path. No-op when nothing is selected. (Path-tracer is handled above
  // and intentionally excluded — final-render mode.)
  if (!pathTracerRenderer.isActive) ssaoModulator.renderOutlineOverlayToScreen();
  // ADR-553 — ViewCube as a scissored sub-viewport of the MAIN renderer (single WebGL context).
  // Drawn LAST, into the corner of the final framebuffer, so it is untouched by SSAO/outline/post-FX
  // (AO-immune by construction, like the outline overlay above). Runs on every path incl. path-trace
  // (writes the screen AFTER the accumulation blit → no accumulation corruption).
  viewCube.composite();
}
