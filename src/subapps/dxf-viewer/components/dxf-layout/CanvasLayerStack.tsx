/**
 * 🏢 ENTERPRISE: CanvasLayerStack — Extraction #13
 *
 * @description All 9 canvas layers and their inline callbacks, extracted from CanvasSection.
 * Renders the visual canvas stack: PDF → LayerCanvas → DxfCanvas → PreviewCanvas →
 * CrosshairOverlay → SnapIndicator → RulerCornerBox → DrawingContextMenu
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~334 lines of JSX
 */

'use client';

import React, { useSyncExternalStore } from 'react';
import { DxfCanvas, LayerCanvas } from '../../canvas-v2';
import { PreviewCanvas } from '../../canvas-v2/preview-canvas';
import CrosshairOverlay from '../../canvas-v2/overlays/CrosshairOverlay';
import RulerCornerBox from '../../canvas-v2/overlays/RulerCornerBox';
import SnapIndicatorOverlay from '../../canvas-v2/overlays/SnapIndicatorOverlay';
import { PdfBackgroundCanvas } from '../../pdf-background';
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { RULERS_GRID_CONFIG } from '../../systems/rulers-grid/config';
import { UI_COLORS, PREVIEW_DEFAULTS } from '../../config/color-config';
import { canvasUI } from '@/styles/design-tokens/canvas';
import { createCombinedBounds } from '../../systems/zoom/utils/bounds';
import { isInDrawingMode } from '../../systems/tools/ToolStateManager';
import { dwarn } from '../../debug';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import { subscribeSnapResult, getFullSnapResult } from '../../systems/cursor/ImmediateSnapStore';
import type { CanvasLayerStackProps } from './canvas-layer-stack-types';

// Re-export props type for consumers
export type { CanvasLayerStackProps } from './canvas-layer-stack-types';

// ============================================================================
// COMPONENT
// ============================================================================

export const CanvasLayerStack: React.FC<CanvasLayerStackProps> = ({
  transform, viewport, activeTool, overlayMode, showLayers,
  showDxfCanvas, showLayerCanvas,
  containerRef, dxfCanvasRef, overlayCanvasRef, previewCanvasRef, drawingHandlersRef, entitySelectedOnMouseDownRef,
  dxfScene, colorLayers, colorLayersWithDraft,
  settings, gripState, entityState,
  zoomSystem, dxfGripInteraction, universalSelection, setTransform,
  mouseCss, updateMouseCss, updateMouseWorld,
  containerHandlers,
  handleOverlayClick, handleMultiOverlayClick, handleCanvasClick, handleUnifiedMouseMove,
  handleDrawingContextMenu,
  drawingState, entityJoin, pdf, onMouseMove,
  entityPickingActive,
  guides, guidesVisible, ghostGuide, ghostDiagonalGuide, ghostSegmentLine, highlightedGuideId, selectedGuideIds,
  constructionPoints, highlightedPointId,
}) => {
  const currentSnapResult = useSyncExternalStore(subscribeSnapResult, getFullSnapResult);

  // --- Destructure grouped props ---
  const { crosshair: crosshairSettings, cursor: cursorCanvasSettings, snap: snapSettings, ruler: rulerSettings, grid: gridSettings, gridMajorInterval, selection: selectionSettings, grip: gripSettings, globalRuler: globalRulerSettings } = settings;
  const { draggingVertex, draggingEdgeMidpoint, hoveredVertexInfo, hoveredEdgeInfo, draggingOverlayBody, dragPreviewPosition } = gripState;
  const { selectedEntityIds, setSelectedEntityIds, hoveredEntityId, setHoveredEntityId, hoveredOverlayId, setHoveredOverlayId } = entityState;
  const { drawingHandlers, draftPolygon, handleDrawingFinish, handleDrawingClose, handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc } = drawingState;

  // --- Computed values ---
  const isGripDragging = draggingVertex !== null || draggingEdgeMidpoint !== null || hoveredVertexInfo !== null || hoveredEdgeInfo !== null;

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
        entityIds.map(id => ({ id, type: 'dxf-entity' as const }))
      );
    }
  };

  const handleUnifiedMarqueeResult = ({ layerIds, entityIds }: { layerIds: string[]; entityIds: string[] }) => {
    universalSelection.clearAll();
    if (layerIds.length > 0) {
      universalSelection.addMultiple(
        layerIds.map(id => ({ id, type: 'overlay' as const }))
      );
    }
    setSelectedEntityIds(entityIds);
    if (entityIds.length > 0) {
      universalSelection.addMultiple(
        entityIds.map(id => ({ id, type: 'dxf-entity' as const }))
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

  const handleDxfEntitySelect = (entityId: string | null) => {
    if (entityId) {
      setSelectedEntityIds(prev => {
        if (prev.length === 1 && prev[0] === entityId) return prev;
        return [entityId];
      });
      universalSelection.clearByType('dxf-entity');
      universalSelection.select(entityId, 'dxf-entity');
      entitySelectedOnMouseDownRef.current = true;
    } else {
      entitySelectedOnMouseDownRef.current = false;
    }
  };

  const handleDxfMouseMove = (screenPos: Point2D, worldPos: Point2D) => {
    if (worldPos) {
      handleUnifiedMouseMove(worldPos, screenPos);
    }

    if (onMouseMove && worldPos) {
      const mockEvent = {
        clientX: screenPos.x,
        clientY: screenPos.y,
        preventDefault: () => {},
        stopPropagation: () => {}
      } as React.MouseEvent;
      onMouseMove(worldPos, mockEvent);
    }

    updateMouseCss(screenPos);
    updateMouseWorld(worldPos);

    if (isInDrawingMode(activeTool, overlayMode) && worldPos && drawingHandlersRef.current?.onDrawingHover) {
      drawingHandlersRef.current.onDrawingHover(worldPos);
    }
  };

  const handleRulerZoomToFit = () => {
    const combinedBounds = createCombinedBounds(dxfScene, colorLayers, true);
    if (combinedBounds && viewport.width > 0 && viewport.height > 0) {
      zoomSystem.zoomToFit(combinedBounds, viewport, true);
    } else {
      dwarn('CanvasLayerStack', 'ZoomToFit: Invalid bounds or viewport!', { combinedBounds, viewport });
    }
  };

  const handleRulerWheelZoom = (delta: number) => {
    if (mouseCss) {
      zoomSystem.handleWheelZoom(delta, mouseCss);
    }
  };

  // --- Computed props ---
  const draggingOverlayDelta = draggingOverlayBody && dragPreviewPosition
    ? {
        overlayId: draggingOverlayBody.overlayId,
        delta: {
          x: dragPreviewPosition.x - draggingOverlayBody.startPoint.x,
          y: dragPreviewPosition.y - draggingOverlayBody.startPoint.y,
        },
      }
    : null;

  const dxfRulerSettings = {
    enabled: (globalRulerSettings?.horizontal?.enabled && globalRulerSettings?.vertical?.enabled) ?? true,
    visible: true,
    opacity: 1.0,
    unit: globalRulerSettings.units as 'mm' | 'cm' | 'm',
    color: globalRulerSettings.horizontal.color,
    backgroundColor: globalRulerSettings.horizontal.backgroundColor,
    fontSize: globalRulerSettings.horizontal.fontSize,
    textColor: globalRulerSettings.horizontal.textColor,
    height: 30,
    width: 30,
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
  };

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
          {/* PDF Background (z-[-10]) */}
          <PdfBackgroundCanvas
            imageUrl={pdf.imageUrl}
            pdfTransform={pdf.transform}
            canvasTransform={transform}
            viewport={viewport}
            enabled={pdf.enabled}
            opacity={pdf.opacity}
          />

          {/* LayerCanvas (z-0) */}
          {showLayerCanvas && (
            <LayerCanvas
              ref={overlayCanvasRef as React.RefObject<HTMLCanvasElement>}
              layers={colorLayersWithDraft}
              transform={transform}
              viewport={viewport}
              activeTool={activeTool}
              overlayMode={overlayMode}
              layersVisible={showLayers}
              dxfScene={dxfScene}
              enableUnifiedCanvas
              isGripDragging={isGripDragging}
              data-canvas-type="layer"
              onContextMenu={handleDrawingContextMenu}
              onTransformChange={handleTransformChange}
              onWheelZoom={zoomSystem.handleWheelZoom}
              crosshairSettings={crosshairSettings}
              cursorSettings={cursorCanvasSettings}
              snapSettings={snapSettings}
              gridSettings={{ ...gridSettings, enabled: false }}
              rulerSettings={{ ...rulerSettings, enabled: false }}
              selectionSettings={selectionSettings}
              renderOptions={{
                showCrosshair: true,
                showCursor: true,
                showSnapIndicators: true,
                showGrid: false,
                showRulers: false,
                showSelectionBox: false,
                crosshairPosition: null,
                cursorPosition: null,
                snapResults: [],
                selectionBox: null,
                gripSettings,
              }}
              onLayerClick={handleOverlayClickWithEntityClear}
              onMultiLayerClick={handleMultiOverlayClickWithEntityClear}
              onCanvasClick={handleCanvasClick}
              onDrawingHover={drawingHandlersRef.current?.onDrawingHover}
              draggingOverlay={draggingOverlayDelta}
              onMouseMove={(screenPos, worldPos) => handleUnifiedMouseMove(worldPos, screenPos)}
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['0']}`}
              style={canvasUI.positioning.layers.layerCanvasWithTools(activeTool, crosshairSettings.enabled)}
            />
          )}

          {/* DxfCanvas (z-10) */}
          {showDxfCanvas && (
            <DxfCanvas
              ref={dxfCanvasRef}
              scene={dxfScene}
              transform={transform}
              viewport={viewport}
              activeTool={activeTool}
              overlayMode={overlayMode}
              colorLayers={colorLayers}
              renderOptions={{
                showGrid: false,
                showLayerNames: false,
                wireframeMode: false,
                selectedEntityIds,
                hoveredEntityId,
                gripInteractionState: dxfGripInteraction.gripInteractionState,
                dragPreview: dxfGripInteraction.dragPreview ?? undefined,
              }}
              crosshairSettings={crosshairSettings}
              gridSettings={gridSettings}
              rulerSettings={dxfRulerSettings}
              guides={guides}
              guidesVisible={guidesVisible}
              ghostGuide={ghostGuide}
              ghostDiagonalGuide={ghostDiagonalGuide}
              ghostSegmentLine={ghostSegmentLine}
              highlightedGuideId={highlightedGuideId}
              selectedGuideIds={selectedGuideIds}
              constructionPoints={constructionPoints}
              highlightedPointId={highlightedPointId}
              onLayerSelected={handleOverlayClickWithEntityClear}
              onMultiLayerSelected={handleMultiOverlayClickWithEntityClear}
              onEntitiesSelected={handleDxfEntitiesSelected}
              onUnifiedMarqueeResult={handleUnifiedMarqueeResult}
              onHoverEntity={setHoveredEntityId}
              onHoverOverlay={setHoveredOverlayId}
              onEntitySelect={handleDxfEntitySelect}
              isGripDragging={isGripDragging || dxfGripInteraction.isDraggingGrip}
              onGripMouseDown={(worldPos) => dxfGripInteraction.handleGripMouseDown(worldPos)}
              onGripMouseUp={(worldPos) => dxfGripInteraction.handleGripMouseUp(worldPos)}
              entityPickingActive={entityPickingActive}
              data-canvas-type="dxf"
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['10']}`}
              onContextMenu={handleDrawingContextMenu}
              onCanvasClick={handleCanvasClick}
              onTransformChange={handleTransformChange}
              onWheelZoom={zoomSystem.handleWheelZoom}
              onMouseMove={handleDxfMouseMove}
            />
          )}

          {/* PreviewCanvas (pointer-events: none) */}
          <PreviewCanvas
            ref={previewCanvasRef as React.RefObject<import('../../canvas-v2/preview-canvas').PreviewCanvasHandle>}
            transform={transform}
            viewport={viewport}
            isActive={isInDrawingMode(activeTool, overlayMode)}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            defaultOptions={PREVIEW_DEFAULTS}
          />

          {/* CrosshairOverlay (z-20) */}
          <CrosshairOverlay
            isActive={crosshairSettings.enabled}
            rulerMargins={{
              left: rulerSettings.width ?? COORDINATE_LAYOUT.RULER_LEFT_WIDTH,
              top: 0,
              bottom: 0,
            }}
            className={`absolute ${PANEL_LAYOUT.POSITION.LEFT_0} ${PANEL_LAYOUT.POSITION.RIGHT_0} ${PANEL_LAYOUT.POSITION.TOP_0} ${PANEL_LAYOUT.Z_INDEX['20']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            style={{ height: `calc(100% - ${rulerSettings.height ?? COORDINATE_LAYOUT.RULER_TOP_HEIGHT}px)` }}
          />

          {/* SnapIndicatorOverlay (z-30) */}
          <SnapIndicatorOverlay
            snapResult={currentSnapResult ? {
              point: currentSnapResult.snappedPoint,
              type: currentSnapResult.activeMode || 'endpoint',
            } : null}
            viewport={viewport}
            canvasRect={dxfCanvasRef?.current?.getCanvas?.()?.getBoundingClientRect() ?? null}
            transform={transform}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['30']}`}
          />

          {/* RulerCornerBox (z-30) */}
          <RulerCornerBox
            rulerWidth={rulerSettings.width ?? RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH}
            rulerHeight={rulerSettings.height ?? RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT}
            currentScale={transform.scale}
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
};
