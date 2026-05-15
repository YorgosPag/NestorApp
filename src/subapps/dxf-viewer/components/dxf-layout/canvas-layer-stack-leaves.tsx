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
import { useRotationPreview } from '../../hooks/tools/useRotationPreview';
import { useMovePreview } from '../../hooks/tools/useMovePreview';
import { useGripGhostPreview } from '../../hooks/tools/useGripGhostPreview';
import { useMirrorPreview } from '../../hooks/tools/useMirrorPreview';
import { useScalePreview } from '../../hooks/tools/useScalePreview';
import { useStretchPreview } from '../../hooks/tools/useStretchPreview';
import { TrimPreviewMount } from './TrimPreviewMount';
import { ExtendPreviewOverlay } from './ExtendPreviewOverlay';
import type { MovePhase } from '../../hooks/tools/useMoveTool';
import type { MirrorPhase } from '../../hooks/tools/useMirrorTool';
import type { DxfGripDragPreview } from '../../hooks/grip-computation';
import { useHoveredEntity } from '../../systems/hover/useHover';
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
      snapResult={snapResult ? {
        point: snapResult.snappedPoint,
        type: snapResult.activeMode || 'endpoint',
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

// --- ROTATION PREVIEW MOUNT ---

interface RotationPreviewMountProps {
  phase: import('../../hooks/tools/useRotationTool').RotationPhase;
  basePoint: Point2D | null;
  referencePoint: Point2D | null;
  currentAngle: number;
  selectedEntityIds: string[];
  levelManager: Parameters<typeof useRotationPreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

/**
 * Mounts useRotationPreview. No JSX — draws to PreviewCanvas via imperative API.
 * Subscribes to useCursorWorldPosition internally.
 * Only this component re-renders on mousemove when rotation is active.
 */
export const RotationPreviewMount = React.memo(function RotationPreviewMount(
  props: RotationPreviewMountProps,
) {
  useRotationPreview(props);
  return null;
});

// ============================================================================
// MOVE PREVIEW MOUNT (ADR-049)
// ============================================================================
interface MovePreviewMountProps {
  phase: MovePhase;
  basePoint: Point2D | null;
  selectedEntityIds: string[];
  selectedOverlayIds?: string[];
  getOverlay?: Parameters<typeof useMovePreview>[0]['getOverlay'];
  levelManager: Parameters<typeof useMovePreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

/**
 * Mounts useMovePreview. No JSX — draws to PreviewCanvas via imperative API.
 * Subscribes to useCursorWorldPosition internally.
 * Only this component re-renders on mousemove when move tool is active.
 */
export const MovePreviewMount = React.memo(function MovePreviewMount(
  props: MovePreviewMountProps,
) {
  useMovePreview(props);
  return null;
});

// ============================================================================
// GRIP DRAG PREVIEW MOUNT (ADR-049 SSOT — paired with Move tool)
// ============================================================================
interface GripDragPreviewMountProps {
  dragPreview: DxfGripDragPreview | null;
  levelManager: Parameters<typeof useGripGhostPreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

// --- MIRROR PREVIEW MOUNT ---
interface MirrorPreviewMountProps {
  phase: MirrorPhase;
  firstPoint: Point2D | null;
  secondPoint: Point2D | null;
  selectedEntityIds: string[];
  levelManager: Parameters<typeof useMirrorPreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const MirrorPreviewMount = React.memo(function MirrorPreviewMount(
  props: MirrorPreviewMountProps,
) {
  useMirrorPreview(props);
  return null;
});

// --- SCALE PREVIEW MOUNT ---
interface ScalePreviewMountProps {
  levelManager: Parameters<typeof useScalePreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

export const ScalePreviewMount = React.memo(function ScalePreviewMount(
  props: ScalePreviewMountProps,
) {
  useScalePreview(props);
  return null;
});

// ============================================================================
// STRETCH PREVIEW MOUNT (ADR-349 Phase 1c-B1)
// ============================================================================
interface StretchPreviewMountProps {
  levelManager: Parameters<typeof useStretchPreview>[0]['levelManager'];
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
}

/**
 * Mounts useStretchPreview. No JSX — draws to PreviewCanvas via imperative API.
 * Subscribes to StretchToolStore + useCursorWorldPosition internally.
 * Only this component re-renders on stretch displacement updates — NOT CanvasLayerStack.
 */
export const StretchPreviewMount = React.memo(function StretchPreviewMount(
  props: StretchPreviewMountProps,
) {
  useStretchPreview(props);
  return null;
});

/**
 * Mounts useGripGhostPreview. No JSX — draws to PreviewCanvas via imperative
 * API. Renders a blue translucent ghost of the entity being grip-dragged
 * (center / vertex / edge handle), using the same SSOT primitives as the
 * toolbar Move tool. The original entity stays painted at its source
 * position in the main canvas — the bitmap cache is NOT invalidated during
 * drag (ADR-040 cardinal rule 3).
 */
export const GripDragPreviewMount = React.memo(function GripDragPreviewMount(
  props: GripDragPreviewMountProps,
) {
  useGripGhostPreview(props);
  return null;
});

// ============================================================================
// PREVIEW CANVAS MOUNTS — composite of the 3 zero-jsx preview mounts
// ============================================================================

interface PreviewCanvasMountsProps {
  rotation: Omit<RotationPreviewMountProps, 'selectedEntityIds' | 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  move: Omit<MovePreviewMountProps, 'selectedEntityIds' | 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  mirror: Omit<MirrorPreviewMountProps, 'selectedEntityIds' | 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  scale: Omit<ScalePreviewMountProps, 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  stretch: Omit<StretchPreviewMountProps, 'levelManager' | 'transform' | 'getCanvas' | 'getViewportElement'>;
  /** ADR-350: TRIM overlay has no extra payload — full state lives in TrimToolStore. */
  trim?: Record<string, never>;
  gripDragPreview: DxfGripDragPreview | null;
  selectedEntityIds: string[];
  levelManager: MovePreviewMountProps['levelManager'];
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
  const { rotation, move, mirror, scale, stretch, gripDragPreview, selectedEntityIds, levelManager, transform, getCanvas, getViewportElement } = props;
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
    </>
  );
});
