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
import { useGuideWorkflowComputed } from '../../hooks/guides/useGuideWorkflowComputed';
import { useDraftPolygonLayer } from '../../hooks/layers/useDraftPolygonLayer';
import { ColumnGhostPreviewMount, type ColumnGhostPreviewMountProps } from './canvas-layer-stack-column-ghost';
import { MepFixtureGhostPreviewMount, type MepFixtureGhostPreviewMountProps } from './canvas-layer-stack-mep-fixture-ghost';
import { ElectricalPanelGhostPreviewMount, type ElectricalPanelGhostPreviewMountProps } from './canvas-layer-stack-electrical-panel-ghost';
import { MepManifoldGhostPreviewMount, type MepManifoldGhostPreviewMountProps } from './canvas-layer-stack-mep-manifold-ghost';
import { MepRadiatorGhostPreviewMount, type MepRadiatorGhostPreviewMountProps } from './canvas-layer-stack-mep-radiator-ghost';
import { MepBoilerGhostPreviewMount, type MepBoilerGhostPreviewMountProps } from './canvas-layer-stack-mep-boiler-ghost';
import { MepWaterHeaterGhostPreviewMount, type MepWaterHeaterGhostPreviewMountProps } from './canvas-layer-stack-mep-water-heater-ghost';
import { MepSegmentGhostPreviewMount, type MepSegmentGhostPreviewMountProps, type GhostSegmentSpec } from './canvas-layer-stack-mep-segment-ghost';
import { WaterProposalGhostPreviewMount } from './canvas-layer-stack-water-proposal-ghost';
import { DrainageProposalGhostPreviewMount } from './canvas-layer-stack-drainage-proposal-ghost';
import { SlabOpeningGhostPreviewMount, type SlabOpeningGhostPreviewMountProps } from './canvas-layer-stack-slab-opening-ghost';
import { OpeningGhostPreviewMount, type OpeningGhostPreviewMountProps } from './canvas-layer-stack-opening-ghost';
import { OpeningTagDragMount } from './canvas-layer-stack-opening-tag-drag';
import { MepWireWaypointDragMount } from './canvas-layer-stack-mep-wire-waypoint';
import { GripDimAnnotationMount } from './canvas-layer-stack-grip-dim-annotation';
import { TrimPreviewMount } from './TrimPreviewMount';
import { ExtendPreviewOverlay } from './ExtendPreviewOverlay';
import {
  RotationPreviewMount,
  MovePreviewMount,
  MirrorPreviewMount,
  ScalePreviewMount,
  StretchPreviewMount,
  GripDragPreviewMount,
  type RotationPreviewMountProps,
  type MovePreviewMountProps,
  type MirrorPreviewMountProps,
  type ScalePreviewMountProps,
  type StretchPreviewMountProps,
} from './canvas-layer-stack-tool-preview-mounts';
import type { DxfGripDragPreview } from '../../hooks/grip-computation';
import { useHoveredEntity } from '../../systems/hover/useHover';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/scene';
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
      snapResult={snapResult ? {
        point: snapResult.snappedPoint,
        type: snapResult.activeMode || 'endpoint',
        description: snapResult.snapPoint?.description,
      } : null}
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
  scene: DxfScene | null;
  transform: ViewTransform;
  viewport: { width: number; height: number };
  activeTool?: string;
  overlayMode?: 'select' | 'draw' | 'edit';
  colorLayers?: ColorLayer[];
  renderOptionsBase: Omit<DxfRenderOptions, 'hoveredEntityId'>;
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
  onUnifiedMarqueeResult?: (result: { layerIds: string[]; entityIds: string[] }) => void;
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
  dxfCanvasRef, scene, transform, viewport, activeTool, overlayMode, colorLayers,
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

  // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): stable identity prevents the
  // dxf-canvas-renderer dirty-tracking effect from re-running every parent render.
  const renderOptions = useMemo(
    () => ({ ...renderOptionsBase, hoveredEntityId }),
    [renderOptionsBase, hoveredEntityId],
  );

  return (
    <DxfCanvas
      ref={dxfCanvasRef}
      scene={scene}
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

// PREVIEW CANVAS MOUNTS — composite zero-jsx preview mounts
interface PreviewCanvasMountsProps {
  rotation: Omit<RotationPreviewMountProps, 'selectedEntityIds' | 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  move: Omit<MovePreviewMountProps, 'selectedEntityIds' | 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  mirror: Omit<MirrorPreviewMountProps, 'selectedEntityIds' | 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  scale: Omit<ScalePreviewMountProps, 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  stretch: Omit<StretchPreviewMountProps, 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-350: TRIM overlay has no extra payload — full state lives in TrimToolStore. */
  trim?: Record<string, never>;
  /** ADR-363 Phase 4.5c.1 — column anchor ghost preview payload. */
  columnGhost: Omit<ColumnGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-406 — MEP fixture 2D placement ghost payload. */
  mepFixtureGhost: Omit<MepFixtureGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 Φ3 — electrical panel 2D placement ghost payload. */
  electricalPanelGhost: Omit<ElectricalPanelGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 Φ12 — MEP manifold (plumbing) 2D placement ghost payload. */
  mepManifoldGhost: Omit<MepManifoldGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 Εύρος Β — heating radiator 2D placement ghost payload. */
  mepRadiatorGhost: Omit<MepRadiatorGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 Εύρος Β #2 — heating boiler 2D placement ghost payload. */
  mepBoilerGhost: Omit<MepBoilerGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 DHW — domestic water heater 2D placement ghost payload. */
  mepWaterHeaterGhost: Omit<MepWaterHeaterGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-408 Φ8 — MEP segment (duct/pipe) 2D rubber-band ghost payload. */
  mepSegmentGhost: Omit<MepSegmentGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  slabOpeningGhost: Omit<SlabOpeningGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  openingGhost: Omit<OpeningGhostPreviewMountProps, 'transform' | 'getCanvas' | 'getViewportElement'>;
  gripDragPreview: DxfGripDragPreview | null;
  selectedEntityIds: string[];
  levelManager: MovePreviewMountProps['levelManager'] & {
    setLevelScene: (levelId: string, scene: SceneModel) => void;
  };
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}
/**
 * Renders the 3 PreviewCanvas mounts (Rotation / Move / GripDrag) sharing
 * the same `getCanvas` / `getViewportElement` getters. Keeps the shell
 * CanvasLayerStack lean (single JSX node instead of 30 lines of props).
 */
export const PreviewCanvasMounts = React.memo(function PreviewCanvasMounts(
  props: PreviewCanvasMountsProps,
) {
  const { rotation, move, mirror, scale, stretch, columnGhost, mepFixtureGhost, electricalPanelGhost, mepManifoldGhost, mepRadiatorGhost, mepBoilerGhost, mepWaterHeaterGhost, mepSegmentGhost, slabOpeningGhost, openingGhost, gripDragPreview, selectedEntityIds, levelManager, transform, getCanvas, getViewportElement } = props;
  return (
    <>
      <RotationPreviewMount
        {...rotation}
        selectedEntityIds={selectedEntityIds}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MirrorPreviewMount
        {...mirror}
        selectedEntityIds={selectedEntityIds}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MovePreviewMount
        {...move}
        selectedEntityIds={selectedEntityIds}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <ScalePreviewMount
        {...scale}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <StretchPreviewMount
        {...stretch}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <TrimPreviewMount
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <ExtendPreviewOverlay
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <GripDragPreviewMount
        dragPreview={gripDragPreview}
        levelManager={levelManager}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <ColumnGhostPreviewMount
        {...columnGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepFixtureGhostPreviewMount
        {...mepFixtureGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <ElectricalPanelGhostPreviewMount
        {...electricalPanelGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepManifoldGhostPreviewMount
        {...mepManifoldGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepRadiatorGhostPreviewMount
        {...mepRadiatorGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepBoilerGhostPreviewMount
        {...mepBoilerGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepWaterHeaterGhostPreviewMount
        {...mepWaterHeaterGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      <MepSegmentGhostPreviewMount
        {...mepSegmentGhost}
        transform={transform}
        getCanvas={getCanvas}
        getViewportElement={getViewportElement}
      />
      {/* ADR-426 Slice 2 — water auto-design proposal ghost (low-freq store, inert while idle). */}
      <WaterProposalGhostPreviewMount transform={transform} getCanvas={getCanvas} getViewportElement={getViewportElement} />
      {/* ADR-427 Slice 2 — drainage auto-design proposal ghost (low-freq store, inert while idle). */}
      <DrainageProposalGhostPreviewMount transform={transform} getCanvas={getCanvas} getViewportElement={getViewportElement} />
      <SlabOpeningGhostPreviewMount {...slabOpeningGhost} transform={transform} getCanvas={getCanvas} getViewportElement={getViewportElement} />
      <OpeningGhostPreviewMount {...openingGhost} transform={transform} getCanvas={getCanvas} getViewportElement={getViewportElement} />
      <GripDimAnnotationMount dragPreview={gripDragPreview} levelManager={levelManager} transform={transform} getCanvas={getCanvas} getViewportElement={getViewportElement} />
      <OpeningTagDragMount
        transform={transform}
        getViewportElement={getViewportElement}
        currentLevelId={levelManager.currentLevelId}
        getLevelScene={levelManager.getLevelScene}
        setLevelScene={levelManager.setLevelScene}
      />
      {/* ADR-408 Φ7 FU#3 — editable home-run wire waypoints (active circuit). */}
      <MepWireWaypointDragMount
        transform={transform}
        getViewportElement={getViewportElement}
        currentLevelId={levelManager.currentLevelId}
        getLevelScene={levelManager.getLevelScene}
      />
    </>
  );
});
