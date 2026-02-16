'use client';
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { CanvasLayerStack } from './CanvasLayerStack';
import { useCanvasContext } from '../../contexts/CanvasContext';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLevels } from '../../systems/levels';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
import { useCursorSettings, useCursorActions } from '../../systems/cursor';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind, Overlay } from '../../overlays/types';
import { MOVEMENT_DETECTION } from '../../config/tolerance-config';
import { useGripStyles } from '../../settings-provider';
import type { Point2D } from '../../rendering/types/Types';
import { useZoom } from '../../systems/zoom';
import { dwarn, derr } from '../../debug';
import { type PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { usePdfBackgroundStore } from '../../pdf-background';
import { useEventBus } from '../../systems/events';
import { useUniversalSelection } from '../../systems/selection';
import {
  useCommandHistory,
  useCommandHistoryKeyboard,
} from '../../core/commands';
import { useCanvasSettings, useCanvasMouse, useViewportManager, useDxfSceneConversion, useCanvasContextMenu, useSmartDelete, useDrawingUIHandlers, useCanvasClickHandler, useLayerCanvasMouseMove, useFitToView, usePolygonCompletion, useCanvasKeyboardShortcuts, useCanvasEffects, useOverlayInteraction } from '../../hooks/canvas';
import { useOverlayLayers } from '../../hooks/layers';
import { useSpecialTools } from '../../hooks/tools';
import { useGripSystem } from '../../hooks/grips';
import { useDxfGripInteraction } from '../../hooks/useDxfGripInteraction';
import { usePinchZoom } from '../../hooks/gestures/usePinchZoom';
import { useTouchPan } from '../../hooks/gestures/useTouchPan';
import { useResponsiveLayout as useResponsiveLayoutForCanvas } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';

/**
 * Renders the main canvas area, including the renderer and floating panels.
 */
export const CanvasSection: React.FC<DXFViewerLayoutProps & { overlayMode: OverlayEditorMode, currentStatus: Status, currentKind: OverlayKind }> = (props) => {
  // 🏢 ENTERPRISE (2026-01-25): Destructure props FIRST to avoid "Cannot access before initialization" errors
  // ΚΡΙΣΙΜΟ: Αυτά τα props χρησιμοποιούνται σε useCallback hooks παρακάτω
  const {
    activeTool,
    showGrid,
    showLayers, // ✅ ΥΠΑΡΧΟΝ SYSTEM: Layer visibility απο useDxfViewerState
    overlayMode = 'select',
    currentStatus = 'for-sale',
    currentKind = 'unit',
    ...restProps
  } = props;

  // 🏢 ENTERPRISE FIX (2026-01-27): Use dxfRef from CanvasContext for centralized zoom operations
  // ARCHITECTURE: CanvasProvider MUST wrap CanvasSection (see DxfViewerApp.tsx:81, DxfViewerContent.tsx:907)
  // This enables useCanvasOperations hook to access the actual DxfCanvas imperative API
  // CRITICAL: The context's dxfRef must be connected to DxfCanvas for zoom buttons to work
  const canvasContext = useCanvasContext();

  // 🏢 ENTERPRISE: Ensure CanvasProvider is in the component tree (ADR-043)
  // Development warning for architectural violations
  if (process.env.NODE_ENV === 'development' && !canvasContext) {
    dwarn('CanvasSection', '⚠️ ARCHITECTURE WARNING: CanvasProvider not found. Zoom buttons and centralized canvas operations may not work correctly.');
  }

  // 🏢 ENTERPRISE (2026-01-27): ALWAYS use context ref - NO fallback!
  // ADR: Imperative API = Source of Truth
  // The ref MUST be stable across renders to maintain the imperative handle
  const dxfCanvasRef = canvasContext?.dxfRef;

  if (!dxfCanvasRef) {
    derr('CanvasSection', '🚨 CRITICAL: CanvasContext.dxfRef is null! Zoom buttons will not work!');
  }
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  // 🏢 ADR-040: PreviewCanvas ref for direct preview rendering (bypasses React state)
  const previewCanvasRef = useRef<PreviewCanvasHandle>(null);

  // 🏢 ENTERPRISE (2026-01-27): Context transform is TELEMETRY ONLY
  // ADR: Imperative API controls zoom, context tracks last known state
  // DxfCanvas receives transform prop but imperative methods are the primary control
  const defaultTransform = useMemo(() => ({ scale: 1, offsetX: 0, offsetY: 0 }), []);
  const transform = canvasContext?.transform || defaultTransform;
  const contextSetTransform = canvasContext?.setTransform || (() => {
    derr('CanvasSection', 'setTransform called but CanvasContext not available');
  });

  // 🏢 ENTERPRISE (2026-02-16): Viewport management extracted to useViewportManager hook
  // Owns: viewport state, viewportRef, transformRef, ResizeObserver, RAF initial measure
  // See: hooks/canvas/useViewportManager.ts
  const containerRef = useRef<HTMLDivElement>(null);
  // 🏢 PDF BACKGROUND: Get PDF background state and setViewport action
  // NOTE: Moved up from original position so setPdfViewport is available for onViewportChange
  const {
    enabled: pdfEnabled,
    opacity: pdfOpacity,
    transform: pdfTransform,
    renderedImageUrl: pdfImageUrl,
    setViewport: setPdfViewport,
  } = usePdfBackgroundStore();

  const { viewport, viewportRef, viewportReady, setTransform, transformRef } = useViewportManager({
    containerRef,
    transform,
    setTransform: contextSetTransform,
    onViewportChange: setPdfViewport,
  });

  // 🏢 ENTERPRISE (2026-01-30): Get canvas element for viewport snapshot
  // Returns the canvas HTMLElement for use with getViewportSnapshotFromElement()
  // CRITICAL: This is used for coordinate transforms - NO HARDCODED FALLBACKS
  const getCanvasElement = useCallback((): HTMLElement | null => {
    const dxfCanvas = dxfCanvasRef?.current?.getCanvas?.();
    if (dxfCanvas instanceof HTMLElement) return dxfCanvas;
    if (overlayCanvasRef.current instanceof HTMLElement) return overlayCanvasRef.current;
    if (containerRef.current instanceof HTMLElement) return containerRef.current;
    return null;
  }, []);

  const zoomSystem = useZoom({
    initialTransform: transform, // 🏢 ENTERPRISE: Use context transform as initial value
    onTransformChange: (newTransform) => {
      setTransform(newTransform);
    },
    // 🏢 ENTERPRISE: Inject viewport για accurate zoom-to-cursor
    viewport
  });
  // 🎯 Canvas visibility από parent props (με fallback στα defaults)
  const showDxfCanvas = props.dxfCanvasVisible ?? true;
  const showLayerCanvasDebug = props.layerCanvasVisible ?? true;

  // 🏢 ENTERPRISE (2026-01-27): Only log ERRORS for critical state issues
  if (!showDxfCanvas) {
    derr('CanvasSection', '🚨 CRITICAL: DxfCanvas is HIDDEN! showDxfCanvas =', showDxfCanvas, '- Zoom buttons will NOT work!');
  }


  const overlayStore = useOverlayStore();
  // 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
  // Single source of truth for ALL entity selections
  const universalSelection = useUniversalSelection();
  // 🏢 ENTERPRISE (2026-01-26): Command History for Undo/Redo - ADR-032
  const { execute: executeCommand } = useCommandHistory();
  // 🏢 ENTERPRISE (2026-01-26): Enable Ctrl+Z/Ctrl+Y keyboard shortcuts for undo/redo
  useCommandHistoryKeyboard();
  // 🏢 ENTERPRISE (2026-01-25): Refs for stores to avoid stale closures in callbacks
  // These refs are CRITICAL - they ensure callbacks always have access to the latest store state
  const overlayStoreRef = useRef(overlayStore);
  const universalSelectionRef = useRef(universalSelection);

  // 🏢 ENTERPRISE (2026-01-25): Keep refs in sync with current store values
  // This is CRITICAL for updateVertex/addVertex to work with the latest polygon data
  overlayStoreRef.current = overlayStore;
  universalSelectionRef.current = universalSelection;
  const levelManager = useLevels();

  // 🏢 ENTERPRISE (2026-01-25): Moved BEFORE callbacks that use them to avoid hoisting issues
  const currentOverlays = levelManager.currentLevelId
    ? overlayStore.getByLevel(levelManager.currentLevelId)
    : [];
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
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  // 🏢 ENTERPRISE (2026-02-14): AutoCAD-style hover highlighting
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  // 🏢 ENTERPRISE (2026-02-15): SSoT entity selection — track if mouseDown selected an entity
  // Prevents handleCanvasClick from deselecting what was just selected
  const entitySelectedOnMouseDownRef = useRef(false);
  // 🏢 ENTERPRISE (2026-02-15): Overlay hover highlighting (unified pipeline)
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);
  // 🎯 EVENT BUS: For polygon drawing communication with toolbar
  const eventBus = useEventBus();

  // 🏢 ENTERPRISE (2026-02-16): Polygon draft state + completion logic extracted to usePolygonCompletion hook
  // Owns: draftPolygon, draftPolygonRef, finishDrawingWithPolygonRef, isSavingPolygon, finishDrawing
  const {
    draftPolygon, setDraftPolygon, draftPolygonRef,
    isSavingPolygon, setIsSavingPolygon,
    finishDrawingWithPolygonRef, finishDrawing,
  } = usePolygonCompletion({
    levelManager, overlayStore, eventBus,
    currentStatus, currentKind, activeTool, overlayMode,
  });

  const {
    circleTTT,
    linePerpendicular,
    lineParallel,
  } = useSpecialTools({
    activeTool,
    levelManager,
  });

  const { currentSnapResult } = useSnapContext();

  // Get rulers and grid settings from RulersGridSystem
  const {
    state: { grid: gridContextSettings, rulers: rulerContextSettings }
  } = useRulersGridContext();

  // Get cursor settings from CursorSystem
  const { settings: cursorSettings } = useCursorSettings();

  // 🏢 ENTERPRISE (2026-01-31): Centralized canvas settings construction - ADR-XXX
  // Extracts settings conversion from component to dedicated hook (SRP)
  const {
    crosshairSettings,
    cursorCanvasSettings,
    snapSettings,
    rulerSettings,
    gridSettings,
    selectionSettings,
    gridMajorInterval,
  } = useCanvasSettings({
    cursorSettings,
    gridContextSettings: gridContextSettings ?? null,
    rulerContextSettings: rulerContextSettings ?? null,
    showGrid,
  });

  // 🏢 ENTERPRISE (2026-01-25): Centralized Grip Settings (SINGLE SOURCE OF TRUTH)
  // Pattern: SAP/Autodesk - Provider-based settings for consistent grip appearance
  const gripSettings = useGripStyles();

  /**
   * 🏢 ENTERPRISE: Container-level mouse tracking for CursorSystem
   * Pattern: Autodesk/Adobe - Global cursor position tracking
   *
   * This ensures CursorSystem position is ALWAYS updated, regardless of
   * which child canvas is active or whether DxfCanvas/LayerCanvas are mounted.
   */
  const { updatePosition, setActive } = useCursorActions();

  // ADR-176: Touch gesture hooks for mobile pinch-zoom and pan
  const { layoutMode: canvasLayoutMode } = useResponsiveLayoutForCanvas();
  const isMobileOrTablet = canvasLayoutMode !== 'desktop';

  usePinchZoom({
    targetRef: containerRef,
    enabled: isMobileOrTablet,
    onZoom: useCallback((delta: number, center: { x: number; y: number }) => {
      // Synthetic zoom: scale transform around center point
      const newScale = transform.scale * delta;
      const clampedScale = Math.max(0.01, Math.min(newScale, 1000));
      contextSetTransform({
        scale: clampedScale,
        offsetX: center.x - (center.x - transform.offsetX) * (clampedScale / transform.scale),
        offsetY: center.y - (center.y - transform.offsetY) * (clampedScale / transform.scale),
      });
    }, [transform, contextSetTransform]),
  });

  useTouchPan({
    targetRef: containerRef,
    enabled: isMobileOrTablet,
    activeTool,
    onPan: useCallback((deltaX: number, deltaY: number) => {
      contextSetTransform({
        scale: transform.scale,
        offsetX: transform.offsetX + deltaX,
        offsetY: transform.offsetY + deltaY,
      });
    }, [transform, contextSetTransform]),
  });

  // 🏢 ENTERPRISE (2026-01-31): Mouse event handling moved to useCanvasMouse hook - ADR-XXX
  // Previous ~290 lines of handler definitions now handled by centralized hook
  // This hook CONSUMES refs from useGripSystem (no duplicates)
  const {
    mouseCss,                      // 🏢 ENTERPRISE: Now from hook (was local state)
    mouseWorld,                    // 🏢 ENTERPRISE: Now from hook (was local state)
    updateMouseCss,
    updateMouseWorld,
    handleContainerMouseMove,
    handleContainerMouseDown,
    handleContainerMouseUp,
    handleContainerMouseEnter,
    handleContainerMouseLeave,
  } = useCanvasMouse({
    transform,
    viewport,
    activeTool,
    updatePosition,
    setActive,
    containerRef,
    // Grip state from useGripSystem
    hoveredVertexInfo,
    hoveredEdgeInfo,
    selectedGrips,
    setSelectedGrips,
    draggingVertices,
    setDraggingVertices,
    draggingEdgeMidpoint,
    setDraggingEdgeMidpoint,
    draggingOverlayBody,
    setDraggingOverlayBody,
    dragPreviewPosition,
    setDragPreviewPosition,
    // Refs INJECTED from useGripSystem (CANONICAL - Single Source of Truth)
    gripHoverThrottleRef,
    justFinishedDragRef,
    markDragFinished,
    // Store refs
    universalSelectionRef,
    overlayStoreRef,
    // Command execution
    executeCommand,
    // 🏢 ADR-079: Movement detection threshold from centralized config
    movementDetectionThreshold: MOVEMENT_DETECTION.MIN_MOVEMENT,
  });

  // ✅ LAYER VISIBILITY: Show LayerCanvas controlled by debug toggle
  // 🔧 FIX (2026-01-24): ALWAYS show LayerCanvas when in draw/edit mode to ensure overlays are visible
  // Debug toggle only applies when in 'select' mode (not actively drawing/editing)
  const showLayerCanvas = showLayerCanvasDebug || overlayMode === 'draw' || overlayMode === 'edit';

  const {
    colorLayers,
    colorLayersWithDraft,
    isNearFirstPoint,
  } = useOverlayLayers({
    overlays: currentOverlays,
    isSelected: universalSelection.isSelected,
    hoveredVertexInfo,
    hoveredEdgeInfo,
    selectedGrips,
    draggingVertex,
    draggingVertices,
    draggingEdgeMidpoint,
    dragPreviewPosition,
    draftPolygon,
    mouseWorld,
    transformScale: transform.scale,
    currentStatus,
    hoveredOverlayId,
    overlayMode,
  });

  // 🏢 ENTERPRISE (2026-02-16): Scene→DxfScene conversion extracted to useDxfSceneConversion hook
  // Converts SceneModel entities to DxfEntityUnion for Canvas V2 rendering
  const { dxfScene } = useDxfSceneConversion({ currentScene: props.currentScene ?? null });

  // 🏢 ENTERPRISE (2026-02-15): AutoCAD-style grip interaction for DXF entities
  // Manages state machine: idle → hovering → warm → following → commit/cancel
  const dxfGripInteraction = useDxfGripInteraction({
    selectedEntityIds,
    dxfScene,
    transform,
    enabled: activeTool === 'select',
  });

  // 🏢 ENTERPRISE (2026-02-16): LayerCanvas mouse move handler extracted to useLayerCanvasMouseMove hook
  // Grip hover detection, throttled position updates, drag preview, parent callback delegation
  const { handleLayerCanvasMouseMove } = useLayerCanvasMouseMove({
    activeTool,
    transform,
    updateMouseCss,
    updateMouseWorld,
    hoveredVertexInfo, setHoveredVertexInfo,
    hoveredEdgeInfo, setHoveredEdgeInfo,
    draggingVertex, draggingEdgeMidpoint, draggingOverlayBody,
    setDragPreviewPosition,
    gripHoverThrottleRef,
    universalSelection,
    currentOverlays,
    gripSettings,
    onParentMouseMove: props.onMouseMove,
  });

  // 🏢 ENTERPRISE (2026-02-16): Fit-to-view + fit-to-overlay extracted to useFitToView hook
  const { fitToOverlay } = useFitToView({
    dxfScene, colorLayers, zoomSystem, setTransform, containerRef, currentOverlays,
  });

  // 🏢 ENTERPRISE (2026-02-16): Canvas effects + drawing system — extraction #11
  // globalRulerSettings, drawingHandlers, drawingHandlersRef, hasUnifiedDrawingPointsRef
  const { globalRulerSettings, drawingHandlers, drawingHandlersRef, hasUnifiedDrawingPointsRef } = useCanvasEffects({
    activeTool,
    overlayMode,
    currentScene: props.currentScene ?? null,
    handleSceneChange: props.handleSceneChange,
    onToolChange: props.onToolChange,
    previewCanvasRef,
    selectedGrips,
    setSelectedGrips,
    setDragPreviewPosition,
    universalSelection,
    dxfScene,
    dxfCanvasRef,
    overlayCanvasRef,
    zoomSystem,
  });

  const { drawingContextMenu, handleDrawingContextMenu, handleDrawingContextMenuClose } = useCanvasContextMenu({
    containerRef,
    activeTool,
    overlayMode,
    hasUnifiedDrawingPointsRef,
    draftPolygonRef,
  });

  // 🏢 ENTERPRISE (2026-02-16): Drawing UI handlers extracted to useDrawingUIHandlers hook
  const {
    handleDrawingFinish,
    handleDrawingClose,
    handleDrawingCancel,
    handleDrawingUndoLastPoint,
    handleFlipArc,
  } = useDrawingUIHandlers({
    overlayMode,
    draftPolygonRef,
    finishDrawingWithPolygonRef,
    drawingHandlersRef,
    setDraftPolygon,
  });

  // 🏢 ENTERPRISE (2026-02-16): Overlay interaction handlers — extraction #12
  const { handleOverlayClick, handleMultiOverlayClick } = useOverlayInteraction({
    activeTool,
    overlayMode,
    currentOverlays,
    universalSelection,
    overlayStore,
    hoveredEdgeInfo,
    transformScale: transform.scale,
    fitToOverlay,
    setDraggingOverlayBody,
    setDragPreviewPosition,
  });

  // 🏢 ENTERPRISE (2026-02-16): Canvas click handler extracted to useCanvasClickHandler hook
  // Priority-based routing: grips → special tools → overlay drawing → unified drawing → move → deselect
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
    selectedGrips,
    setSelectedGrips,
    executeCommand,
    overlayStoreRef,
    universalSelectionRef,
    levelManager,
    setSelectedEntityIds,
    eventBus,
  });

  // 🏢 ENTERPRISE (2026-02-16): Keyboard shortcuts extracted to useCanvasKeyboardShortcuts hook
  // Delete/Backspace, Escape, Enter, X (flip arc) — all handled by the hook
  useCanvasKeyboardShortcuts({
    handleSmartDelete, dxfGripInteraction,
    setDraftPolygon, draftPolygon,
    selectedGrips, setSelectedGrips,
    activeTool, handleDrawingFinish, handleFlipArc, finishDrawing,
  });

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
        draggingVertex,
        draggingEdgeMidpoint,
        hoveredVertexInfo,
        hoveredEdgeInfo,
        draggingOverlayBody,
        dragPreviewPosition,
      }}
      entityState={{
        selectedEntityIds,
        setSelectedEntityIds,
        hoveredEntityId,
        setHoveredEntityId,
        hoveredOverlayId,
        setHoveredOverlayId,
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
        handleDrawingFinish,
        handleDrawingClose,
        handleDrawingCancel,
        handleDrawingUndoLastPoint,
        handleFlipArc,
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
