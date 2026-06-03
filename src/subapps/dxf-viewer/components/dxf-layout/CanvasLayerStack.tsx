/**
 * ⚠️ ARCHITECTURE-CRITICAL — READ ADR-040 BEFORE EDITING (update changelog same commit)
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * Shell renders 9 canvas layers extracted from CanvasSection (~334 lines JSX).
 * ADR-040 micro-leaf pattern: high-freq subscriptions pushed into named leaves:
 * - SnapIndicatorSubscriber, DraftLayerSubscriber, DxfCanvasSubscriber
 * - RotationPreviewMount (ADR-188), MovePreviewMount (ADR-049)
 * Shell itself MUST NOT call useSyncExternalStore (enforced: CHECK 6C).
 */
'use client';
import React, { useCallback, useMemo, useRef } from 'react';
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
  PreviewCanvasMounts,
  type LayerCanvasPassthroughProps,
} from './canvas-layer-stack-leaves';
import { PolygonCropPreviewSubscriber } from './LassoCropPreviewSubscriber'; import { LassoFreehandPreviewSubscriber } from './LassoFreehandPreviewSubscriber';
import { ZoomWindowSubscriber } from './leaves/ZoomWindowSubscriber';
import { AutoAreaResultPanel } from './AutoAreaResultPanel'; import { AutoAreaPreviewOverlay } from './AutoAreaPreviewOverlay';
import { CanvasNumericInputOverlay } from '../../systems/canvas-numeric-input/CanvasNumericInputOverlay'; import { DynamicInputSubscriber } from './DynamicInputSubscriber'; import { CanvasLayerStack3dLeaf } from './canvas-layer-stack-3d-leaf';
import { ViewMode3DToggleButton } from '../../bim-3d/viewport/ViewMode3DToggleButton'; import { Focus2DOverlayLeaf } from './Focus2DOverlayLeaf'; import { SelectionCursorIcon } from '../../accessibility/SelectionCursorIcon';
import { useDxfOverlay3DSync } from './useDxfOverlay3DSync'; import { useLevelId3DSync } from './useLevelId3DSync';
// ADR-396 P4 — ETICS θερμοπρόσοψη 2D overlay (dedicated floor-overlay micro-leaf).
import { EnvelopeOverlay } from './EnvelopeOverlay';
import { HomeRunWiresOverlay } from './HomeRunWiresOverlay';
// ADR-399 Phase D — 2D «Όλοι οι όροφοι» read-only underlay (other floors, faded, behind active).
import { FloorUnderlayOverlay } from './FloorUnderlayOverlay';
export type { CanvasLayerStackProps } from './canvas-layer-stack-types';
const EMPTY_SNAP_RESULTS: readonly never[] = Object.freeze([]);
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
  rotationPreview, movePreview, mirrorPreview, scalePreview, stretchPreview, columnGhostPreview, mepFixtureGhostPreview, electricalPanelGhostPreview, slabOpeningGhostPreview, openingGhostPreview, levelManager,
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
  const { selectedEntityIds } = entityState;
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
    universalSelection.replaceEntitySelection(entityIds);
  };
  const handleUnifiedMarqueeResult = ({
    layerIds,
    entityIds,
    subtract,
  }: {
    layerIds: string[];
    entityIds: string[];
    subtract?: boolean;
  }) => {
    universalSelection.handleMarqueeResult(layerIds, entityIds, { subtract: !!subtract });
  };
  const handleOverlayClickWithEntityClear = (overlayId: string, point: Point2D) => {
    universalSelection.clearByType('dxf-entity');
    handleOverlayClick(overlayId, point);
  };
  const handleMultiOverlayClickWithEntityClear = (layerIds: string[]) => {
    universalSelection.clearByType('dxf-entity');
    handleMultiOverlayClick(layerIds);
  };
  const handleDxfEntitySelect = (entityId: string | null, additive?: boolean) => {
    if (entityId) {
      universalSelection.handleEntityClick(entityId, { shiftKey: !!additive });
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
  // ADR-040 perf: refs so callbacks don't capture stale scene/colorLayers while staying stable.
  const dxfSceneRef = useRef(dxfScene);
  dxfSceneRef.current = dxfScene;
  const colorLayersRef = useRef(colorLayers);
  colorLayersRef.current = colorLayers;
  const handleRulerZoomToFit = useCallback(() => {
    const combinedBounds = createCombinedBounds(dxfSceneRef.current, colorLayersRef.current, true);
    if (combinedBounds && viewport.width > 0 && viewport.height > 0) {
      zoomSystem.zoomToFit(combinedBounds, viewport, true);
    } else {
      dwarn('CanvasLayerStack', 'ZoomToFit: Invalid bounds or viewport!', {
        combinedBounds,
        viewport,
      });
    }
  }, [viewport, zoomSystem]);
  const handleRulerWheelZoom = useCallback((delta: number) => {
    const cssPos = getImmediatePosition();
    if (cssPos) {
      zoomSystem.handleWheelZoom(delta, cssPos);
    }
  }, [zoomSystem]);
  const handleZoom100 = useCallback(() => zoomSystem.zoomTo100(), [zoomSystem]);
  const handleZoomIn = useCallback(() => zoomSystem.zoomIn(), [zoomSystem]);
  const handleZoomOut = useCallback(() => zoomSystem.zoomOut(), [zoomSystem]);
  const handleZoomPrevious = useCallback(() => zoomSystem.zoomPrevious(), [zoomSystem]);
  const handleZoomToScale = useCallback((scale: number) => zoomSystem.zoomToScale(scale), [zoomSystem]);
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
    borderColor: globalRulerSettings.horizontal.borderColor,
    borderWidth: globalRulerSettings.horizontal.borderWidth,
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
  useDxfOverlay3DSync(dxfScene);
  useLevelId3DSync(levelManager.currentLevelId);
  const layerClassName = `absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['0']}`;
  const layerStyle = useMemo(
    () => canvasUI.positioning.layers.layerCanvasWithTools(activeTool, crosshairSettings.enabled),
    [activeTool, crosshairSettings.enabled],
  );
  const onMouseMoveStable = useCallback(
    (screenPos: Point2D, worldPos: Point2D) => handleUnifiedMouseMove(worldPos, screenPos),
    [handleUnifiedMouseMove],
  );
  // Shared getters consumed by all 3 PreviewCanvas mounts (Rotation / Move / GripDrag).
  const getPreviewCanvas = useCallback(
    () => previewCanvasRef.current?.getCanvas() ?? null,
    [previewCanvasRef],
  );
  const getViewportEl = useCallback(() => {
    const canvas = dxfCanvasRef?.current?.getCanvas?.();
    return canvas instanceof HTMLElement ? canvas : null;
  }, [dxfCanvasRef]);
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
  // ADR-049 SSOT: dragPreview removed — grip-drag ghost lives on PreviewCanvas
  // via GripDragPreviewMount, same path as toolbar Move tool.
  const dxfRenderOptionsBase = useMemo<Omit<DxfRenderOptions, 'hoveredEntityId'>>(
    () => ({
      showGrid: false,
      showLayerNames: false,
      wireframeMode: false,
      selectedEntityIds,
      gripInteractionState: dxfGripInteraction.gripInteractionState,
      movePreviewActive: movePreview.phase === 'awaiting-destination',
    }),
    [selectedEntityIds, dxfGripInteraction.gripInteractionState, movePreview.phase],
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
          onDoubleClick={containerHandlers.onDoubleClick}
          onContextMenu={handleDrawingContextMenu}
        >
          {floorId && (
            <FloorplanBackgroundCanvas
              floorId={floorId}
              worldToCanvas={transform}
              viewport={viewport}
              cad={{ mode: 'cad-y-up', margins: COORDINATE_LAYOUT.MARGINS }}
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            />
          )}
          {/* ADR-399 Phase D — 2D underlay of other building floors (read-only, faded),
              behind the active DXF canvas. Self-gated to floor3DScope==='all' && mode==='2d'. */}
          <FloorUnderlayOverlay transform={transform} viewport={viewport} />
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
          <PreviewCanvas
            ref={previewCanvasRef as React.RefObject<PreviewCanvasHandle>}
            transform={transform}
            viewport={viewport}
            isActive={isInDrawingMode(activeTool, overlayMode)}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            defaultOptions={PREVIEW_DEFAULTS}
            sceneUnits={dxfScene?.units ?? 'mm'}
          />
          {/* PreviewCanvas mounts: Rotation / Move / GripDrag (ADR-049 SSOT) */}
          <PreviewCanvasMounts
            rotation={rotationPreview}
            move={movePreview}
            mirror={mirrorPreview}
            scale={scalePreview}
            stretch={stretchPreview}
            columnGhost={columnGhostPreview}
            mepFixtureGhost={mepFixtureGhostPreview}
            electricalPanelGhost={electricalPanelGhostPreview}
            slabOpeningGhost={slabOpeningGhostPreview}
            openingGhost={openingGhostPreview}
            gripDragPreview={dxfGripInteraction.dragPreview}
            selectedEntityIds={selectedEntityIds}
            levelManager={levelManager}
            transform={transform}
            getCanvas={getPreviewCanvas}
            getViewportElement={getViewportEl}
          />
          <CrosshairOverlay
            isActive={crosshairSettings.enabled && !!dxfScene}
            rulerMargins={{
              left: rulerSettings.width ?? COORDINATE_LAYOUT.RULER_LEFT_WIDTH,
              top: 0,
              bottom: 0,
            }}
            isEntitySelected={(id) => selectedEntityIds.includes(id)}
            className={`absolute ${PANEL_LAYOUT.POSITION.LEFT_0} ${PANEL_LAYOUT.POSITION.RIGHT_0} ${PANEL_LAYOUT.POSITION.TOP_0} ${PANEL_LAYOUT.Z_INDEX['20']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            style={{
              height: `calc(100% - ${rulerSettings.height ?? COORDINATE_LAYOUT.RULER_TOP_HEIGHT}px)`,
            }}
          />
          <SnapIndicatorSubscriber
            viewport={viewport}
            dxfCanvasRef={dxfCanvasRef}
            transform={transform}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['30']}`}
          />
          <RulerCornerBox
            rulerWidth={rulerSettings.width ?? RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH}
            rulerHeight={rulerSettings.height ?? RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT}
            backgroundColor={globalRulerSettings.horizontal.backgroundColor}
            textColor={globalRulerSettings.horizontal.textColor}
            onZoomToFit={handleRulerZoomToFit}
            onZoom100={handleZoom100}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomPrevious={handleZoomPrevious}
            onZoomToScale={handleZoomToScale}
            onWheelZoom={handleRulerWheelZoom}
            className={PANEL_LAYOUT.Z_INDEX['30']}
          />
          <AutoAreaPreviewOverlay transform={transform} viewport={viewport} />
          <PolygonCropPreviewSubscriber transform={transform} viewport={viewport} className={`absolute inset-0 w-full h-full pointer-events-none ${PANEL_LAYOUT.Z_INDEX['20']}`} />
          <LassoFreehandPreviewSubscriber transform={transform} viewport={viewport} className={`absolute inset-0 w-full h-full pointer-events-none ${PANEL_LAYOUT.Z_INDEX['20']}`} />
          {/* ADR-374 — ZOOM Window rubber-band rect overlay (mount per ADR §"File Structure") */}
          <ZoomWindowSubscriber className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['20']}`} />
          <CanvasNumericInputOverlay />
          {/* ADR-357 Phase 2a — Dynamic Input overlay (length/angle live readout). */}
          <DynamicInputSubscriber
            activeTool={activeTool}
            viewport={viewport}
            transform={transform}
            canvasRect={dxfCanvasRef?.current?.getCanvas?.()?.getBoundingClientRect() ?? null}
            onDrawingPoint={drawingHandlers.onDrawingPoint}
          />
          <CanvasLayerStack3dLeaf />
          <Focus2DOverlayLeaf scene={dxfScene} transform={transform} viewport={viewport} />
          {/* ADR-396 P4 — ETICS θερμοπρόσοψη: συνεχές offset περίγραμμα + insulation hatch band. */}
          <EnvelopeOverlay scene={dxfScene} transform={transform} viewport={viewport} currentLevelId={levelManager.currentLevelId} />
          {/* ADR-408 Φ7 — home-run circuit wires (derived panel→fixtures annotation). */}
          <HomeRunWiresOverlay scene={dxfScene} transform={transform} viewport={viewport} currentLevelId={levelManager.currentLevelId} gripDragPreview={dxfGripInteraction.dragPreview} />
          {/* ADR-366 §A.7.Q3 Phase 4.7 — cross-mode cursor modifier badge (fixed, single instance) */}
          <SelectionCursorIcon />
          <ViewMode3DToggleButton />
        </div>
      </div>
      <AutoAreaResultPanel />
    </>
  );
});
