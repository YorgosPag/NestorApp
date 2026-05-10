/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * After any architectural change → update the ADR changelog (same commit).
 *
 * 🏢 ENTERPRISE: CanvasLayerStack — Extraction #13
 *
 * @description All 9 canvas layers and their inline callbacks, extracted from CanvasSection.
 * Renders the visual canvas stack: PDF → LayerCanvas → DxfCanvas → PreviewCanvas →
 * CrosshairOverlay → SnapIndicator → RulerCornerBox → DrawingContextMenu
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~334 lines of JSX
 *
 * 🚀 PERF (2026-05-09 Phase E): Micro-leaf subscriber pattern (Excalidraw/Figma).
 * Components that subscribe to high-frequency stores are isolated as nano-leaves:
 * - SnapIndicatorSubscriber  — subscribeSnapResult (useSyncExternalStore)
 * - DraftLayerSubscriber     — useDraftPolygonLayer → useCursorWorldPosition
 * - DxfCanvasSubscriber      — useGuideWorkflowComputed + useHoveredEntity
 * - RotationPreviewMount     — useRotationPreview → useCursorWorldPosition
 * CanvasLayerStack shell itself does NOT subscribe to any high-frequency store.
 */

'use client';

import React, { useCallback, useMemo } from 'react';
import { PreviewCanvas } from '../../canvas-v2/preview-canvas';
import CrosshairOverlay from '../../canvas-v2/overlays/CrosshairOverlay';
import RulerCornerBox from '../../canvas-v2/overlays/RulerCornerBox';
import { FloorplanBackgroundCanvas } from '../../floorplan-background';
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { RULERS_GRID_CONFIG } from '../../systems/rulers-grid/config';
import { UI_COLORS, PREVIEW_DEFAULTS } from '../../config/color-config';
import { canvasUI } from '@/styles/design-tokens/canvas';
import { createCombinedBounds } from '../../systems/zoom/utils/bounds';
import { isInDrawingMode } from '../../systems/tools/ToolStateManager';
import { dwarn } from '../../debug';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import { getImmediatePosition } from '../../systems/cursor/ImmediatePositionStore';
import { setHoveredEntity, setHoveredOverlay } from '../../systems/hover/HoverStore';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import type { DxfRenderOptions } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { CanvasLayerStackProps } from './canvas-layer-stack-types';
import {
  SnapIndicatorSubscriber,
  DraftLayerSubscriber,
  DxfCanvasSubscriber,
  RotationPreviewMount,
  type LayerCanvasPassthroughProps,
} from './canvas-layer-stack-leaves';

// Re-export props type for consumers
export type { CanvasLayerStackProps } from './canvas-layer-stack-types';

// Stable empty array — passed to renderOptions.snapResults to avoid
// creating a new array literal on every render.
const EMPTY_SNAP_RESULTS: readonly never[] = Object.freeze([]);

// ============================================================================
// MAIN COMPONENT (shell — no high-frequency subscriptions)
// ============================================================================

export const CanvasLayerStack = React.memo(function CanvasLayerStack({
  transform, viewport, activeTool, overlayMode, showLayers,
  showDxfCanvas, showLayerCanvas,
  containerRef, dxfCanvasRef, overlayCanvasRef, previewCanvasRef, drawingHandlersRef, entitySelectedOnMouseDownRef,
  dxfScene, colorLayers, draftPolygon, currentStatus,
  settings, gripState, entityState,
  zoomSystem, dxfGripInteraction, universalSelection, setTransform,
  containerHandlers,
  handleOverlayClick, handleMultiOverlayClick, handleCanvasClick, handleUnifiedMouseMove,
  handleDrawingContextMenu,
  drawingState, entityJoin, floorId, onMouseMove,
  entityPickingActive,
  selectedGuideIds, constructionPoints,
  guideWorkflowState, guideStateObj, cpStateObj,
  rotationPreview, levelManager,
}: CanvasLayerStackProps) {
  // --- Destructure grouped props ---
  const {
    crosshair: crosshairSettings, cursor: cursorCanvasSettings, snap: snapSettings,
    ruler: rulerSettings, grid: gridSettings, gridMajorInterval,
    selection: selectionSettings, grip: gripSettings, globalRuler: globalRulerSettings,
  } = settings;
  const {
    draggingVertex, draggingEdgeMidpoint, hoveredVertexInfo, hoveredEdgeInfo,
    draggingOverlayBody, dragPreviewPosition,
  } = gripState;
  const { selectedEntityIds, setSelectedEntityIds } = entityState;
  const {
    drawingHandlers, handleDrawingFinish, handleDrawingClose,
    handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc,
  } = drawingState;

  // --- Computed values ---
  const isGripDragging =
    draggingVertex !== null ||
    draggingEdgeMidpoint !== null ||
    hoveredVertexInfo !== null ||
    hoveredEdgeInfo !== null;

  // --- Named callbacks ---
  const handleTransformChange = (newTransform: ViewTransform) => {
    setTransform(newTransform);
    zoomSystem.setTransform(newTransform);
  };

  const handleDxfEntitiesSelected = (entityIds: string[]) => {
    setSelectedEntityIds(entityIds);
    universalSelection.clearByType('dxf-entity');
    if (entityIds.length > 0) {
      universalSelection.selectMultiple(
        entityIds.map((id) => ({ id, type: 'dxf-entity' as const })),
      );
    }
  };

  const handleUnifiedMarqueeResult = ({
    layerIds,
    entityIds,
  }: {
    layerIds: string[];
    entityIds: string[];
  }) => {
    universalSelection.clearAll();
    if (layerIds.length > 0) {
      universalSelection.addMultiple(
        layerIds.map((id) => ({ id, type: 'overlay' as const })),
      );
    }
    setSelectedEntityIds(entityIds);
    if (entityIds.length > 0) {
      universalSelection.addMultiple(
        entityIds.map((id) => ({ id, type: 'dxf-entity' as const })),
      );
    }
  };

  const handleOverlayClickWithEntityClear = (overlayId: string, point: Point2D) => {
    setSelectedEntityIds([]);
    handleOverlayClick(overlayId, point);
  };

  const handleMultiOverlayClickWithEntityClear = (layerIds: string[]) => {
    setSelectedEntityIds([]);
    handleMultiOverlayClick(layerIds);
  };

  const handleDxfEntitySelect = (entityId: string | null, additive?: boolean) => {
    if (entityId) {
      if (additive) {
        // Read current state directly — universalSelection calls must NOT go inside
        // a setState updater (that runs during render → "update while rendering" error).
        if (selectedEntityIds.includes(entityId)) {
          setSelectedEntityIds(prev => prev.filter(id => id !== entityId));
          universalSelection.deselect(entityId);
        } else {
          setSelectedEntityIds(prev => [...prev, entityId]);
          universalSelection.add(entityId, 'dxf-entity');
        }
      } else {
        if (!(selectedEntityIds.length === 1 && selectedEntityIds[0] === entityId)) {
          setSelectedEntityIds([entityId]);
        }
        universalSelection.clearByType('dxf-entity');
        universalSelection.select(entityId, 'dxf-entity');
      }
      entitySelectedOnMouseDownRef.current = true;
    } else if (!additive) {
      entitySelectedOnMouseDownRef.current = false;
    }
  };

  const handleDxfMouseMove = useCallback(
    (screenPos: Point2D, worldPos: Point2D) => {
      if (worldPos) {
        handleUnifiedMouseMove(worldPos, screenPos);
      }

      if (onMouseMove && worldPos) {
        const mockEvent = {
          clientX: screenPos.x,
          clientY: screenPos.y,
          preventDefault: () => {},
          stopPropagation: () => {},
        } as React.MouseEvent;
        onMouseMove(worldPos, mockEvent);
      }

      // 🚀 PERF (2026-05-09): ImmediatePositionStore updated upstream.
      if (isInDrawingMode(activeTool, overlayMode) && worldPos && drawingHandlersRef.current?.onDrawingHover) {
        drawingHandlersRef.current.onDrawingHover(worldPos);
      }
    },
    [handleUnifiedMouseMove, onMouseMove, activeTool, overlayMode, drawingHandlersRef],
  );

  const handleRulerZoomToFit = () => {
    const combinedBounds = createCombinedBounds(dxfScene, colorLayers, true);
    if (combinedBounds && viewport.width > 0 && viewport.height > 0) {
      zoomSystem.zoomToFit(combinedBounds, viewport, true);
    } else {
      dwarn('CanvasLayerStack', 'ZoomToFit: Invalid bounds or viewport!', {
        combinedBounds,
        viewport,
      });
    }
  };

  const handleRulerWheelZoom = (delta: number) => {
    const cssPos = getImmediatePosition();
    if (cssPos) {
      zoomSystem.handleWheelZoom(delta, cssPos);
    }
  };

  // --- Computed props ---
  const draggingOverlayDelta =
    draggingOverlayBody && dragPreviewPosition
      ? {
          overlayId: draggingOverlayBody.overlayId,
          delta: {
            x: dragPreviewPosition.x - draggingOverlayBody.startPoint.x,
            y: dragPreviewPosition.y - draggingOverlayBody.startPoint.y,
          },
        }
      : null;

  const dxfRulerSettings = useMemo(() => ({
    enabled:
      (globalRulerSettings?.horizontal?.enabled && globalRulerSettings?.vertical?.enabled) ?? true,
    visible: true,
    opacity: 1.0,
    unit: globalRulerSettings.units as 'mm' | 'cm' | 'm',
    color: globalRulerSettings.horizontal.color,
    backgroundColor: globalRulerSettings.horizontal.backgroundColor,
    fontSize: globalRulerSettings.horizontal.fontSize,
    textColor: globalRulerSettings.horizontal.textColor,
    height: globalRulerSettings.horizontal.height ?? RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT,
    width: globalRulerSettings.vertical.width ?? RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH,
    showLabels: globalRulerSettings.horizontal.showLabels,
    showUnits: globalRulerSettings.horizontal.showUnits,
    showBackground: globalRulerSettings.horizontal.showBackground,
    showMajorTicks: globalRulerSettings.horizontal.showMajorTicks,
    showMinorTicks: true,
    majorTickColor: globalRulerSettings.horizontal.color,
    minorTickColor: UI_COLORS.BUTTON_SECONDARY,
    majorTickLength: 10,
    minorTickLength: 5,
    tickInterval: gridSettings.size * gridMajorInterval,
    unitsFontSize: 10,
    unitsColor: globalRulerSettings.horizontal.textColor,
    labelPrecision: 1,
    borderColor: globalRulerSettings.horizontal.color,
    borderWidth: 1,
  }), [globalRulerSettings, gridSettings.size, gridMajorInterval]);

  // --- Stable references for downstream memos (avoid fresh-spread per render) ---
  const gridSettingsDisabled = useMemo(
    () => ({ ...gridSettings, enabled: false }),
    [gridSettings],
  );
  const rulerSettingsDisabled = useMemo(
    () => ({ ...rulerSettings, enabled: false }),
    [rulerSettings],
  );
  const layerRenderOptions = useMemo(
    () => ({
      showCrosshair: true,
      showCursor: true,
      showSnapIndicators: true,
      showGrid: false,
      showRulers: false,
      showSelectionBox: false,
      crosshairPosition: null,
      cursorPosition: null,
      snapResults: EMPTY_SNAP_RESULTS as never[],
      selectionBox: null,
      gripSettings,
    }),
    [gripSettings],
  );
  const layerClassName = `absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['0']}`;
  const layerStyle = useMemo(
    () => canvasUI.positioning.layers.layerCanvasWithTools(activeTool, crosshairSettings.enabled),
    [activeTool, crosshairSettings.enabled],
  );
  const onMouseMoveStable = useCallback(
    (screenPos: Point2D, worldPos: Point2D) => handleUnifiedMouseMove(worldPos, screenPos),
    [handleUnifiedMouseMove],
  );

  // --- LayerCanvas passthrough props (ref and layers excluded — injected by DraftLayerSubscriber) ---
  const layerCanvasPassthroughProps: LayerCanvasPassthroughProps = useMemo(() => ({
    transform,
    viewport,
    activeTool,
    overlayMode,
    layersVisible: showLayers,
    dxfScene,
    enableUnifiedCanvas: true,
    isGripDragging,
    onContextMenu: handleDrawingContextMenu,
    onTransformChange: handleTransformChange,
    onWheelZoom: zoomSystem.handleWheelZoom,
    crosshairSettings,
    cursorSettings: cursorCanvasSettings,
    snapSettings,
    gridSettings: gridSettingsDisabled,
    rulerSettings: rulerSettingsDisabled,
    selectionSettings,
    renderOptions: layerRenderOptions,
    onLayerClick: handleOverlayClickWithEntityClear,
    onMultiLayerClick: handleMultiOverlayClickWithEntityClear,
    onCanvasClick: handleCanvasClick,
    onDrawingHover: drawingHandlersRef.current?.onDrawingHover,
    draggingOverlay: draggingOverlayDelta,
    onMouseMove: onMouseMoveStable,
    className: layerClassName,
    style: layerStyle,
  }), [
    transform, viewport, activeTool, overlayMode, showLayers, dxfScene,
    isGripDragging, handleDrawingContextMenu, handleTransformChange,
    zoomSystem.handleWheelZoom, crosshairSettings, cursorCanvasSettings,
    snapSettings, gridSettingsDisabled, rulerSettingsDisabled, selectionSettings,
    layerRenderOptions, handleOverlayClickWithEntityClear,
    handleMultiOverlayClickWithEntityClear, handleCanvasClick,
    draggingOverlayDelta, onMouseMoveStable, layerClassName, layerStyle,
  ]);

  // DxfCanvas renderOptions base (hoveredEntityId injected by DxfCanvasSubscriber).
  // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): memoized for stable identity so
  // DxfCanvasSubscriber's useMemo on { ...base, hoveredEntityId } stays effective.
  const dxfRenderOptionsBase = useMemo<Omit<DxfRenderOptions, 'hoveredEntityId'>>(
    () => ({
      showGrid: false,
      showLayerNames: false,
      wireframeMode: false,
      selectedEntityIds,
      gripInteractionState: dxfGripInteraction.gripInteractionState,
      dragPreview: dxfGripInteraction.dragPreview ?? undefined,
    }),
    [selectedEntityIds, dxfGripInteraction.gripInteractionState, dxfGripInteraction.dragPreview],
  );

  // Guide workflow computed params (passed to DxfCanvasSubscriber)
  const guideComputedParams = useMemo(() => ({
    activeTool,
    guideState: guideStateObj,
    cpState: cpStateObj,
    transform,
    state: guideWorkflowState,
  }), [activeTool, guideStateObj, cpStateObj, transform, guideWorkflowState]);

  return (
    <>
      <div className="flex-1 relative">
        <div
          ref={containerRef as React.RefObject<HTMLDivElement>}
          className={`canvas-stack relative w-full h-full cursor-none bg-[var(--canvas-background-dxf)] ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`}
          onMouseMove={containerHandlers.onMouseMove}
          onMouseDown={containerHandlers.onMouseDown}
          onMouseUp={containerHandlers.onMouseUp}
          onMouseEnter={containerHandlers.onMouseEnter}
          onMouseLeave={containerHandlers.onMouseLeave}
          onContextMenu={handleDrawingContextMenu}
        >
          {/* Floorplan Background (ADR-340 — replaces legacy PdfBackgroundCanvas, z-0) */}
          {floorId && (
            <FloorplanBackgroundCanvas
              floorId={floorId}
              worldToCanvas={transform}
              viewport={viewport}
              cad={{ mode: 'cad-y-up', margins: COORDINATE_LAYOUT.MARGINS }}
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            />
          )}

          {/* LayerCanvas (z-0) — rubber-band draft computed in subscriber */}
          {showLayerCanvas && (
            <DraftLayerSubscriber
              canvasRef={overlayCanvasRef as React.RefObject<HTMLCanvasElement>}
              colorLayers={colorLayers}
              draftPolygon={draftPolygon}
              currentStatus={currentStatus}
              overlayMode={overlayMode}
              transformScale={transform.scale}
              layerCanvasPassthroughProps={layerCanvasPassthroughProps}
            />
          )}

          {/* DxfCanvas (z-10) — guide computed + hoveredEntityId injected in subscriber */}
          {showDxfCanvas && (
            <DxfCanvasSubscriber
              dxfCanvasRef={dxfCanvasRef}
              scene={dxfScene}
              transform={transform}
              viewport={viewport}
              activeTool={activeTool}
              overlayMode={overlayMode}
              colorLayers={colorLayers}
              renderOptionsBase={dxfRenderOptionsBase}
              crosshairSettings={crosshairSettings}
              gridSettings={gridSettings}
              rulerSettings={dxfRulerSettings}
              selectedGuideIds={selectedGuideIds}
              constructionPoints={constructionPoints}
              panelHighlightPointId={guideWorkflowState.panelHighlightPointId}
              guideWorkflowComputedParams={guideComputedParams}
              isGripDragging={isGripDragging || dxfGripInteraction.isDraggingGrip}
              entityPickingActive={entityPickingActive}
              onLayerSelected={handleOverlayClickWithEntityClear}
              onMultiLayerSelected={handleMultiOverlayClickWithEntityClear}
              onEntitiesSelected={handleDxfEntitiesSelected}
              onUnifiedMarqueeResult={handleUnifiedMarqueeResult}
              onHoverEntity={(id) => setHoveredEntity(id)}
              onHoverOverlay={(id) => setHoveredOverlay(id)}
              onEntitySelect={handleDxfEntitySelect}
              onGripMouseDown={(worldPos) => dxfGripInteraction.handleGripMouseDown(worldPos)}
              onGripMouseUp={(worldPos) => dxfGripInteraction.handleGripMouseUp(worldPos)}
              onContextMenu={handleDrawingContextMenu}
              onCanvasClick={handleCanvasClick}
              onTransformChange={handleTransformChange}
              onWheelZoom={zoomSystem.handleWheelZoom}
              onMouseMove={handleDxfMouseMove}
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['10']}`}
            />
          )}

          {/* PreviewCanvas (pointer-events: none) */}
          <PreviewCanvas
            ref={previewCanvasRef as React.RefObject<PreviewCanvasHandle>}
            transform={transform}
            viewport={viewport}
            isActive={isInDrawingMode(activeTool, overlayMode)}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            defaultOptions={PREVIEW_DEFAULTS}
          />

          {/* RotationPreviewMount — draws on PreviewCanvas via imperative API */}
          <RotationPreviewMount
            phase={rotationPreview.phase}
            basePoint={rotationPreview.basePoint}
            referencePoint={rotationPreview.referencePoint}
            currentAngle={rotationPreview.currentAngle}
            selectedEntityIds={selectedEntityIds}
            levelManager={levelManager}
            transform={transform}
            getCanvas={() => previewCanvasRef.current?.getCanvas() ?? null}
            getViewportElement={() => {
              const canvas = dxfCanvasRef?.current?.getCanvas?.();
              return canvas instanceof HTMLElement ? canvas : null;
            }}
          />

          {/* CrosshairOverlay (z-20) */}
          <CrosshairOverlay
            isActive={crosshairSettings.enabled}
            rulerMargins={{
              left: rulerSettings.vertical?.width ?? COORDINATE_LAYOUT.RULER_LEFT_WIDTH,
              top: 0,
              bottom: 0,
            }}
            className={`absolute ${PANEL_LAYOUT.POSITION.LEFT_0} ${PANEL_LAYOUT.POSITION.RIGHT_0} ${PANEL_LAYOUT.POSITION.TOP_0} ${PANEL_LAYOUT.Z_INDEX['20']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            style={{
              height: `calc(100% - ${rulerSettings.horizontal?.height ?? COORDINATE_LAYOUT.RULER_TOP_HEIGHT}px)`,
            }}
          />

          {/* SnapIndicatorOverlay (z-30) — nano-leaf subscriber */}
          <SnapIndicatorSubscriber
            viewport={viewport}
            dxfCanvasRef={dxfCanvasRef}
            transform={transform}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['30']}`}
          />

          {/* RulerCornerBox (z-30) */}
          <RulerCornerBox
            rulerWidth={rulerSettings.vertical?.width ?? RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH}
            rulerHeight={rulerSettings.horizontal?.height ?? RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT}
            backgroundColor={globalRulerSettings.horizontal.backgroundColor}
            textColor={globalRulerSettings.horizontal.textColor}
            onZoomToFit={handleRulerZoomToFit}
            onZoom100={() => zoomSystem.zoomTo100()}
            onZoomIn={() => zoomSystem.zoomIn()}
            onZoomOut={() => zoomSystem.zoomOut()}
            onZoomPrevious={() => zoomSystem.zoomPrevious()}
            onZoomToScale={(scale) => zoomSystem.zoomToScale(scale)}
            onWheelZoom={handleRulerWheelZoom}
            viewport={viewport}
            className={PANEL_LAYOUT.Z_INDEX['30']}
          />
        </div>
      </div>
    </>
  );
});
