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
  useFitToView, usePolygonCompletion, useCanvasKeyboardShortcuts,
  useCanvasEffects, useOverlayInteraction,
} from '../../hooks/canvas';
import { useOverlayLayers } from '../../hooks/layers';
import { useSpecialTools } from '../../hooks/tools';
import { useUnifiedGripInteraction } from '../../hooks/grips/useUnifiedGripInteraction';
import { useEntityJoin } from '../../hooks/useEntityJoin';
import { useNotifications } from '../../../../providers/NotificationProvider';
// 🏢 PERF (2026-02-19): Imperative context menus — no parent re-render on open
import DrawingContextMenu, { type DrawingContextMenuHandle } from '../../ui/components/DrawingContextMenu';
import EntityContextMenu, { type EntityContextMenuHandle } from '../../ui/components/EntityContextMenu';
import type { ToolType } from '../../ui/toolbar/types';
import { useTouchGestures } from '../../hooks/gestures/useTouchGestures';
import { useResponsiveLayout as useResponsiveLayoutForCanvas } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';

/**
 * Canvas orchestrator — wires 25+ hooks together and delegates rendering to CanvasLayerStack.
 * No business logic, no JSX beyond the single CanvasLayerStack call.
 *
 * ADR-183: Unified Grip System — useGripSystem + useDxfGripInteraction + useLayerCanvasMouseMove
 * replaced by single useUnifiedGripInteraction hook.
 */
export const CanvasSection: React.FC<DXFViewerLayoutProps & { overlayMode: OverlayEditorMode, currentStatus: Status, currentKind: OverlayKind }> = (props) => {
  const {
    activeTool,
    showGrid,
    showLayers,
    overlayMode = 'select',
    setOverlayMode,
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
  const { warning: notifyWarning, success: notifySuccess } = useNotifications();
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

  // === Entity interaction state ===
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  // Prevents handleCanvasClick from deselecting what mouseDown just selected
  const entitySelectedOnMouseDownRef = useRef(false);
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);
  const eventBus = useEventBus();

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

  // === DXF scene (must be before unified grip system) ===
  const { dxfScene } = useDxfSceneConversion({ currentScene: props.currentScene ?? null });

  // === ADR-183: Unified Grip System ===
  const unified = useUnifiedGripInteraction({
    selectedEntityIds,
    dxfScene,
    transform,
    currentOverlays,
    universalSelection,
    overlayStore,
    overlayStoreRef,
    activeTool,
    gripSettings,
    executeCommand,
    movementDetectionThreshold: MOVEMENT_DETECTION.MIN_MOVEMENT,
  });

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

  // === Mouse event handling (STRIPPED — grip logic now in unified hook) ===
  const {
    mouseCss, mouseWorld,
    updateMouseCss, updateMouseWorld,
    handleContainerMouseMove,
    handleContainerMouseEnter, handleContainerMouseLeave,
  } = useCanvasMouse({
    transform, viewport, activeTool,
    updatePosition, setActive, containerRef,
    // ADR-183: Pass unified grip state so container drag preview still works
    hoveredVertexInfo: unified.overlayProjection.hoveredVertexInfo,
    hoveredEdgeInfo: unified.overlayProjection.hoveredEdgeInfo,
    selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips,
    draggingVertices: unified.draggingVertices,
    setDraggingVertices: () => {}, // no-op — unified handles this
    draggingEdgeMidpoint: unified.draggingEdgeMidpoint,
    setDraggingEdgeMidpoint: () => {}, // no-op
    draggingOverlayBody: unified.draggingOverlayBody,
    setDraggingOverlayBody: () => {}, // no-op
    dragPreviewPosition: unified.overlayProjection.dragPreviewPosition,
    setDragPreviewPosition: unified.setDragPreviewPosition,
    gripHoverThrottleRef: unified.gripHoverThrottleRef,
    justFinishedDragRef: unified.justFinishedDragRef,
    markDragFinished: unified.markDragFinished,
    universalSelectionRef, overlayStoreRef,
    executeCommand,
    movementDetectionThreshold: MOVEMENT_DETECTION.MIN_MOVEMENT,
  });

  // ADR-183: Wrapper container handlers — unified hook handles grip mouseDown/mouseUp
  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      const consumed = unified.handleMouseDown(
        mouseWorld ?? { x: 0, y: 0 },
        e.shiftKey,
      );
      if (consumed) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    // Fall through to useCanvasMouse for non-grip behavior (not needed — grip handling is complete)
  }, [unified, mouseWorld]);

  const handleContainerMouseUp = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const worldPos = mouseWorld ?? { x: 0, y: 0 };
    const consumed = await unified.handleMouseUp(worldPos);
    if (consumed) return;
    // No fallback needed — unified handles all grip commits
  }, [unified, mouseWorld]);

  // === Layer visibility: always show when drawing/editing ===
  const showLayerCanvas = showLayerCanvasDebug || overlayMode === 'draw' || overlayMode === 'edit';

  // === Overlay → ColorLayer conversion ===
  const {
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrips, selectedGrip,
    draggingVertex, draggingVertices, draggingEdgeMidpoint,
    dragPreviewPosition, draggingOverlayBody,
  } = unified.overlayProjection;

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

  const { fitToOverlay } = useFitToView({
    dxfScene, colorLayers, zoomSystem, setTransform, containerRef, currentOverlays,
  });

  const { globalRulerSettings, drawingHandlers, drawingHandlersRef, hasUnifiedDrawingPointsRef } = useCanvasEffects({
    activeTool, overlayMode,
    currentScene: props.currentScene ?? null,
    handleSceneChange: props.handleSceneChange,
    onToolChange: props.onToolChange,
    previewCanvasRef,
    selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips,
    setDragPreviewPosition: unified.setDragPreviewPosition,
    universalSelection, dxfScene, dxfCanvasRef, overlayCanvasRef, zoomSystem,
    currentLevelId: levelManager.currentLevelId,
  });

  // 🏢 PERF (2026-02-19): Imperative refs for context menus — open() doesn't re-render canvas
  const drawingMenuRef = useRef<DrawingContextMenuHandle>(null);
  const entityMenuRef = useRef<EntityContextMenuHandle>(null);

  const { handleDrawingContextMenu } = useCanvasContextMenu({
    containerRef, activeTool, overlayMode, hasUnifiedDrawingPointsRef, draftPolygonRef,
    selectedEntityIds, drawingMenuRef, entityMenuRef,
  });

  const { handleDrawingFinish, handleDrawingClose, handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc } = useDrawingUIHandlers({
    overlayMode, draftPolygonRef, finishDrawingWithPolygonRef, drawingHandlersRef, setDraftPolygon,
  });

  const { handleOverlayClick, handleMultiOverlayClick } = useOverlayInteraction({
    activeTool, overlayMode, currentOverlays, universalSelection, overlayStore,
    hoveredEdgeInfo, transformScale: transform.scale,
    fitToOverlay,
    setDraggingOverlayBody: unified.setDraggingOverlayBody,
    setDragPreviewPosition: unified.setDragPreviewPosition,
  });

  const { handleCanvasClick } = useCanvasClickHandler({
    viewportReady, viewport, transform,
    activeTool, overlayMode,
    circleTTT, linePerpendicular, lineParallel,
    dxfGripInteraction: unified.dxfProjection,
    levelManager,
    draftPolygon, setDraftPolygon, isSavingPolygon, setIsSavingPolygon,
    isNearFirstPoint, finishDrawingWithPolygonRef,
    drawingHandlersRef, entitySelectedOnMouseDownRef,
    universalSelection,
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrip,
    selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips,
    justFinishedDragRef: unified.justFinishedDragRef,
    draggingOverlayBody: unified.draggingOverlayBody,
    setSelectedEntityIds,
    currentOverlays, handleOverlayClick,
  });

  const { handleSmartDelete } = useSmartDelete({
    selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips,
    executeCommand,
    overlayStoreRef, universalSelectionRef, levelManager,
    setSelectedEntityIds, eventBus,
  });

  // ADR-186: Entity Join System
  const entityJoinHook = useEntityJoin({
    levelManager,
    executeCommand,
    setSelectedEntityIds,
    onWarning: notifyWarning,
    onSuccess: notifySuccess,
  });

  // ADR-161: Memoized join state (avoid recalculating on every render)
  const entityJoinState = useMemo(() => {
    const canJoin = entityJoinHook.canJoin(selectedEntityIds);
    const preview = canJoin ? entityJoinHook.getJoinPreview(selectedEntityIds) : null;
    return {
      canJoin,
      joinResultLabel: preview?.resultType !== 'not-joinable' ? preview?.resultType : undefined,
    };
  }, [entityJoinHook, selectedEntityIds]);

  // 🏢 FIX (2026-02-19): Callback to exit overlay draw mode on Escape
  // Resets overlayMode from 'draw' → 'select' so drawing doesn't persist
  const handleExitDrawMode = useCallback(() => {
    if (overlayMode === 'draw' && setOverlayMode) {
      setOverlayMode('select');
    }
  }, [overlayMode, setOverlayMode]);

  useCanvasKeyboardShortcuts({
    handleSmartDelete,
    dxfGripInteraction: unified.dxfProjection,
    setDraftPolygon, draftPolygon,
    selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips,
    activeTool, handleDrawingFinish, handleFlipArc, finishDrawing,
    // ADR-161: Entity Join via J key
    selectedEntityIds,
    handleEntityJoin: () => entityJoinHook.joinEntities(selectedEntityIds),
    canEntityJoin: entityJoinState.canJoin,
    onExitDrawMode: handleExitDrawMode,
  });

  // === Render ===
  return (
    <>
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
        gripState={unified.gripStateForStack}
        entityState={{
          selectedEntityIds, setSelectedEntityIds,
          hoveredEntityId, setHoveredEntityId,
          hoveredOverlayId, setHoveredOverlayId,
        }}
        zoomSystem={zoomSystem}
        dxfGripInteraction={unified.dxfProjection}
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
        handleUnifiedMouseMove={unified.handleMouseMove}
        handleDrawingContextMenu={handleDrawingContextMenu}
        drawingState={{
          drawingHandlers,
          draftPolygon,
          handleDrawingFinish, handleDrawingClose,
          handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc,
        }}
        entityJoin={{
          canJoin: entityJoinState.canJoin,
          joinResultLabel: entityJoinState.joinResultLabel,
          onJoin: () => entityJoinHook.joinEntities(selectedEntityIds),
          onDelete: () => handleSmartDelete(),
        }}
        pdf={{
          imageUrl: pdfImageUrl,
          transform: pdfTransform,
          enabled: pdfEnabled,
          opacity: pdfOpacity,
        }}
        onMouseMove={props.onMouseMove}
      />

      {/* 🏢 PERF (2026-02-19): Context menus rendered OUTSIDE CanvasLayerStack.
          Opening the menu triggers re-render ONLY in the menu component itself,
          not the entire canvas stack (~94ms saved per right-click). */}
      <DrawingContextMenu
        ref={drawingMenuRef}
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
      <EntityContextMenu
        ref={entityMenuRef}
        selectedCount={selectedEntityIds.length}
        canJoin={entityJoinState.canJoin}
        joinResultLabel={entityJoinState.joinResultLabel}
        onJoin={() => entityJoinHook.joinEntities(selectedEntityIds)}
        onDelete={() => handleSmartDelete()}
        onCancel={() => entityMenuRef.current?.close()}
      />
    </>
  );
};
