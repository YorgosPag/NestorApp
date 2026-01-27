'use client';
import React, { useRef, useState, useCallback } from 'react';
// === CANVAS V2 IMPORTS ===
import { DxfCanvas, LayerCanvas, type ColorLayer, type SnapSettings, type GridSettings, type RulerSettings, type SelectionSettings, type DxfScene, type DxfEntityUnion, type DxfCanvasRef } from '../../canvas-v2';
import { createCombinedBounds } from '../../systems/zoom/utils/bounds';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
// ✅ CURSOR SETTINGS: Import από κεντρικό system αντί για duplicate
import type { CursorSettings } from '../../systems/cursor/config';
import { useCanvasOperations } from '../../hooks/interfaces/useCanvasOperations';
import { useCanvasContext } from '../../contexts/CanvasContext';
import { useDrawingHandlers } from '../../hooks/drawing/useDrawingHandlers';
import { UI_COLORS } from '../../config/color-config';
// CanvasProvider removed - not needed for Canvas V2
// OverlayCanvas import removed - it was dead code
import { FloatingPanelContainer } from '../../ui/FloatingPanelContainer';
import { OverlayList } from '../../ui/OverlayList';
import { OverlayProperties } from '../../ui/OverlayProperties';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLevels } from '../../systems/levels';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
import { useCursorSettings, useCursorActions } from '../../systems/cursor';
// 🏢 ENTERPRISE (2026-01-25): Immediate position store για zero-latency crosshair
import { setImmediatePosition } from '../../systems/cursor/ImmediatePositionStore';
import { globalRulerStore } from '../../settings-provider';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind, Overlay } from '../../overlays/types';
import type { RegionStatus } from '../../types/overlay';
import { getStatusColors } from '../../config/color-mapping';
import { createOverlayHandlers } from '../../overlays/types';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ENTERPRISE (2026-01-25): Edge detection for polygon vertex insertion
import { findOverlayEdgeForGrip } from '../../utils/entity-conversion';
// 🏢 ENTERPRISE (2026-01-25): Centralized Grip Settings via Provider (CANONICAL - SINGLE SOURCE OF TRUTH)
import { useGripStyles } from '../../settings-provider';
// 🏢 ENTERPRISE (2026-01-26): ADR-036 - Centralized tool detection (Single Source of Truth)
import { isDrawingTool, isMeasurementTool, isInteractiveTool, isInDrawingMode } from '../../systems/tools/ToolStateManager';
import type { LayerRenderOptions } from '../../canvas-v2/layer-canvas/layer-types';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import { useZoom } from '../../systems/zoom';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// ✅ ENTERPRISE MIGRATION: Using ServiceRegistry
import { serviceRegistry } from '../../services';
// ✅ ADR-006 FIX: Import CrosshairOverlay για crosshair rendering
import CrosshairOverlay from '../../canvas-v2/overlays/CrosshairOverlay';
// 🏢 ADR-040: PreviewCanvas for direct preview rendering (performance optimization)
import { PreviewCanvas, type PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
// ✅ ADR-009: Import RulerCornerBox for interactive corner box (AutoCAD/Revit standard)
import RulerCornerBox from '../../canvas-v2/overlays/RulerCornerBox';
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
// 🏢 ENTERPRISE (2026-01-26): Command History for Undo/Redo - ADR-032
import {
  useCommandHistory,
  useCommandHistoryKeyboard,
  DeleteOverlayCommand,
  DeleteMultipleOverlaysCommand,
  DeleteOverlayVertexCommand,
  DeleteMultipleOverlayVerticesCommand,
  MoveMultipleOverlayVerticesCommand,
  type VertexMovement
} from '../../core/commands';

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

  // ✅ FIX: Use DxfCanvasRef type για getCanvas() method access
  const dxfCanvasRef = useRef<DxfCanvasRef>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  // 🏢 ADR-040: PreviewCanvas ref for direct preview rendering (bypasses React state)
  const previewCanvasRef = useRef<PreviewCanvasHandle>(null);

  // === NEW ZOOM SYSTEM ===
  const initialTransform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  const [transform, setTransform] = useState<ViewTransform>(initialTransform);

  // ✅ CENTRALIZED VIEWPORT: Single source of truth για viewport dimensions
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const zoomSystem = useZoom({
    initialTransform,
    onTransformChange: (newTransform) => {
      setTransform(newTransform);
    },
    // 🏢 ENTERPRISE: Inject viewport για accurate zoom-to-cursor
    viewport
  });
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const [mouseCss, setMouseCss] = useState<Point2D | null>(null);
  const [mouseWorld, setMouseWorld] = useState<Point2D | null>(null);

  // 🚀 PERFORMANCE (2026-01-27): Refs to skip unnecessary state updates
  // Mouse position updates only when changed by more than 1 pixel
  const lastMouseCssRef = useRef<Point2D | null>(null);
  const lastMouseWorldRef = useRef<Point2D | null>(null);

  // 🚀 PERFORMANCE: Memoized setters that skip updates when position unchanged
  const updateMouseCss = useCallback((point: Point2D) => {
    const last = lastMouseCssRef.current;
    if (!last || Math.abs(point.x - last.x) > 0.5 || Math.abs(point.y - last.y) > 0.5) {
      lastMouseCssRef.current = point;
      setMouseCss(point);
    }
  }, []);

  const updateMouseWorld = useCallback((point: Point2D) => {
    const last = lastMouseWorldRef.current;
    if (!last || Math.abs(point.x - last.x) > 0.1 || Math.abs(point.y - last.y) > 0.1) {
      lastMouseWorldRef.current = point;
      setMouseWorld(point);
    }
  }, []);

  // 🎯 Canvas visibility από parent props (με fallback στα defaults)
  const showDxfCanvas = props.dxfCanvasVisible ?? true;
  const showLayerCanvasDebug = props.layerCanvasVisible ?? true;


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
  // 🏢 ENTERPRISE (2026-01-25): Multi-selection - getSelectedOverlay() replaced by isSelected() and getSelectedOverlays()
  // const selectedOverlay = overlayStore.getSelectedOverlay(); // DEPRECATED - use overlayStore.isSelected(id) instead

  const [draftPolygon, setDraftPolygon] = useState<Array<[number, number]>>([]);
  // 🔧 FIX (2026-01-24): Ref for fresh polygon access in async operations
  const draftPolygonRef = useRef<Array<[number, number]>>([]);
  // 🏢 ENTERPRISE (2026-01-25): State για grip hover detection (WARM grip)
  const [hoveredEdgeInfo, setHoveredEdgeInfo] = useState<{ overlayId: string; edgeIndex: number } | null>(null);
  const [hoveredVertexInfo, setHoveredVertexInfo] = useState<{ overlayId: string; vertexIndex: number } | null>(null);

  // 🏢 ENTERPRISE (2026-01-26): State για MULTIPLE selected grips (HOT grips - Autodesk pattern)
  // Shift+Click: Add/remove grips to selection | Drag: Move all selected grips together
  // ADR-031: Multi-Grip Selection System
  const [selectedGrips, setSelectedGrips] = useState<Array<{
    type: 'vertex' | 'edge-midpoint';
    overlayId: string;
    index: number; // vertexIndex for vertex, edgeIndex for edge-midpoint
  }>>([]);

  // 🏢 ENTERPRISE: Helper για backwards compatibility με single selectedGrip usage
  const selectedGrip = selectedGrips.length > 0 ? selectedGrips[0] : null;

  // 🏢 ENTERPRISE (2026-01-26): State για MULTI-vertex drag (vertex movement)
  // ADR-031: Multi-Grip Selection System - supports moving multiple grips together
  const [draggingVertices, setDraggingVertices] = useState<Array<{
    overlayId: string;
    vertexIndex: number;
    startPoint: Point2D;
    originalPosition: Point2D; // Original vertex position for delta calculation
  }> | null>(null);

  // 🏢 ENTERPRISE: Helper για backwards compatibility
  const draggingVertex = draggingVertices && draggingVertices.length > 0 ? {
    overlayId: draggingVertices[0].overlayId,
    vertexIndex: draggingVertices[0].vertexIndex,
    startPoint: draggingVertices[0].startPoint
  } : null;
  // 🏢 ENTERPRISE (2026-01-25): State για edge midpoint drag (vertex insertion)
  const [draggingEdgeMidpoint, setDraggingEdgeMidpoint] = useState<{
    overlayId: string;
    edgeIndex: number;
    insertIndex: number;
    startPoint: Point2D;
    newVertexCreated: boolean; // True after vertex has been inserted
  } | null>(null);

  // 🏢 ENTERPRISE (2026-01-25): Real-time drag preview position
  // Updates on every mouse move during drag for smooth visual feedback
  const [dragPreviewPosition, setDragPreviewPosition] = useState<Point2D | null>(null);

  // 🚀 PERFORMANCE (2026-01-27): Throttle ref for grip hover detection
  // Grip hover detection is O(selectedOverlays × vertices) - expensive on every mouse move
  const gripHoverThrottleRef = useRef<{
    lastCheckTime: number;
    lastWorldPoint: Point2D | null;
  }>({
    lastCheckTime: 0,
    lastWorldPoint: null
  });

  // 🏢 ENTERPRISE (2026-01-25): Flag to prevent click event immediately after drag
  // Prevents overlay deselection when releasing mouse after drag
  const justFinishedDragRef = useRef(false);
  // 🔧 FIX (2026-01-24): Flag to track if we're in the process of saving
  const [isSavingPolygon, setIsSavingPolygon] = useState(false);
  // 🎯 EVENT BUS: For polygon drawing communication with toolbar
  const eventBus = useEventBus();

  // Keep ref in sync with state
  React.useEffect(() => {
    draftPolygonRef.current = draftPolygon;
  }, [draftPolygon]);

  // 🎯 POLYGON EVENTS (2026-01-24): Notify toolbar about draft polygon changes
  React.useEffect(() => {
    eventBus.emit('overlay:draft-polygon-update', {
      pointCount: draftPolygon.length,
      canSave: draftPolygon.length >= 3
    });
  }, [draftPolygon.length, eventBus]);

  // 🏢 ENTERPRISE: Provide zoom system to context
  const canvasContext = useCanvasContext();
  // 🎯 SNAP INDICATOR: Get current snap result for visual feedback
  const { currentSnapResult } = useSnapContext();
  // 🏢 PDF BACKGROUND: Get PDF background state and setViewport action
  const {
    enabled: pdfEnabled,
    opacity: pdfOpacity,
    transform: pdfTransform,
    renderedImageUrl: pdfImageUrl,
    setViewport: setPdfViewport,
  } = usePdfBackgroundStore();
  // ✅ CENTRALIZED VIEWPORT: Update viewport από canvas dimensions
  // 🏢 FIX (2026-01-04): Use ResizeObserver for reliable viewport tracking
  React.useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    const updateViewport = () => {
      // 🏢 FIX: dxfCanvasRef.current is NOT HTMLCanvasElement - it has getCanvas() method!
      // Try to get the actual canvas element from DxfCanvas component ref
      const dxfCanvas = dxfCanvasRef.current?.getCanvas?.();
      const layerCanvas = overlayCanvasRef.current;

      // Use DxfCanvas as primary (has the actual canvas element)
      const canvas = dxfCanvas || layerCanvas;

      if (canvas && canvas instanceof HTMLCanvasElement) {
        const rect = canvas.getBoundingClientRect();
        // Only update if dimensions are valid (not 0x0)
        if (rect.width > 0 && rect.height > 0) {
          setViewport({ width: rect.width, height: rect.height });
          // 🏢 PDF BACKGROUND: Sync viewport to PDF store for fit-to-view
          setPdfViewport({ width: rect.width, height: rect.height });
          // Viewport updated silently
        }
      }
    };

    // 🏢 ENTERPRISE: Use ResizeObserver for precise dimension tracking
    const setupObserver = () => {
      const dxfCanvas = dxfCanvasRef.current?.getCanvas?.();
      const layerCanvas = overlayCanvasRef.current;
      const canvas = dxfCanvas || layerCanvas;

      if (canvas && canvas instanceof HTMLCanvasElement) {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              setViewport({ width, height });
              // 🏢 PDF BACKGROUND: Sync viewport to PDF store for fit-to-view
              setPdfViewport({ width, height });
            }
          }
        });
        resizeObserver.observe(canvas);

        // Initial update
        updateViewport();
      }
    };

    // 🏢 ENTERPRISE: Retry mechanism for canvas mount timing
    let retryCount = 0;
    const maxRetries = 10;

    const trySetupObserver = () => {
      const dxfCanvas = dxfCanvasRef.current?.getCanvas?.();
      const layerCanvas = overlayCanvasRef.current;

      if (dxfCanvas || layerCanvas) {
        setupObserver();
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(trySetupObserver, PANEL_LAYOUT.TIMING.OBSERVER_RETRY); // Retry every 100ms
      } else {
        console.warn('⚠️ [Viewport] Canvas not available after', maxRetries, 'retries');
      }
    };

    // Initial setup with delay to ensure canvas is mounted
    const timer = setTimeout(trySetupObserver, PANEL_LAYOUT.TIMING.OBSERVER_RETRY);

    // Fallback: Also listen for window resize
    window.addEventListener('resize', updateViewport);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateViewport);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []); // 🏢 FIX: Empty deps - setup once, ResizeObserver handles updates

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

  // 🔧 FIX: React state hook για GlobalRulerStore reactivity
  const [globalRulerSettings, setGlobalRulerSettings] = React.useState(globalRulerStore.settings);

  React.useEffect(() => {
    const unsubscribe = globalRulerStore.subscribe((newSettings) => {
      setGlobalRulerSettings(newSettings);
    });
    return unsubscribe;
  }, []);

  // Get cursor settings from CursorSystem
  const { settings: cursorSettings } = useCursorSettings();

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
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * 🏢 ENTERPRISE: Container mouse move handler
   * Updates CursorSystem position for all overlays (CrosshairOverlay, etc.)
   * FIX (2026-01-25): Also updates immediate position για zero-latency crosshair
   */
  const handleContainerMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const screenPos: Point2D = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // 🚀 IMMEDIATE: Update immediate store για zero-latency crosshair
    setImmediatePosition(screenPos);
    // React state update (για components που το χρειάζονται)
    updatePosition(screenPos);
  }, [updatePosition]);

  const handleContainerMouseEnter = React.useCallback(() => {
    setActive(true);
  }, [setActive]);

  const handleContainerMouseLeave = React.useCallback(() => {
    setActive(false);
    // 🚀 IMMEDIATE: Clear immediate position για zero-latency crosshair
    setImmediatePosition(null);
    updatePosition(null);
  }, [setActive, updatePosition]);

  // 🏢 ENTERPRISE (2026-01-26): Mouse down handler for MULTI-GRIP selection and drag
  // ADR-031: Multi-Grip Selection System
  // Patterns:
  // - Single click: Select single grip (replaces selection)
  // - Shift+Click: Add/remove grip to/from selection (toggle)
  // - Click+Drag: Start dragging ALL selected grips together
  const handleContainerMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle left click
    if (e.button !== 0) return;

    // Only in select/layering mode
    if (activeTool !== 'select' && activeTool !== 'layering') return;

    const isShiftPressed = e.shiftKey;

    // 🏢 ENTERPRISE (2026-01-26): Check if hovered overlay is in multi-selection
    const hoveredOverlayId = hoveredVertexInfo?.overlayId || hoveredEdgeInfo?.overlayId;
    if (!hoveredOverlayId) {
      // Clicked elsewhere → Deselect ALL grips (unless Shift is pressed to preserve selection)
      if (!isShiftPressed && selectedGrips.length > 0) {
        setSelectedGrips([]);
      }
      return;
    }

    // Check if the hovered overlay is selected (part of multi-selection)
    // 🏢 ENTERPRISE (2026-01-26): Use universal selection system via ref to avoid stale closures - ADR-030
    if (!universalSelectionRef.current.isSelected(hoveredOverlayId)) {
      // Clicked on grip of non-selected overlay → Deselect grips
      if (!isShiftPressed && selectedGrips.length > 0) {
        setSelectedGrips([]);
      }
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const screenPos: Point2D = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, viewport);

    // === VERTEX GRIP CLICK ===
    if (hoveredVertexInfo) {
      e.preventDefault();
      e.stopPropagation();

      const clickedGrip = {
        type: 'vertex' as const,
        overlayId: hoveredVertexInfo.overlayId,
        index: hoveredVertexInfo.vertexIndex
      };

      // 🏢 ENTERPRISE (2026-01-26): Check if this grip is already selected
      const isGripAlreadySelected = selectedGrips.some(
        g => g.type === 'vertex' && g.overlayId === clickedGrip.overlayId && g.index === clickedGrip.index
      );

      if (isShiftPressed) {
        // 🏢 FIX (2026-01-26): Shift+Click = ONLY toggle selection, NO drag
        // This allows building multi-selection without accidentally moving grips
        if (isGripAlreadySelected) {
          // Remove from selection
          setSelectedGrips(selectedGrips.filter(
            g => !(g.type === 'vertex' && g.overlayId === clickedGrip.overlayId && g.index === clickedGrip.index)
          ));
        } else {
          // Add to selection
          setSelectedGrips([...selectedGrips, clickedGrip]);
        }
        // 🏢 CRITICAL: Do NOT start dragging on Shift+Click
        return;
      }

      // 🏢 ENTERPRISE (2026-01-26): Regular click (no Shift)
      // If clicking on already-selected grip: drag ALL selected grips
      // If clicking on non-selected grip: replace selection and drag single grip
      const gripsToMove = isGripAlreadySelected
        ? selectedGrips.filter(g => g.type === 'vertex')  // Move all selected vertex grips
        : [clickedGrip];  // Just the clicked grip

      // Update selection if clicking on non-selected grip
      if (!isGripAlreadySelected) {
        setSelectedGrips([clickedGrip]);
      }

      // 🏢 ENTERPRISE (2026-01-26): Start dragging selected vertex grips
      if (gripsToMove.length > 0) {
        const overlayStore = overlayStoreRef.current;
        const draggingData = gripsToMove.map(grip => {
          // Get original vertex position from overlay
          const overlay = overlayStore.overlays[grip.overlayId];
          const originalPosition = overlay?.polygon?.[grip.index]
            ? { x: overlay.polygon[grip.index][0], y: overlay.polygon[grip.index][1] }
            : worldPos;

          return {
            overlayId: grip.overlayId,
            vertexIndex: grip.index,
            startPoint: worldPos,
            originalPosition
          };
        });

        setDraggingVertices(draggingData);
        setDragPreviewPosition(worldPos);
      }
      return;
    }

    // === EDGE MIDPOINT GRIP CLICK → IMMEDIATE DRAG (single grip only) ===
    if (hoveredEdgeInfo) {
      e.preventDefault();
      e.stopPropagation();

      const clickedGrip = {
        type: 'edge-midpoint' as const,
        overlayId: hoveredEdgeInfo.overlayId,
        index: hoveredEdgeInfo.edgeIndex
      };

      // 🏢 ENTERPRISE: Edge midpoints always replace selection (no multi-select for edge midpoints)
      // This is because dragging edge midpoint creates a NEW vertex, not moves existing
      setSelectedGrips([clickedGrip]);
      setDraggingEdgeMidpoint({
        overlayId: hoveredEdgeInfo.overlayId,
        edgeIndex: hoveredEdgeInfo.edgeIndex,
        insertIndex: hoveredEdgeInfo.edgeIndex + 1,
        startPoint: worldPos,
        newVertexCreated: false
      });
      setDragPreviewPosition(worldPos);
      return;
    }
  }, [activeTool, hoveredVertexInfo, hoveredEdgeInfo, selectedGrips, transform, viewport]);

  // 🏢 ENTERPRISE (2026-01-26): Mouse up handler for MULTI-grip drag end
  // ADR-031: Multi-Grip Selection System - updates all dragged vertices
  const handleContainerMouseUp = React.useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const overlayStore = overlayStoreRef.current;

    // Handle MULTI-vertex drag end
    if (draggingVertices && draggingVertices.length > 0 && overlayStore) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const screenPos: Point2D = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, viewport);

        // 🏢 ENTERPRISE (2026-01-26): Calculate delta from first grip's start point
        const delta = {
          x: worldPos.x - draggingVertices[0].startPoint.x,
          y: worldPos.y - draggingVertices[0].startPoint.y
        };

        // 🏢 ENTERPRISE (2026-01-26): Command Pattern for multi-grip movement - ADR-032
        // Uses MoveMultipleOverlayVerticesCommand for UNDO/REDO support
        const movements: VertexMovement[] = draggingVertices.map(drag => ({
          overlayId: drag.overlayId,
          vertexIndex: drag.vertexIndex,
          oldPosition: [drag.originalPosition.x, drag.originalPosition.y] as [number, number],
          newPosition: [
            drag.originalPosition.x + delta.x,
            drag.originalPosition.y + delta.y
          ] as [number, number]
        }));

        // Execute command through history for undo/redo support
        const command = new MoveMultipleOverlayVerticesCommand(movements, overlayStore);
        executeCommand(command);
      }
      // 🏢 ENTERPRISE (2026-01-26): Clear ONLY drag-related states
      // ⚠️ IMPORTANT: Do NOT clear selectedGrips - grips should remain visible for further editing
      setDraggingVertices(null);
      setDragPreviewPosition(null);
      // 🏢 ENTERPRISE: Set flag to prevent click event from deselecting overlay
      justFinishedDragRef.current = true;
      setTimeout(() => { justFinishedDragRef.current = false; }, 100);
    }

    // Handle edge midpoint drag end
    if (draggingEdgeMidpoint && overlayStore) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const screenPos: Point2D = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, viewport);

        if (!draggingEdgeMidpoint.newVertexCreated) {
          // First time - insert new vertex
          await overlayStore.addVertex(
            draggingEdgeMidpoint.overlayId,
            draggingEdgeMidpoint.insertIndex,
            [worldPos.x, worldPos.y]
          );
        } else {
          // Vertex already created - just update position
          await overlayStore.updateVertex(
            draggingEdgeMidpoint.overlayId,
            draggingEdgeMidpoint.insertIndex,
            [worldPos.x, worldPos.y]
          );
        }
      }
      // 🏢 ENTERPRISE (2026-01-25): Clear ONLY drag-related states
      // ⚠️ IMPORTANT: Do NOT clear selectedGrip - grips should remain visible
      setDraggingEdgeMidpoint(null);
      setDragPreviewPosition(null);
      // 🏢 ENTERPRISE: Set flag to prevent click event from deselecting overlay
      justFinishedDragRef.current = true;
      setTimeout(() => { justFinishedDragRef.current = false; }, 100);
    }
  }, [draggingVertex, draggingVertices, draggingEdgeMidpoint, transform, viewport, executeCommand]);

  // 🔺 CURSOR SYSTEM INTEGRATION - Σύνδεση με floating panel
  const crosshairSettings: CrosshairSettings = {
    enabled: cursorSettings.crosshair.enabled,
    visible: cursorSettings.crosshair.enabled, // visible follows enabled state
    color: cursorSettings.crosshair.color,
    size: cursorSettings.crosshair.size_percent,
    opacity: cursorSettings.crosshair.opacity,
    style: cursorSettings.crosshair.line_style,
    // Extended properties από CursorSystem
    lineWidth: cursorSettings.crosshair.line_width,
    useCursorGap: cursorSettings.crosshair.use_cursor_gap,
    centerGapPx: cursorSettings.crosshair.center_gap_px,
    showCenterDot: true,  // Default: show center dot
    centerDotSize: 2      // Default: 2px center dot
  };

  // 🔺 CURSOR SETTINGS INTEGRATION - Pass complete cursor settings to LayerCanvas
  // LayerCanvas expects the full CursorSettings object from systems/cursor/config.ts
  const cursorCanvasSettings: CursorSettings = cursorSettings;

  const snapSettings: SnapSettings = {
    enabled: true,
    types: ['endpoint', 'midpoint', 'center'],
    tolerance: 10
  };

  // Convert RulersGridSystem settings to Canvas V2 format
  const rulerSettings: RulerSettings = {
    enabled: true, // ✅ FORCE ENABLE RULERS
    unit: (rulerContextSettings?.units as 'mm' | 'cm' | 'm') ?? 'mm',
    color: rulerContextSettings?.horizontal?.color ?? UI_COLORS.WHITE, // ✅ CENTRALIZED WHITE για visibility
    backgroundColor: rulerContextSettings?.horizontal?.backgroundColor ?? UI_COLORS.DARK_BACKGROUND, // ✅ CENTRALIZED DARK BACKGROUND για contrast
    fontSize: rulerContextSettings?.horizontal?.fontSize ?? 12,
    // Extended properties από RulersGridSystem
    textColor: rulerContextSettings?.horizontal?.textColor ?? UI_COLORS.WHITE, // ✅ CENTRALIZED WHITE TEXT για visibility
    showLabels: rulerContextSettings?.horizontal?.showLabels ?? true,
    showUnits: rulerContextSettings?.horizontal?.showUnits ?? true,
    showBackground: rulerContextSettings?.horizontal?.showBackground ?? true,
    showMajorTicks: rulerContextSettings?.horizontal?.showMajorTicks ?? true,
    showMinorTicks: rulerContextSettings?.horizontal?.showMinorTicks ?? true,
    majorTickColor: rulerContextSettings?.horizontal?.majorTickColor ?? UI_COLORS.WHITE, // ✅ CENTRALIZED WHITE TICKS
    minorTickColor: rulerContextSettings?.horizontal?.minorTickColor ?? UI_COLORS.LIGHT_GRAY, // ✅ CENTRALIZED LIGHT GRAY MINOR TICKS
    majorTickLength: rulerContextSettings?.horizontal?.majorTickLength ?? 10,
    minorTickLength: rulerContextSettings?.horizontal?.minorTickLength ?? 5,
    height: rulerContextSettings?.horizontal?.height ?? 30,
    width: rulerContextSettings?.vertical?.width ?? 30,
    position: rulerContextSettings?.horizontal?.position ?? 'bottom',
    // 🔺 MISSING UNITS SETTINGS - Σύνδεση με floating panel
    unitsFontSize: rulerContextSettings?.horizontal?.unitsFontSize ?? 10,
    unitsColor: rulerContextSettings?.horizontal?.unitsColor ?? UI_COLORS.WHITE // ✅ CENTRALIZED WHITE UNITS TEXT
  };

  // ✅ LAYER VISIBILITY: Show LayerCanvas controlled by debug toggle
  // 🔧 FIX (2026-01-24): ALWAYS show LayerCanvas when in draw/edit mode to ensure overlays are visible
  // Debug toggle only applies when in 'select' mode (not actively drawing/editing)
  const showLayerCanvas = showLayerCanvasDebug || overlayMode === 'draw' || overlayMode === 'edit';

  // 🏢 ENTERPRISE (2026-01-25): Clear draft polygon when switching to select tool
  // Αποτρέπει το bug όπου η διαδικασία σχεδίασης συνεχίζεται μετά την αλλαγή tool
  React.useEffect(() => {
    if (activeTool === 'select' && draftPolygon.length > 0) {
      setDraftPolygon([]);
    }
  }, [activeTool, draftPolygon.length]);

  // 🏢 ENTERPRISE (2026-01-26): Clear selected grips when overlay or tool changes
  // ADR-031: Multi-Grip Selection System - clear grips that are no longer valid
  React.useEffect(() => {
    if (selectedGrips.length > 0) {
      // Filter out grips whose overlays are no longer selected
      const validGrips = selectedGrips.filter(grip =>
        universalSelection.isSelected(grip.overlayId)
      );

      // Clear all grips if tool is not select/layering
      if (activeTool !== 'select' && activeTool !== 'layering') {
        setSelectedGrips([]);
        setDragPreviewPosition(null);
      } else if (validGrips.length !== selectedGrips.length) {
        // Some grips became invalid - update selection
        setSelectedGrips(validGrips);
        if (validGrips.length === 0) {
          setDragPreviewPosition(null);
        }
      }
    }
  }, [universalSelection, activeTool, selectedGrips]);

  // ✅ CONVERT RulersGridSystem grid settings to Canvas V2 GridSettings format
  // RulersGridSystem uses: gridSettings.visual.color
  // Canvas GridRenderer uses: gridSettings.color
  const gridSettings: GridSettings = {
    // Enabled state: ΠΡΩΤΑ από panel, μετά toolbar fallback, τέλος ΠΑΝΤΑ true για stability
    // 🛡️ NULL GUARD: Ensure grid is always enabled, even if context is temporarily undefined during re-renders
    enabled: gridContextSettings?.visual?.enabled ?? showGrid ?? true,
    visible: gridContextSettings?.visual?.enabled ?? true, // ✅ VISIBILITY: Controls grid rendering

    // ✅ SIZE: Από panel settings
    size: gridContextSettings?.visual?.step ?? 10,

    // ✅ COLORS: Από panel settings (NOT hardcoded!)
    color: gridContextSettings?.visual?.color ?? UI_COLORS.BLUE_DEFAULT, // CENTRALIZED default blue από panel
    majorGridColor: gridContextSettings?.visual?.majorGridColor ?? UI_COLORS.MEDIUM_GRAY,
    minorGridColor: gridContextSettings?.visual?.minorGridColor ?? UI_COLORS.LIGHT_GRAY_ALT,

    // ✅ OPACITY: Από panel settings
    opacity: gridContextSettings?.visual?.opacity ?? 0.6,

    // ✅ LINE WIDTHS: Από panel settings
    lineWidth: gridContextSettings?.visual?.minorGridWeight ?? 0.5,
    majorGridWeight: gridContextSettings?.visual?.majorGridWeight ?? 1,
    minorGridWeight: gridContextSettings?.visual?.minorGridWeight ?? 0.5,

    // ✅ GRID STYLE: Από panel settings (lines/dots/crosses)
    style: gridContextSettings?.visual?.style ?? 'lines',
    majorInterval: gridContextSettings?.visual?.subDivisions ?? 5, // Extended property for grid subdivisions
    showMajorGrid: true,
    showMinorGrid: true,
    adaptiveOpacity: false, // ❌ DISABLE για να φαίνεται πάντα
    minVisibleSize: 0 // ✅ ALWAYS SHOW regardless of zoom
  };

  // 🔧 Grid major interval for ruler tick calculations
  const gridMajorInterval = gridContextSettings?.visual?.subDivisions ?? 5;

  // 🔺 SELECTION SETTINGS INTEGRATION - Σύνδεση selection boxes με floating panel
  const selectionSettings: SelectionSettings = {
    window: {
      fillColor: cursorSettings.selection.window.fillColor,
      fillOpacity: cursorSettings.selection.window.fillOpacity,
      borderColor: cursorSettings.selection.window.borderColor,
      borderOpacity: cursorSettings.selection.window.borderOpacity,
      borderStyle: cursorSettings.selection.window.borderStyle,
      borderWidth: cursorSettings.selection.window.borderWidth
    },
    crossing: {
      fillColor: cursorSettings.selection.crossing.fillColor,
      fillOpacity: cursorSettings.selection.crossing.fillOpacity,
      borderColor: cursorSettings.selection.crossing.borderColor,
      borderOpacity: cursorSettings.selection.crossing.borderOpacity,
      borderStyle: cursorSettings.selection.crossing.borderStyle,
      borderWidth: cursorSettings.selection.crossing.borderWidth
    }
  };

  // === CONVERT OVERLAYS TO CANVAS V2 FORMAT ===
  const convertToColorLayers = (overlays: Overlay[]): ColorLayer[] => {
    // Simple debug - only log count and first overlay sample (no infinite re-render)
    if (overlays.length > 0) {
      // // console.log('🔍 Converting overlays:', {
      //   count: overlays.length,
      //   sample: { id: overlays[0].id, hasPolygon: !!overlays[0].polygon }
      // });
    }

    return overlays
      .filter(overlay => overlay.polygon && Array.isArray(overlay.polygon) && overlay.polygon.length >= 3)
      .map((overlay, index) => {
        const vertices = overlay.polygon.map((point: [number, number]) => ({ x: point[0], y: point[1] }));

        // 🎯 ENTERPRISE: Χρήση Overlay.style properties αντί για non-existent properties
        // 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
        const isSelected = universalSelection.isSelected(overlay.id);
        const statusColors = overlay.status ? getStatusColors(overlay.status) : null;
        const fillColor = overlay.style?.fill || statusColors?.fill || UI_COLORS.BUTTON_PRIMARY;
        const strokeColor = overlay.style?.stroke || statusColors?.stroke || UI_COLORS.BLACK;

        return {
          id: overlay.id,
          name: overlay.label || `Layer ${index + 1}`,
          color: fillColor,
          opacity: overlay.style?.opacity ?? 0.7,  // Slightly transparent so we can see them
          visible: true,  // Overlays are always visible (no visible property in Overlay interface)
          zIndex: index,
          // 🎯 ΚΡΙΣΙΜΟ: Περνάμε το status για STATUS_COLORS mapping στο LayerRenderer
          status: overlay.status as RegionStatus | undefined,
          // 🏢 ENTERPRISE (2026-01-25): Show grips when layer is selected with select tool
          showGrips: isSelected,
          // 🏢 ENTERPRISE (2026-01-25): Show edge midpoint grips for vertex insertion (Autodesk pattern)
          showEdgeMidpoints: isSelected,
          // WARM state (hover)
          hoveredEdgeIndex: hoveredEdgeInfo?.overlayId === overlay.id ? hoveredEdgeInfo.edgeIndex : undefined,
          hoveredVertexIndex: hoveredVertexInfo?.overlayId === overlay.id ? hoveredVertexInfo.vertexIndex : undefined,
          // 🏢 ENTERPRISE (2026-01-26): HOT state (MULTI-selected grips - Autodesk pattern)
          // ADR-031: Multi-Grip Selection System - array of selected grip indices
          selectedGripIndices: selectedGrips
            .filter(g => g.overlayId === overlay.id && g.type === 'vertex')
            .map(g => g.index),
          selectedEdgeMidpointIndices: selectedGrips
            .filter(g => g.overlayId === overlay.id && g.type === 'edge-midpoint')
            .map(g => g.index),
          // 🏢 ENTERPRISE (2026-01-26): Real-time drag preview for MULTI-GRIP movement
          // Pattern: Autodesk Inventor - Immutable original positions + computed delta
          isDragging: draggingVertex?.overlayId === overlay.id || draggingEdgeMidpoint?.overlayId === overlay.id,
          // Legacy support
          dragPreviewPosition: (draggingVertex?.overlayId === overlay.id || draggingEdgeMidpoint?.overlayId === overlay.id)
            ? dragPreviewPosition ?? undefined
            : undefined,
          // 🏢 ENTERPRISE: Complete drag state with original positions
          dragState: (draggingVertices && draggingVertices.length > 0 && dragPreviewPosition)
            ? (() => {
                // Build original positions map for this overlay's dragging vertices
                const originalPositions = new Map<number, Point2D>();
                draggingVertices
                  .filter(dv => dv.overlayId === overlay.id)
                  .forEach(dv => {
                    originalPositions.set(dv.vertexIndex, dv.originalPosition);
                  });

                // Calculate delta from first grip's start point
                const delta = {
                  x: dragPreviewPosition.x - draggingVertices[0].startPoint.x,
                  y: dragPreviewPosition.y - draggingVertices[0].startPoint.y
                };

                return { delta, originalPositions };
              })()
            : undefined,
          polygons: [{
            id: `polygon_${overlay.id}`,
            vertices,
            fillColor,  // Use status colors or style colors
            strokeColor: isSelected ? UI_COLORS.SELECTED_RED : strokeColor,
            strokeWidth: isSelected ? 3 : 2,  // Thicker stroke when selected
            selected: isSelected
          }]
        };
      });
  };

  const colorLayers = convertToColorLayers(currentOverlays);

  // 🔧 FIX (2026-01-24): Add draft preview layer so user sees polygon while drawing
  // Without this, the draftPolygon is only stored in state but never rendered

  // 🎯 GRIP CLOSE DETECTION: Check if mouse is near first point
  const CLOSE_THRESHOLD = 20; // pixels in world coordinates (scaled by transform)
  const isNearFirstPoint = React.useMemo(() => {
    if (draftPolygon.length < 3 || !mouseWorld) return false;
    const firstPoint = draftPolygon[0];
    const dx = mouseWorld.x - firstPoint[0];
    const dy = mouseWorld.y - firstPoint[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (CLOSE_THRESHOLD / transform.scale);
  }, [draftPolygon, mouseWorld, transform.scale]);

  const draftColorLayer: ColorLayer | null = React.useMemo(() => {
    // Show grips from first point, but need at least 1 point
    if (draftPolygon.length < 1) return null;

    const statusColors = getStatusColors(currentStatus);
    // 🔧 FIX: Default colors if status not found
    const fillColor = statusColors?.fill ?? 'rgba(59, 130, 246, 0.3)'; // Default blue
    const strokeColor = statusColors?.stroke ?? '#3b82f6';

    return {
      id: 'draft-polygon-preview',
      name: 'Draft Polygon (Preview)',
      color: fillColor,
      opacity: 0.5, // Slightly transparent to indicate it's a preview
      visible: true,
      zIndex: 999, // On top of all other layers
      status: currentStatus as 'for-sale' | 'for-rent' | 'reserved' | 'sold' | 'landowner',
      // 🎯 DRAFT GRIPS: Enable grip rendering for draft polygons
      isDraft: true,
      showGrips: true,
      isNearFirstPoint: isNearFirstPoint,
      polygons: [{
        id: 'draft-polygon-preview-0',
        vertices: draftPolygon.map(([x, y]) => ({ x, y })),
        fillColor: fillColor,
        strokeColor: strokeColor,
        strokeWidth: 2,
        selected: false
      }]
    };
  }, [draftPolygon, currentStatus, isNearFirstPoint]);

  // Combine saved layers with draft preview
  const colorLayersWithDraft = React.useMemo(() => {
    return draftColorLayer ? [...colorLayers, draftColorLayer] : colorLayers;
  }, [colorLayers, draftColorLayer]);

  // === 🎨 DRAWING SYSTEM ===
  // useDrawingHandlers για DXF entity drawing (Line, Circle, Rectangle, etc.)
  const drawingHandlers = useDrawingHandlers(
    activeTool,
    (entity) => {
      // Callback όταν δημιουργηθεί entity
      if (props.handleSceneChange && props.currentScene) {
        // 🎯 TYPE-SAFE: Entity is already properly typed from useDrawingHandlers
        const updatedScene = {
          ...props.currentScene,
          entities: [...(props.currentScene.entities || []), entity]
        };
        props.handleSceneChange(updatedScene);
      }
    },
    (tool) => {
      // Tool change callback
      if (props.onToolChange) {
        props.onToolChange(tool);
      }
    },
    props.currentScene ?? undefined, // ✅ Convert null to undefined for type compatibility
    previewCanvasRef // 🏢 ADR-040: Pass PreviewCanvas ref for direct preview rendering
  );

  // === 🎯 DRAWING HANDLERS REF ===
  // Χρήση ref pattern για να αποφύγουμε infinite loops (Bug #1 fix)
  const drawingHandlersRef = React.useRef(drawingHandlers);
  React.useEffect(() => {
    drawingHandlersRef.current = drawingHandlers;
  }, [drawingHandlers]);

  // === 🚀 AUTO-START DRAWING ===
  // Όταν επιλέγεται drawing tool ή measurement tool, ξεκινά αυτόματα το drawing mode
  // 🏢 ENTERPRISE (2026-01-26): ADR-036 - Using centralized tool detection (Single Source of Truth)
  React.useEffect(() => {
    const isDrawing = isDrawingTool(activeTool);
    const isMeasurement = isMeasurementTool(activeTool);

    if ((isDrawing || isMeasurement) && drawingHandlersRef.current?.startDrawing) {
      // 🎯 TYPE-SAFE: activeTool is already narrowed to DrawingTool by if statement
      drawingHandlersRef.current.startDrawing(activeTool as import('../../hooks/drawing/useUnifiedDrawing').DrawingTool);
    }
  }, [activeTool]);

  // === CONVERT SCENE TO CANVAS V2 FORMAT ===
  // 🏢 ENTERPRISE (2026-01-26): Always create dxfScene for preview entities, even without loaded DXF
  // This allows measurement/drawing tools to work even when no DXF file is loaded
  const dxfScene: DxfScene = {
    entities: [
      ...(props.currentScene?.entities?.map((entity): DxfEntityUnion | null => {
        // Get layer color information
        const layerInfo = entity.layer ? props.currentScene?.layers?.[entity.layer] : null;

        // Convert SceneEntity to DxfEntityUnion
        // 🏢 ENTERPRISE (2026-01-27): Type guard for measurement properties
        // Measurement entities (from useUnifiedDrawing) have these flags for distance label rendering
        const entityWithMeasurement = entity as typeof entity & {
          measurement?: boolean;
          showEdgeDistances?: boolean;
        };

        const base = {
          id: entity.id,
          layer: entity.layer || 'default',
          color: String(entity.color || layerInfo?.color || UI_COLORS.WHITE), // ✅ ENTERPRISE FIX: Ensure string type
          lineWidth: entity.lineweight || 1,
          visible: entity.visible ?? true, // ✅ ENTERPRISE FIX: Default to true if undefined
          // 🏢 ENTERPRISE (2026-01-27): Pass measurement flags for distance label rendering
          // These flags come from useUnifiedDrawing when creating measurement entities
          ...(entityWithMeasurement.measurement !== undefined && { measurement: entityWithMeasurement.measurement }),
          ...(entityWithMeasurement.showEdgeDistances !== undefined && { showEdgeDistances: entityWithMeasurement.showEdgeDistances })
        };

        switch (entity.type) {
          case 'line': {
            // Type guard: Entity με type 'line' έχει start & end
            const lineEntity = entity as typeof entity & { start: Point2D; end: Point2D };
            return { ...base, type: 'line' as const, start: lineEntity.start, end: lineEntity.end } as DxfEntityUnion;
          }
          case 'circle': {
            // Type guard: Entity με type 'circle' έχει center & radius
            const circleEntity = entity as typeof entity & { center: Point2D; radius: number };
            return { ...base, type: 'circle' as const, center: circleEntity.center, radius: circleEntity.radius } as DxfEntityUnion;
          }
          case 'polyline': {
            // Type guard: Entity με type 'polyline' έχει vertices & closed
            const polylineEntity = entity as typeof entity & { vertices: Point2D[]; closed: boolean };
            return { ...base, type: 'polyline' as const, vertices: polylineEntity.vertices, closed: polylineEntity.closed } as DxfEntityUnion;
          }
          case 'arc': {
            // Type guard: Entity με type 'arc' έχει center, radius, startAngle, endAngle
            const arcEntity = entity as typeof entity & { center: Point2D; radius: number; startAngle: number; endAngle: number };
            return { ...base, type: 'arc' as const, center: arcEntity.center, radius: arcEntity.radius, startAngle: arcEntity.startAngle, endAngle: arcEntity.endAngle } as DxfEntityUnion;
          }
          case 'text': {
            // ╔════════════════════════════════════════════════════════════════════╗
            // ║ ⚠️ VERIFIED WORKING (2026-01-03) - ΜΗΝ ΑΛΛΑΞΕΤΕ!                   ║
            // ║ height || fontSize || 12 είναι η ΣΩΣΤΗ σειρά προτεραιότητας       ║
            // ║ ΜΗΝ αλλάξετε σε fontSize || height - ΧΑΛΑΕΙ τα κείμενα!           ║
            // ╚════════════════════════════════════════════════════════════════════╝
            const textEntity = entity as typeof entity & { position: Point2D; text: string; fontSize?: number; height?: number; rotation?: number };
            const textHeight = textEntity.height || textEntity.fontSize || 12;
            return { ...base, type: 'text' as const, position: textEntity.position, text: textEntity.text, height: textHeight, rotation: textEntity.rotation } as DxfEntityUnion;
          }
          default:
            console.warn('🔍 Unsupported entity type for DxfCanvas:', entity.type);
            return null;
        }
      }).filter(Boolean) as DxfEntityUnion[] || []),
      // 🏢 ADR-040: Preview entity rendering moved to dedicated PreviewCanvas layer
      // This eliminates duplicate rendering and improves performance (250ms → <16ms)
      // Previous code (kept for reference):
      // ...(drawingHandlers.drawingState.previewEntity ? [...] : [])
    ],
    layers: Object.keys(props.currentScene?.layers || {}), // ✅ FIX: Convert layers object to array (optional chaining for null safety)
    bounds: props.currentScene?.bounds ?? null // ✅ FIX: Convert undefined to null for type compatibility
  };


  // 🔍 DEBUG - Check if DXF scene has entities and auto-fit to view
  React.useEffect(() => {
    if (dxfScene && dxfScene.entities.length > 0) {
      // DxfScene loaded with entities - debug disabled for performance

      // ✅ AUTO-FIT TO VIEW - Using new zoom system with DYNAMIC VIEWPORT
      if (dxfScene.bounds) {
        // Auto-fitting DXF to view - debug disabled for performance

        // Get actual canvas dimensions instead of hardcoded values
        const canvas = dxfCanvasRef.current || overlayCanvasRef.current;
        if (canvas && canvas instanceof HTMLCanvasElement) {
          // ✅ ENTERPRISE MIGRATION: Get service from registry
          const canvasBounds = serviceRegistry.get('canvas-bounds');
          const rect = canvasBounds.getBounds(canvas);
          const viewport = { width: rect.width, height: rect.height };

          // Use professional zoom system for fit-to-view with actual viewport
          // 🎯 ENTERPRISE: alignToOrigin=true to position world (0,0) at bottom-left ruler intersection
          zoomSystem.zoomToFit(dxfScene.bounds, viewport, true);
        } else {
          // Fallback to container dimensions if canvas not ready
          const container = document.querySelector('.relative.w-full.h-full.overflow-hidden');
          if (container) {
            // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CanvasBoundsService (works with any element)
            const rect = container.getBoundingClientRect();
            // 🎯 ENTERPRISE: alignToOrigin=true to position world (0,0) at bottom-left ruler intersection
            zoomSystem.zoomToFit(dxfScene.bounds, { width: rect.width, height: rect.height }, true);
          }
        }
      }
    } else if (dxfScene) {
      // console.log('🔍 DxfScene loaded but NO entities:', { dxfScene });
    }
  }, [props.currentScene]); // Use props instead of derived state to prevent infinite loop

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

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: FIT TO OVERLAY - Χρήση κεντρικής υπηρεσίας αντί για διάσπαρτη logic
  const fitToOverlay = (overlayId: string) => {
    const overlay = currentOverlays.find(o => o.id === overlayId);
    if (!overlay || !overlay.polygon || overlay.polygon.length < 3) {
      return;
    }

    // Calculate bounding box of overlay polygon
    const xs = overlay.polygon.map(([x]) => x);
    const ys = overlay.polygon.map(([, y]) => y);
    const bounds = {
      min: { x: Math.min(...xs), y: Math.min(...ys) },
      max: { x: Math.max(...xs), y: Math.max(...ys) }
    };

    // ✅ ENTERPRISE MIGRATION: Get service from registry
    const fitToView = serviceRegistry.get('fit-to-view');
    const viewport = { width: 800, height: 600 }; // Default fallback - should get from actual canvas
    const result = fitToView.calculateFitToViewFromBounds(bounds, viewport, { padding: 0.1 });

    if (result.success && result.transform) {
      // Apply transform to zoom system
      zoomSystem.setTransform(result.transform);
    }
  };


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
      console.error('Failed to add vertex:', error);
    }
  };

  // Drawing logic
  const handleOverlayClick = (overlayId: string, point: Point2D) => {
    // console.log('🔍 handleOverlayClick called:', { overlayId, point, overlayMode, activeTool });

    // 🏢 ENTERPRISE (2026-01-25): Check for edge midpoint click first (vertex insertion)
    if ((activeTool === 'select' || activeTool === 'layering') && hoveredEdgeInfo?.overlayId === overlayId) {
      const overlay = currentOverlays.find(o => o.id === overlayId);
      if (overlay?.polygon) {
        const EDGE_TOLERANCE = 15 / transform.scale; // 15 pixels in world units
        const edgeInfo = findOverlayEdgeForGrip(point, overlay.polygon, EDGE_TOLERANCE);

        if (edgeInfo && edgeInfo.edgeIndex === hoveredEdgeInfo.edgeIndex) {
          // Click was on the hovered edge midpoint - add vertex
          handleEdgeMidpointClick(overlayId, edgeInfo.edgeIndex, edgeInfo.insertPoint);
          return; // Don't proceed with selection
        }
      }
    }

    // 🚀 PROFESSIONAL CAD: Αυτόματη επιλογή layers όταν select/layering tool είναι ενεργό
    // 🏢 ENTERPRISE (2026-01-25): Προσθήκη 'select' tool για επιλογή layers με grips
    if (activeTool === 'select' || activeTool === 'layering' || overlayMode === 'select') {
      // console.log('🔍 Selecting overlay:', overlayId);
      handleOverlaySelect(overlayId);

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

  const handleCanvasClick = (point: Point2D) => {
    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Route click to unified drawing system for drawing AND measurement tools
    // 🏢 ENTERPRISE (2026-01-26): ADR-036 - Using centralized tool detection (Single Source of Truth)
    if (isInteractiveTool(activeTool) && drawingHandlersRef.current) {
      const canvasElement = dxfCanvasRef.current?.getCanvas?.();
      if (!canvasElement) return;

      const viewportLocal = { width: canvasElement.clientWidth, height: canvasElement.clientHeight };
      const worldPoint = CoordinateTransforms.screenToWorld(point, transform, viewportLocal);

      drawingHandlersRef.current.onDrawingPoint(worldPoint);
      return;
    }

    // ✅ OVERLAY MODE: Use legacy overlay system with draftPolygon
    // 🏢 ENTERPRISE (2026-01-25): Block drawing when select tool is active
    if (overlayMode === 'draw' && activeTool !== 'select') {
      if (isSavingPolygon) return;

      const canvasRef = dxfCanvasRef.current || overlayCanvasRef.current;
      if (!canvasRef) return;

      const canvasElement = 'getCanvas' in canvasRef ? canvasRef.getCanvas() : canvasRef;
      if (!canvasElement) return;

      const viewport = { width: canvasElement.clientWidth, height: canvasElement.clientHeight };
      const worldPoint = CoordinateTransforms.screenToWorld(point, transform, viewport);
      const worldPointArray: [number, number] = [worldPoint.x, worldPoint.y];

      // 🎯 SIMPLIFIED (2026-01-24): Just add points - user saves with toolbar button
      setDraftPolygon(prev => [...prev, worldPointArray]);
    } else {
      // 🏢 ENTERPRISE (2026-01-25): Only deselect overlay if clicking on EMPTY canvas space
      // Do NOT deselect if:
      // - A grip is selected (user might be about to drag)
      // - User is hovering over a grip
      // - Click was on the overlay itself (handled by handleOverlayClick)
      // - Just finished a drag operation (prevent accidental deselection)
      const isClickOnGrip = hoveredVertexInfo !== null || hoveredEdgeInfo !== null;
      const hasSelectedGrip = selectedGrip !== null;
      const justFinishedDrag = justFinishedDragRef.current;

      if (!isClickOnGrip && !hasSelectedGrip && !justFinishedDrag) {
        // 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030
        universalSelection.clearByType('overlay');
        setSelectedGrips([]); // Clear grip selection when clicking empty space
      }
    }
  };

  // 🔧 FIX (2026-01-24): New function that accepts polygon as parameter to avoid stale closure
  const finishDrawingWithPolygon = async (polygon: Array<[number, number]>) => {
    // 🔧 FIX: Better error handling - notify user if level is not selected
    if (polygon.length < 3) {
      console.warn('⚠️ Cannot save polygon - need at least 3 points');
      return false;
    }

    if (!levelManager.currentLevelId) {
      console.error('❌ Cannot save polygon - no level selected!');
      // TODO: Show notification to user
      alert('Παρακαλώ επιλέξτε ένα επίπεδο (Level) πρώτα για να αποθηκευτεί το polygon.');
      return false;
    }

    try {
      await overlayStore.add({
        levelId: levelManager.currentLevelId,
        kind: currentKind,
        polygon: polygon, // 🔧 FIX: Use passed polygon, not stale draftPolygon
        status: currentStatus,
        label: `Overlay ${Date.now()}`, // Temporary label
      });

      return true;
    } catch (error) {
      console.error('Failed to create overlay:', error);
      return false;
    }
    // Note: setDraftPolygon([]) is done in the calling setDraftPolygon callback
  };

  // Legacy function for Enter key support (uses current state, which is fine for keyboard)
  const finishDrawing = async () => {
    if (draftPolygon.length >= 3 && levelManager.currentLevelId) {
      await finishDrawingWithPolygon(draftPolygon);
    }
    setDraftPolygon([]);
  };

  // 🎯 POLYGON EVENTS (2026-01-24): Listen for save/cancel commands from toolbar
  React.useEffect(() => {
    // Handle save polygon command from toolbar "Αποθήκευση" button
    const cleanupSave = eventBus.on('overlay:save-polygon', () => {
      const polygon = draftPolygonRef.current;

      if (polygon.length >= 3) {
        setIsSavingPolygon(true);
        finishDrawingWithPolygon(polygon).then(success => {
          setIsSavingPolygon(false);
          if (success) {
            setDraftPolygon([]);
          }
        });
      }
    });

    // Handle cancel polygon command from toolbar or Escape key
    const cleanupCancel = eventBus.on('overlay:cancel-polygon', () => {
      setDraftPolygon([]);
    });

    return () => {
      cleanupSave();
      cleanupCancel();
    };
  }, [eventBus]);

  // Handle fit-to-view event from useCanvasOperations fallback
  React.useEffect(() => {
    const handleFitToView = (e: CustomEvent) => {
      // 🚀 USE COMBINED BOUNDS - DXF + overlays
      // 🏢 FIX (2026-01-04): forceRecalculate=true includes dynamically drawn entities
      const combinedBounds = createCombinedBounds(dxfScene, colorLayers, true);

      if (combinedBounds) {
        const viewport = e.detail?.viewport || { width: 800, height: 600 };

        try {
          // 🎯 ENTERPRISE: alignToOrigin = true → (0,0) at axis intersection (bottom-left)
          const zoomResult = zoomSystem.zoomToFit(combinedBounds, viewport, true);

          // 🔥 ΚΡΙΣΙΜΟ: Εφαρμογή του νέου transform με null checks + NaN guards
          if (zoomResult && zoomResult.transform) {
            const { scale, offsetX, offsetY } = zoomResult.transform;

            // 🛡️ GUARD: Check for NaN values before applying transform
            if (isNaN(scale) || isNaN(offsetX) || isNaN(offsetY)) {
              console.error('🚨 Shift+1 failed: Invalid transform (NaN values)');
              return;
            }

            setTransform(zoomResult.transform);
          }
        } catch (error) {
          console.error('🚨 Shift+1 failed:', error);
        }
      }
    };

    document.addEventListener('canvas-fit-to-view', handleFitToView as EventListener);
    return () => document.removeEventListener('canvas-fit-to-view', handleFitToView as EventListener);
  }, [dxfScene, colorLayers, zoomSystem]); // 🚀 Include colorLayers για combined bounds

  // 🏢 ENTERPRISE (2026-01-26): Smart Delete Handler - ADR-032
  // Handles Delete/Backspace with intelligent context awareness:
  // - If grips selected → delete vertices (from highest index to lowest)
  // - Else if overlay selected → delete entire overlay
  // Pattern: AutoCAD/Figma - context-aware deletion
  const handleSmartDelete = React.useCallback(async () => {
    const overlayStoreInstance = overlayStoreRef.current;

    // PRIORITY 1: Delete selected grips (vertices) with UNDO SUPPORT
    if (selectedGrips.length > 0) {
      // 🏢 ENTERPRISE: Sort by index DESCENDING to avoid index shifting
      // When deleting vertex[5], then vertex[3], indices stay correct
      const vertexGrips = selectedGrips
        .filter(g => g.type === 'vertex')
        .sort((a, b) => {
          // Group by overlayId first, then sort by index descending within each overlay
          if (a.overlayId !== b.overlayId) return a.overlayId.localeCompare(b.overlayId);
          return b.index - a.index; // Descending order
        });

      if (vertexGrips.length > 0) {
        // 🏢 ENTERPRISE (2026-01-26): Use Command System for undo support - ADR-032
        // Execute command via Command History for Ctrl+Z undo capability
        if (vertexGrips.length === 1) {
          // Single vertex delete
          executeCommand(new DeleteOverlayVertexCommand(
            vertexGrips[0].overlayId,
            vertexGrips[0].index,
            overlayStoreInstance
          ));
        } else {
          // Batch vertex delete
          executeCommand(new DeleteMultipleOverlayVerticesCommand(
            vertexGrips.map(g => ({ overlayId: g.overlayId, vertexIndex: g.index })),
            overlayStoreInstance
          ));
        }

        // Clear grip selection after deletion
        setSelectedGrips([]);
        return true;
      }
    }

    // PRIORITY 2: Delete selected overlays (entire entities) with UNDO SUPPORT
    // 🏢 ENTERPRISE: Use getIdsByType('overlay') from Universal Selection System - ADR-030
    // 🏢 ENTERPRISE (2026-01-26): Delete works REGARDLESS of current tool
    // Pattern: AutoCAD/Figma/Revit - Delete ALWAYS removes selected entities
    // The current tool determines what you CREATE, not what you can DELETE
    const selectedOverlayIds = universalSelectionRef.current.getIdsByType('overlay');
    if (selectedOverlayIds.length > 0) {
      // 🏢 ENTERPRISE (2026-01-26): Use Command System for undo support - ADR-032
      // Execute command via Command History for Ctrl+Z undo capability
      if (selectedOverlayIds.length === 1) {
        // Single overlay delete
        executeCommand(new DeleteOverlayCommand(selectedOverlayIds[0], overlayStoreInstance));
      } else {
        // Batch overlay delete
        executeCommand(new DeleteMultipleOverlaysCommand(selectedOverlayIds, overlayStoreInstance));
      }

      // Clear selection after deletion
      // 🏢 ENTERPRISE: Use clearAll() from Universal Selection System - ADR-030
      universalSelectionRef.current.clearAll();
      return true;
    }

    return false;
  }, [selectedGrips, executeCommand]); // 🏢 ENTERPRISE: No tool dependency - delete works in all modes

  // 🏢 ENTERPRISE (2026-01-26): Listen for delete command from floating toolbar - ADR-032
  React.useEffect(() => {
    const cleanupDelete = eventBus.on('toolbar:delete', () => {
      handleSmartDelete();
    });

    return () => {
      cleanupDelete();
    };
  }, [eventBus, handleSmartDelete]);

  // Handle keyboard shortcuts for drawing, delete, and local operations
  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // 🏢 ENTERPRISE (2026-01-26): Smart Delete - ADR-032
      // Delete/Backspace: Context-aware deletion (grips first, then overlays)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation(); // 🏢 Prevent other handlers from receiving this event
        await handleSmartDelete();
        return;
      }

      // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Zoom shortcuts μετακόμισαν στο hooks/useKeyboardShortcuts.ts
      // Εδώ κρατάμε ΜΟΝΟ local shortcuts για drawing mode (Escape, Enter)

      switch (e.key) {
        case 'Escape':
          setDraftPolygon([]);
          // 🏢 ENTERPRISE: Escape also clears grip selection
          if (selectedGrips.length > 0) {
            setSelectedGrips([]);
          }
          break;
        case 'Enter':
          if (draftPolygon.length >= 3) {
            finishDrawing();
          }
          break;
      }
    };

    // 🏢 ENTERPRISE: Use capture: true to handle Delete before other handlers
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [draftPolygon, finishDrawing, handleSmartDelete, selectedGrips]);


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
          className={`canvas-stack relative w-full h-full ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`}
          style={{ cursor: 'none' }} // ✅ ADR-008 CAD-GRADE: ALWAYS hide CSS cursor - crosshair is the only cursor
          onMouseMove={handleContainerMouseMove}
          onMouseDown={handleContainerMouseDown}
          onMouseUp={handleContainerMouseUp}
          onMouseEnter={handleContainerMouseEnter}
          onMouseLeave={handleContainerMouseLeave}
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
              transform={transform}
              viewport={viewport} // ✅ CENTRALIZED: Pass centralized viewport
              activeTool={activeTool} // 🔥 ΚΡΙΣΙΜΟ: Pass activeTool για pan cursor
              overlayMode={overlayMode} // 🎯 OVERLAY FIX: Pass overlayMode for drawing detection
              layersVisible={showLayers} // ✅ ΥΠΑΡΧΟΝ SYSTEM: Existing layer visibility
              dxfScene={dxfScene} // 🎯 SNAP FIX: Pass DXF scene for snap engine initialization
              enableUnifiedCanvas={true} // ✅ ΕΝΕΡΓΟΠΟΙΗΣΗ: Unified event system για debugging
              // 🏢 ENTERPRISE (2026-01-25): Prevent selection when hovering over grip OR already dragging
              // Note: We use hoveredVertexInfo/hoveredEdgeInfo because dragging state is set AFTER mousedown
              isGripDragging={
                draggingVertex !== null ||
                draggingEdgeMidpoint !== null ||
                hoveredVertexInfo !== null ||
                hoveredEdgeInfo !== null
              }
              data-canvas-type="layer" // 🎯 DEBUG: Identifier για alignment test
              onTransformChange={(newTransform) => {
                setTransform(newTransform); // ✅ SYNC: Κοινό transform state για LayerCanvas
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
              onMouseMove={(screenPoint) => {
                // 🚀 PERFORMANCE (2026-01-27): ENTERPRISE OPTIMIZATION
                // Reduced unnecessary work in mousemove handler to achieve <16ms per frame

                // 🚀 EARLY RETURN: Skip all grip-related work if not in select/layering mode
                const isGripMode = activeTool === 'select' || activeTool === 'layering';

                // 🚀 THROTTLED: Mouse position updates (was causing re-renders on every move)
                const now = performance.now();
                const throttle = gripHoverThrottleRef.current;

                // 🚀 PERFORMANCE (2026-01-27): Increase throttle from 33ms to 100ms (10fps)
                // Grip hover detection doesn't need 30fps - 10fps is smooth enough for visual feedback
                const GRIP_HOVER_THROTTLE_MS = 100;
                const shouldUpdate = now - throttle.lastCheckTime >= GRIP_HOVER_THROTTLE_MS;

                if (!shouldUpdate) {
                  // 🚀 PERFORMANCE (2026-01-27): During drag, use RAF-throttled preview update
                  // Instead of setState on every mousemove, we use a ref + RAF for smooth animation
                  return; // Skip all other work until throttle period passes
                }

                throttle.lastCheckTime = now;

                // Now do the throttled work
                updateMouseCss(screenPoint);
                const worldPoint = CoordinateTransforms.screenToWorld(screenPoint, transform, viewport);
                updateMouseWorld(worldPoint);
                throttle.lastWorldPoint = worldPoint;

                // 🚀 PERFORMANCE: Skip grip detection entirely if not in grip mode
                if (!isGripMode) {
                  // Clear any stale hover state (only if needed)
                  if (hoveredEdgeInfo || hoveredVertexInfo) {
                    setHoveredEdgeInfo(null);
                    setHoveredVertexInfo(null);
                  }
                } else {
                  // 🏢 ENTERPRISE (2026-01-25): Grip hover detection for selected overlays
                  const selectedOverlayIds = universalSelection.getIdsByType('overlay');

                  // 🚀 EARLY RETURN: Skip if no overlays selected
                  if (selectedOverlayIds.length === 0) {
                    if (hoveredEdgeInfo || hoveredVertexInfo) {
                      setHoveredEdgeInfo(null);
                      setHoveredVertexInfo(null);
                    }
                  } else {
                    const selectedOverlays = selectedOverlayIds
                      .map(id => currentOverlays.find(o => o.id === id))
                      .filter((o): o is Overlay => o !== undefined);

                    // 🎯 CENTRALIZED: Tolerance from grip settings
                    const gripTolerancePx = (gripSettings.gripSize ?? 5) * (gripSettings.dpiScale ?? 1.0) + 2;
                    const gripToleranceWorld = gripTolerancePx / transform.scale;

                    // Check grips on ALL selected overlays
                    let foundVertexInfo: { overlayId: string; vertexIndex: number } | null = null;
                    let foundEdgeInfo: { overlayId: string; edgeIndex: number } | null = null;

                    outerLoop:
                    for (const overlay of selectedOverlays) {
                      if (!overlay?.polygon) continue;

                      // 1. Check vertex grips first (higher priority)
                      for (let i = 0; i < overlay.polygon.length; i++) {
                        const vertex = overlay.polygon[i];
                        const dx = worldPoint.x - vertex[0];
                        const dy = worldPoint.y - vertex[1];
                        const distSq = dx * dx + dy * dy; // 🚀 PERF: Skip sqrt
                        const toleranceSq = gripToleranceWorld * gripToleranceWorld;

                        if (distSq < toleranceSq) {
                          foundVertexInfo = { overlayId: overlay.id, vertexIndex: i };
                          break outerLoop;
                        }
                      }

                      // 2. If no vertex hover, check edge midpoints
                      const edgeInfo = findOverlayEdgeForGrip(worldPoint, overlay.polygon, gripToleranceWorld);
                      if (edgeInfo) {
                        foundEdgeInfo = { overlayId: overlay.id, edgeIndex: edgeInfo.edgeIndex };
                        break;
                      }
                    }

                    // 🚀 PERFORMANCE: Only setState if value actually changed
                    if (foundVertexInfo) {
                      if (!hoveredVertexInfo ||
                          hoveredVertexInfo.overlayId !== foundVertexInfo.overlayId ||
                          hoveredVertexInfo.vertexIndex !== foundVertexInfo.vertexIndex) {
                        setHoveredVertexInfo(foundVertexInfo);
                      }
                      if (hoveredEdgeInfo) setHoveredEdgeInfo(null);
                    } else if (foundEdgeInfo) {
                      if (!hoveredEdgeInfo ||
                          hoveredEdgeInfo.overlayId !== foundEdgeInfo.overlayId ||
                          hoveredEdgeInfo.edgeIndex !== foundEdgeInfo.edgeIndex) {
                        setHoveredEdgeInfo(foundEdgeInfo);
                      }
                      if (hoveredVertexInfo) setHoveredVertexInfo(null);
                    } else {
                      // Clear hover only if something was previously set
                      if (hoveredEdgeInfo) setHoveredEdgeInfo(null);
                      if (hoveredVertexInfo) setHoveredVertexInfo(null);
                    }
                  }
                }

                // 🏢 ENTERPRISE: Drag preview update (already throttled by above check)
                if (draggingVertex || draggingEdgeMidpoint) {
                  setDragPreviewPosition(worldPoint);
                }

                // ✅ ΔΙΟΡΘΩΣΗ: Καλώ και το props.onMouseMove για cursor-centered zoom
                if (props.onMouseMove) {
                  // 🎯 TYPE-SAFE: Create proper mock event (event not available in this context)
                  const mockEvent = {
                    clientX: screenPoint.x,
                    clientY: screenPoint.y,
                    preventDefault: () => {},
                    stopPropagation: () => {}
                  } as React.MouseEvent;
                  props.onMouseMove(worldPoint, mockEvent);
                }
              }}
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['0']}`} // 🎯 Z-INDEX FIX: LayerCanvas BACKGROUND (z-0)
              style={canvasUI.positioning.layers.layerCanvasWithTools(activeTool, crosshairSettings.enabled)}
            />
          )}

          {/* 🔺 CANVAS V2: DXF Canvas - Foreground DXF Drawing (Over colored layers) */}
          {showDxfCanvas && (
            <DxfCanvas
              ref={dxfCanvasRef}
              scene={dxfScene}
              transform={transform}
              viewport={viewport} // ✅ CENTRALIZED: Pass centralized viewport
              activeTool={activeTool} // 🔥 ΚΡΙΣΙΜΟ: Pass activeTool για pan cursor
              overlayMode={overlayMode} // 🎯 OVERLAY FIX: Pass overlayMode for drawing detection
              colorLayers={colorLayers} // ✅ FIX: Pass color layers για fit to view bounds
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
              data-canvas-type="dxf" // 🎯 DEBUG: Identifier για alignment test
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['10']}`} // 🎯 Z-INDEX FIX: DxfCanvas FOREGROUND (z-10) - ΠΑΝΩ από LayerCanvas!
              onCanvasClick={handleCanvasClick} // 🎯 FIX: Connect canvas clicks για drawing tools!
              onTransformChange={(newTransform) => {
                setTransform(newTransform); // ✅ SYNC: Κοινό transform state για DxfCanvas
                zoomSystem.setTransform(newTransform);
              }}
              onWheelZoom={zoomSystem.handleWheelZoom} // ✅ CONNECT ZOOM SYSTEM
              onMouseMove={(screenPos, worldPos) => {
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
            defaultOptions={{
              color: '#00FF00', // Green preview (AutoCAD standard)
              lineWidth: 1,
              opacity: 0.9,
              showGrips: true,
              gripSize: 6,
              gripColor: '#00FF00',
            }}
          />

          {/* ✅ ADR-008: CrosshairOverlay - INTERNAL mouse tracking for pixel-perfect alignment */}
          {/* 🏢 CAD-GRADE: CrosshairOverlay tracks mouse position internally AND gets size from layout */}
          <CrosshairOverlay
            isActive={crosshairSettings.enabled}
            // ✅ ADR-008: REMOVED viewport prop - canvas gets actual size from layout via ResizeObserver
            rulerMargins={{
              left: rulerSettings.width ?? 30,
              top: 0,
              bottom: 0
            }}
            className={`absolute ${PANEL_LAYOUT.POSITION.LEFT_0} ${PANEL_LAYOUT.POSITION.RIGHT_0} ${PANEL_LAYOUT.POSITION.TOP_0} ${PANEL_LAYOUT.Z_INDEX['20']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            style={{ height: `calc(100% - ${rulerSettings.height ?? 30}px)` }}
          />

          {/* 🎯 SNAP INDICATOR: Visual feedback for snap points (AutoCAD/MicroStation style)
              @see docs/features/snapping/SNAP_INDICATOR_LINE.md - Βήμα 5: Κλικ και δημιουργία νέας γραμμής */}
          <SnapIndicatorOverlay
            snapResult={currentSnapResult ? {
              point: currentSnapResult.snappedPoint,
              type: currentSnapResult.activeMode || 'endpoint'
            } : null}
            viewport={viewport}
            canvasRect={dxfCanvasRef.current?.getCanvas?.()?.getBoundingClientRect() ?? null}
            transform={transform}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['30']}`}
          />

          {/* ✅ ADR-009: RulerCornerBox - Interactive corner box at ruler intersection */}
          {/* 🏢 CAD-GRADE: Industry standard (AutoCAD/Revit/Blender) corner box with zoom controls */}
          <RulerCornerBox
            rulerWidth={rulerSettings.width ?? 30}
            rulerHeight={rulerSettings.height ?? 30}
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
                console.warn('🚨 [ZoomToFit] Invalid bounds or viewport!', { combinedBounds, viewport });
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
        </div>
      </div>


      {/* Right Sidebar - MOVED TO DxfViewerContent */}
    </>
  );
};
