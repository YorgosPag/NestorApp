/**
 * scene-manager-actions — pure helpers for ThreeJsSceneManager mutation
 * methods (syncBimEntities, syncDxfOverlay, selectBimEntity, loadHdri).
 * Extracted to keep the manager under the 500-line cap (CLAUDE.md N.7.1).
 */

import type * as THREE from 'three';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
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
import type { DxfToThreeConverter, DxfOverlayFloorEntry } from '../converters/DxfToThreeConverter';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import { raycastWorldPointOrPlane } from '../systems/raycaster/BimEntityRaycaster';
import { markBvhDirty } from '../systems/raycaster/bvh-setup';
import { withSuppressed3DToUniversalSync } from '../systems/selection/use-3d-selection-universal-bridge';

export interface SyncBimEntitiesDeps {
  readonly bimLayer: BimSceneLayer;
  readonly selectionHighlighter: BimSelectionHighlighter;
  /** ADR-538 — hover silhouette highlighter; cleared on rebuild so no stale mesh ref renders. */
  readonly hoverHighlighter: BimSelectionHighlighter;
  readonly keyboardFocusManager: KeyboardFocusManagerApi;
  readonly pathTracerRenderer: PathTracerRenderer;
  readonly sectionController: SectionSceneController;
}

/**
 * ADR-399 Phase B / ADR-382 Phase C — the floor/building visibility bundle that
 * travels together through every BIM scene-sync path. Extracted as ONE named
 * options object (big-player option-bag convention: Three.js `set(options)`,
 * Revit API option bags, Figma plugin params) so both public `ThreeJsSceneManager`
 * wrappers, both Args below, and all three `bim3d-resync` call sites compose it
 * instead of unrolling the same 5 params with the same defaults (CHECK 3.28
 * clone, ADR-584). Flat by design — the sync internals read `args.floors`/
 * `args.buildingVisModes`/… directly, so this intersects into the Args unchanged.
 */
export type FloorVisibilityScope = {
  readonly floors: readonly FloorRef[];
  readonly buildings: readonly BuildingRef[];
  readonly activeBuildingId: string | null;
  readonly buildingVisModes: ReadonlyMap<string, BuildingVisMode>;
  /** ADR-382 Phase C — per-level visibility modes for pre-mesh hide filter. */
  readonly floorVisModes: ReadonlyMap<string, FloorVisMode>;
};

/** The empty-scope default (no floors/buildings, all-default visibility) shared by every wrapper's default param. */
export const EMPTY_FLOOR_VIS_SCOPE: FloorVisibilityScope = {
  floors: [],
  buildings: [],
  activeBuildingId: null,
  buildingVisModes: new Map(),
  floorVisModes: new Map(),
};

export type SyncBimEntitiesArgs = {
  readonly entities: Bim3DEntities;
  readonly floorElevationMm: number;
  /** ADR-448 Phase 1b — datum-relative FFL of the storey ceiling (next floor up). */
  readonly nextFloorElevationMm: number | undefined;
  readonly activeLevelId: string | undefined;
} & FloorVisibilityScope;

/**
 * The highlighter/focus/BVH/selection/section bookkeeping that wraps EVERY BIM mesh
 * rebuild — identical for the single-floor and the multi-floor variant, which differ
 * ONLY in the `BimSceneLayer` call they make. `buildGeometry` is that one difference.
 *
 * Order matters: the selection snapshot is taken BEFORE the highlighters are cleared
 * (the rebuild drops the meshes they point at) and re-applied AFTER the new meshes
 * exist. Extracted as the single owner of this sequence (CHECK 3.28 clone, ADR-584).
 */
function rebuildBimMeshes(
  deps: SyncBimEntitiesDeps,
  scope: FloorVisibilityScope,
  buildGeometry: () => void,
): void {
  const selectedIds = useSelection3DStore.getState().selectedBimIds;
  deps.selectionHighlighter.onClear();
  deps.hoverHighlighter.onClear(); // ADR-538 — drop stale hovered mesh ref before rebuild
  // Phase 4.5: stale bimId refs die on rebuild — clear focus before new traversal.
  deps.keyboardFocusManager.clear();
  buildGeometry();
  // ADR-040 Φ-3D-pointer — fresh meshes need BVH trees; re-arm the per-pick walk.
  markBvhDirty(deps.bimLayer.group);
  if (scope.buildingVisModes.size > 0) applyBuildingVisibility(deps.bimLayer.group, scope.buildingVisModes);
  // ADR-402 Phase C — re-apply the highlight for the whole multi-selection.
  if (selectedIds.length > 0) deps.selectionHighlighter.onSelect(new Set(selectedIds));
  deps.pathTracerRenderer.invalidateScene();
  deps.sectionController.ensureInit();
  deps.sectionController.applyState();
  // ADR-455/665 — `applyState()`'s fast path (slider drag = unchanged cut composition)
  // skips the scene-wide `applyClippingPlanes`, so meshes JUST rebuilt above (column core
  // μπετόν, finish σοβάς skin, rebar cage, edge overlays) would keep `clippingPlanes=null`
  // and never cut — the finish appeared clipped only because its material was warmed by an
  // earlier slow path. Mirror the topo layer's contract: the layer rebuilt, so re-assert the
  // CURRENT planes onto the fresh BIM subtree. Subtree-scoped + idempotent (no scene-wide
  // needsUpdate storm); the controller stays the single owner of the planes.
  deps.sectionController.reapplyClipPlanesUnder(deps.bimLayer.group);
}

export function syncBimEntitiesIntoScene(
  deps: SyncBimEntitiesDeps,
  args: SyncBimEntitiesArgs,
): void {
  rebuildBimMeshes(deps, args, () => deps.bimLayer.sync(
    args.entities,
    args.floorElevationMm,
    args.activeLevelId,
    args.floors,
    args.buildings,
    args.activeBuildingId,
    args.buildingVisModes,
    args.floorVisModes,
    args.nextFloorElevationMm,
  ));
}

export type SyncMultiFloorBimEntitiesArgs = {
  /** Per-floor entity bundles + elevations (ADR-399 Phase B "all floors"). */
  readonly stack: readonly FloorStackEntry[];
} & FloorVisibilityScope;

/**
 * ADR-399 Phase B — multi-floor variant of {@link syncBimEntitiesIntoScene}.
 * Identical highlighter/focus/selection/section bookkeeping; delegates the
 * stacked geometry build to `BimSceneLayer.syncMultiFloor`.
 */
export function syncMultiFloorBimEntitiesIntoScene(
  deps: SyncBimEntitiesDeps,
  args: SyncMultiFloorBimEntitiesArgs,
): void {
  rebuildBimMeshes(deps, args, () => deps.bimLayer.syncMultiFloor(
    args.stack,
    args.floors,
    args.buildings,
    args.activeBuildingId,
    args.buildingVisModes,
    args.floorVisModes,
  ));
}

export interface SyncDxfOverlayDeps {
  readonly dxfConverter: DxfToThreeConverter;
  readonly pathTracerRenderer: PathTracerRenderer;
  readonly sectionController: SectionSceneController;
  readonly viewport: ViewportCamera;
}

/**
 * Post-convert bookkeeping shared by both DXF-overlay syncs (single-floor + stacked):
 * invalidate the path-tracer, frame the first loaded plan, re-arm the section planes.
 * The two callers differ ONLY in which converter call they make first (CHECK 3.28, ADR-584).
 */
function finalizeDxfOverlaySync(
  deps: SyncDxfOverlayDeps,
  fitDone: boolean,
  onFitApplied: () => void,
): void {
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

export function syncDxfOverlayIntoScene(
  deps: SyncDxfOverlayDeps,
  dxfScene: DxfScene | null,
  fitDone: boolean,
  onFitApplied: () => void,
): void {
  deps.dxfConverter.sync(dxfScene);
  finalizeDxfOverlaySync(deps, fitDone, onFitApplied);
}

/**
 * ADR-399 Phase B — stacked per-floor DXF overlay («Όλοι οι όροφοι»). Mirror of
 * {@link syncDxfOverlayIntoScene} but feeds the converter every floor's plan at
 * its datum-relative elevation; first-frame framing covers the whole stack.
 */
export function syncDxfOverlayMultiFloorIntoScene(
  deps: SyncDxfOverlayDeps,
  entries: readonly DxfOverlayFloorEntry[],
  fitDone: boolean,
  onFitApplied: () => void,
): void {
  deps.dxfConverter.syncMultiFloor(entries);
  finalizeDxfOverlaySync(deps, fitDone, onFitApplied);
}

export interface OrbitPivotDeps {
  readonly bimGroup: THREE.Group;
  readonly camera: THREE.Camera;
  readonly canvas: HTMLCanvasElement;
  /** Current orbit target — the camera-facing fallback plane passes through it. */
  readonly currentTarget: THREE.Vector3;
  /**
   * Floor-plane elevation (metres) of the DXF overlay, or null when no DXF is
   * loaded. When set, a BIM-miss raycast falls back to this horizontal plane
   * (where the DXF wireframe lives) so clicking the floor plan yields the real
   * cursor point — fixes «σε DXF η περιστροφή έφευγε στο κέντρο» (ADR-366 §A.6.Q5).
   */
  readonly groundY: number | null;
  readonly setOrbitPivot: (point: THREE.Vector3) => void;
  readonly onNavigationActive: () => void;
  readonly markDirty: () => void;
}

/**
 * ADR-366 §A.6.Q5 — Alt+click/Alt-press orbit-pivot picking. Raycasts the BIM
 * scene at the cursor; on a hit makes that world point the camera orbit center,
 * else falls back to a camera-facing plane through the current target so an
 * Alt+drag ALWAYS orbits around the cursor point (v3 fix: empty-space / DXF-only
 * clicks no longer no-op → «δεν γυρίζει γύρω από το σημείο»). Flashes the POI
 * cross. Returns true (a pivot is always resolvable unless the canvas has no size).
 */
export function setBimOrbitPivot(deps: OrbitPivotDeps, clientX: number, clientY: number): boolean {
  const point = raycastWorldPointOrPlane(
    deps.bimGroup, deps.camera, deps.canvas, clientX, clientY, deps.currentTarget, deps.groundY,
  );
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

export interface BimSelectionDeps {
  readonly bimGroup: THREE.Group;
  readonly selectionHighlighter: BimSelectionHighlighter;
}

/**
 * ADR-402 Phase C — selection mutation extracted from ThreeJsSceneManager
 * (keeps the manager under the 500-line cap, N.7.1).
 *
 * `replace` (plain click): null clears, otherwise the selection becomes exactly
 * the picked entity. `toggle` (Shift+click): adds/removes the picked entity.
 * In both cases the highlighter is re-synced to the resulting multi-selection.
 */
export function applyBimSelection(
  deps: BimSelectionDeps,
  bimId: string | null,
  mode: 'replace' | 'toggle',
): void {
  const store = useSelection3DStore.getState();
  if (mode === 'replace') {
    if (bimId === null) store.clearSelection();
    else store.selectEntity(bimId, resolveBimEntityType(deps.bimGroup, bimId));
  } else if (bimId !== null) {
    store.toggleEntity(bimId, resolveBimEntityType(deps.bimGroup, bimId));
  }
  const ids = useSelection3DStore.getState().selectedBimIds;
  if (ids.length === 0) deps.selectionHighlighter.onClear();
  else deps.selectionHighlighter.onSelect(new Set(ids));
}

/**
 * ADR-402 / ADR-532 — cross-mode selection hydration (universal 2D → 3D).
 *
 * Entering 3D, mirror the universal selection into the 3D store + highlighter so entities picked
 * in 2D STAY selected in 3D. Only ids that have 3D geometry (a resolvable `bimType`) can be
 * outlined here; every other selected entity (raw DXF, overlays…) remains untouched in the
 * universal truth — it simply has no mesh to highlight in this view.
 *
 * The 3D-store write is wrapped in {@link withSuppressed3DToUniversalSync}: without it the write
 * would echo through the 3D→universal bridge and `replaceEntitySelection([3D-subset])` would DROP
 * those non-3D entities from the universal selection. Hydration is strictly one-way (universal → 3D).
 */
export function hydrateBimSelectionFromUniversal(
  deps: BimSelectionDeps,
  universalIds: readonly string[],
): void {
  const ids: string[] = [];
  const types: Record<string, string> = {};
  for (const id of universalIds) {
    const bimType = resolveBimEntityType(deps.bimGroup, id);
    if (!bimType) continue; // no 3D geometry → nothing to outline in this view
    ids.push(id);
    types[id] = bimType;
  }
  withSuppressed3DToUniversalSync(() => useSelection3DStore.getState().setSelection(ids, types));
  if (ids.length === 0) deps.selectionHighlighter.onClear();
  else deps.selectionHighlighter.onSelect(new Set(ids));
}

/**
 * ADR-538 — drive the YELLOW hover silhouette: outline `bimId`, but NOT when it is already
 * selected (it keeps its gold selection outline — same `!selected` rule as the 2D
 * `determinePhase`). `null` clears. The hover sibling of {@link applyBimSelection}; the
 * caller marks the scene dirty.
 */
export function applyBimHover(highlighter: BimSelectionHighlighter, bimId: string | null): void {
  const selected = bimId !== null && useSelection3DStore.getState().selectedBimIds.includes(bimId);
  highlighter.onSelect(bimId !== null && !selected ? new Set([bimId]) : new Set());
}

/**
 * ADR-446 §2 — visible-background mode subscription (dark «σαν 2Δ» ↔ environment).
 * Per-view SSoT on `bim-render-settings-store` alongside `visualStyle`. The
 * EnvmapGenerator owns `scene.background`; flip it imperatively + repaint. The
 * matching edge-colour swap is rebuilt React-side (use-bim3d-vg-resync). Plain
 * zustand store → manual prev-guard. Extracted to keep the manager under the
 * 500-line cap (N.7.1). Returns the unsubscribe handle.
 */
export function initBackgroundModeSubscription(
  envmapGenerator: EnvmapGenerator,
  markDirty: () => void,
): () => void {
  envmapGenerator.setBackgroundMode(useBimRenderSettingsStore.getState().backgroundMode);
  let prevBgMode = useBimRenderSettingsStore.getState().backgroundMode;
  return useBimRenderSettingsStore.subscribe((s) => {
    if (s.backgroundMode === prevBgMode) return;
    prevBgMode = s.backgroundMode;
    envmapGenerator.setBackgroundMode(s.backgroundMode);
    markDirty();
  });
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
