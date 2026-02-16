'use client';
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
// === CANVAS V2 IMPORTS ===
import { DxfCanvas, LayerCanvas } from '../../canvas-v2';
import { createCombinedBounds } from '../../systems/zoom/utils/bounds';
// ✅ CURSOR SETTINGS: Import από κεντρικό system αντί για duplicate
import { useCanvasContext } from '../../contexts/CanvasContext';
// useDrawingHandlers → moved to useCanvasEffects hook
import { UI_COLORS, PREVIEW_DEFAULTS } from '../../config/color-config';
// ADR-130, ADR-142: getLayerNameOrDefault, TEXT_SIZE_LIMITS — moved to useDxfSceneConversion hook
// CanvasProvider removed - not needed for Canvas V2
// OverlayCanvas import removed - it was dead code
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLevels } from '../../systems/levels';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
// 🏢 ADR-127: Centralized Ruler Dimensions
import { RULERS_GRID_CONFIG } from '../../systems/rulers-grid/config';
import { useCursorSettings, useCursorActions } from '../../systems/cursor';
// globalRulerStore → moved to useCanvasEffects hook
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind, Overlay } from '../../overlays/types';
import { createOverlayHandlers } from '../../overlays/types';
import { squaredDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// pointToLineDistance — moved to useCanvasClickHandler hook
// 🏢 ADR-079: Centralized Movement Detection Constants
// 🏢 ADR-099: Centralized Polygon Tolerances
// 🏢 ADR-147: Centralized Hit Tolerance for Entity Picking
import { MOVEMENT_DETECTION, POLYGON_TOLERANCES } from '../../config/tolerance-config';
// 🏢 ENTERPRISE (2026-01-25): Edge detection for polygon vertex insertion
import { findOverlayEdgeForGrip } from '../../utils/entity-conversion';
// isPointInPolygon — moved to useCanvasClickHandler hook
// 🏢 ENTERPRISE (2026-01-25): Centralized Grip Settings via Provider (CANONICAL - SINGLE SOURCE OF TRUTH)
import { useGripStyles } from '../../settings-provider';
// 🏢 ENTERPRISE (2026-01-26): ADR-036 - Centralized tool detection (Single Source of Truth)
import { isInDrawingMode } from '../../systems/tools/ToolStateManager';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ADR-102: Centralized Entity Type Guards
// isLineEntity, isPolylineEntity, Entity — moved to useCanvasClickHandler hook
import { useZoom } from '../../systems/zoom';
import {
  CoordinateTransforms,
  COORDINATE_LAYOUT,
} from '../../rendering/core/CoordinateTransforms';
// serviceRegistry → moved to useCanvasEffects hook (DXF auto-fit)
// 🏢 ENTERPRISE (2026-01-30): canvasBoundsService — moved to useViewportManager hook
import { dlog, dwarn, derr } from '../../debug';
// ✅ ADR-006 FIX: Import CrosshairOverlay για crosshair rendering
import CrosshairOverlay from '../../canvas-v2/overlays/CrosshairOverlay';
// 🏢 ADR-040: PreviewCanvas for direct preview rendering (performance optimization)
import { PreviewCanvas, type PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
// ✅ ADR-009: Import RulerCornerBox for interactive corner box (AutoCAD/Revit standard)
import RulerCornerBox from '../../canvas-v2/overlays/RulerCornerBox';
// 🏢 ADR-047: DrawingContextMenu for right-click context menu during drawing (AutoCAD pattern)
import DrawingContextMenu from '../../ui/components/DrawingContextMenu';
// 🎯 SNAP INDICATOR: Import for visual snap feedback
import SnapIndicatorOverlay from '../../canvas-v2/overlays/SnapIndicatorOverlay';
import { useSnapContext } from '../../snapping/context/SnapContext';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';
// 🏢 ENTERPRISE: Centralized spacing tokens (ADR-013)
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 PDF BACKGROUND: Enterprise PDF background system
import { PdfBackgroundCanvas, usePdfBackgroundStore } from '../../pdf-background';
// 🎯 EVENT BUS: For polygon drawing communication with toolbar
import { useEventBus } from '../../systems/events';
// 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
import { useUniversalSelection } from '../../systems/selection';
// 🏢 ENTERPRISE (2026-01-31): Circle TTT and Line tools now managed by useSpecialTools hook
// Previous imports: useCircleTTT, useLinePerpendicular, useLineParallel
// Now handled by hooks/tools/useSpecialTools.ts
// 🏢 ENTERPRISE (2026-01-26): Command History for Undo/Redo - ADR-032
import {
  useCommandHistory,
  useCommandHistoryKeyboard,
} from '../../core/commands';
// Delete*Command + LevelSceneManagerAdapter — moved to useSmartDelete hook
// 🏢 ADR-101: Centralized deep clone utility
import { deepClone } from '../../utils/clone-utils';
// 🏢 ENTERPRISE (2026-01-31): Centralized canvas settings construction - ADR-XXX
// 🏢 ENTERPRISE (2026-01-31): Centralized mouse event handling - ADR-XXX
import { useCanvasSettings, useCanvasMouse, useViewportManager, useDxfSceneConversion, useCanvasContextMenu, useSmartDelete, useDrawingUIHandlers, useCanvasClickHandler, useLayerCanvasMouseMove, useFitToView, usePolygonCompletion, useCanvasKeyboardShortcuts, useCanvasEffects } from '../../hooks/canvas';
// 🏢 ENTERPRISE (2026-01-31): Centralized overlay to ColorLayer conversion - ADR-XXX
import { useOverlayLayers } from '../../hooks/layers';
// 🏢 ENTERPRISE (2026-01-31): Centralized special tools management - ADR-XXX
import { useSpecialTools } from '../../hooks/tools';
// 🏢 ENTERPRISE (2026-01-31): Centralized grip system state management - ADR-XXX
import { useGripSystem } from '../../hooks/grips';
// 🏢 ADR-119: UnifiedFrameScheduler — moved to useViewportManager hook
// 🏢 ENTERPRISE (2026-02-15): AutoCAD-style grip interaction for DXF entities
import { useDxfGripInteraction } from '../../hooks/useDxfGripInteraction';
// ADR-176: Touch gestures + responsive layout
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
  // 🏢 ENTERPRISE (2026-01-31): Mouse position state moved to useCanvasMouse hook
  // mouseCss, mouseWorld, lastMouseCssRef, lastMouseWorldRef, updateMouseCss, updateMouseWorld
  // are now provided by the hook (see line ~520)

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
  // 🏢 FIX (2026-02-01): transformRef sync now handled by useViewportManager hook
  const levelManager = useLevels();

  // 🏢 ENTERPRISE (2026-01-25): Moved BEFORE callbacks that use them to avoid hoisting issues
  const currentOverlays = levelManager.currentLevelId
    ? overlayStore.getByLevel(levelManager.currentLevelId)
    : [];
  // 🏢 ENTERPRISE (2026-01-25): Multi-selection - getSelectedOverlay() replaced by isSelected() and getSelectedOverlays()
  // const selectedOverlay = overlayStore.getSelectedOverlay(); // DEPRECATED - use overlayStore.isSelected(id) instead

  // 🏢 ENTERPRISE (2026-02-16): draftPolygon, draftPolygonRef, finishDrawingWithPolygonRef → usePolygonCompletion hook
  // 🏢 ADR-047: Drawing context menu — moved to useCanvasContextMenu hook (see line ~590)
  // 🏢 ENTERPRISE (2026-01-31): Grip system state management moved to useGripSystem hook
  // Previous ~65 lines of grip state definitions now handled by centralized hook
  // Includes: hover states, selection states, drag states, throttle refs
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
  // 🏢 ENTERPRISE (2026-02-16): isSavingPolygon state → usePolygonCompletion hook
  // 🏢 ENTERPRISE (2026-02-13): Selected drawn entity IDs for DxfCanvas highlight rendering
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

  // 🏢 ENTERPRISE (2026-01-31): Special tools management moved to useSpecialTools hook
  // Previous ~100 lines of tool initialization and activation logic now handled by centralized hook
  const {
    circleTTT,
    linePerpendicular,
    lineParallel,
  } = useSpecialTools({
    activeTool,
    levelManager,
  });

  // 🏢 ENTERPRISE (2026-02-16): Ref sync + EventBus polygon update → usePolygonCompletion hook

  // 🏢 ENTERPRISE: Provide zoom system to context
  // NOTE: canvasContext already retrieved at line 93 for centralized zoom operations
  // 🎯 SNAP INDICATOR: Get current snap result for visual feedback
  const { currentSnapResult } = useSnapContext();
  // 🏢 PDF BACKGROUND: usePdfBackgroundStore moved up (before useViewportManager) for onViewportChange
  // pdfEnabled, pdfOpacity, pdfTransform, pdfImageUrl, setPdfViewport are now available from line ~168
  // 🏢 ENTERPRISE (2026-02-16): ResizeObserver + RAF viewport measurement → useViewportManager hook

  // ✅ AUTO FIT TO VIEW: Trigger existing fit-to-view event after canvas mount
  // ⚠️ DISABLED: Αφαιρέθηκε γιατί προκαλούσε issues με origin marker visibility
  // Ο χρήστης μπορεί να πατήσει manual "Ευθυγράμμιση" όταν χρειάζεται
  /*
  const hasTriggeredAutoFit = React.useRef(false);
  React.useEffect(() => {
    // Only trigger ONCE after viewport is ready
    if (!hasTriggeredAutoFit.current && viewport.width > 0 && viewport.height > 0) {
      const timer = setTimeout(() => {
        // Auto fit to view dispatched
        // ✅ ZERO DUPLICATES: Χρησιμοποιώ το ΥΠΑΡΧΟΝ event system
        document.dispatchEvent(new CustomEvent('canvas-fit-to-view', {
          detail: { viewport }
        }));
        hasTriggeredAutoFit.current = true; // Mark as triggered
      }, 200); // Small delay to ensure all canvas setup is complete

      return () => clearTimeout(timer);
    }
  }, [viewport.width, viewport.height]); // ✅ FIX: Only depend on viewport, not colorLayers
  */

  // Get rulers and grid settings from RulersGridSystem
  const {
    state: { grid: gridContextSettings, rulers: rulerContextSettings }
  } = useRulersGridContext();

  // 🏢 ENTERPRISE (2026-02-16): globalRulerSettings → useCanvasEffects hook

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
  // containerRef — moved to useViewportManager section (line ~166)

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

  // 🏢 ENTERPRISE (2026-01-31): Settings construction moved to useCanvasSettings hook
  // Previous ~150 lines of settings construction now handled by the hook above (line 608-622)

  // ✅ LAYER VISIBILITY: Show LayerCanvas controlled by debug toggle
  // 🔧 FIX (2026-01-24): ALWAYS show LayerCanvas when in draw/edit mode to ensure overlays are visible
  // Debug toggle only applies when in 'select' mode (not actively drawing/editing)
  const showLayerCanvas = showLayerCanvasDebug || overlayMode === 'draw' || overlayMode === 'edit';

  // 🏢 ENTERPRISE (2026-02-16): Clear draft polygon on tool change → usePolygonCompletion hook

  // 🏢 ENTERPRISE (2026-02-16): Preview canvas cleanup → useCanvasEffects hook

  // 🏢 ENTERPRISE (2026-02-16): Grip validation → useCanvasEffects hook

  // 🏢 ENTERPRISE (2026-01-31): Grid/Selection settings construction moved to useCanvasSettings hook
  // Previous ~60 lines of settings construction now handled by the hook above (line 608-622)

  // 🏢 ENTERPRISE (2026-01-31): Overlay to ColorLayer conversion moved to useOverlayLayers hook
  // Previous ~140 lines of conversion logic now handled by centralized hook
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

  // Use shared overlay handlers to eliminate duplicate code
  // 🏢 ENTERPRISE (2026-01-25): Bridge to universal selection system - ADR-030
  const { handleOverlaySelect, handleOverlayEdit, handleOverlayDelete, handleOverlayUpdate } =
    createOverlayHandlers({
      setSelectedOverlay: (id: string | null) => {
        // 🏢 ENTERPRISE (2026-01-25): Route through universal selection system - ADR-030
        if (id) {
          universalSelection.select(id, 'overlay');
        } else {
          universalSelection.clearByType('overlay');
        }
      },
      remove: overlayStore.remove,
      update: overlayStore.update,
      getSelectedOverlay: overlayStore.getSelectedOverlay,
      overlays: overlayStore.overlays
    }, undefined);  // ✅ CanvasSection δεν έχει levelSwitcher, άρα περνάω undefined

  // 🏢 ENTERPRISE (2026-02-16): fitToOverlay → useFitToView hook


  // 🏢 ENTERPRISE (2026-01-25): Edge midpoint click handler for vertex insertion
  const handleEdgeMidpointClick = async (overlayId: string, edgeIndex: number, insertPoint: Point2D) => {
    const overlay = currentOverlays.find(o => o.id === overlayId);
    if (!overlay) return;

    // Convert Point2D to [number, number] for overlay store
    const vertex: [number, number] = [insertPoint.x, insertPoint.y];
    const insertIndex = edgeIndex + 1; // Insert after the edge start vertex

    try {
      await overlayStore.addVertex(overlayId, insertIndex, vertex);
    } catch (error) {
      derr('CanvasSection', 'Failed to add vertex:', error);
    }
  };

  // Drawing logic
  const handleOverlayClick = (overlayId: string, point: Point2D) => {
    // console.log('🔍 handleOverlayClick called:', { overlayId, point, overlayMode, activeTool });

    // 🏢 ENTERPRISE (2026-01-25): Check for edge midpoint click first (vertex insertion)
    if ((activeTool === 'select' || activeTool === 'layering') && hoveredEdgeInfo?.overlayId === overlayId) {
      const overlay = currentOverlays.find(o => o.id === overlayId);
      if (overlay?.polygon) {
        // 🏢 ADR-099: Using centralized POLYGON_TOLERANCES.EDGE_DETECTION
        const edgeTolerance = POLYGON_TOLERANCES.EDGE_DETECTION / transform.scale;
        const edgeInfo = findOverlayEdgeForGrip(point, overlay.polygon, edgeTolerance);

        if (edgeInfo && edgeInfo.edgeIndex === hoveredEdgeInfo.edgeIndex) {
          // Click was on the hovered edge midpoint - add vertex
          handleEdgeMidpointClick(overlayId, edgeInfo.edgeIndex, edgeInfo.insertPoint);
          return; // Don't proceed with selection
        }
      }
    }

    // 🚀 PROFESSIONAL CAD: Αυτόματη επιλογή layers όταν select/layering/move tool είναι ενεργό
    // 🏢 ENTERPRISE (2026-01-25): Προσθήκη 'select' tool για επιλογή layers με grips
    // 🏢 ENTERPRISE (2027-01-27): Προσθήκη 'move' tool για overlay drag - Unified Toolbar Integration
    if (activeTool === 'select' || activeTool === 'layering' || activeTool === 'move' || overlayMode === 'select') {
      // console.log('🔍 Selecting overlay:', overlayId);
      handleOverlaySelect(overlayId);

      // 🏢 ENTERPRISE (2027-01-27): Start overlay body drag if move tool is active - Unified Toolbar Integration
      if (activeTool === 'move') {
        const overlay = currentOverlays.find(o => o.id === overlayId);
        if (overlay?.polygon) {
          // Start dragging the entire overlay body
          setDraggingOverlayBody({
            overlayId,
            startPoint: point,
            startPolygon: deepClone(overlay.polygon) // Deep copy for undo
          });
          setDragPreviewPosition(point);
        }
      }

      // 🔧 AUTO FIT TO VIEW - Zoom to selected overlay (only for layering tool)
      if (activeTool === 'layering') {
        setTimeout(() => {
          fitToOverlay(overlayId);
        }, 100); // Small delay to ensure selection state updates
      }
    }
  };

  // 🏢 ENTERPRISE (2026-01-25): Multi-selection handler for marquee selection
  const handleMultiOverlayClick = useCallback((layerIds: string[]) => {
    if (activeTool === 'select' || activeTool === 'layering' || overlayMode === 'select') {
      // 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030
      universalSelection.selectMultiple(layerIds.map(id => ({ id, type: 'overlay' as const })));
    }
  }, [activeTool, overlayMode, overlayStore]);

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

  // 🏢 ENTERPRISE (2026-02-16): finishDrawingWithPolygon + finishDrawing → usePolygonCompletion hook

  // 🏢 ENTERPRISE (2026-02-16): Save/cancel polygon EventBus listeners → usePolygonCompletion hook

  // 🏢 ENTERPRISE (2026-02-16): Fit-to-view EventBus listener → useFitToView hook

  // 🏢 ENTERPRISE (2026-02-16): Smart delete extracted to useSmartDelete hook
  // Handles Delete/Backspace with priority: grips → overlays → DXF entities
  // Also listens for toolbar:delete events from EventBus
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

  // 🏢 ADR-053: Native contextmenu listener — moved to useCanvasContextMenu hook

  // ❌ REMOVED: Duplicate zoom handlers - now using centralized zoomSystem.handleKeyboardZoom()
  // All keyboard zoom is handled through the unified system in the keyboard event handler above

  return (
    <>
      {/* Left Sidebar - REMOVED - FloatingPanelContainer handles this */}

      {/* Main Canvas Area */}
      {/* ╔════════════════════════════════════════════════════════════════════════╗
          ║ ⚠️ CRITICAL FIX (2026-01-03) - Canvas container backgrounds           ║
          ║ ΜΗΝ ΠΡΟΣΘΕΤΕΤΕ bg-muted ή PANEL_COLORS.BG_SECONDARY εδώ!              ║
          ║ Αυτά δημιουργούν "πέπλο" που καλύπτει τα χρώματα DXF οντοτήτων.       ║
          ║ Το transparent background επιτρέπει σωστή απεικόνιση canvas.          ║
          ╚════════════════════════════════════════════════════════════════════════╝ */}
      <div className="flex-1 relative">
        {/* DEBUG BUTTONS MOVED TO HEADER */}

        <div
          ref={containerRef}
          className={`canvas-stack relative w-full h-full cursor-none bg-[var(--canvas-background-dxf)] ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`} // ADR-008 CAD-GRADE: cursor-none hides CSS cursor + 🔧 FIX (2026-02-13): Canvas background moved HERE (container) so LayerCanvas overlays are visible through transparent DxfCanvas
          onMouseMove={handleContainerMouseMove}
          onMouseDown={handleContainerMouseDown}
          onMouseUp={handleContainerMouseUp}
          onMouseEnter={handleContainerMouseEnter}
          onMouseLeave={handleContainerMouseLeave}
          onContextMenu={handleDrawingContextMenu} // 🏢 ADR-047: Right-click context menu during drawing
        >
          {/* 🏢 PDF BACKGROUND: Lowest layer in canvas stack (z-[-10]) */}
          <PdfBackgroundCanvas
            imageUrl={pdfImageUrl}
            pdfTransform={pdfTransform}
            canvasTransform={transform}
            viewport={viewport}
            enabled={pdfEnabled}
            opacity={pdfOpacity}
          />

          {/* 🔺 CANVAS V2: Layer Canvas - Background Overlays (Semi-transparent colored layers) */}
          {showLayerCanvas && (
            <LayerCanvas
              ref={overlayCanvasRef}
              layers={colorLayersWithDraft} // 🔧 FIX (2026-01-24): Include draft preview layer
              transform={transform} // 🏢 FIX (2026-02-01): Use React state (reactive) for proper re-render
              viewport={viewport} // 🏢 FIX (2026-02-01): Use React state (reactive) - ref was not triggering re-render!
              activeTool={activeTool} // 🔥 ΚΡΙΣΙΜΟ: Pass activeTool για pan cursor
              overlayMode={overlayMode} // 🎯 OVERLAY FIX: Pass overlayMode for drawing detection
              layersVisible={showLayers} // ✅ ΥΠΑΡΧΟΝ SYSTEM: Existing layer visibility
              dxfScene={dxfScene} // 🎯 SNAP FIX: Pass DXF scene for snap engine initialization
              enableUnifiedCanvas // ✅ ΕΝΕΡΓΟΠΟΙΗΣΗ: Unified event system για debugging
              // 🏢 ENTERPRISE (2026-01-25): Prevent selection when hovering over grip OR already dragging
              // Note: We use hoveredVertexInfo/hoveredEdgeInfo because dragging state is set AFTER mousedown
              isGripDragging={
                draggingVertex !== null ||
                draggingEdgeMidpoint !== null ||
                hoveredVertexInfo !== null ||
                hoveredEdgeInfo !== null
              }
              data-canvas-type="layer" // 🎯 DEBUG: Identifier για alignment test
              onContextMenu={handleDrawingContextMenu} // 🏢 ADR-053: Right-click context menu
              onTransformChange={(newTransform) => {
                // 🏢 ENTERPRISE: Single source of truth - setTransform writes to CanvasContext
                setTransform(newTransform);
                zoomSystem.setTransform(newTransform);
              }}
              onWheelZoom={zoomSystem.handleWheelZoom} // ✅ CONNECT ZOOM SYSTEM
              crosshairSettings={crosshairSettings} // Crosshair μόνο για layers
              cursorSettings={cursorCanvasSettings}
              snapSettings={snapSettings}
              gridSettings={{ ...gridSettings, enabled: false }} // 🔧 FIX: Disable grid in LayerCanvas (now in DxfCanvas)
              rulerSettings={{ ...rulerSettings, enabled: false }} // 🔧 FIX: Disable rulers in LayerCanvas (now in DxfCanvas)
              selectionSettings={selectionSettings}
              // 🏢 ENTERPRISE (2026-01-25): Pass centralized grip settings to LayerCanvas
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
                gripSettings // 🎯 SINGLE SOURCE OF TRUTH
              }}
              onLayerClick={handleOverlayClick}
              onMultiLayerClick={handleMultiOverlayClick}
              onCanvasClick={handleCanvasClick}
              // 🏢 ENTERPRISE (2026-01-26): ADR-036 - Drawing hover callback for preview line
              // Note: Tool check happens inside useCentralizedMouseHandlers via isInteractiveTool()
              onDrawingHover={drawingHandlersRef.current?.onDrawingHover}
              // 🏢 ENTERPRISE (2027-01-27): Pass dragging state for ghost rendering - Unified Toolbar Integration
              draggingOverlay={
                draggingOverlayBody && dragPreviewPosition
                  ? {
                      overlayId: draggingOverlayBody.overlayId,
                      delta: {
                        x: dragPreviewPosition.x - draggingOverlayBody.startPoint.x,
                        y: dragPreviewPosition.y - draggingOverlayBody.startPoint.y
                      }
                    }
                  : null
              }
              onMouseMove={handleLayerCanvasMouseMove}
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['0']}`} // 🎯 Z-INDEX FIX: LayerCanvas BACKGROUND (z-0)
              style={canvasUI.positioning.layers.layerCanvasWithTools(activeTool, crosshairSettings.enabled)}
            />
          )}

          {/* 🔺 CANVAS V2: DXF Canvas - Foreground DXF Drawing (Over colored layers) */}
          {showDxfCanvas && (
            <DxfCanvas
              ref={dxfCanvasRef}
              scene={dxfScene}
              transform={transform} // 🏢 FIX (2026-02-01): Use React state (reactive) for proper re-render
              viewport={viewport} // 🏢 FIX (2026-02-01): Use React state (reactive) - consistent with LayerCanvas
              activeTool={activeTool} // 🔥 ΚΡΙΣΙΜΟ: Pass activeTool για pan cursor
              overlayMode={overlayMode} // 🎯 OVERLAY FIX: Pass overlayMode for drawing detection
              colorLayers={colorLayers} // ✅ FIX: Pass color layers για fit to view bounds
              renderOptions={{
                showGrid: false,
                showLayerNames: false,
                wireframeMode: false,
                selectedEntityIds,
                hoveredEntityId,
                gripInteractionState: dxfGripInteraction.gripInteractionState,
                dragPreview: dxfGripInteraction.dragPreview ?? undefined,
              }} // 🏢 ENTERPRISE (2026-02-14): Entity selection + hover highlight + grip editing
              crosshairSettings={crosshairSettings} // ✅ RESTORED: Crosshair enabled
              gridSettings={gridSettings} // ✅ RESTORED: Grid enabled
              rulerSettings={{
                // 🛡️ NULL GUARD: Ensure rulers are always enabled, even if context is temporarily undefined
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
                tickInterval: gridSettings.size * gridMajorInterval, // ✅ SYNC WITH GRID: Use major grid interval!
                unitsFontSize: 10,
                unitsColor: globalRulerSettings.horizontal.textColor,
                labelPrecision: 1,
                borderColor: globalRulerSettings.horizontal.color,
                borderWidth: 1
              }}
              // 🏢 ENTERPRISE (2026-02-13): AutoCAD-style marquee selection — forward to DxfCanvas (z-10)
              // DxfCanvas intercepts ALL pointer events, so it MUST handle marquee selection
              onLayerSelected={handleOverlayClick}
              onMultiLayerSelected={handleMultiOverlayClick}
              onEntitiesSelected={(entityIds) => {
                setSelectedEntityIds(entityIds);
                // 🏢 ENTERPRISE (2026-02-15): Sync marquee selection → universalSelection
                // Without this, Delete/Backspace cannot find DXF entities selected via marquee
                universalSelection.clearByType('dxf-entity');
                if (entityIds.length > 0) {
                  universalSelection.selectMultiple(
                    entityIds.map(id => ({ id, type: 'dxf-entity' as const }))
                  );
                }
              }}
              onHoverEntity={setHoveredEntityId}
              onHoverOverlay={setHoveredOverlayId}
              onEntitySelect={(entityId) => {
                // 🏢 SSoT (2026-02-15): Single pipeline for entity selection
                // HitTester → useCentralizedMouseHandlers.mouseDown → onEntitySelect
                if (entityId) {
                  // 🏢 ENTERPRISE (2026-02-15): Skip state update if entity is ALREADY selected.
                  // Creating a new array triggers useDxfGripInteraction's useEffect that resets
                  // all grip state (phase, activeGrip, hoveredGrip) — killing any in-progress
                  // grip interaction. Only update when the selection actually changes.
                  setSelectedEntityIds(prev => {
                    if (prev.length === 1 && prev[0] === entityId) return prev; // Same entity — keep reference
                    return [entityId];
                  });
                  universalSelection.clearByType('dxf-entity');
                  universalSelection.select(entityId, 'dxf-entity');
                  entitySelectedOnMouseDownRef.current = true;
                } else {
                  entitySelectedOnMouseDownRef.current = false;
                }
              }}
              isGripDragging={draggingVertex !== null || draggingEdgeMidpoint !== null || hoveredVertexInfo !== null || hoveredEdgeInfo !== null || dxfGripInteraction.isDraggingGrip}
              // 🏢 ENTERPRISE (2026-02-15): Grip drag-release model — wire mouseDown/mouseUp
              onGripMouseDown={(worldPos) => dxfGripInteraction.handleGripMouseDown(worldPos)}
              onGripMouseUp={(worldPos) => dxfGripInteraction.handleGripMouseUp(worldPos)}
              data-canvas-type="dxf" // 🎯 DEBUG: Identifier για alignment test
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['10']}`} // 🎯 Z-INDEX FIX: DxfCanvas FOREGROUND (z-10) - ΠΑΝΩ από LayerCanvas!
              onContextMenu={handleDrawingContextMenu} // 🏢 ADR-053: Right-click context menu
              onCanvasClick={handleCanvasClick} // 🎯 FIX: Connect canvas clicks για drawing tools!
              onTransformChange={(newTransform) => {
                // 🏢 ENTERPRISE: Single source of truth - setTransform writes to CanvasContext
                setTransform(newTransform);
                zoomSystem.setTransform(newTransform);
              }}
              onWheelZoom={zoomSystem.handleWheelZoom} // ✅ CONNECT ZOOM SYSTEM
              onMouseMove={(screenPos, worldPos) => {
                // 🏢 ENTERPRISE (2026-02-15): Grip hover/following detection (priority over other handlers)
                if (worldPos) {
                  dxfGripInteraction.handleGripMouseMove(worldPos, screenPos);
                }

                // ✅ ΔΙΟΡΘΩΣΗ: Περνάω το worldPos στο props.onMouseMove για cursor-centered zoom
                // Note: event is not available in this context, so we create a minimal mock event
                if (props.onMouseMove && worldPos) {
                  const mockEvent = {
                    clientX: screenPos.x,
                    clientY: screenPos.y,
                    preventDefault: () => {},
                    stopPropagation: () => {}
                  } as React.MouseEvent;
                  props.onMouseMove(worldPos, mockEvent);
                }

                // ✅ ADR-006 FIX: Update mouseCss/mouseWorld για CrosshairOverlay
                // 🚀 PERFORMANCE (2026-01-27): Use memoized setters to skip unnecessary updates
                updateMouseCss(screenPos);
                updateMouseWorld(worldPos);

                // 🏢 ENTERPRISE (2026-01-26): ADR-038 - Call onDrawingHover for preview line
                // Using centralized isInDrawingMode (Single Source of Truth)
                if (isInDrawingMode(activeTool, overlayMode) && worldPos && drawingHandlersRef.current?.onDrawingHover) {
                  drawingHandlersRef.current.onDrawingHover(worldPos);
                }
              }}
            />
          )}

          {/* 🏢 ADR-040: PreviewCanvas - Direct rendering for drawing previews (performance optimization) */}
          {/* Pattern: Autodesk/Bentley - Dedicated preview layer bypasses React state for 60fps */}
          <PreviewCanvas
            ref={previewCanvasRef}
            transform={transform}
            viewport={viewport}
            isActive={isInDrawingMode(activeTool, overlayMode)}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            defaultOptions={PREVIEW_DEFAULTS}
          />

          {/* ✅ ADR-008: CrosshairOverlay - INTERNAL mouse tracking for pixel-perfect alignment */}
          {/* 🏢 CAD-GRADE: CrosshairOverlay tracks mouse position internally AND gets size from layout */}
          <CrosshairOverlay
            isActive={crosshairSettings.enabled}
            // ✅ ADR-008: REMOVED viewport prop - canvas gets actual size from layout via ResizeObserver
            rulerMargins={{
              left: rulerSettings.width ?? COORDINATE_LAYOUT.RULER_LEFT_WIDTH,
              top: rulerSettings.height ?? COORDINATE_LAYOUT.RULER_TOP_HEIGHT,
              bottom: COORDINATE_LAYOUT.MARGINS.bottom
            }}
            className={`absolute ${PANEL_LAYOUT.POSITION.LEFT_0} ${PANEL_LAYOUT.POSITION.RIGHT_0} ${PANEL_LAYOUT.POSITION.TOP_0} ${PANEL_LAYOUT.Z_INDEX['20']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            style={{ height: `calc(100% - ${rulerSettings.height ?? COORDINATE_LAYOUT.RULER_TOP_HEIGHT}px)` }}
          />

          {/* 🎯 SNAP INDICATOR: Visual feedback for snap points (AutoCAD/MicroStation style)
              @see docs/features/snapping/SNAP_INDICATOR_LINE.md - Βήμα 5: Κλικ και δημιουργία νέας γραμμής */}
          <SnapIndicatorOverlay
            snapResult={currentSnapResult ? {
              point: currentSnapResult.snappedPoint,
              type: currentSnapResult.activeMode || 'endpoint'
            } : null}
            viewport={viewport}
            canvasRect={dxfCanvasRef?.current?.getCanvas?.()?.getBoundingClientRect() ?? null}
            transform={transform}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['30']}`}
          />

          {/* ✅ ADR-009: RulerCornerBox - Interactive corner box at ruler intersection */}
          {/* 🏢 CAD-GRADE: Industry standard (AutoCAD/Revit/Blender) corner box with zoom controls */}
          <RulerCornerBox
            rulerWidth={rulerSettings.width ?? RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH}
            rulerHeight={rulerSettings.height ?? RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT}
            currentScale={transform.scale}
            backgroundColor={globalRulerSettings.horizontal.backgroundColor}
            textColor={globalRulerSettings.horizontal.textColor}
            onZoomToFit={() => {
              // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Use existing createCombinedBounds for unified bounds
              // 🏢 FIX (2026-01-04): forceRecalculate=true includes dynamically drawn entities
              const combinedBounds = createCombinedBounds(dxfScene, colorLayers, true);

              if (combinedBounds && viewport.width > 0 && viewport.height > 0) {
                zoomSystem.zoomToFit(combinedBounds, viewport, true);
              } else {
                dwarn('CanvasSection', '🚨 ZoomToFit: Invalid bounds or viewport!', { combinedBounds, viewport });
              }
            }}
            onZoom100={() => zoomSystem.zoomTo100()}
            onZoomIn={() => zoomSystem.zoomIn()}
            onZoomOut={() => zoomSystem.zoomOut()}
            onZoomPrevious={() => zoomSystem.zoomPrevious()}
            onZoomToScale={(scale) => zoomSystem.zoomToScale(scale)}
            onWheelZoom={(delta) => {
              // Convert delta to zoom direction and use cursor-centered zoom
              if (mouseCss) {
                zoomSystem.handleWheelZoom(delta, mouseCss);
              }
            }}
            viewport={viewport}
            className={PANEL_LAYOUT.Z_INDEX['30']}
          />

          {/* 🏢 ADR-047: DrawingContextMenu - Right-click context menu during drawing */}
          <DrawingContextMenu
            isOpen={drawingContextMenu.isOpen}
            onOpenChange={handleDrawingContextMenuClose}
            position={drawingContextMenu.position}
            activeTool={overlayMode === 'draw' ? 'polygon' : activeTool}
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


      {/* Right Sidebar - MOVED TO DxfViewerContent */}
    </>
  );
};
