/**
 * scene-manager-actions — pure helpers for ThreeJsSceneManager mutation
 * methods (syncBimEntities, syncDxfOverlay, selectBimEntity, loadHdri).
 * Extracted to keep the manager under the 500-line cap (CLAUDE.md N.7.1).
 */

import type * as THREE from 'three';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { applyBuildingVisibility } from '../utils/applyBuildingVisibility';
import { applyDxfOverlayFraming } from './scene-sync-dxf-overlay';
import type { BimSceneLayer } from './BimSceneLayer';
import type { FloorStackEntry } from './multi-floor-3d-source';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import type { FloorVisMode } from '../utils/floor-visibility-state';
import type { BimSelectionHighlighter } from '../systems/selection/BimSelectionHighlighter';
import type { KeyboardFocusManagerApi } from '../accessibility/KeyboardFocusManager';
import type { EnvmapGenerator } from '../lighting/envmap-generator';
import type { PathTracerRenderer } from '../render/PathTracerRenderer';
import type { SectionSceneController } from './section-scene-controller';
import type { DxfToThreeConverter } from '../converters/DxfToThreeConverter';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import { raycastWorldPoint } from '../systems/raycaster/BimEntityRaycaster';

export interface SyncBimEntitiesDeps {
  readonly bimLayer: BimSceneLayer;
  readonly selectionHighlighter: BimSelectionHighlighter;
  readonly keyboardFocusManager: KeyboardFocusManagerApi;
  readonly pathTracerRenderer: PathTracerRenderer;
  readonly sectionController: SectionSceneController;
}

export interface SyncBimEntitiesArgs {
  readonly entities: Bim3DEntities;
  readonly floorElevationMm: number;
  readonly activeLevelId: string | undefined;
  readonly floors: readonly FloorRef[];
  readonly buildings: readonly BuildingRef[];
  readonly activeBuildingId: string | null;
  readonly buildingVisModes: ReadonlyMap<string, BuildingVisMode>;
  /** ADR-382 Phase C — per-level visibility modes for pre-mesh hide filter. */
  readonly floorVisModes: ReadonlyMap<string, FloorVisMode>;
}

export function syncBimEntitiesIntoScene(
  deps: SyncBimEntitiesDeps,
  args: SyncBimEntitiesArgs,
): void {
  const selectedId = useSelection3DStore.getState().selectedBimId;
  deps.selectionHighlighter.onClear();
  // Phase 4.5: stale bimId refs die on rebuild — clear focus before new traversal.
  deps.keyboardFocusManager.clear();
  deps.bimLayer.sync(
    args.entities,
    args.floorElevationMm,
    args.activeLevelId,
    args.floors,
    args.buildings,
    args.activeBuildingId,
    args.buildingVisModes,
    args.floorVisModes,
  );
  if (args.buildingVisModes.size > 0) applyBuildingVisibility(deps.bimLayer.group, args.buildingVisModes);
  if (selectedId) deps.selectionHighlighter.onSelect(selectedId);
  deps.pathTracerRenderer.invalidateScene();
  deps.sectionController.ensureInit();
  deps.sectionController.applyState();
}

export interface SyncMultiFloorBimEntitiesArgs {
  /** Per-floor entity bundles + elevations (ADR-399 Phase B "all floors"). */
  readonly stack: readonly FloorStackEntry[];
  readonly floors: readonly FloorRef[];
  readonly buildings: readonly BuildingRef[];
  readonly activeBuildingId: string | null;
  readonly buildingVisModes: ReadonlyMap<string, BuildingVisMode>;
  readonly floorVisModes: ReadonlyMap<string, FloorVisMode>;
}

/**
 * ADR-399 Phase B — multi-floor variant of {@link syncBimEntitiesIntoScene}.
 * Identical highlighter/focus/selection/section bookkeeping; delegates the
 * stacked geometry build to `BimSceneLayer.syncMultiFloor`.
 */
export function syncMultiFloorBimEntitiesIntoScene(
  deps: SyncBimEntitiesDeps,
  args: SyncMultiFloorBimEntitiesArgs,
): void {
  const selectedId = useSelection3DStore.getState().selectedBimId;
  deps.selectionHighlighter.onClear();
  deps.keyboardFocusManager.clear();
  deps.bimLayer.syncMultiFloor(
    args.stack,
    args.floors,
    args.buildings,
    args.activeBuildingId,
    args.buildingVisModes,
    args.floorVisModes,
  );
  if (args.buildingVisModes.size > 0) applyBuildingVisibility(deps.bimLayer.group, args.buildingVisModes);
  if (selectedId) deps.selectionHighlighter.onSelect(selectedId);
  deps.pathTracerRenderer.invalidateScene();
  deps.sectionController.ensureInit();
  deps.sectionController.applyState();
}

export interface SyncDxfOverlayDeps {
  readonly dxfConverter: DxfToThreeConverter;
  readonly pathTracerRenderer: PathTracerRenderer;
  readonly sectionController: SectionSceneController;
  readonly viewport: ViewportCamera;
}

export function syncDxfOverlayIntoScene(
  deps: SyncDxfOverlayDeps,
  dxfScene: DxfScene | null,
  fitDone: boolean,
  onFitApplied: () => void,
): void {
  deps.dxfConverter.sync(dxfScene);
  deps.pathTracerRenderer.invalidateScene();
  applyDxfOverlayFraming({
    viewport: deps.viewport,
    bounds: deps.dxfConverter.getBounds(),
    fitDone,
    onFitApplied,
  });
  deps.sectionController.ensureInit();
  deps.sectionController.applyState();
}

export interface OrbitPivotDeps {
  readonly bimGroup: THREE.Group;
  readonly camera: THREE.Camera;
  readonly canvas: HTMLCanvasElement;
  readonly setOrbitPivot: (point: THREE.Vector3) => void;
  readonly onNavigationActive: () => void;
  readonly markDirty: () => void;
}

/**
 * ADR-366 §A.6.Q5 — Alt+click orbit-pivot picking. Raycasts the BIM scene at the
 * cursor; on a hit makes that world point the camera orbit center (no camera
 * movement) + flashes the POI cross. Returns true when a pivot was set, false
 * when the ray missed (caller leaves the current pivot + selection untouched).
 */
export function setBimOrbitPivot(deps: OrbitPivotDeps, clientX: number, clientY: number): boolean {
  const point = raycastWorldPoint(deps.bimGroup, deps.camera, deps.canvas, clientX, clientY);
  if (!point) return false;
  deps.setOrbitPivot(point);
  deps.onNavigationActive();
  deps.markDirty();
  return true;
}

/** Resolve bimType from the live BIM group by traversing once until matched. */
export function resolveBimEntityType(bimGroup: THREE.Group, bimId: string): string {
  let bimType = '';
  bimGroup.traverse((obj) => {
    if (bimType) return;
    const id = obj.userData['bimId'] as string | undefined;
    if (id === bimId) bimType = (obj.userData['bimType'] as string | undefined) ?? '';
  });
  return bimType;
}

export async function loadHdriIntoStore(
  url: string,
  envmapGenerator: EnvmapGenerator,
  pathTracerRenderer: PathTracerRenderer,
  onDirty: () => void,
): Promise<void> {
  const store = useEnvironmentStore.getState();
  store.setLoading(true);
  store.setError(false);
  try {
    await envmapGenerator.loadHdri(url);
    pathTracerRenderer.invalidateScene();
    onDirty();
  } catch {
    store.setError(true);
  } finally {
    store.setLoading(false);
  }
}
