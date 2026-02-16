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

import React, { type RefObject, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import { DxfCanvas, LayerCanvas } from '../../canvas-v2';
import type { DxfCanvasRef } from '../../canvas-v2';
import { PreviewCanvas, type PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import CrosshairOverlay from '../../canvas-v2/overlays/CrosshairOverlay';
import RulerCornerBox from '../../canvas-v2/overlays/RulerCornerBox';
import SnapIndicatorOverlay from '../../canvas-v2/overlays/SnapIndicatorOverlay';
import DrawingContextMenu from '../../ui/components/DrawingContextMenu';
import { PdfBackgroundCanvas } from '../../pdf-background';
import type { PdfBackgroundTransform } from '../../pdf-background';
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { RULERS_GRID_CONFIG } from '../../systems/rulers-grid/config';
import { UI_COLORS, PREVIEW_DEFAULTS } from '../../config/color-config';
import { canvasUI } from '@/styles/design-tokens/canvas';
import { createCombinedBounds } from '../../systems/zoom/utils/bounds';
import { isInDrawingMode } from '../../systems/tools/ToolStateManager';
import { dwarn } from '../../debug';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';
import type { OverlayEditorMode } from '../../overlays/types';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
import type { CursorSettings } from '../../systems/cursor/config';
import type { GridSettings, RulerSettings, SnapSettings, SelectionSettings } from '../../canvas-v2';
import type { GripSettings } from '../../types/gripSettings';
import type { RulerSettings as GlobalRulerSettings } from '../../systems/rulers-grid/config';
import type { SnapResult } from '../../snapping/extended-types';
import type { ToolType } from '../../ui/toolbar/types';
import type {
  VertexHoverInfo,
  EdgeHoverInfo,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
} from '../../hooks/canvas/useCanvasMouse';
import type { UseDxfGripInteractionReturn } from '../../hooks/useDxfGripInteraction';
import type { useDrawingHandlers } from '../../hooks/drawing/useDrawingHandlers';

// ============================================================================
// TYPES
// ============================================================================

type DrawingHandlersReturn = ReturnType<typeof useDrawingHandlers>;

interface Viewport {
  width: number;
  height: number;
}

/** Minimal universal selection interface for DxfCanvas callbacks */
interface UniversalSelectionForStack {
  clearByType: (type: 'overlay' | 'dxf-entity') => void;
  select: (id: string, type: 'overlay' | 'dxf-entity') => void;
  selectMultiple: (items: Array<{ id: string; type: 'overlay' | 'dxf-entity' }>) => void;
}

/** Zoom system methods used by CanvasLayerStack */
interface ZoomSystemForStack {
  zoomToFit: (bounds: { min: Point2D; max: Point2D }, viewport: Viewport, alignToOrigin?: boolean) => { transform: ViewTransform } | null;
  setTransform: (transform: ViewTransform) => void;
  handleWheelZoom: (delta: number, center: Point2D) => void;
  zoomTo100: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomPrevious: () => void;
  zoomToScale: (scale: number) => void;
}

export interface CanvasLayerStackProps {
  // === Core canvas state ===
  transform: ViewTransform;
  viewport: Viewport;
  activeTool: string;
  overlayMode: OverlayEditorMode;
  showLayers: boolean;

  // === Visibility flags ===
  showDxfCanvas: boolean;
  showLayerCanvas: boolean;

  // === Canvas refs ===
  containerRef: RefObject<HTMLDivElement | null>;
  dxfCanvasRef: RefObject<DxfCanvasRef> | undefined;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  previewCanvasRef: RefObject<PreviewCanvasHandle | null>;
  drawingHandlersRef: MutableRefObject<DrawingHandlersReturn | null>;
  entitySelectedOnMouseDownRef: MutableRefObject<boolean>;

  // === Canvas data ===
  dxfScene: DxfScene | null;
  colorLayers: ColorLayer[];
  colorLayersWithDraft: ColorLayer[];

  // === Settings (grouped) ===
  settings: {
    crosshair: CrosshairSettings;
    cursor: CursorSettings;
    snap: SnapSettings;
    ruler: RulerSettings;
    grid: GridSettings;
    gridMajorInterval: number;
    selection: SelectionSettings;
    grip: GripSettings;
    globalRuler: GlobalRulerSettings;
  };

  // === Grip render state (grouped) ===
  gripState: {
    draggingVertex: DraggingVertexState | null;
    draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
    hoveredVertexInfo: VertexHoverInfo | null;
    hoveredEdgeInfo: EdgeHoverInfo | null;
    draggingOverlayBody: DraggingOverlayBodyState | null;
    dragPreviewPosition: Point2D | null;
  };

  // === Entity interaction state (grouped) ===
  entityState: {
    selectedEntityIds: string[];
    setSelectedEntityIds: Dispatch<SetStateAction<string[]>>;
    hoveredEntityId: string | null;
    setHoveredEntityId: (id: string | null) => void;
    hoveredOverlayId: string | null;
    setHoveredOverlayId: (id: string | null) => void;
  };

  // === System objects ===
  zoomSystem: ZoomSystemForStack;
  dxfGripInteraction: UseDxfGripInteractionReturn;
  universalSelection: UniversalSelectionForStack;
  currentSnapResult: SnapResult | null;
  setTransform: (t: ViewTransform) => void;

  // === Mouse state ===
  mouseCss: Point2D | null;
  updateMouseCss: (pos: Point2D) => void;
  updateMouseWorld: (pos: Point2D) => void;

  // === Container event handlers (grouped) ===
  containerHandlers: {
    onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };

  // === Canvas interaction handlers ===
  handleOverlayClick: (overlayId: string, point: Point2D) => void;
  handleMultiOverlayClick: (layerIds: string[]) => void;
  handleCanvasClick: (worldPoint: Point2D) => void;
  /** ADR-183: Unified grip mouse move handler (replaces handleLayerCanvasMouseMove bridge hack) */
  handleUnifiedMouseMove: (worldPos: Point2D, screenPos: Point2D) => void;
  handleDrawingContextMenu: (e: React.MouseEvent) => void;
  handleDrawingContextMenuClose: (open: boolean) => void;

  // === Drawing state (grouped) ===
  drawingState: {
    drawingHandlers: DrawingHandlersReturn;
    contextMenu: { isOpen: boolean; position: { x: number; y: number } };
    draftPolygon: Array<[number, number]>;
    handleDrawingFinish: () => void;
    handleDrawingClose: () => void;
    handleDrawingCancel: () => void;
    handleDrawingUndoLastPoint: () => void;
    handleFlipArc: () => void;
  };

  // === PDF background (grouped) ===
  pdf: {
    imageUrl: string | null;
    transform: PdfBackgroundTransform;
    enabled: boolean;
    opacity: number;
  };

  // === External callback ===
  onMouseMove?: (worldPos: Point2D, event: React.MouseEvent) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const CanvasLayerStack: React.FC<CanvasLayerStackProps> = ({
  transform, viewport, activeTool, overlayMode, showLayers,
  showDxfCanvas, showLayerCanvas,
  containerRef, dxfCanvasRef, overlayCanvasRef, previewCanvasRef, drawingHandlersRef, entitySelectedOnMouseDownRef,
  dxfScene, colorLayers, colorLayersWithDraft,
  settings, gripState, entityState,
  zoomSystem, dxfGripInteraction, universalSelection, currentSnapResult, setTransform,
  mouseCss, updateMouseCss, updateMouseWorld,
  containerHandlers,
  handleOverlayClick, handleMultiOverlayClick, handleCanvasClick, handleUnifiedMouseMove,
  handleDrawingContextMenu, handleDrawingContextMenuClose,
  drawingState, pdf, onMouseMove,
}) => {
  // --- Destructure grouped props ---
  const { crosshair: crosshairSettings, cursor: cursorCanvasSettings, snap: snapSettings, ruler: rulerSettings, grid: gridSettings, gridMajorInterval, selection: selectionSettings, grip: gripSettings, globalRuler: globalRulerSettings } = settings;
  const { draggingVertex, draggingEdgeMidpoint, hoveredVertexInfo, hoveredEdgeInfo, draggingOverlayBody, dragPreviewPosition } = gripState;
  const { selectedEntityIds, setSelectedEntityIds, hoveredEntityId, setHoveredEntityId, hoveredOverlayId, setHoveredOverlayId } = entityState;
  const { drawingHandlers, contextMenu: drawingContextMenu, draftPolygon, handleDrawingFinish, handleDrawingClose, handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc } = drawingState;

  // --- Computed values ---
  const isGripDragging = draggingVertex !== null || draggingEdgeMidpoint !== null || hoveredVertexInfo !== null || hoveredEdgeInfo !== null;

  // --- Named callbacks (previously inline) ---

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
    // ADR-183: ONE call handles ALL grips (DXF + overlay) — replaces bridge hack
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
          {/* PDF Background: Lowest layer (z-[-10]) */}
          <PdfBackgroundCanvas
            imageUrl={pdf.imageUrl}
            pdfTransform={pdf.transform}
            canvasTransform={transform}
            viewport={viewport}
            enabled={pdf.enabled}
            opacity={pdf.opacity}
          />

          {/* LayerCanvas: Background overlays (z-0) */}
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
              onLayerClick={handleOverlayClick}
              onMultiLayerClick={handleMultiOverlayClick}
              onCanvasClick={handleCanvasClick}
              onDrawingHover={drawingHandlersRef.current?.onDrawingHover}
              draggingOverlay={draggingOverlayDelta}
              onMouseMove={(screenPos, worldPos) => handleUnifiedMouseMove(worldPos, screenPos)}
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['0']}`}
              style={canvasUI.positioning.layers.layerCanvasWithTools(activeTool, crosshairSettings.enabled)}
            />
          )}

          {/* DxfCanvas: Foreground DXF drawing (z-10) */}
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
              onLayerSelected={handleOverlayClick}
              onMultiLayerSelected={handleMultiOverlayClick}
              onEntitiesSelected={handleDxfEntitiesSelected}
              onHoverEntity={setHoveredEntityId}
              onHoverOverlay={setHoveredOverlayId}
              onEntitySelect={handleDxfEntitySelect}
              isGripDragging={isGripDragging || dxfGripInteraction.isDraggingGrip}
              onGripMouseDown={(worldPos) => dxfGripInteraction.handleGripMouseDown(worldPos)}
              onGripMouseUp={(worldPos) => dxfGripInteraction.handleGripMouseUp(worldPos)}
              data-canvas-type="dxf"
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['10']}`}
              onContextMenu={handleDrawingContextMenu}
              onCanvasClick={handleCanvasClick}
              onTransformChange={handleTransformChange}
              onWheelZoom={zoomSystem.handleWheelZoom}
              onMouseMove={handleDxfMouseMove}
            />
          )}

          {/* PreviewCanvas: Drawing previews (pointer-events: none) */}
          <PreviewCanvas
            ref={previewCanvasRef as React.RefObject<PreviewCanvasHandle>}
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
              top: rulerSettings.height ?? COORDINATE_LAYOUT.RULER_TOP_HEIGHT,
              bottom: COORDINATE_LAYOUT.MARGINS.bottom,
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

          {/* DrawingContextMenu */}
          <DrawingContextMenu
            isOpen={drawingContextMenu.isOpen}
            onOpenChange={handleDrawingContextMenuClose}
            position={drawingContextMenu.position}
            activeTool={(overlayMode === 'draw' ? 'polygon' : activeTool) as ToolType}
            pointCount={
              overlayMode === 'draw'
                ? draftPolygon.length
                : (drawingHandlers?.drawingState?.tempPoints?.length ?? 0)
            }
            onFinish={handleDrawingFinish}
            onClose={handleDrawingClose}
            onUndoLastPoint={handleDrawingUndoLastPoint}
            onCancel={handleDrawingCancel}
            onFlipArc={handleFlipArc}
          />
        </div>
      </div>
    </>
  );
};
