/**
 * ThreeJsSceneManager teardown — extracted from `ThreeJsSceneManager.dispose()`
 * to keep the orchestrator under the 500-line module budget (CLAUDE.md N.7.1).
 *
 * Pure function: receives every disposable / unsubscribe it must touch and
 * tears them down in the same order the in-class implementation used.
 */

import type * as THREE from 'three';
import type { BimSceneLayer } from './BimSceneLayer';
import type { SectionSceneController } from './section-scene-controller';
import type { AnimationManager } from '../viewport/animation-manager';
import type { FocusOutlineRenderer } from '../accessibility/FocusOutlineRenderer';
import type { KeyboardFocusManagerApi } from '../accessibility/KeyboardFocusManager';
import type { IdleDetector } from '../lighting/idle-detector';
import type { QualityModulator } from '../lighting/quality-modulator';
import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { EnvmapGenerator } from '../lighting/envmap-generator';
import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import type { PerformanceCollector } from '../performance/PerformanceCollector';
import type { BimSelectionHighlighter } from '../systems/selection/BimSelectionHighlighter';
import type { DxfToThreeConverter } from '../converters/DxfToThreeConverter';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';
import type { WaypointDragHandleRenderer } from '../animation/WaypointDragHandle';

export interface SceneManagerDisposeDeps {
  readonly renderer: THREE.WebGLRenderer;
  readonly rafHandle: number | null;
  readonly envStoreUnsub: () => void;
  readonly focusUnsub: () => void;
  readonly sectionController: SectionSceneController;
  readonly waypointDragHandleRenderer: WaypointDragHandleRenderer;
  readonly animationManager: AnimationManager;
  readonly focusOutlineRenderer: FocusOutlineRenderer;
  readonly keyboardFocusManager: KeyboardFocusManagerApi;
  readonly idleDetector: IdleDetector;
  readonly qualityModulator: QualityModulator;
  readonly pathTracerRenderer: PathTracerRenderer;
  readonly ssaoModulator: SSAOModulator;
  readonly envmapGenerator: EnvmapGenerator;
  readonly performanceCollector: PerformanceCollector;
  readonly selectionHighlighter: BimSelectionHighlighter;
  readonly bimLayer: BimSceneLayer;
  readonly dxfConverter: DxfToThreeConverter;
  readonly viewport: ViewportCamera;
  readonly viewCube: ViewCubeEngine;
  readonly poi: { dispose(): void };
}

export function disposeSceneManagerResources(deps: SceneManagerDisposeDeps): void {
  deps.envStoreUnsub();
  deps.sectionController.dispose();
  deps.waypointDragHandleRenderer.dispose();
  const dom = deps.renderer.domElement;
  if (deps.rafHandle !== null) cancelAnimationFrame(deps.rafHandle);
  deps.animationManager.dispose();
  deps.focusUnsub();
  deps.focusOutlineRenderer.dispose();
  deps.keyboardFocusManager.dispose();
  deps.idleDetector.dispose();
  deps.qualityModulator.dispose();
  deps.pathTracerRenderer.dispose();
  deps.ssaoModulator.dispose();
  deps.envmapGenerator.dispose();
  deps.performanceCollector.dispose();
  deps.selectionHighlighter.dispose();
  deps.bimLayer.dispose();
  deps.dxfConverter.dispose();
  deps.viewport.dispose();
  deps.viewCube.dispose();
  deps.poi.dispose();
  deps.renderer.dispose();
  if (dom.parentNode) dom.parentNode.removeChild(dom);
}
