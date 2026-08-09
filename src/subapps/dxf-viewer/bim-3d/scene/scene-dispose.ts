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
import type { ShadowModulator } from '../lighting/shadow-modulator';
import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { EnvmapGenerator } from '../lighting/envmap-generator';
import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import type { PerformanceCollector } from '../performance/PerformanceCollector';
import type { BimSelectionHighlighter } from '../systems/selection/BimSelectionHighlighter';
import type { DxfToThreeConverter } from '../converters/DxfToThreeConverter';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';
import type { WaypointDragHandleRenderer } from '../animation/WaypointDragHandle';
import { disposeMeshReveal } from '../reveal/mesh-reveal-fade'; // ADR-693 Φ2

/**
 * Structural shape of everything torn down here: an overlay/layer owns GPU resources and
 * answers `dispose()`. Typed by SHAPE and not by class on purpose — this module is the
 * teardown order, not the layer catalogue, and importing 14 concrete classes to call one
 * method on each would make it depend on every subsystem it merely closes.
 */
interface SceneDisposable {
  dispose(): void;
}

/**
 * Overlays and scene layers — the first half of `ThreeJsSceneManager.dispose()`.
 *
 * Runs BEFORE {@link disposeSceneManagerResources}: an overlay may hold a reference into the
 * renderer/scene it decorates, so the decorations leave first and the machinery second — the
 * same order the in-class implementation used.
 */
export interface SceneOverlayDisposeDeps {
  readonly faceHighlighter: SceneDisposable;
  readonly faceHoverHighlighter: SceneDisposable;
  readonly dxfBackdrop: SceneDisposable;
  readonly hoverBeautyCache: SceneDisposable;
  /** ADR-358 Q19 — store subscription teardown, paired with its highlighter. */
  readonly stairSubUnsub: () => void;
  readonly stairSubElementHighlighter: SceneDisposable;
  /** ADR-715 — το ίδιο ζευγάρι για το «Τμήμα». */
  readonly buriedPartUnsub: () => void;
  readonly buriedPartHighlighter: SceneDisposable;
  /** ADR-558 — Cinema-4D-style ground grid. */
  readonly gridFloor: SceneDisposable;
  /** Υπόβαθρο χάρτη — υφές πλακιδίων στην κάρτα γραφικών. */
  readonly basemapLayer: SceneDisposable;
  readonly terrainLayer: SceneDisposable;
  readonly terrainContourLayer: SceneDisposable;
  readonly terrainCutCapLayer: SceneDisposable;
  readonly pointCloudLayer: SceneDisposable;
  readonly autoBreaklineLayer: SceneDisposable;
}

export function disposeSceneOverlayLayers(deps: SceneOverlayDisposeDeps): void {
  // ADR-539 + ADR-516 Phase 2 + ADR-549 Φ3 — release face overlays + caches.
  deps.faceHighlighter.dispose();
  deps.faceHoverHighlighter.dispose();
  deps.dxfBackdrop.dispose();
  deps.hoverBeautyCache.dispose();
  // Subscription + overlay always fall together: an overlay that survives its store keeps
  // painting from state nobody updates any more.
  deps.stairSubUnsub();
  deps.stairSubElementHighlighter.dispose();
  deps.buriedPartUnsub();
  deps.buriedPartHighlighter.dispose();
  deps.gridFloor.dispose(); // ADR-558 — unregister overlay + free grid geometry/material.
  // Χωρίς αυτό, κάθε άνοιγμα/κλείσιμο της 3Δ προβολής αφήνει πίσω τις υφές των πλακιδίων στη
  // μνήμη της κάρτας γραφικών — διαρροή που δεν φαίνεται ως σφάλμα, μόνο ως σταδιακή επιβράδυνση.
  deps.basemapLayer.dispose();
  deps.terrainLayer.dispose(); // ADR-650 M4 — drop store subs + free the terrain mesh geometry.
  deps.terrainContourLayer.dispose(); // ADR-650 M10d — drop store subs + free the contour line geometry.
  deps.terrainCutCapLayer.dispose(); // ADR-665 M2 — drop the storey/scope subs + free the cap geometry.
  deps.pointCloudLayer.dispose(); // ADR-650 M8β/Β — drop store sub + free the cloud buffers + material.
  deps.autoBreaklineLayer.dispose(); // ADR-650 M8β/Γ — drop the review sub + free the candidate lines.
  disposeMeshReveal(); // ADR-693 Φ2 — free any in-flight reveal veil (per-instance material + geometry).
}

export interface SceneManagerDisposeDeps {
  readonly renderer: THREE.WebGLRenderer;
  readonly envStoreUnsub: () => void;
  /** ADR-446 §2 — visible-background mode subscription teardown. */
  readonly bgModeUnsub: () => void;
  readonly focusUnsub: () => void;
  readonly sectionController: SectionSceneController;
  readonly waypointDragHandleRenderer: WaypointDragHandleRenderer;
  readonly animationManager: AnimationManager;
  readonly focusOutlineRenderer: FocusOutlineRenderer;
  readonly keyboardFocusManager: KeyboardFocusManagerApi;
  readonly idleDetector: IdleDetector;
  readonly qualityModulator: QualityModulator;
  readonly shadowModulator: ShadowModulator;
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
  deps.bgModeUnsub();
  deps.sectionController.dispose();
  deps.waypointDragHandleRenderer.dispose();
  const dom = deps.renderer.domElement;
  // ADR-040 Phase XXIII — no cancelAnimationFrame: scheduler unregister handled by caller.
  deps.animationManager.dispose();
  deps.focusUnsub();
  deps.focusOutlineRenderer.dispose();
  deps.keyboardFocusManager.dispose();
  deps.idleDetector.dispose();
  deps.qualityModulator.dispose();
  deps.shadowModulator.dispose();
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
