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
import type { SSAOModulator } from '../lighting/ssao-modulator';
import type { ShadowModulator } from '../lighting/shadow-modulator';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfOverlayFloorEntry } from '../converters/DxfToThreeConverter';

/** Post-sync side-effect subsystems shared by every BIM scene-sync wrapper. */
export interface SceneSyncSideEffects {
  readonly faceHighlighter: FaceSelectionHighlighter;
  readonly faceHoverHighlighter: FaceSelectionHighlighter;
  readonly ssaoModulator: SSAOModulator;
  readonly shadowModulator: ShadowModulator;
  readonly camera: THREE.Camera;
  readonly markDirty: () => void;
}

/** ADR-539 — re-attach both per-face overlays after the geometry rebuild. */
function refreshFaceOverlays(fx: SceneSyncSideEffects): void {
  fx.faceHighlighter.refresh();
  fx.faceHoverHighlighter.refresh();
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
