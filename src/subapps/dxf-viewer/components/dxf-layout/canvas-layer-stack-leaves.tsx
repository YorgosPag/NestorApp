/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * After any architectural change → update the ADR changelog (same commit).
 *
 * CanvasLayerStack — Micro-leaf subscriber components (Phase E, ADR-040).
 *
 * Each leaf subscribes to a single high-frequency store so that only the
 * smallest possible React subtree re-renders on mousemove / snap / hover.
 *
 * Shell CanvasLayerStack imports these and composes them without subscribing
 * to any high-frequency store itself.
 */

'use client';
import React, { useMemo, useSyncExternalStore, useEffect } from 'react';
import { perfStart, perfEnd, PERF_LINE_PROFILE } from '../../debug/perf-line-profile';
import { useHoveredOverlay } from '../../systems/hover/useHover';
import { DxfCanvas, LayerCanvas } from '../../canvas-v2';
import SnapIndicatorOverlay from '../../canvas-v2/overlays/SnapIndicatorOverlay';
import { subscribeSnapResult, getFullSnapResult } from '../../systems/cursor/ImmediateSnapStore';
import { toSnapIndicatorView } from '../../snapping/extended-types';
import { useGuideWorkflowComputed } from '../../hooks/guides/useGuideWorkflowComputed';
import { useDraftPolygonLayer } from '../../hooks/layers/useDraftPolygonLayer';
import { useHoveredEntity } from '../../systems/hover/useHover';
import { useSelectedRoofEdge } from '../../bim/roofs/useRoofEdgeSelection';
// ADR-532 B4 — grip render is selection-driven; the leaf self-subscribes so the
// orchestrator (CanvasSection) no longer re-renders on entity selection.
import { useSelectedEntityIds } from '../../systems/selection/useSelectedEntities';
// 🏢 Live scene → canvas redraw (big-player invalidate-on-model-change, ADR-040 /
// ADR-547): this render leaf subscribes to the scene SSoT and converts the fresh
// snapshot itself, so a committed entity repaints on the SAME frame — instead of
// waiting for a coincidental orchestrator re-render. ONLY this leaf re-renders.
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import { collectGroupEntities } from '../../systems/group/group-selection-bounds';
// ADR-575 §enter-group — leaf self-subscribes the drill-in level so the active group's
// members are re-tagged with their own id (in-place edit) without re-rendering CanvasSection.
import { useActiveGroupId } from '../../systems/group/useActiveGroup';
import type { SceneModel } from '../../types/scene';
// ADR-550 — the leaf self-subscribes the store-driven transform tools (scale / stretch) so their
// originals dim to ghosts while the real moving copy is shown (mirror of `movePreviewActive`).
// Low-freq phase reads (one transition per click) → ADR-040-safe; the orchestrator stays inert.
import { ScaleToolStore } from '../../systems/scale/ScaleToolStore';
import { StretchToolStore } from '../../systems/stretch/StretchToolStore';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { DxfCanvasRef } from '../../canvas-v2';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';
import type { DxfScene, DxfRenderOptions } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ConstructionPoint } from '../../systems/guides/guide-types';
import type { GridSettings, RulerSettings } from '../../canvas-v2';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';

// ─── Stable guide store subscriptions (module-level = stable across renders) ──
// ADR-040: micro-leaf pattern — DxfCanvasSubscriber is the ONLY React subscriber
// to guide position changes. CanvasSection uses useGuideActions() (no subscription)
// so guide drag no longer causes CanvasSection to re-render at 60fps.
const _guideStore = getGlobalGuideStore();
const _subscribeGuideStore = (cb: () => void) => _guideStore.subscribe(cb);
const _getGuides = () => _guideStore.getGuides();
const _getGuidesVisible = () => _guideStore.isVisible();

// --- SNAP INDICATOR SUBSCRIBER ---
interface SnapIndicatorSubscriberProps {
  viewport: { width: number; height: number };
  dxfCanvasRef: React.RefObject<DxfCanvasRef> | undefined;
  transform: ViewTransform;
  className: string;
}

/**
 * Subscribes to ImmediateSnapStore and renders SnapIndicatorOverlay.
 * Only this component re-renders on snap changes — NOT CanvasLayerStack.
 */
export const SnapIndicatorSubscriber = React.memo(function SnapIndicatorSubscriber({
  viewport, dxfCanvasRef, transform, className,
}: SnapIndicatorSubscriberProps) {
  const snapResult = useSyncExternalStore(subscribeSnapResult, getFullSnapResult);
  return (
    <SnapIndicatorOverlay
      snapResult={toSnapIndicatorView(snapResult)}
      viewport={viewport}
      canvasRect={dxfCanvasRef?.current?.getCanvas?.()?.getBoundingClientRect() ?? null}
      transform={transform}
      className={className}
    />
  );
});

// ============================================================================
// DRAFT LAYER SUBSCRIBER
// ============================================================================
// LayerCanvas pass-through props (layers injected by subscriber after computing draft)
export type LayerCanvasPassthroughProps = Omit<React.ComponentPropsWithoutRef<typeof LayerCanvas>, 'layers'>;

interface DraftLayerSubscriberProps {
  // React 18 useRef returns RefObject<T | null>; forwardRef expects RefObject<T>.
  // Cast is safe — the underlying ref object is identical at runtime.
  canvasRef: React.RefObject<HTMLCanvasElement | null> | React.RefObject<HTMLCanvasElement>;
  colorLayers: ColorLayer[];
  draftPolygon: Array<[number, number]>;
  currentStatus: string;
  overlayMode: 'select' | 'draw' | 'edit';
  transformScale: number;
  layerCanvasPassthroughProps: LayerCanvasPassthroughProps;
}

/**
 * Subscribes to useCursorWorldPosition (via useDraftPolygonLayer) and renders LayerCanvas.
 * Only this component re-renders on mousemove when the rubber-band preview is active.
 */
export const DraftLayerSubscriber = React.memo(function DraftLayerSubscriber({
  canvasRef,
  colorLayers,
  draftPolygon,
  currentStatus,
  overlayMode,
  transformScale,
  layerCanvasPassthroughProps,
}: DraftLayerSubscriberProps) {
  const { colorLayersWithDraft } = useDraftPolygonLayer({
    colorLayers,
    draftPolygon,
    currentStatus: currentStatus as import('../../types/overlay').RegionStatus,
    overlayMode,
    transformScale,
  });

  // 🚀 PERF (ADR-040 Phase II): useHoveredOverlay moved here from CanvasSection.
  // This leaf already re-renders every mousemove (useDraftPolygonLayer → useCursorWorldPosition),
  // so the subscription is free. CanvasSection no longer re-renders on overlay hover.
  const hoveredOverlayId = useHoveredOverlay();
  const finalLayers = useMemo(() => {
    if (!hoveredOverlayId) return colorLayersWithDraft;
    return colorLayersWithDraft.map(l =>
      l.id === hoveredOverlayId ? { ...l, isHovered: true } : l
    );
  }, [colorLayersWithDraft, hoveredOverlayId]);

  return (
    <LayerCanvas
      ref={canvasRef as React.RefObject<HTMLCanvasElement>}
      {...layerCanvasPassthroughProps}
      layers={finalLayers}
    />
  );
});

// ============================================================================
// DXF CANVAS SUBSCRIBER
// ============================================================================

interface DxfCanvasSubscriberProps {
  dxfCanvasRef: React.RefObject<DxfCanvasRef> | undefined;
  /**
   * Fallback converted scene (from the orchestrator). Kept for the first paint /
   * SSR; the live paint source is the reactive `useLevelScene` + `convertScene`
   * below so a committed entity shows immediately (big-player, ADR-040/547).
   */
  scene: DxfScene | null;
  /** Active level id — the scene slice this leaf subscribes to reactively. */
  sceneLevelId: string | null;
  /** Cached SceneModel → DxfScene converter (shares the orchestrator's WeakMap). */
  convertScene: (scene: SceneModel | null) => DxfScene;
  transform: ViewTransform;
  viewport: { width: number; height: number };
  activeTool?: string;
  overlayMode?: 'select' | 'draw' | 'edit';
  colorLayers?: ColorLayer[];
  // ADR-532 B4 — selectedEntityIds is NOT in the base: this leaf subscribes to it
  // (useSelectedEntityIds) and injects it, alongside hoveredEntityId/selectedRoofEdge.
  renderOptionsBase: Omit<DxfRenderOptions, 'hoveredEntityId' | 'selectedEntityIds'>;
  crosshairSettings?: CrosshairSettings;
  gridSettings?: GridSettings;
  rulerSettings?: RulerSettings;
  // guides / guidesVisible REMOVED from props — subscribed directly from
  // guide store inside this component (ADR-040 micro-leaf pattern).
  selectedGuideIds?: ReadonlySet<string>;
  constructionPoints?: readonly ConstructionPoint[];
  panelHighlightPointId?: string | null;
  guideWorkflowComputedParams: Parameters<typeof useGuideWorkflowComputed>[0];
  isGripDragging?: boolean;
  entityPickingActive?: boolean;
  onLayerSelected?: (layerId: string, position: Point2D) => void;
  onMultiLayerSelected?: (layerIds: string[]) => void;
  onEntitiesSelected?: (entityIds: string[]) => void;
  onUnifiedMarqueeResult?: (result: { layerIds: string[]; entityIds: string[]; circuitIds?: string[] }) => void;
  onHoverEntity?: (entityId: string | null) => void;
  onHoverOverlay?: (overlayId: string | null) => void;
  onEntitySelect?: (entityId: string | null) => void;
  onGripMouseDown?: (worldPos: Point2D) => boolean;
  onGripMouseUp?: (worldPos: Point2D) => boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  onCanvasClick?: (point: Point2D, shiftKey?: boolean) => void;
  onTransformChange?: (transform: ViewTransform) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D) => void;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  className?: string;
}

/**
 * Subscribes to useCursorWorldPosition (via useGuideWorkflowComputed) +
 * useHoveredEntity (HoverStore) and renders DxfCanvas.
 * Only this component re-renders on mousemove — NOT CanvasLayerStack.
 *
 * Concrete typed props avoid forwardRef ComponentProps gymnastics.
 */
export const DxfCanvasSubscriber = React.memo(function DxfCanvasSubscriber({
  dxfCanvasRef, scene, sceneLevelId, convertScene, transform, viewport, activeTool, overlayMode, colorLayers,
  renderOptionsBase, crosshairSettings, gridSettings, rulerSettings,
  selectedGuideIds, constructionPoints, panelHighlightPointId,
  guideWorkflowComputedParams, isGripDragging, entityPickingActive,
  onLayerSelected, onMultiLayerSelected, onEntitiesSelected, onUnifiedMarqueeResult,
  onHoverEntity, onHoverOverlay, onEntitySelect, onGripMouseDown, onGripMouseUp,
  onContextMenu, onCanvasClick, onTransformChange, onWheelZoom, onMouseMove, className,
}: DxfCanvasSubscriberProps) {
  const _perfRenderStart = perfStart();
  useEffect(() => {
    if (PERF_LINE_PROFILE) perfEnd('DxfCanvasSubscriber.commit', _perfRenderStart);
  });

  // 🏢 LIVE SCENE → CANVAS REDRAW (big-player invalidate-on-model-change, ADR-040/547).
  // Subscribe to the level's scene SSoT and convert the fresh snapshot HERE (leaf),
  // so a committed entity (e.g. a new wall via `addWallToScene` → `SceneStore`) is
  // painted on the next frame — no dependency on a coincidental orchestrator re-render.
  // `useLevelScene` returns a reference-stable `SceneModel` (new only on a real
  // mutation), so the `useMemo` reconverts (shared WeakMap cache) ONLY on a content
  // change → a fresh `DxfScene` ref → DxfCanvas's `useEffect([scene])` marks dirty →
  // bitmap cache invalidates on `sceneRef` → repaint. Hover/selection re-renders of
  // this leaf reuse the cached ref (no needless rebuild). Falls back to the prop
  // `scene` before the store has the level (first paint).
  const liveSceneModel = useLevelScene(sceneLevelId);
  // ADR-575 §enter-group — drill-in level. Changing it (double-click enter / Esc exit)
  // re-tags only the active group's members with their own id so the entered member is
  // individually paintable/hover-able/selectable (Revit «Edit Group»). Low-freq (one
  // transition per gesture) → ADR-040-safe; only this leaf re-renders, not the orchestrator.
  const activeGroupId = useActiveGroupId();
  // Recompute ONLY on a real scene mutation (liveSceneModel ref), units change
  // (convertScene) or a drill-in enter/exit (activeGroupId) — NOT on this leaf's
  // hover/selection re-renders → no needless bitmap rebuild. Falls back to the
  // orchestrator prop before the store has the level.
  const liveScene = useMemo(
    () => (liveSceneModel ? convertScene(liveSceneModel, activeGroupId) : null),
    [liveSceneModel, convertScene, activeGroupId],
  );
  const reactiveScene = liveScene ?? scene;
  // 🚀 PERF: Subscribe to guide store DIRECTLY here (micro-leaf pattern, ADR-040).
  // CanvasSection uses useGuideActions() (no subscription) → guide drag at 60fps
  // no longer re-renders CanvasSection. Only this leaf re-renders on guide changes.
  const guides = useSyncExternalStore(_subscribeGuideStore, _getGuides, _getGuides);
  const guidesVisible = useSyncExternalStore(_subscribeGuideStore, _getGuidesVisible, _getGuidesVisible);

  // Override guideState.guides in computed params with fresh subscribed data.
  const localComputedParams = useMemo(() => ({
    ...guideWorkflowComputedParams,
    guideState: { ...guideWorkflowComputedParams.guideState, guides, guidesVisible },
  }), [guideWorkflowComputedParams, guides, guidesVisible]);

  const guideComputed = useGuideWorkflowComputed(localComputedParams);
  const hoveredEntityId = useHoveredEntity();
  // ADR-532 B4 — selection-set leaf subscription (reference-stable until the dxf
  // selection changes). Grips/selection highlight redraw without re-rendering the
  // CanvasSection orchestrator.
  const selectedEntityIds = useSelectedEntityIds();
  // ADR-417 Φ-per-edge — micro-leaf subscription στο roofEdgeSelectionStore ώστε
  // η αλλαγή επιλεγμένης ακμής να ξανατρέχει το δυναμικό «selected» pass (live
  // edge highlight). Μόνο αυτό το leaf re-renders, ΟΧΙ ο orchestrator (ADR-040).
  const selectedRoofEdge = useSelectedRoofEdge();
  // ADR-575 §selection/hover semantics — ids of the live GROUP containers, so the canvas
  // interactive overlay paints a hovered/selected group as ONE unit (whole-group highlight,
  // no per-member grips) instead of one stray member. Same derivation SSoT as the grip
  // registry (`collectGroupEntities`). Reads the RAW SceneModel (groups survive only
  // pre-expansion); rebuilds only on a real scene mutation → stable through hover re-renders.
  const groupIds = useMemo(
    () => new Set(collectGroupEntities(liveSceneModel?.entities).keys()),
    [liveSceneModel],
  );
  // ADR-550 — store-driven transform tools dim their selected originals (a real moving copy is on
  // PreviewCanvas). Phase reads are low-freq; the active phase holds steady through the 60fps drag.
  const scalePhase = useSyncExternalStore(ScaleToolStore.subscribe, () => ScaleToolStore.getState().phase);
  const stretchPhase = useSyncExternalStore(StretchToolStore.subscribe, () => StretchToolStore.getState().phase);
  const transformPreviewActive = scalePhase === 'scale_input' || stretchPhase === 'displacement';

  // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): stable identity prevents the
  // dxf-canvas-renderer dirty-tracking effect from re-running every parent render.
  const renderOptions = useMemo(
    () => ({
      ...renderOptionsBase,
      hoveredEntityId,
      selectedRoofEdge,
      selectedEntityIds,
      groupIds,
      // OR-in the store-driven transform tools (the Shell already OR-ed move + rotate).
      movePreviewActive: renderOptionsBase.movePreviewActive || transformPreviewActive,
    }),
    [renderOptionsBase, hoveredEntityId, selectedRoofEdge, selectedEntityIds, groupIds, transformPreviewActive],
  );

  return (
    <DxfCanvas
      ref={dxfCanvasRef}
      scene={reactiveScene}
      transform={transform}
      viewport={viewport}
      activeTool={activeTool}
      overlayMode={overlayMode}
      colorLayers={colorLayers}
      renderOptions={renderOptions}
      crosshairSettings={crosshairSettings}
      gridSettings={gridSettings}
      rulerSettings={rulerSettings}
      guides={guides}
      guidesVisible={guidesVisible}
      ghostGuide={guideComputed.ghostGuide}
      ghostDiagonalGuide={guideComputed.ghostDiagonalGuide}
      ghostSegmentLine={guideComputed.ghostSegmentLine}
      highlightedGuideId={guideComputed.effectiveHighlightedGuideId}
      selectedGuideIds={selectedGuideIds}
      constructionPoints={constructionPoints}
      highlightedPointId={
        guideComputed.highlightedPointId ??
        panelHighlightPointId ??
        guideComputed.panelHighlightPointId
      }
      isGripDragging={isGripDragging}
      entityPickingActive={entityPickingActive}
      onLayerSelected={onLayerSelected}
      onMultiLayerSelected={onMultiLayerSelected}
      onEntitiesSelected={onEntitiesSelected}
      onUnifiedMarqueeResult={onUnifiedMarqueeResult}
      onHoverEntity={onHoverEntity}
      onHoverOverlay={onHoverOverlay}
      onEntitySelect={onEntitySelect}
      onGripMouseDown={onGripMouseDown}
      onGripMouseUp={onGripMouseUp}
      onContextMenu={onContextMenu}
      onCanvasClick={onCanvasClick}
      onTransformChange={onTransformChange}
      onWheelZoom={onWheelZoom}
      onMouseMove={onMouseMove}
      className={className}
    />
  );
});

// ADR-040 500-LOC split — PreviewCanvasMounts now lives in its own file.
// Re-export keeps `canvas-layer-stack-leaves` the single import barrel.
export { PreviewCanvasMounts, type PreviewCanvasMountsProps } from './canvas-layer-stack-preview-mounts';
