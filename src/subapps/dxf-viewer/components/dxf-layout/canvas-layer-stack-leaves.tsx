/**
 * CanvasLayerStack — Micro-leaf subscriber components (Phase E, ADR-040).
 *
 * Each leaf subscribes to a single high-frequency store so that only the
 * smallest possible React subtree re-renders on mousemove / snap / hover.
 *
 * Shell CanvasLayerStack imports these and composes them without subscribing
 * to any high-frequency store itself.
 */

'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { DxfCanvas, LayerCanvas } from '../../canvas-v2';
import SnapIndicatorOverlay from '../../canvas-v2/overlays/SnapIndicatorOverlay';
import { subscribeSnapResult, getFullSnapResult } from '../../systems/cursor/ImmediateSnapStore';
import { useGuideWorkflowComputed } from '../../hooks/guides/useGuideWorkflowComputed';
import { useDraftPolygonLayer } from '../../hooks/layers/useDraftPolygonLayer';
import { useRotationPreview } from '../../hooks/tools/useRotationPreview';
import { useHoveredEntity } from '../../systems/hover/useHover';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { DxfCanvasRef } from '../../canvas-v2';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';
import type { DxfScene, DxfRenderOptions } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Guide, ConstructionPoint } from '../../systems/guides/guide-types';
import type { GridSettings, RulerSettings } from '../../canvas-v2';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';

// ============================================================================
// SNAP INDICATOR SUBSCRIBER
// ============================================================================

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
  return (
    <LayerCanvas
      ref={canvasRef as React.RefObject<HTMLCanvasElement>}
      {...layerCanvasPassthroughProps}
      layers={colorLayersWithDraft}
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
  guides?: readonly Guide[];
  guidesVisible?: boolean;
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
  guides, guidesVisible, selectedGuideIds, constructionPoints, panelHighlightPointId,
  guideWorkflowComputedParams, isGripDragging, entityPickingActive,
  onLayerSelected, onMultiLayerSelected, onEntitiesSelected, onUnifiedMarqueeResult,
  onHoverEntity, onHoverOverlay, onEntitySelect, onGripMouseDown, onGripMouseUp,
  onContextMenu, onCanvasClick, onTransformChange, onWheelZoom, onMouseMove, className,
}: DxfCanvasSubscriberProps) {
  const guideComputed = useGuideWorkflowComputed(guideWorkflowComputedParams);
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

// ============================================================================
// ROTATION PREVIEW MOUNT
// ============================================================================

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
