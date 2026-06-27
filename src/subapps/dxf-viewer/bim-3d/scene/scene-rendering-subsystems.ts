/**
 * scene-rendering-subsystems — factory for ThreeJsSceneManager rendering
 * subsystems (lighting modulators + envmap + path tracer + idle detector +
 * performance collector). Extracted to keep the manager under the 500-line
 * cap (CLAUDE.md N.7.1). Pure factory: no class state.
 */

import type * as THREE from 'three';
import { Vector2 } from 'three';
import { QualityModulator } from '../lighting/quality-modulator';
import { SSAOModulator } from '../lighting/ssao-modulator';
import { SelectionOutlinePass } from '../systems/selection/SelectionOutlinePass';
import { EnvmapGenerator } from '../lighting/envmap-generator';
import { PathTracerRenderer } from '../render/PathTracerRenderer';
import { PerformanceCollector } from '../performance/PerformanceCollector';
import { createSceneIdleDetector } from './scene-idle-handlers';
import type { IdleDetector } from '../lighting/idle-detector';
import type { BimSceneLayer } from './BimSceneLayer';

export interface SceneRenderingSubsystemsDeps {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly sun: THREE.DirectionalLight;
  readonly bimLayer: BimSceneLayer;
  readonly getCamera: () => THREE.Camera;
  readonly viewportSize: { readonly width: number; readonly height: number };
  /** Marks the scene dirty so the master scheduler renders an SSAO ramp frame. */
  readonly onNeedsRender: () => void;
}

export interface SceneRenderingSubsystems {
  readonly qualityModulator: QualityModulator;
  readonly ssaoModulator: SSAOModulator;
  /** ADR-536 — selection silhouette outline (composited after the scene render). */
  readonly selectionOutlinePass: SelectionOutlinePass;
  readonly envmapGenerator: EnvmapGenerator;
  readonly pathTracerRenderer: PathTracerRenderer;
  readonly idleDetector: IdleDetector;
  readonly performanceCollector: PerformanceCollector;
}

export function createSceneRenderingSubsystems(
  deps: SceneRenderingSubsystemsDeps,
): SceneRenderingSubsystems {
  const qualityModulator = new QualityModulator(deps.sun);
  // ADR-536 — built before the SSAO modulator so it can be inserted into the composer chain.
  const selectionOutlinePass = new SelectionOutlinePass(
    new Vector2(deps.viewportSize.width, deps.viewportSize.height),
    deps.scene,
    deps.getCamera(),
  );
  const ssaoModulator = new SSAOModulator(
    deps.renderer,
    deps.scene,
    deps.getCamera,
    deps.viewportSize.width,
    deps.viewportSize.height,
    deps.onNeedsRender,
    selectionOutlinePass,
  );
  const envmapGenerator = new EnvmapGenerator(deps.renderer, deps.scene);
  const pathTracerRenderer = new PathTracerRenderer(deps.renderer, deps.scene, deps.getCamera);
  const idleDetector = createSceneIdleDetector({
    qualityModulator,
    ssaoModulator,
    bimLayer: deps.bimLayer,
    pathTracerRenderer,
  });
  const performanceCollector = new PerformanceCollector(deps.renderer, deps.scene);
  performanceCollector.start();
  return {
    qualityModulator,
    ssaoModulator,
    selectionOutlinePass,
    envmapGenerator,
    pathTracerRenderer,
    idleDetector,
    performanceCollector,
  };
}
