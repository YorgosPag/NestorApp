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
}
