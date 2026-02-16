'use client';
import React, { useRef, useState, useCallback, useMemo } from 'react';
import { CanvasLayerStack } from './CanvasLayerStack';
import { useCanvasContext } from '../../contexts/CanvasContext';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLevels } from '../../systems/levels';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
import { useCursorSettings, useCursorActions } from '../../systems/cursor';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import { MOVEMENT_DETECTION } from '../../config/tolerance-config';
import { useGripStyles } from '../../settings-provider';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import { useZoom } from '../../systems/zoom';
import { dwarn, derr } from '../../debug';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { usePdfBackgroundStore } from '../../pdf-background';
import { useEventBus } from '../../systems/events';
import { useUniversalSelection } from '../../systems/selection';
import { useCommandHistory, useCommandHistoryKeyboard } from '../../core/commands';
import {
  useCanvasSettings, useCanvasMouse, useViewportManager, useDxfSceneConversion,
  useCanvasContextMenu, useSmartDelete, useDrawingUIHandlers, useCanvasClickHandler,
  useLayerCanvasMouseMove, useFitToView, usePolygonCompletion, useCanvasKeyboardShortcuts,
  useCanvasEffects, useOverlayInteraction,
} from '../../hooks/canvas';
import { useOverlayLayers } from '../../hooks/layers';
import { useSpecialTools } from '../../hooks/tools';
import { useGripSystem } from '../../hooks/grips';
import { useDxfGripInteraction } from '../../hooks/useDxfGripInteraction';
import { useTouchGestures } from '../../hooks/gestures/useTouchGestures';
import { useResponsiveLayout as useResponsiveLayoutForCanvas } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';

/**
 * Canvas orchestrator — wires 25+ hooks together and delegates rendering to CanvasLayerStack.
 * No business logic, no JSX beyond the single CanvasLayerStack call.
 */
export const CanvasSection: React.FC<DXFViewerLayoutProps & { overlayMode: OverlayEditorMode, currentStatus: Status, currentKind: OverlayKind }> = (props) => {
  const {
    activeTool,
    showGrid,
    showLayers,
    overlayMode = 'select',
    currentStatus = 'for-sale',
    currentKind = 'unit',
    ...restProps
  } = props;

  // === Canvas context (ADR-043: CanvasProvider must wrap this component) ===
  const canvasContext = useCanvasContext();

  if (process.env.NODE_ENV === 'development' && !canvasContext) {
    dwarn('CanvasSection', 'CanvasProvider not found — zoom buttons will not work.');
  }

  const dxfCanvasRef = canvasContext?.dxfRef;
  if (!dxfCanvasRef) {
    derr('CanvasSection', 'CanvasContext.dxfRef is null — zoom buttons will not work.');
  }

  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<PreviewCanvasHandle>(null);

  // === Transform state ===
  const defaultTransform = useMemo(() => ({ scale: 1, offsetX: 0, offsetY: 0 }), []);
  const transform = canvasContext?.transform || defaultTransform;
  const contextSetTransform = canvasContext?.setTransform || (() => {
    derr('CanvasSection', 'setTransform called but CanvasContext not available');
  });

  // === Viewport management ===
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    enabled: pdfEnabled,
    opacity: pdfOpacity,
    transform: pdfTransform,
    renderedImageUrl: pdfImageUrl,
    setViewport: setPdfViewport,
  } = usePdfBackgroundStore();

  const { viewport, viewportRef, viewportReady, setTransform, transformRef } = useViewportManager({
    containerRef, transform,
    setTransform: contextSetTransform,
    onViewportChange: setPdfViewport,
  });

  // Canvas element accessor for coordinate transforms
  const getCanvasElement = useCallback((): HTMLElement | null => {
    const dxfCanvas = dxfCanvasRef?.current?.getCanvas?.();
    if (dxfCanvas instanceof HTMLElement) return dxfCanvas;
    if (overlayCanvasRef.current instanceof HTMLElement) return overlayCanvasRef.current;
    if (containerRef.current instanceof HTMLElement) return containerRef.current;
    return null;
  }, []);

  const zoomSystem = useZoom({
    initialTransform: transform,
    onTransformChange: setTransform,
    viewport,
  });

  // === Canvas visibility ===
  const showDxfCanvas = props.dxfCanvasVisible ?? true;
  const showLayerCanvasDebug = props.layerCanvasVisible ?? true;

  if (!showDxfCanvas) {
    derr('CanvasSection', 'DxfCanvas is HIDDEN — zoom buttons will NOT work.');
  }

  // === Core stores + state ===
  const overlayStore = useOverlayStore();
  const universalSelection = useUniversalSelection();
  const { execute: executeCommand } = useCommandHistory();
  useCommandHistoryKeyboard();

  // Stable refs to avoid stale closures in mouse event callbacks
  const overlayStoreRef = useRef(overlayStore);
  const universalSelectionRef = useRef(universalSelection);
  overlayStoreRef.current = overlayStore;
  universalSelectionRef.current = universalSelection;

  const levelManager = useLevels();
  const currentOverlays = levelManager.currentLevelId
    ? overlayStore.getByLevel(levelManager.currentLevelId)
    : [];

  // === Grip system (hover, selection, drag states) ===
  const {
    hoveredVertexInfo, setHoveredVertexInfo,
    hoveredEdgeInfo, setHoveredEdgeInfo,
    selectedGrips, setSelectedGrips, selectedGrip,
    draggingVertices, setDraggingVertices, draggingVertex,
    draggingEdgeMidpoint, setDraggingEdgeMidpoint,
    draggingOverlayBody, setDraggingOverlayBody,
    dragPreviewPosition, setDragPreviewPosition,
    gripHoverThrottleRef, justFinishedDragRef,
    markDragFinished,
  } = useGripSystem();

  // === Entity interaction state ===
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  // Prevents handleCanvasClick from deselecting what mouseDown just selected
  const entitySelectedOnMouseDownRef = useRef(false);
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);
  const eventBus = useEventBus();

  // === Polygon drawing ===
  const {
    draftPolygon, setDraftPolygon, draftPolygonRef,
    isSavingPolygon, setIsSavingPolygon,
    finishDrawingWithPolygonRef, finishDrawing,
  } = usePolygonCompletion({
    levelManager, overlayStore, eventBus,
    currentStatus, currentKind, activeTool, overlayMode,
  });

  const { circleTTT, linePerpendicular, lineParallel } = useSpecialTools({ activeTool, levelManager });
  const { currentSnapResult } = useSnapContext();

  // === Settings ===
  const { state: { grid: gridContextSettings, rulers: rulerContextSettings } } = useRulersGridContext();
  const { settings: cursorSettings } = useCursorSettings();
  const {
    crosshairSettings, cursorCanvasSettings, snapSettings,
    rulerSettings, gridSettings, selectionSettings, gridMajorInterval,
  } = useCanvasSettings({
    cursorSettings,
    gridContextSettings: gridContextSettings ?? null,
    rulerContextSettings: rulerContextSettings ?? null,
    showGrid,
  });
  const gripSettings = useGripStyles();

  // === Cursor + touch gestures (ADR-176) ===
  const { updatePosition, setActive } = useCursorActions();

  const { layoutMode: canvasLayoutMode } = useResponsiveLayoutForCanvas();
  useTouchGestures({
    targetRef: containerRef,
    enabled: canvasLayoutMode !== 'desktop',
    activeTool,
    transform,
    setTransform: contextSetTransform,
  });

  // === Mouse event handling ===
  const {
    mouseCss, mouseWorld,
    updateMouseCss, updateMouseWorld,
    handleContainerMouseMove, handleContainerMouseDown,
    handleContainerMouseUp, handleContainerMouseEnter, handleContainerMouseLeave,
  } = useCanvasMouse({
    transform, viewport, activeTool,
    updatePosition, setActive, containerRef,
    hoveredVertexInfo, hoveredEdgeInfo,
    selectedGrips, setSelectedGrips,
    draggingVertices, setDraggingVertices,
    draggingEdgeMidpoint, setDraggingEdgeMidpoint,
    draggingOverlayBody, setDraggingOverlayBody,
    dragPreviewPosition, setDragPreviewPosition,
    gripHoverThrottleRef, justFinishedDragRef, markDragFinished,
    universalSelectionRef, overlayStoreRef,
    executeCommand,
    movementDetectionThreshold: MOVEMENT_DETECTION.MIN_MOVEMENT,
  });

  // === Layer visibility: always show when drawing/editing ===
  const showLayerCanvas = showLayerCanvasDebug || overlayMode === 'draw' || overlayMode === 'edit';

  // === Overlay → ColorLayer conversion ===
  const { colorLayers, colorLayersWithDraft, isNearFirstPoint } = useOverlayLayers({
    overlays: currentOverlays,
    isSelected: universalSelection.isSelected,
    hoveredVertexInfo, hoveredEdgeInfo,
    selectedGrips, draggingVertex, draggingVertices,
    draggingEdgeMidpoint, dragPreviewPosition,
    draftPolygon, mouseWorld,
    transformScale: transform.scale,
    currentStatus, hoveredOverlayId, overlayMode,
  });

  // === DXF scene + grip interaction ===
  const { dxfScene } = useDxfSceneConversion({ currentScene: props.currentScene ?? null });
  const dxfGripInteraction = useDxfGripInteraction({
    selectedEntityIds, dxfScene, transform,
    enabled: activeTool === 'select',
  });

  // === Delegated hook orchestration ===
  const { handleLayerCanvasMouseMove } = useLayerCanvasMouseMove({
    activeTool, transform,
    updateMouseCss, updateMouseWorld,
    hoveredVertexInfo, setHoveredVertexInfo,
    hoveredEdgeInfo, setHoveredEdgeInfo,
    draggingVertex, draggingEdgeMidpoint, draggingOverlayBody,
    setDragPreviewPosition, gripHoverThrottleRef,
    universalSelection, currentOverlays, gripSettings,
    onParentMouseMove: props.onMouseMove,
  });

  const { fitToOverlay } = useFitToView({
    dxfScene, colorLayers, zoomSystem, setTransform, containerRef, currentOverlays,
  });

  const { globalRulerSettings, drawingHandlers, drawingHandlersRef, hasUnifiedDrawingPointsRef } = useCanvasEffects({
    activeTool, overlayMode,
    currentScene: props.currentScene ?? null,
    handleSceneChange: props.handleSceneChange,
    onToolChange: props.onToolChange,
    previewCanvasRef, selectedGrips, setSelectedGrips, setDragPreviewPosition,
    universalSelection, dxfScene, dxfCanvasRef, overlayCanvasRef, zoomSystem,
  });

  const { drawingContextMenu, handleDrawingContextMenu, handleDrawingContextMenuClose } = useCanvasContextMenu({
    containerRef, activeTool, overlayMode, hasUnifiedDrawingPointsRef, draftPolygonRef,
  });

  const { handleDrawingFinish, handleDrawingClose, handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc } = useDrawingUIHandlers({
    overlayMode, draftPolygonRef, finishDrawingWithPolygonRef, drawingHandlersRef, setDraftPolygon,
  });

  const { handleOverlayClick, handleMultiOverlayClick } = useOverlayInteraction({
    activeTool, overlayMode, currentOverlays, universalSelection, overlayStore,
    hoveredEdgeInfo, transformScale: transform.scale,
    fitToOverlay, setDraggingOverlayBody, setDragPreviewPosition,
  });

  const { handleCanvasClick } = useCanvasClickHandler({
    viewportReady, viewport, transform,
    activeTool, overlayMode,
    circleTTT, linePerpendicular, lineParallel, dxfGripInteraction,
    levelManager,
    draftPolygon, setDraftPolygon, isSavingPolygon, setIsSavingPolygon,
    isNearFirstPoint, finishDrawingWithPolygonRef,
    drawingHandlersRef, entitySelectedOnMouseDownRef,
    universalSelection,
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrip,
    selectedGrips, setSelectedGrips, justFinishedDragRef,
    draggingOverlayBody, setSelectedEntityIds,
    currentOverlays, handleOverlayClick,
  });

  const { handleSmartDelete } = useSmartDelete({
    selectedGrips, setSelectedGrips, executeCommand,
    overlayStoreRef, universalSelectionRef, levelManager,
    setSelectedEntityIds, eventBus,
  });

  useCanvasKeyboardShortcuts({
    handleSmartDelete, dxfGripInteraction,
    setDraftPolygon, draftPolygon,
    selectedGrips, setSelectedGrips,
    activeTool, handleDrawingFinish, handleFlipArc, finishDrawing,
  });

  // === Render ===
  return (
    <CanvasLayerStack
      transform={transform}
      viewport={viewport}
      activeTool={activeTool}
      overlayMode={overlayMode}
      showLayers={showLayers}
      showDxfCanvas={showDxfCanvas}
      showLayerCanvas={showLayerCanvas}
      containerRef={containerRef}
      dxfCanvasRef={dxfCanvasRef}
      overlayCanvasRef={overlayCanvasRef}
      previewCanvasRef={previewCanvasRef}
      drawingHandlersRef={drawingHandlersRef}
      entitySelectedOnMouseDownRef={entitySelectedOnMouseDownRef}
      dxfScene={dxfScene}
      colorLayers={colorLayers}
      colorLayersWithDraft={colorLayersWithDraft}
      settings={{
        crosshair: crosshairSettings,
        cursor: cursorCanvasSettings,
        snap: snapSettings,
        ruler: rulerSettings,
        grid: gridSettings,
        gridMajorInterval,
        selection: selectionSettings,
        grip: gripSettings,
        globalRuler: globalRulerSettings,
      }}
      gripState={{
        draggingVertex, draggingEdgeMidpoint,
        hoveredVertexInfo, hoveredEdgeInfo,
        draggingOverlayBody, dragPreviewPosition,
      }}
      entityState={{
        selectedEntityIds, setSelectedEntityIds,
        hoveredEntityId, setHoveredEntityId,
        hoveredOverlayId, setHoveredOverlayId,
      }}
      zoomSystem={zoomSystem}
      dxfGripInteraction={dxfGripInteraction}
      universalSelection={universalSelection}
      currentSnapResult={currentSnapResult}
      setTransform={setTransform}
      mouseCss={mouseCss}
      updateMouseCss={updateMouseCss}
      updateMouseWorld={updateMouseWorld}
      containerHandlers={{
        onMouseMove: handleContainerMouseMove,
        onMouseDown: handleContainerMouseDown,
        onMouseUp: handleContainerMouseUp,
        onMouseEnter: handleContainerMouseEnter,
        onMouseLeave: handleContainerMouseLeave,
      }}
      handleOverlayClick={handleOverlayClick}
      handleMultiOverlayClick={handleMultiOverlayClick}
      handleCanvasClick={handleCanvasClick}
      handleLayerCanvasMouseMove={handleLayerCanvasMouseMove}
      handleDrawingContextMenu={handleDrawingContextMenu}
      handleDrawingContextMenuClose={handleDrawingContextMenuClose}
      drawingState={{
        drawingHandlers,
        contextMenu: drawingContextMenu,
        draftPolygon,
        handleDrawingFinish, handleDrawingClose,
        handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc,
      }}
      pdf={{
        imageUrl: pdfImageUrl,
        transform: pdfTransform,
        enabled: pdfEnabled,
        opacity: pdfOpacity,
      }}
      onMouseMove={props.onMouseMove}
    />
  );
};
