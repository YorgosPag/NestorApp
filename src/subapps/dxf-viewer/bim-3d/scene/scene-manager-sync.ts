/**
 * scene-manager-sync — high-level BIM scene-sync orchestration extracted from
 * ThreeJsSceneManager. Wraps the `scene-manager-actions` primitives with the
 * manager's post-sync side-effects (per-face overlay refresh, SSAO/shadow warm-up,
 * dirty flag), so the manager keeps thin delegating wrappers and stays under the
 * 500-line SRP cap (CLAUDE.md N.7.1).
 */

import type * as THREE from 'three';
import {
  syncBimEntitiesIntoScene,
  syncMultiFloorBimEntitiesIntoScene,
  syncDxfOverlayIntoScene,
  syncDxfOverlayMultiFloorIntoScene,
  type SyncBimEntitiesDeps,
  type SyncBimEntitiesArgs,
  type SyncMultiFloorBimEntitiesArgs,
  type SyncDxfOverlayDeps,
} from './scene-manager-actions';
import { applyFloorVisibility as applyFloorVis } from '../utils/applyFloorVisibility';
import { applyBuildingVisibility as applyBuildingVis } from '../utils/applyBuildingVisibility';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import type { FloorVisMode } from '../utils/floor-visibility-state';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import type { FaceSelectionHighlighter } from '../systems/selection/FaceSelectionHighlighter';
import type { StairSubElementHighlighter } from '../systems/selection/StairSubElementHighlighter';
import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { ShadowModulator } from '../lighting/shadow-modulator';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfOverlayFloorEntry } from '../converters/DxfToThreeConverter';

/** Post-sync side-effect subsystems shared by every BIM scene-sync wrapper. */
export interface SceneSyncSideEffects {
  readonly faceHighlighter: FaceSelectionHighlighter;
  readonly faceHoverHighlighter: FaceSelectionHighlighter;
  /** ADR-358 Q19 — re-attach the per-tread/riser overlay after the mesh rebuild. */
  readonly stairSubElementHighlighter: StairSubElementHighlighter;
  readonly ssaoModulator: SSAOModulator;
  readonly shadowModulator: ShadowModulator;
  readonly camera: THREE.Camera;
  readonly markDirty: () => void;
}

/**
 * Assemble the shared BIM-sync deps bundle from the manager's subsystems. Indexed-access
 * param types (no class imports) keep the manager's wrapper a single line (N.7.1).
 */
export function buildBimSyncDeps(
  bimLayer: SyncBimEntitiesDeps['bimLayer'],
  selectionHighlighter: SyncBimEntitiesDeps['selectionHighlighter'],
  hoverHighlighter: SyncBimEntitiesDeps['hoverHighlighter'],
  keyboardFocusManager: SyncBimEntitiesDeps['keyboardFocusManager'],
  pathTracerRenderer: SyncBimEntitiesDeps['pathTracerRenderer'],
  sectionController: SyncBimEntitiesDeps['sectionController'],
): SyncBimEntitiesDeps {
  return { bimLayer, selectionHighlighter, hoverHighlighter, keyboardFocusManager, pathTracerRenderer, sectionController };
}

/** Assemble the post-sync side-effect bundle; derives `camera` from the viewport. */
export function buildSceneSyncSideEffects(
  faceHighlighter: SceneSyncSideEffects['faceHighlighter'],
  faceHoverHighlighter: SceneSyncSideEffects['faceHoverHighlighter'],
  stairSubElementHighlighter: SceneSyncSideEffects['stairSubElementHighlighter'],
  ssaoModulator: SceneSyncSideEffects['ssaoModulator'],
  shadowModulator: SceneSyncSideEffects['shadowModulator'],
  viewport: { readonly camera: THREE.Camera },
  markDirty: () => void,
): SceneSyncSideEffects {
  return { faceHighlighter, faceHoverHighlighter, stairSubElementHighlighter, ssaoModulator, shadowModulator, camera: viewport.camera, markDirty };
}

/** Assemble the DXF-overlay deps bundle (converter + path-tracer + section + viewport). */
export function buildSyncDxfOverlayDeps(
  dxfConverter: SyncDxfOverlayDeps['dxfConverter'],
  pathTracerRenderer: SyncDxfOverlayDeps['pathTracerRenderer'],
  sectionController: SyncDxfOverlayDeps['sectionController'],
  viewport: SyncDxfOverlayDeps['viewport'],
): SyncDxfOverlayDeps {
  return { dxfConverter, pathTracerRenderer, sectionController, viewport };
}

/** ADR-539 / ADR-358 Q19 — re-attach both per-face overlays + the stair sub-element overlay after rebuild. */
function refreshFaceOverlays(fx: SceneSyncSideEffects): void {
  fx.faceHighlighter.refresh();
  fx.faceHoverHighlighter.refresh();
  fx.stairSubElementHighlighter.refresh();
}

/** Single-floor BIM sync + ADR-366 §B.5 warm-up/shadow/dirty bookkeeping. */
export function syncBimEntities(
  deps: SyncBimEntitiesDeps,
  args: SyncBimEntitiesArgs,
  fx: SceneSyncSideEffects,
): void {
  syncBimEntitiesIntoScene(deps, args);
  refreshFaceOverlays(fx);
  // ADR-366 §B.5 — SSAO warm-up only when idle photorealism is opted in (heavy sync GPU render).
  if (useViewMode3DStore.getState().autoPreviewEnabled) fx.ssaoModulator.warmUp();
  // ADR-366 §B.5 — pre-compile the OFF shadow variant so the adaptive toggle is a cache hit
  // (no ~400ms first-compile stall). Idempotent.
  fx.shadowModulator.warmUp(fx.camera);
  fx.shadowModulator.invalidateShadowMap(); // geometry changed → rebuild static shadow map.
  fx.markDirty();
}

/** ADR-399 Phase B — multi-floor BIM sync + warm-up/shadow/dirty bookkeeping. */
export function syncBimEntitiesMultiFloor(
  deps: SyncBimEntitiesDeps,
  args: SyncMultiFloorBimEntitiesArgs,
  fx: SceneSyncSideEffects,
): void {
  syncMultiFloorBimEntitiesIntoScene(deps, args);
  refreshFaceOverlays(fx);
  fx.ssaoModulator.warmUp();
  fx.shadowModulator.invalidateShadowMap(); // ADR-366 §B.5 — geometry changed → rebuild static shadow map.
  fx.markDirty();
}

/** ADR-382 Phase C — per-floor visibility + shadow-map rebuild (hidden geometry stops casting). */
export function applyFloorVisibility(
  group: THREE.Group,
  modes: ReadonlyMap<string, FloorVisMode>,
  shadowModulator: ShadowModulator,
  markDirty: () => void,
): void {
  applyFloorVis(group, modes);
  shadowModulator.invalidateShadowMap(); // ADR-366 §B.5
  markDirty();
}

/** Building-level visibility + shadow-map rebuild (hidden geometry stops casting). */
export function applyBuildingVisibility(
  group: THREE.Group,
  modes: ReadonlyMap<string, BuildingVisMode>,
  shadowModulator: ShadowModulator,
  markDirty: () => void,
): void {
  applyBuildingVis(group, modes);
  shadowModulator.invalidateShadowMap(); // ADR-366 §B.5
  markDirty();
}

/** First-frame camera-fit latch shared by the DXF overlay wrappers. */
export interface DxfOverlayFitState {
  readonly done: boolean;
  readonly markDone: () => void;
}

/** Single-floor DXF wireframe overlay sync + dirty flag. */
export function syncDxfOverlay(
  deps: SyncDxfOverlayDeps,
  dxfScene: DxfScene | null,
  fit: DxfOverlayFitState,
  markDirty: () => void,
): void {
  syncDxfOverlayIntoScene(deps, dxfScene, fit.done, fit.markDone);
  markDirty();
}

/** ADR-399 Phase B — stacked per-floor DXF overlay sync + dirty flag. */
export function syncDxfOverlayMultiFloor(
  deps: SyncDxfOverlayDeps,
  entries: readonly DxfOverlayFloorEntry[],
  fit: DxfOverlayFitState,
  markDirty: () => void,
): void {
  syncDxfOverlayMultiFloorIntoScene(deps, entries, fit.done, fit.markDone);
  markDirty();
}
