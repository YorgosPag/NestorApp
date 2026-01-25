'use client';
import React, { useRef, useState } from 'react';
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
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import { useZoom } from '../../systems/zoom';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// ✅ ENTERPRISE MIGRATION: Using ServiceRegistry
import { serviceRegistry } from '../../services';
// ✅ ADR-006 FIX: Import CrosshairOverlay για crosshair rendering
import CrosshairOverlay from '../../canvas-v2/overlays/CrosshairOverlay';
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

/**
 * Renders the main canvas area, including the renderer and floating panels.
 */
export const CanvasSection: React.FC<DXFViewerLayoutProps & { overlayMode: OverlayEditorMode, currentStatus: Status, currentKind: OverlayKind }> = (props) => {
  // ✅ FIX: Use DxfCanvasRef type για getCanvas() method access
  const dxfCanvasRef = useRef<DxfCanvasRef>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // === NEW ZOOM SYSTEM ===
  const initialTransform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  const [transform, setTransform] = useState<ViewTransform>(initialTransform);

  // ✅ CENTRALIZED VIEWPORT: Single source of truth για viewport dimensions
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const zoomSystem = useZoom({
    initialTransform,
    onTransformChange: (newTransform) => {
      setTransform(newTransform); // ✅ SYNC WITH STATE
    },
    // 🏢 ENTERPRISE: Inject viewport για accurate zoom-to-cursor
    viewport
  });
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const [mouseCss, setMouseCss] = useState<Point2D | null>(null);
  const [mouseWorld, setMouseWorld] = useState<Point2D | null>(null);

  // 🎯 Canvas visibility από parent props (με fallback στα defaults)
  const showDxfCanvas = props.dxfCanvasVisible ?? true;
  const showLayerCanvasDebug = props.layerCanvasVisible ?? true;


  const overlayStore = useOverlayStore();
  const levelManager = useLevels();
  const [draftPolygon, setDraftPolygon] = useState<Array<[number, number]>>([]);
  // 🔧 FIX (2026-01-24): Ref for fresh polygon access in async operations
  const draftPolygonRef = useRef<Array<[number, number]>>([]);
  // 🏢 ENTERPRISE (2026-01-25): State για edge midpoint hover detection
  const [hoveredEdgeInfo, setHoveredEdgeInfo] = useState<{ overlayId: string; edgeIndex: number } | null>(null);
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

  const {
    activeTool,
    showGrid,
    showLayers, // ✅ ΥΠΑΡΧΟΝ SYSTEM: Layer visibility απο useDxfViewerState
    overlayMode = 'select',
    currentStatus = 'for-sale',
    currentKind = 'unit',
    ...restProps
  } = props;

  // ✅ LAYER VISIBILITY: Show LayerCanvas controlled by debug toggle
  // 🔧 FIX (2026-01-24): ALWAYS show LayerCanvas when in draw/edit mode to ensure overlays are visible
  // Debug toggle only applies when in 'select' mode (not actively drawing/editing)
  const showLayerCanvas = showLayerCanvasDebug || overlayMode === 'draw' || overlayMode === 'edit';

  // 🏢 ENTERPRISE (2026-01-25): Clear draft polygon when switching to select tool
  // Αποτρέπει το bug όπου η διαδικασία σχεδίασης συνεχίζεται μετά την αλλαγή tool
  React.useEffect(() => {
    if (activeTool === 'select' && draftPolygon.length > 0) {
      console.log('🧹 Clearing draft polygon on tool change to select');
      setDraftPolygon([]);
    }
  }, [activeTool, draftPolygon.length]);

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

  // Get overlays for current level
  const currentOverlays = levelManager.currentLevelId
    ? overlayStore.getByLevel(levelManager.currentLevelId)
    : [];

  const selectedOverlay = overlayStore.getSelectedOverlay();


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
        const isSelected = overlay.id === overlayStore.selectedOverlayId;
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
          hoveredEdgeIndex: hoveredEdgeInfo?.overlayId === overlay.id ? hoveredEdgeInfo.edgeIndex : undefined,
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
    props.currentScene ?? undefined // ✅ Convert null to undefined for type compatibility
  );

  // === 🎯 DRAWING HANDLERS REF ===
  // Χρήση ref pattern για να αποφύγουμε infinite loops (Bug #1 fix)
  const drawingHandlersRef = React.useRef(drawingHandlers);
  React.useEffect(() => {
    drawingHandlersRef.current = drawingHandlers;
  }, [drawingHandlers]);

  // === 🚀 AUTO-START DRAWING ===
  // Όταν επιλέγεται drawing tool, ξεκινά αυτόματα το drawing mode
  React.useEffect(() => {
    const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' ||
                          activeTool === 'polygon' || activeTool === 'circle' ||
                          activeTool === 'rectangle'; // ✅ Removed 'arc' - not in ToolType union
    if (isDrawingTool && drawingHandlersRef.current?.startDrawing) {
      // 🎯 TYPE-SAFE: activeTool is already narrowed to drawing tools by if statement
      drawingHandlersRef.current.startDrawing(activeTool);
    }
  }, [activeTool]);

  // === CONVERT SCENE TO CANVAS V2 FORMAT ===
  const dxfScene: DxfScene | null = props.currentScene ? {
    entities: [
      ...(props.currentScene.entities?.map((entity): DxfEntityUnion | null => {
        // Get layer color information
        const layerInfo = entity.layer ? props.currentScene?.layers?.[entity.layer] : null;

        // Convert SceneEntity to DxfEntityUnion
        const base = {
          id: entity.id,
          layer: entity.layer || 'default',
          color: String(entity.color || layerInfo?.color || UI_COLORS.WHITE), // ✅ ENTERPRISE FIX: Ensure string type
          lineWidth: entity.lineweight || 1,
          visible: entity.visible ?? true // ✅ ENTERPRISE FIX: Default to true if undefined
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
      // 🎯 ADD PREVIEW ENTITY: Include preview entity from drawing state for real-time rendering
      ...(drawingHandlers.drawingState.previewEntity ? (() => {
        const preview = drawingHandlers.drawingState.previewEntity;

        // Type-safe preview entity mapping based on entity type
        if (preview.type === 'line') {
          const linePreview = preview as typeof preview & {
            start: Point2D;
            end: Point2D;
            color?: string;
            lineweight?: number
          };
          return [{
            id: linePreview.id,
            type: 'line' as const,
            layer: linePreview.layer || '0',
            color: linePreview.color || UI_COLORS.BRIGHT_GREEN, // Green for preview
            lineWidth: linePreview.lineweight || 1,
            visible: true,
            start: linePreview.start,
            end: linePreview.end
          }] as DxfEntityUnion[];
        }

        // Note: DxfEntityUnion δεν υποστηρίζει 'point', 'rectangle', etc - skip για τώρα
        // Αν χρειαστεί, θα πρέπει να επεκταθεί το DxfEntityUnion type
        return [];
      })() : [])
    ],
    layers: Object.keys(props.currentScene.layers || {}), // ✅ FIX: Convert layers object to array
    bounds: props.currentScene.bounds // ✅ FIX: Use actual bounds from scene
  } : null;

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
  const { handleOverlaySelect, handleOverlayEdit, handleOverlayDelete, handleOverlayUpdate } =
    createOverlayHandlers({
      setSelectedOverlay: overlayStore.setSelectedOverlay,
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

    console.log('🏢 Adding vertex at edge midpoint:', { overlayId, edgeIndex, insertIndex, vertex });

    try {
      await overlayStore.addVertex(overlayId, insertIndex, vertex);
      console.log('✅ Vertex added successfully');
    } catch (error) {
      console.error('❌ Failed to add vertex:', error);
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

  const handleCanvasClick = (point: Point2D) => {
    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Route click to unified drawing system for drawing tools
    const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' || activeTool === 'polygon'
      || activeTool === 'rectangle' || activeTool === 'circle';

    if (isDrawingTool && drawingHandlersRef.current) {
      const canvasElement = dxfCanvasRef.current?.getCanvas?.();
      if (!canvasElement) return;

      const viewport = { width: canvasElement.clientWidth, height: canvasElement.clientHeight };
      const worldPoint = CoordinateTransforms.screenToWorld(point, transform, viewport);
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
      handleOverlaySelect(null);
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

  // Handle keyboard shortcuts for drawing and zoom
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Zoom shortcuts μετακόμισαν στο hooks/useKeyboardShortcuts.ts
      // Εδώ κρατάμε ΜΟΝΟ local shortcuts για drawing mode (Escape, Enter)

      switch (e.key) {
        case 'Escape':
          setDraftPolygon([]);
          break;
        case 'Enter':
          if (draftPolygon.length >= 3) {
            finishDrawing();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftPolygon, finishDrawing]);


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
              onLayerClick={handleOverlayClick}
              onCanvasClick={handleCanvasClick}
              onMouseMove={(point) => {
                setMouseCss(point);
                setMouseWorld(point); // TODO: Transform CSS to world coordinates

                // 🏢 ENTERPRISE (2026-01-25): Edge hover detection for selected overlays
                if ((activeTool === 'select' || activeTool === 'layering') && selectedOverlay) {
                  const overlay = currentOverlays.find(o => o.id === selectedOverlay.id);
                  if (overlay?.polygon) {
                    const EDGE_TOLERANCE = 15 / transform.scale; // 15 pixels in world units
                    const edgeInfo = findOverlayEdgeForGrip(point, overlay.polygon, EDGE_TOLERANCE);

                    if (edgeInfo) {
                      setHoveredEdgeInfo({ overlayId: overlay.id, edgeIndex: edgeInfo.edgeIndex });
                    } else {
                      setHoveredEdgeInfo(null);
                    }
                  }
                } else {
                  // Clear hover when not in select/layering mode
                  if (hoveredEdgeInfo) {
                    setHoveredEdgeInfo(null);
                  }
                }

                // ✅ ΔΙΟΡΘΩΣΗ: Καλώ και το props.onMouseMove για cursor-centered zoom
                if (props.onMouseMove) {
                  // 🎯 TYPE-SAFE: Create proper mock event (event not available in this context)
                  const mockEvent = {
                    clientX: point.x,
                    clientY: point.y,
                    preventDefault: () => {},
                    stopPropagation: () => {}
                  } as React.MouseEvent;
                  props.onMouseMove(point, mockEvent);
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
                setMouseCss(screenPos);
                setMouseWorld(worldPos);

                // 🎯 FIX: Call onDrawingHover για preview phase rendering
                const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' || activeTool === 'polygon'
                  || activeTool === 'rectangle' || activeTool === 'circle';

                if (isDrawingTool && worldPos && drawingHandlersRef.current?.onDrawingHover) {
                  drawingHandlersRef.current.onDrawingHover(worldPos);
                }
              }}
            />
          )}

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
