'use client';
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
// === CANVAS V2 IMPORTS ===
import { DxfCanvas, LayerCanvas, type DxfScene, type DxfEntityUnion } from '../../canvas-v2';
import { createCombinedBounds } from '../../systems/zoom/utils/bounds';
// ✅ CURSOR SETTINGS: Import από κεντρικό system αντί για duplicate
import { useCanvasContext } from '../../contexts/CanvasContext';
import { useDrawingHandlers } from '../../hooks/drawing/useDrawingHandlers';
import { UI_COLORS } from '../../config/color-config';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault } from '../../config/layer-config';
// 🏢 ADR-142: Centralized Default Font Size
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
// CanvasProvider removed - not needed for Canvas V2
// OverlayCanvas import removed - it was dead code
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLevels } from '../../systems/levels';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
// 🏢 ADR-127: Centralized Ruler Dimensions
import { RULERS_GRID_CONFIG } from '../../systems/rulers-grid/config';
import { useCursorSettings, useCursorActions } from '../../systems/cursor';
// 🏢 ENTERPRISE (2026-01-25): Immediate position store για zero-latency crosshair
import { globalRulerStore } from '../../settings-provider';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind, Overlay } from '../../overlays/types';
import { createOverlayHandlers } from '../../overlays/types';
import { squaredDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ENTERPRISE (2026-01-31): Import pointToLineDistance for Circle TTT hit testing
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-079: Centralized Movement Detection Constants
// 🏢 ADR-099: Centralized Polygon Tolerances
// 🏢 ADR-147: Centralized Hit Tolerance for Entity Picking
import { MOVEMENT_DETECTION, POLYGON_TOLERANCES, TOLERANCE_CONFIG } from '../../config/tolerance-config';
// 🏢 ENTERPRISE (2026-01-25): Edge detection for polygon vertex insertion
import { findOverlayEdgeForGrip } from '../../utils/entity-conversion';
// 🔧 FIX (2026-02-13): Point-in-polygon hit-test for move tool overlay detection
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
// 🏢 ENTERPRISE (2026-01-25): Centralized Grip Settings via Provider (CANONICAL - SINGLE SOURCE OF TRUTH)
import { useGripStyles } from '../../settings-provider';
// 🏢 ENTERPRISE (2026-01-26): ADR-036 - Centralized tool detection (Single Source of Truth)
import { isDrawingTool, isMeasurementTool, isInteractiveTool, isInDrawingMode } from '../../systems/tools/ToolStateManager';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ADR-102: Centralized Entity Type Guards
import {
  isLineEntity, isPolylineEntity, isCircleEntity, isArcEntity,
  isRectangleEntity, isRectEntity, isLWPolylineEntity,
  type Entity
} from '../../types/entities';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { useZoom } from '../../systems/zoom';
import {
  CoordinateTransforms,
  COORDINATE_LAYOUT,
  getPointerSnapshotFromElement
} from '../../rendering/core/CoordinateTransforms';
// ✅ ENTERPRISE MIGRATION: Using ServiceRegistry
import { serviceRegistry } from '../../services';
// 🏢 ENTERPRISE (2026-01-30): canvasBoundsService kept ONLY for ResizeObserver cache clearing
// NOT used for coordinate transforms - using getPointerSnapshotFromElement instead
import { canvasBoundsService } from '../../services/CanvasBoundsService';
import { dlog } from '../../debug';
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
  DeleteOverlayCommand,
  DeleteMultipleOverlaysCommand,
  DeleteOverlayVertexCommand,
  DeleteMultipleOverlayVerticesCommand
} from '../../core/commands';
// 🏢 ADR-101: Centralized deep clone utility
import { deepClone } from '../../utils/clone-utils';
// 🏢 ENTERPRISE (2026-01-31): Centralized canvas settings construction - ADR-XXX
// 🏢 ENTERPRISE (2026-01-31): Centralized mouse event handling - ADR-XXX
import { useCanvasSettings, useCanvasMouse } from '../../hooks/canvas';
// 🏢 ENTERPRISE (2026-01-31): Centralized overlay to ColorLayer conversion - ADR-XXX
import { useOverlayLayers } from '../../hooks/layers';
// 🏢 ENTERPRISE (2026-01-31): Centralized special tools management - ADR-XXX
import { useSpecialTools } from '../../hooks/tools';
// 🏢 ENTERPRISE (2026-01-31): Centralized grip system state management - ADR-XXX
import { useGripSystem } from '../../hooks/grips';
// 🏢 ADR-119: UnifiedFrameScheduler for centralized RAF management
import { UnifiedFrameScheduler } from '../../rendering/core/UnifiedFrameScheduler';
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
    console.warn('[CanvasSection] ⚠️ ARCHITECTURE WARNING: CanvasProvider not found. Zoom buttons and centralized canvas operations may not work correctly.');
  }

  // 🏢 ENTERPRISE (2026-01-27): ALWAYS use context ref - NO fallback!
  // ADR: Imperative API = Source of Truth
  // The ref MUST be stable across renders to maintain the imperative handle
  const dxfCanvasRef = canvasContext?.dxfRef;

  if (!dxfCanvasRef) {
    console.error('[CanvasSection] 🚨 CRITICAL: CanvasContext.dxfRef is null! Zoom buttons will not work!');
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
    console.error('[CanvasSection] setTransform called but CanvasContext not available');
  });

  // ✅ CENTRALIZED VIEWPORT: Single source of truth για viewport dimensions
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // 🏢 ENTERPRISE (2026-01-30): SSoT Viewport Ref - ZERO React lag
  // PROBLEM: useState viewport updates ASYNC (React batches) → stale on resize
  // SOLUTION: viewportRef updates SYNCHRONOUSLY in ResizeObserver
  // CANONICAL ELEMENT: containerRef (wrapper that contains all canvases)
  const viewportRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // 🏢 ENTERPRISE FIX (2026-02-01): Transform ref for fresh access in ResizeObserver callback
  // PROBLEM: When viewport height changes (toolbar open/close), offsetY must be adjusted
  //          to keep world origin at same screen position
  // SOLUTION: Keep transform ref in sync, adjust offsetY by deltaHeight in ResizeObserver
  const transformRef = useRef(transform);

  // 🏢 ENTERPRISE FIX (2026-02-01): Wrapper setTransform that updates ref SYNCHRONOUSLY
  // PROBLEM: Pan/zoom call setTransform (async React state), but canvas uses transformRef (sync)
  //          This causes origin markers to be out of sync during pan operations
  // SOLUTION: Update transformRef.current IMMEDIATELY, then call context setTransform
  const setTransform = useCallback((newTransform: typeof transform) => {
    // 🎯 CRITICAL: Update ref SYNCHRONOUSLY (no React batching)
    transformRef.current = newTransform;
    // React state update for context (async)
    contextSetTransform(newTransform);
  }, [contextSetTransform]);

  // 🏢 ENTERPRISE FIX (2026-01-27): Viewport readiness check για coordinate transforms
  // Αποτρέπει λανθασμένες μετατροπές coordinates ΠΡΙΝ το viewport αρχικοποιηθεί σωστά
  // PROBLEM: Την πρώτη φορά μετά από server restart, το viewport είναι {0,0}
  //          και η screenToWorld επιστρέφει λάθος τιμές (π.χ. Y-offset ~80px)
  // SOLUTION: Το viewportReady flag αποκλείει τα clicks μέχρι το viewport να είναι valid
  const viewportReady = viewport.width > 0 && viewport.height > 0;

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
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  // 🏢 ENTERPRISE (2026-01-31): Mouse position state moved to useCanvasMouse hook
  // mouseCss, mouseWorld, lastMouseCssRef, lastMouseWorldRef, updateMouseCss, updateMouseWorld
  // are now provided by the hook (see line ~520)

  // 🎯 Canvas visibility από parent props (με fallback στα defaults)
  const showDxfCanvas = props.dxfCanvasVisible ?? true;
  const showLayerCanvasDebug = props.layerCanvasVisible ?? true;

  // 🏢 ENTERPRISE (2026-01-27): Only log ERRORS for critical state issues
  if (!showDxfCanvas) {
    console.error('[CanvasSection] 🚨 CRITICAL: DxfCanvas is HIDDEN! showDxfCanvas =', showDxfCanvas, '- Zoom buttons will NOT work!');
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
  // 🏢 FIX (2026-02-01): Keep transform ref in sync for ResizeObserver callback
  transformRef.current = transform;
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
  // 🏢 ADR-047: Drawing context menu state (AutoCAD-style right-click menu)
  const [drawingContextMenu, setDrawingContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });
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
  // 🔧 FIX (2026-01-24): Flag to track if we're in the process of saving
  const [isSavingPolygon, setIsSavingPolygon] = useState(false);
  // 🏢 ENTERPRISE (2026-02-13): Selected drawn entity IDs for DxfCanvas highlight rendering
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  // 🏢 ENTERPRISE (2026-02-14): AutoCAD-style hover highlighting
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  // 🏢 ENTERPRISE (2026-02-15): Overlay hover highlighting (unified pipeline)
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);
  // 🎯 EVENT BUS: For polygon drawing communication with toolbar
  const eventBus = useEventBus();

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
  // NOTE: canvasContext already retrieved at line 93 for centralized zoom operations
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
  // ✅ CENTRALIZED VIEWPORT: Update viewport από CONTAINER dimensions
  // 🏢 ENTERPRISE (2026-01-30): CANONICAL ELEMENT = container (SSoT)
  // PROBLEM: Canvas vs container mixing caused drift on DevTools toggle
  // SOLUTION: Use CONTAINER as single source of truth for ALL viewport calculations
  React.useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    const updateViewport = () => {
      // 🎯 CANONICAL ELEMENT: containerRef (wrapper that contains all canvases)
      const container = containerRef.current;

      if (container) {
        const rect = container.getBoundingClientRect();
        // Only update if dimensions are valid (not 0x0)
        if (rect.width > 0 && rect.height > 0) {
          const newViewport = { width: rect.width, height: rect.height };
          // 🎯 CRITICAL: Update ref SYNCHRONOUSLY (no React batching)
          viewportRef.current = newViewport;
          // React state update for dependencies
          setViewport(newViewport);
          // 🏢 PDF BACKGROUND: Sync viewport to PDF store for fit-to-view
          setPdfViewport(newViewport);
        }
      }
    };

    // 🏢 ENTERPRISE: ResizeObserver on CONTAINER (canonical element)
    const setupObserver = () => {
      const container = containerRef.current;

      if (container) {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              // 🏢 FIX (2026-02-01): Adjust transform.offsetY when viewport height changes
              // PROBLEM: When toolbar opens/closes, viewport height changes but offsetY stays same
              //          This causes world origin to shift on screen (origin markers misalign)
              // SOLUTION: Adjust offsetY by deltaHeight to keep world origin at same screen position
              // FORMULA: newOffsetY = oldOffsetY + (newHeight - oldHeight)
              const oldHeight = viewportRef.current.height;
              const deltaHeight = height - oldHeight;

              // Only adjust if we have a valid previous height (not initial load)
              if (oldHeight > 0 && Math.abs(deltaHeight) > 0.5) {
                const currentTransform = transformRef.current;
                const newOffsetY = currentTransform.offsetY + deltaHeight;
                const newTransform = {
                  ...currentTransform,
                  offsetY: newOffsetY
                };

                // 🔍 DEBUG: Detailed logging to understand the issue
                const timestamp = performance.now().toFixed(0);
                dlog('Canvas', `[${timestamp}ms][ResizeObserver] ADJUSTING:
  oldHeight=${oldHeight.toFixed(1)}, newHeight=${height.toFixed(1)}, deltaHeight=${deltaHeight.toFixed(1)}
  oldOffsetY=${currentTransform.offsetY.toFixed(1)}, newOffsetY=${newOffsetY.toFixed(1)}
  transformRef.current.offsetY BEFORE=${transformRef.current.offsetY.toFixed(1)}`);

                // 🏢 FIX (2026-02-01): Update transformRef SYNCHRONOUSLY before viewport update
                // PROBLEM: setTransform is async (React batches), but viewportRef is sync
                //          Canvas re-renders with new viewport but OLD transform → misaligned markers
                // SOLUTION: Update transformRef FIRST (sync), then setTransform (async for React)
                transformRef.current = newTransform;

                // React state update for dependencies (async)
                setTransform(newTransform);

                dlog('Canvas', `[${timestamp}ms][ResizeObserver] AFTER: transformRef.current.offsetY=${transformRef.current.offsetY.toFixed(1)}`);
              } else {
                dlog('Canvas', `[ResizeObserver] SKIP adjust: oldHeight=${oldHeight.toFixed(1)}, deltaHeight=${deltaHeight.toFixed(1)}`);
              }

              const newViewport = { width, height };
              // 🎯 CRITICAL: Update ref SYNCHRONOUSLY (no React batching)
              viewportRef.current = newViewport;
              // React state update for dependencies
              setViewport(newViewport);
              // 🏢 PDF BACKGROUND: Sync viewport to PDF store for fit-to-view
              setPdfViewport(newViewport);
              // 🏢 FIX (2026-01-30): Clear canvasBoundsService cache on resize
              canvasBoundsService.clearCache();
            }
          }
        });
        resizeObserver.observe(container);

        // Initial update
        updateViewport();
      }
    };

    // 🏢 ENTERPRISE: Retry mechanism for container mount timing
    let retryCount = 0;
    const maxRetries = 10;

    const trySetupObserver = () => {
      const container = containerRef.current;

      if (container) {
        setupObserver();
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(trySetupObserver, PANEL_LAYOUT.TIMING.OBSERVER_RETRY);
      } else {
        console.warn('⚠️ [Viewport] Container not available after', maxRetries, 'retries');
      }
    };

    // Initial setup with delay to ensure container is mounted
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

  // 🏢 ENTERPRISE FIX (2026-02-01): Force viewport update after browser layout stabilization
  // PROBLEM: getBoundingClientRect() επιστρέφει stale values την πρώτη φορά μετά από server restart
  //          γιατί ο browser δεν έχει ακόμα ολοκληρώσει το layout calculation
  // SOLUTION: Χρησιμοποιούμε requestAnimationFrame + setTimeout για να περιμένουμε
  //           1. RAF: Περιμένει το επόμενο paint frame
  //           2. setTimeout: Δίνει χρόνο στον browser να κάνει reflow
  // RESULT: Το viewport έχει σωστές dimensions ΠΡΙΝ ο χρήστης κάνει click
  // 🏢 ADR-119: Migrated to UnifiedFrameScheduler.scheduleOnceDelayed for centralized RAF management
  // 🏢 FIX (2026-02-01): SSoT - Use containerRef (same as ResizeObserver) instead of dxfCanvas
  //                      Also update viewportRef.current for consistency with main mechanism
  React.useEffect(() => {
    const forceViewportUpdate = () => {
      // 🏢 SSoT: Use containerRef (canonical element) - SAME as ResizeObserver mechanism
      // BEFORE: Used dxfCanvas which caused inconsistency with container-based ResizeObserver
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const newViewport = { width: rect.width, height: rect.height };
          // 🏢 SSoT: Update BOTH ref AND state (same as ResizeObserver)
          viewportRef.current = newViewport;
          setViewport(newViewport);
          setPdfViewport(newViewport);
        }
      }
    };

    // 🏢 ADR-119: Use UnifiedFrameScheduler for centralized RAF coordination
    // Pattern: RAF → setTimeout → RAF ensures layout is stable before measurement
    const cancelScheduled = UnifiedFrameScheduler.scheduleOnceDelayed(
      'canvas-section-viewport-layout',
      forceViewportUpdate,
      PANEL_LAYOUT.TIMING.VIEWPORT_LAYOUT_STABILIZATION
    );

    return cancelScheduled;
  }, []); // Empty deps - run once on mount

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
  const containerRef = useRef<HTMLDivElement>(null);

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

  // 🏢 ENTERPRISE (2026-01-25): Clear draft polygon when switching to select tool
  // Αποτρέπει το bug όπου η διαδικασία σχεδίασης συνεχίζεται μετά την αλλαγή tool
  // 🔧 FIX (2026-02-13): Exclude overlayMode='draw' — in draw mode activeTool stays 'select'
  // but the draft polygon must NOT be cleared while the user is actively drawing
  React.useEffect(() => {
    if (activeTool === 'select' && overlayMode !== 'draw' && draftPolygon.length > 0) {
      setDraftPolygon([]);
    }
  }, [activeTool, draftPolygon.length, overlayMode]);

  // 🏢 ENTERPRISE (2026-02-01): Clear preview canvas when switching to non-drawing tool
  // FIX: Green grip ball (start point indicator) stayed visible after switching to Select tool
  // The preview canvas is independent and must be explicitly cleared when leaving drawing mode
  React.useEffect(() => {
    if (!isInDrawingMode(activeTool, overlayMode)) {
      previewCanvasRef.current?.clear();
    }
  }, [activeTool, overlayMode]);

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
  });

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

  // === 🏢 ADR-053: DRAWING CONTEXT MENU HANDLER ===
  // AutoCAD-style right-click context menu during drawing operations
  // NOTE: This React handler is kept as FALLBACK - main handler is native DOM listener below
  const handleDrawingContextMenu = useCallback((e: React.MouseEvent) => {
    // 🏢 CRITICAL: ALWAYS prevent browser context menu on canvas
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrawingContextMenuClose = useCallback((open: boolean) => {
    if (!open) {
      setDrawingContextMenu(prev => ({ ...prev, isOpen: false }));
    }
  }, []);

  const handleDrawingFinish = useCallback(() => {
    if (drawingHandlersRef.current?.onDrawingDoubleClick) {
      drawingHandlersRef.current.onDrawingDoubleClick();
    }
  }, []);

  const handleDrawingClose = useCallback(() => {
    // For polygon tools, close means finish with closing (same as finish)
    if (drawingHandlersRef.current?.onDrawingDoubleClick) {
      drawingHandlersRef.current.onDrawingDoubleClick();
    }
  }, []);

  // 🏢 ADR-053: Cancel handler using ref pattern (avoids stale closure)
  const handleDrawingCancel = useCallback(() => {
    if (drawingHandlersRef.current?.onDrawingCancel) {
      drawingHandlersRef.current.onDrawingCancel();
    }
  }, []);

  // 🏢 ADR-053: Undo last point handler using ref pattern (avoids stale closure)
  const handleDrawingUndoLastPoint = useCallback(() => {
    if (drawingHandlersRef.current?.onUndoLastPoint) {
      drawingHandlersRef.current.onUndoLastPoint();
    }
  }, []);

  // 🏢 ENTERPRISE (2026-01-31): Flip arc direction handler using ref pattern
  const handleFlipArc = useCallback(() => {
    if (drawingHandlersRef.current?.onFlipArc) {
      drawingHandlersRef.current.onFlipArc();
    }
  }, []);

  // === CONVERT SCENE TO CANVAS V2 FORMAT ===
  // 🔍 DEBUG (2026-01-31): Log props.currentScene for circle debugging
  console.log('📋 [CanvasSection] props.currentScene', {
    hasScene: !!props.currentScene,
    entityCount: props.currentScene?.entities?.length || 0,
    entityTypes: props.currentScene?.entities?.map(e => e.type) || []
  });

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
          // ADR-130: Centralized default layer
          layer: getLayerNameOrDefault(entity.layer),
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
            // Type guard: Entity με type 'arc' έχει center, radius, startAngle, endAngle, counterclockwise
            // 🔧 FIX (2026-01-31): Προσθήκη counterclockwise για σωστή κατεύθυνση τόξου
            const arcEntity = entity as typeof entity & { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise?: boolean };
            return { ...base, type: 'arc' as const, center: arcEntity.center, radius: arcEntity.radius, startAngle: arcEntity.startAngle, endAngle: arcEntity.endAngle, counterclockwise: arcEntity.counterclockwise } as DxfEntityUnion;
          }
          case 'text': {
            // ╔════════════════════════════════════════════════════════════════════╗
            // ║ ⚠️ VERIFIED WORKING (2026-01-03) - ΜΗΝ ΑΛΛΑΞΕΤΕ!                   ║
            // ║ height || fontSize || DEFAULT_FONT_SIZE είναι η ΣΩΣΤΗ σειρά       ║
            // ║ ΜΗΝ αλλάξετε σε fontSize || height - ΧΑΛΑΕΙ τα κείμενα!           ║
            // ║ 🏢 ADR-142: Use centralized DEFAULT_FONT_SIZE for fallback        ║
            // ╚════════════════════════════════════════════════════════════════════╝
            const textEntity = entity as typeof entity & { position: Point2D; text: string; fontSize?: number; height?: number; rotation?: number };
            const textHeight = textEntity.height || textEntity.fontSize || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE;
            return { ...base, type: 'text' as const, position: textEntity.position, text: textEntity.text, height: textHeight, rotation: textEntity.rotation } as DxfEntityUnion;
          }
          case 'angle-measurement': {
            // 🏢 ENTERPRISE (2026-01-27): Angle measurement entity support
            // Type guard: Entity με type 'angle-measurement' έχει vertex, point1, point2, angle
            const angleMeasurementEntity = entity as typeof entity & { vertex: Point2D; point1: Point2D; point2: Point2D; angle: number };
            return { ...base, type: 'angle-measurement' as const, vertex: angleMeasurementEntity.vertex, point1: angleMeasurementEntity.point1, point2: angleMeasurementEntity.point2, angle: angleMeasurementEntity.angle } as DxfEntityUnion;
          }
          case 'rectangle': {
            // 🏢 ENTERPRISE (2026-01-30): Rectangle support - convert to closed polyline
            // Pattern: DXF Standard - rectangles are stored as closed polylines (4 vertices)
            // Type guard: Entity με type 'rectangle' έχει corner1 & corner2
            const rectEntity = entity as typeof entity & { corner1: Point2D; corner2: Point2D };
            const { corner1, corner2 } = rectEntity;
            // Convert corners to 4 vertices (clockwise from corner1)
            const vertices: Point2D[] = [
              corner1,                           // Bottom-left
              { x: corner2.x, y: corner1.y },    // Bottom-right
              corner2,                           // Top-right
              { x: corner1.x, y: corner2.y },    // Top-left
            ];
            return { ...base, type: 'polyline' as const, vertices, closed: true } as DxfEntityUnion;
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
        const canvas = dxfCanvasRef?.current || overlayCanvasRef.current;
        if (canvas && canvas instanceof HTMLCanvasElement) {
          // ✅ ENTERPRISE MIGRATION: Get service from registry
          const canvasBounds = serviceRegistry.get('canvas-bounds');
          const rect = canvasBounds.getBounds(canvas);
          const viewport = { width: rect.width, height: rect.height };

          // Use professional zoom system for fit-to-view with actual viewport
          // 🎯 ENTERPRISE: preserve original origin (allow negative coordinates)
          zoomSystem.zoomToFit(dxfScene.bounds, viewport, false);
        } else {
          // Fallback to container dimensions if canvas not ready
          const container = document.querySelector('.relative.w-full.h-full.overflow-hidden');
          if (container) {
            // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CanvasBoundsService (works with any element)
            const rect = container.getBoundingClientRect();
            // 🎯 ENTERPRISE: preserve original origin (allow negative coordinates)
            zoomSystem.zoomToFit(dxfScene.bounds, { width: rect.width, height: rect.height }, false);
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
    // 🏢 ENTERPRISE (2026-01-30): CANONICAL ELEMENT = containerRef (SSoT)
    // All viewport calculations use container for consistency
    const container = containerRef.current;
    const snap = getPointerSnapshotFromElement(container);
    if (!snap) {
      console.warn('[CanvasSection] fitViewToBounds: Cannot fit - viewport not ready');
      return; // 🏢 Fail-fast: Cannot fit without valid viewport
    }
    const result = fitToView.calculateFitToViewFromBounds(bounds, snap.viewport, { padding: 0.1 });

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

  const handleCanvasClick = (worldPoint: Point2D) => {
    // 🏢 ADR-046: ENTERPRISE FIX - onCanvasClick now receives WORLD coordinates directly!
    //
    // PROBLEM (ROOT CAUSE - 2026-01-27):
    //   - handleMouseUp (in useCentralizedMouseHandlers) used LayerCanvas for world→screen conversion
    //   - handleCanvasClick used DxfCanvas for screen→world conversion
    //   - These are TWO DIFFERENT canvas elements with potentially different dimensions!
    //   - Double conversion with mismatched viewports caused ~80px X-axis offset on first use
    //   - Opening DevTools triggered resize which synced both canvas dimensions, masking the bug
    //
    // SOLUTION (ENTERPRISE - Autodesk/Bentley pattern):
    //   - handleMouseUp now passes WORLD coordinates directly (single conversion at source)
    //   - handleCanvasClick receives WORLD coordinates - no conversion needed!
    //   - Pattern: Single coordinate transform per operation (CAD industry standard)
    //
    // NOTE: The `worldPoint` parameter is already in WORLD coordinate system!

    // 🏢 ADR-045: Block interactions until viewport is ready
    // This guard is still useful to prevent early initialization issues
    if (!viewportReady) {
      console.warn('🚫 [CanvasSection] Click blocked: viewport not ready', viewport);
      return;
    }

    // 🏢 ENTERPRISE (2026-01-31): Circle TTT entity picking mode
    // When circle-ttt tool is active, perform hit testing to find clicked entity
    if (activeTool === 'circle-ttt' && circleTTT.isWaitingForSelection) {
      // Get current scene for hit testing
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;

      if (scene?.entities) {
        // Find entity at click point (check lines and polylines only)
        // 🏢 ADR-147: Use centralized SNAP_DEFAULT tolerance for entity picking
        const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale; // screen pixels in world units

        for (const entity of scene.entities) {
          // 🏢 ADR-102: Use centralized type guards
          const e = entity as unknown as Entity;
          if (isLineEntity(e) || isPolylineEntity(e)) {
            // Simple distance check for hit testing
            let isHit = false;

            if (isLineEntity(e)) {
              const lineEntity = entity as { start: Point2D; end: Point2D };
              const dist = pointToLineDistance(worldPoint, lineEntity.start, lineEntity.end);
              isHit = dist <= hitTolerance;
            } else if (isPolylineEntity(e)) {
              const polyEntity = entity as { vertices: Point2D[]; closed?: boolean };
              if (polyEntity.vertices && polyEntity.vertices.length >= 2) {
                for (let i = 0; i < polyEntity.vertices.length - 1; i++) {
                  const dist = pointToLineDistance(
                    worldPoint,
                    polyEntity.vertices[i],
                    polyEntity.vertices[i + 1]
                  );
                  if (dist <= hitTolerance) {
                    isHit = true;
                    break;
                  }
                }
                // Check closing segment for closed polylines
                if (!isHit && polyEntity.closed && polyEntity.vertices.length > 2) {
                  const dist = pointToLineDistance(
                    worldPoint,
                    polyEntity.vertices[polyEntity.vertices.length - 1],
                    polyEntity.vertices[0]
                  );
                  isHit = dist <= hitTolerance;
                }
              }
            }

            if (isHit) {
              // Pass entity to Circle TTT handler
              const accepted = circleTTT.onEntityClick(entity as import('../../types/scene').AnySceneEntity, worldPoint);
              if (accepted) {
                console.log('🎯 [CanvasSection] Circle TTT entity accepted:', entity.id);
                return; // Entity was accepted, don't process further
              }
            }
          }
        }

        // No entity hit - show feedback
        console.log('🎯 [CanvasSection] Circle TTT: No line/polyline found at click point');
      }
      return; // Don't process as regular canvas click
    }

    // 🏢 ENTERPRISE (2026-01-31): Line Perpendicular entity picking mode - ADR-060
    // Step 0: Select reference line, Step 1: Click through point
    if (activeTool === 'line-perpendicular' && linePerpendicular.isActive) {
      if (linePerpendicular.currentStep === 0) {
        // Step 0: Entity selection mode - find clicked line
        const scene = levelManager.currentLevelId
          ? levelManager.getLevelScene(levelManager.currentLevelId)
          : null;

        if (scene?.entities) {
          // 🏢 ADR-147: Use centralized SNAP_DEFAULT tolerance for entity picking
          const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;

          for (const entity of scene.entities) {
            // 🏢 ADR-102: Use centralized type guard
            if (isLineEntity(entity as unknown as Entity)) {
              const lineEntity = entity as { start: Point2D; end: Point2D };
              const dist = pointToLineDistance(worldPoint, lineEntity.start, lineEntity.end);
              if (dist <= hitTolerance) {
                // Pass entity as AnySceneEntity - the hook will extract start/end internally
                const accepted = linePerpendicular.onEntityClick(
                  entity as import('../../types/scene').AnySceneEntity,
                  worldPoint
                );
                if (accepted) {
                  console.log('🎯 [CanvasSection] LinePerpendicular entity accepted:', entity.id);
                  return;
                }
              }
            }
          }
          console.log('🎯 [CanvasSection] LinePerpendicular: No line found at click point');
        }
        return;
      } else if (linePerpendicular.currentStep === 1) {
        // Step 1: Point selection mode - pass click point to hook
        linePerpendicular.onCanvasClick(worldPoint);
        return;
      }
    }

    // 🏢 ENTERPRISE (2026-01-31): Line Parallel entity picking mode - ADR-060
    // Step 0: Select reference line, Step 1: Click offset point
    if (activeTool === 'line-parallel' && lineParallel.isActive) {
      if (lineParallel.currentStep === 0) {
        // Step 0: Entity selection mode - find clicked line
        const scene = levelManager.currentLevelId
          ? levelManager.getLevelScene(levelManager.currentLevelId)
          : null;

        if (scene?.entities) {
          // 🏢 ADR-147: Use centralized SNAP_DEFAULT tolerance for entity picking
          const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;

          for (const entity of scene.entities) {
            // 🏢 ADR-102: Use centralized type guard
            if (isLineEntity(entity as unknown as Entity)) {
              const lineEntity = entity as { start: Point2D; end: Point2D };
              const dist = pointToLineDistance(worldPoint, lineEntity.start, lineEntity.end);
              if (dist <= hitTolerance) {
                // Pass entity as AnySceneEntity - the hook will extract start/end internally
                const accepted = lineParallel.onEntityClick(
                  entity as import('../../types/scene').AnySceneEntity,
                  worldPoint
                );
                if (accepted) {
                  console.log('🎯 [CanvasSection] LineParallel entity accepted:', entity.id);
                  return;
                }
              }
            }
          }
          console.log('🎯 [CanvasSection] LineParallel: No line found at click point');
        }
        return;
      } else if (lineParallel.currentStep === 1) {
        // Step 1: Point selection mode - pass click point to hook
        lineParallel.onCanvasClick(worldPoint);
        return;
      }
    }

    // ✅ OVERLAY MODE: Use overlay system with draftPolygon (takes priority over unified drawing)
    // ⚠️ NOTE: This MUST come BEFORE the unified drawing check below,
    // because overlay mode uses its own polygon state (draftPolygon), not the unified engine.
    // 🔧 FIX (2026-02-13): Removed `activeTool !== 'select'` guard — when overlay draw mode
    // is activated via OverlayModeButtons, only overlayMode changes; activeTool stays 'select'.
    if (overlayMode === 'draw') {
      if (isSavingPolygon) return;

      // 🏢 ADR-046: worldPoint is already in WORLD coordinates - use directly!
      const worldPointArray: [number, number] = [worldPoint.x, worldPoint.y];

      // 🎯 SIMPLIFIED (2026-01-24): Just add points - user saves with toolbar button
      setDraftPolygon(prev => [...prev, worldPointArray]);
      return;
    }

    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Route click to unified drawing system for drawing AND measurement tools
    // 🏢 ENTERPRISE (2026-01-26): ADR-036 - Using centralized tool detection (Single Source of Truth)
    if (isInteractiveTool(activeTool) && drawingHandlersRef.current) {
      // 🏢 ADR-046: worldPoint is already in WORLD coordinates - no conversion needed!
      drawingHandlersRef.current.onDrawingPoint(worldPoint);
      return;
    }

    // 🔧 FIX (2026-02-13): Move tool — hit-test overlays and start body drag
    // DxfCanvas (z-10) captures mouse events, but overlay hit-testing only exists in LayerCanvas.
    // Since LayerCanvas (z-0) never receives pointer events, we do the hit-test here.
    // 🔧 FIX (2026-02-13): Guard against re-initiating drag when already dragging.
    // Second click should be handled by handleContainerMouseUp (event bubbles to container).
    if (activeTool === 'move' && !draggingOverlayBody) {
      for (const overlay of currentOverlays) {
        if (!overlay.polygon || overlay.polygon.length < 3) continue;
        const vertices = overlay.polygon.map(([x, y]) => ({ x, y }));
        if (isPointInPolygon(worldPoint, vertices)) {
          handleOverlayClick(overlay.id, worldPoint);
          return;
        }
      }
    }

    // 🔧 FIX (2026-02-13): When move-dragging, second click ends drag via handleContainerMouseUp.
    // Skip deselection and all further processing to avoid interfering with the drag-end.
    if (activeTool === 'move' && draggingOverlayBody) {
      return;
    }

    // 🏢 ENTERPRISE (2026-02-13): Entity hit-test for Select tool — click to select drawn entities
    // Pattern: Same tolerance and hit-test approach as Circle-TTT (line 1092), extended to all entity types
    if (activeTool === 'select') {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;

      if (scene?.entities) {
        const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;
        let hitEntityId: string | null = null;

        for (const entity of scene.entities) {
          const e = entity as unknown as Entity;
          let isHit = false;

          if (isLineEntity(e)) {
            isHit = pointToLineDistance(worldPoint, e.start, e.end) <= hitTolerance;
          } else if (isPolylineEntity(e) || isLWPolylineEntity(e)) {
            const verts = (e as { vertices: Point2D[]; closed?: boolean }).vertices;
            if (verts && verts.length >= 2) {
              for (let i = 0; i < verts.length - 1; i++) {
                if (pointToLineDistance(worldPoint, verts[i], verts[i + 1]) <= hitTolerance) {
                  isHit = true;
                  break;
                }
              }
              if (!isHit && (e as { closed?: boolean }).closed && verts.length > 2) {
                isHit = pointToLineDistance(worldPoint, verts[verts.length - 1], verts[0]) <= hitTolerance;
              }
            }
          } else if (isCircleEntity(e)) {
            const dist = calculateDistance(worldPoint, e.center);
            isHit = Math.abs(dist - e.radius) <= hitTolerance;
          } else if (isArcEntity(e)) {
            const dist = calculateDistance(worldPoint, e.center);
            if (Math.abs(dist - e.radius) <= hitTolerance) {
              // Check if point is within arc angle range
              const angle = Math.atan2(worldPoint.y - e.center.y, worldPoint.x - e.center.x);
              const normalizedAngle = ((angle * 180 / Math.PI) % 360 + 360) % 360;
              const startDeg = ((e.startAngle % 360) + 360) % 360;
              const endDeg = ((e.endAngle % 360) + 360) % 360;
              if (startDeg <= endDeg) {
                isHit = normalizedAngle >= startDeg && normalizedAngle <= endDeg;
              } else {
                isHit = normalizedAngle >= startDeg || normalizedAngle <= endDeg;
              }
            }
          } else if (isRectangleEntity(e) || isRectEntity(e)) {
            const rect = e as { x: number; y: number; width: number; height: number };
            // Check proximity to rectangle edges (4 sides)
            const corners = [
              { x: rect.x, y: rect.y },
              { x: rect.x + rect.width, y: rect.y },
              { x: rect.x + rect.width, y: rect.y + rect.height },
              { x: rect.x, y: rect.y + rect.height },
            ];
            for (let i = 0; i < 4; i++) {
              if (pointToLineDistance(worldPoint, corners[i], corners[(i + 1) % 4]) <= hitTolerance) {
                isHit = true;
                break;
              }
            }
          }

          if (isHit) {
            hitEntityId = entity.id;
            break;
          }
        }

        if (hitEntityId) {
          setSelectedEntityIds([hitEntityId]);
          universalSelection.select(hitEntityId, 'dxf-entity');
          return;
        }
      }
    }

    // 🏢 ENTERPRISE (2026-01-25): Only deselect overlay if clicking on EMPTY canvas space
    // Do NOT deselect if:
    // - A grip is selected (user might be about to drag)
    // - User is hovering over a grip
    // - Click was on the overlay itself (handled by handleOverlayClick)
    // - Just finished a drag operation (prevent accidental deselection)
    {
      const isClickOnGrip = hoveredVertexInfo !== null || hoveredEdgeInfo !== null;
      const hasSelectedGrip = selectedGrip !== null;
      const justFinishedDrag = justFinishedDragRef.current;

      if (!isClickOnGrip && !hasSelectedGrip && !justFinishedDrag) {
        // 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030
        universalSelection.clearByType('overlay');
        universalSelection.clearByType('dxf-entity');
        setSelectedGrips([]); // Clear grip selection when clicking empty space
        setSelectedEntityIds([]); // Clear entity selection
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
        // 🏢 ENTERPRISE (2026-01-30): CANONICAL ELEMENT = containerRef (SSoT)
        // All viewport calculations use container for consistency
        const container = containerRef.current;
        const snap = getPointerSnapshotFromElement(container);
        if (!snap) {
          console.warn('[CanvasSection] handleFitToView: Cannot fit - viewport not ready');
          return; // 🏢 Fail-fast: Cannot fit without valid viewport
        }

        try {
          // 🎯 ENTERPRISE: preserve original origin (allow negative coordinates)
          const zoomResult = zoomSystem.zoomToFit(combinedBounds, snap.viewport, false);

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
          // 🏢 ENTERPRISE (2026-01-31): Handle Enter for continuous drawing tools - ADR-083
          // Check if we're in a continuous drawing mode (polyline, polygon, measure-area, circle-best-fit, etc.)
          const continuousTools = ['polyline', 'polygon', 'measure-area', 'measure-angle', 'measure-distance-continuous', 'circle-best-fit'];
          if (continuousTools.includes(activeTool)) {
            e.preventDefault();
            handleDrawingFinish();
          } else if (draftPolygon.length >= 3) {
            // Legacy: Overlay polygon mode
            finishDrawing();
          }
          break;
        // 🏢 ENTERPRISE (2026-01-31): "X" key for flip arc direction during arc drawing
        case 'x':
        case 'X':
          // Only flip if we're in arc drawing mode
          if (activeTool === 'arc-3p' || activeTool === 'arc-cse' || activeTool === 'arc-sce') {
            e.preventDefault();
            handleFlipArc();
          }
          break;
      }
    };

    // 🏢 ENTERPRISE: Use capture: true to handle Delete before other handlers
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [draftPolygon, finishDrawing, handleSmartDelete, selectedGrips, activeTool, handleFlipArc, handleDrawingFinish]);

  // 🏢 ADR-053 ENTERPRISE FIX (2026-01-30): Document-level contextmenu handler
  // Native DOM event listener is MORE RELIABLE than React's synthetic events on canvas
  // This is the pattern used by AutoCAD, Autodesk Viewer, BricsCAD for CAD context menus
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeContextMenu = (e: MouseEvent) => {
      // ALWAYS prevent browser context menu on canvas area
      e.preventDefault();
      e.stopPropagation();

      // Only show OUR context menu when in drawing mode with points
      const isDrawing = isDrawingTool(activeTool) || isMeasurementTool(activeTool);
      const hasPoints = (drawingHandlersRef.current?.drawingState?.tempPoints?.length ?? 0) > 0;

      if (isDrawing && hasPoints) {
        setDrawingContextMenu({
          isOpen: true,
          position: { x: e.clientX, y: e.clientY },
        });
      }
    };

    // Use capture: true to intercept BEFORE any other handler
    container.addEventListener('contextmenu', handleNativeContextMenu, { capture: true });

    return () => {
      container.removeEventListener('contextmenu', handleNativeContextMenu, { capture: true });
    };
  }, [activeTool]);

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
              onMouseMove={(screenPoint) => {
                // 🚀 PERFORMANCE (2026-01-27): ENTERPRISE OPTIMIZATION
                // Reduced unnecessary work in mousemove handler to achieve <16ms per frame

                // 🚀 EARLY RETURN: Skip all grip-related work if not in select/layering mode
                const isGripMode = activeTool === 'select' || activeTool === 'layering';

                // 🚀 THROTTLED: Mouse position updates (was causing re-renders on every move)
                const now = performance.now();
                const throttle = gripHoverThrottleRef.current;

                // 🚀 PERFORMANCE (2026-01-27): Increase throttle from 33ms to 100ms (10fps)
                // Grip hover detection doesn't need 30fps - 10fps is smooth enough for visual feedback.
                // IMPORTANT: Apply this throttle ONLY in grip modes; drawing tools need full-rate hover updates
                // for smooth preview rendering (line/rectangle/circle rubber-band feedback).
                const GRIP_HOVER_THROTTLE_MS = 100;
                const shouldThrottleGripWork =
                  isGripMode && (now - throttle.lastCheckTime < GRIP_HOVER_THROTTLE_MS);

                if (shouldThrottleGripWork) {
                  // 🚀 PERFORMANCE (2026-01-27): During drag, use RAF-throttled preview update
                  // Instead of setState on every mousemove, we use a ref + RAF for smooth animation
                  return; // Skip all other work until throttle period passes
                }

                if (isGripMode) {
                  throttle.lastCheckTime = now;
                }

                // Now do the throttled work
                updateMouseCss(screenPoint);
                // 🏢 ENTERPRISE (2026-01-30): CANONICAL ELEMENT = containerRef (SSoT)
                // All viewport calculations use container for consistency
                const container = containerRef.current;
                const snap = getPointerSnapshotFromElement(container);
                if (!snap) return; // 🏢 Fail-fast: Cannot transform without valid viewport
                const worldPoint = CoordinateTransforms.screenToWorld(screenPoint, transform, snap.viewport);
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
                        // 🏢 ADR-157: Use centralized squaredDistance (ADR-109)
                        const distSq = squaredDistance(worldPoint, { x: vertex[0], y: vertex[1] });
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
                // 🏢 ENTERPRISE (2027-01-27): Add overlay body drag support - Unified Toolbar Integration
                if (draggingVertex || draggingEdgeMidpoint || draggingOverlayBody) {
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
              transform={transform} // 🏢 FIX (2026-02-01): Use React state (reactive) for proper re-render
              viewport={viewport} // 🏢 FIX (2026-02-01): Use React state (reactive) - consistent with LayerCanvas
              activeTool={activeTool} // 🔥 ΚΡΙΣΙΜΟ: Pass activeTool για pan cursor
              overlayMode={overlayMode} // 🎯 OVERLAY FIX: Pass overlayMode for drawing detection
              colorLayers={colorLayers} // ✅ FIX: Pass color layers για fit to view bounds
              renderOptions={{ showGrid: false, showLayerNames: false, wireframeMode: false, selectedEntityIds, hoveredEntityId }} // 🏢 ENTERPRISE (2026-02-14): Entity selection + hover highlight
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
              onEntitiesSelected={setSelectedEntityIds}
              onHoverEntity={setHoveredEntityId}
              onHoverOverlay={setHoveredOverlayId}
              isGripDragging={draggingVertex !== null || draggingEdgeMidpoint !== null || hoveredVertexInfo !== null || hoveredEdgeInfo !== null}
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

          {/* 🏢 ADR-047: DrawingContextMenu - Right-click context menu during drawing */}
          <DrawingContextMenu
            isOpen={drawingContextMenu.isOpen}
            onOpenChange={handleDrawingContextMenuClose}
            position={drawingContextMenu.position}
            activeTool={activeTool}
            pointCount={drawingHandlers?.drawingState?.tempPoints?.length ?? 0}
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
