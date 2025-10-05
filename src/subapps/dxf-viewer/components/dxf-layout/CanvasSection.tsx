'use client';
import React, { useRef, useState } from 'react';
// 🎯 CANVAS Z-INDEX FIX - CSS with !important
import './canvas-stacking.css';
// === CANVAS V2 IMPORTS ===
import { DxfCanvas, LayerCanvas, type ColorLayer, type SnapSettings, type GridSettings, type RulerSettings, type SelectionSettings, type DxfScene, type DxfEntityUnion } from '../../canvas-v2';
import { createCombinedBounds } from '../../systems/zoom/utils/bounds';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
// ✅ CURSOR SETTINGS: Import από κεντρικό system αντί για duplicate
import type { CursorSettings } from '../../systems/cursor/config';
import { useCanvasOperations } from '../../hooks/interfaces/useCanvasOperations';
import { useCanvasContext } from '../../contexts/CanvasContext';
import { useDrawingHandlers } from '../../hooks/drawing/useDrawingHandlers';
// CanvasProvider removed - not needed for Canvas V2
// OverlayCanvas import removed - it was dead code
import { FloatingPanelContainer } from '../../ui/FloatingPanelContainer';
import { OverlayList } from '../../ui/OverlayList';
import { OverlayProperties } from '../../ui/OverlayProperties';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLevels } from '../../systems/levels';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
import { useCursorSettings } from '../../systems/cursor';
import { globalRulerStore } from '../../providers/DxfSettingsProvider';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import { getStatusColors } from '../../config/color-mapping';
import { createOverlayHandlers } from '../../overlays/types';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import { useZoom } from '../../systems/zoom';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// ✅ ENTERPRISE MIGRATION: Using ServiceRegistry
import { serviceRegistry } from '../../services';
// 🎯 DEBUG: Import canvas alignment tester
import { CanvasAlignmentTester } from '../../debug/canvas-alignment-test';

/**
 * Renders the main canvas area, including the renderer and floating panels.
 */
export const CanvasSection: React.FC<DXFViewerLayoutProps & { overlayMode: OverlayEditorMode, currentStatus: Status, currentKind: OverlayKind }> = (props) => {
  // ✅ FIX: Use DxfCanvasRef type για getCanvas() method access
  const dxfCanvasRef = useRef<any>(null); // DxfCanvasRef type (με getCanvas() method)
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

  // 🏢 ENTERPRISE: Provide zoom system to context
  const canvasContext = useCanvasContext();
  // ✅ CENTRALIZED VIEWPORT: Update viewport από canvas dimensions
  React.useEffect(() => {
    const updateViewport = () => {
      // Use DxfCanvas ref as primary (LayerCanvas should have same dimensions)
      const canvas = dxfCanvasRef.current || overlayCanvasRef.current;
      if (canvas && canvas instanceof HTMLCanvasElement) {
        const rect = canvas.getBoundingClientRect();
        // Only update if dimensions are valid (not 0x0)
        if (rect.width > 0 && rect.height > 0) {
          setViewport({ width: rect.width, height: rect.height });
        }
      }
    };

    // Initial update with delay to ensure canvas is mounted
    const timer = setTimeout(updateViewport, 100);

    // Update on resize
    window.addEventListener('resize', updateViewport);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateViewport);
    };
  }, [dxfCanvasRef.current, overlayCanvasRef.current]);

  // ✅ AUTO FIT TO VIEW: Trigger existing fit-to-view event after canvas mount
  // ⚠️ DISABLED: Αφαιρέθηκε γιατί προκαλούσε issues με origin marker visibility
  // Ο χρήστης μπορεί να πατήσει manual "Ευθυγράμμιση" όταν χρειάζεται
  /*
  const hasTriggeredAutoFit = React.useRef(false);
  React.useEffect(() => {
    // Only trigger ONCE after viewport is ready
    if (!hasTriggeredAutoFit.current && viewport.width > 0 && viewport.height > 0) {
      const timer = setTimeout(() => {
        console.log('🎯 AUTO FIT TO VIEW: Dispatching canvas-fit-to-view event');
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
    color: rulerContextSettings?.horizontal?.color ?? '#ffffff', // ✅ WHITE για visibility
    backgroundColor: rulerContextSettings?.horizontal?.backgroundColor ?? '#333333', // ✅ DARK BACKGROUND για contrast
    fontSize: rulerContextSettings?.horizontal?.fontSize ?? 12,
    // Extended properties από RulersGridSystem
    textColor: rulerContextSettings?.horizontal?.textColor ?? '#ffffff', // ✅ WHITE TEXT για visibility
    showLabels: rulerContextSettings?.horizontal?.showLabels ?? true,
    showUnits: rulerContextSettings?.horizontal?.showUnits ?? true,
    showBackground: rulerContextSettings?.horizontal?.showBackground ?? true,
    showMajorTicks: rulerContextSettings?.horizontal?.showMajorTicks ?? true,
    showMinorTicks: rulerContextSettings?.horizontal?.showMinorTicks ?? true,
    majorTickColor: rulerContextSettings?.horizontal?.majorTickColor ?? '#ffffff', // ✅ WHITE TICKS
    minorTickColor: rulerContextSettings?.horizontal?.minorTickColor ?? '#cccccc', // ✅ LIGHT GRAY MINOR TICKS
    majorTickLength: rulerContextSettings?.horizontal?.majorTickLength ?? 10,
    minorTickLength: rulerContextSettings?.horizontal?.minorTickLength ?? 5,
    height: rulerContextSettings?.horizontal?.height ?? 30,
    width: rulerContextSettings?.vertical?.width ?? 30,
    position: rulerContextSettings?.horizontal?.position ?? 'bottom',
    // 🔺 MISSING UNITS SETTINGS - Σύνδεση με floating panel
    unitsFontSize: rulerContextSettings?.horizontal?.unitsFontSize ?? 10,
    unitsColor: rulerContextSettings?.horizontal?.unitsColor ?? '#ffffff' // ✅ WHITE UNITS TEXT
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
  const showLayerCanvas = showLayerCanvasDebug; // Debug toggleable

  // ✅ CONVERT RulersGridSystem grid settings to Canvas V2 GridSettings format
  // RulersGridSystem uses: gridSettings.visual.color
  // Canvas GridRenderer uses: gridSettings.color
  const gridSettings: GridSettings = {
    // Enabled state: ΠΡΩΤΑ από panel, μετά toolbar fallback
    enabled: gridContextSettings?.visual?.enabled ?? showGrid,
    visible: gridContextSettings?.visual?.enabled ?? true, // ✅ VISIBILITY: Controls grid rendering

    // ✅ SIZE: Από panel settings
    size: gridContextSettings?.visual?.step ?? 10,

    // ✅ COLORS: Από panel settings (NOT hardcoded!)
    color: gridContextSettings?.visual?.color ?? '#4444ff', // Default blue από panel
    majorGridColor: gridContextSettings?.visual?.majorGridColor ?? '#888888',
    minorGridColor: gridContextSettings?.visual?.minorGridColor ?? '#bbbbbb',

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

  // 🔍 DEBUG: Log overlay rendering state
  React.useEffect(() => {
    console.log('🎨 CANVAS OVERLAY RENDERING STATE:', {
      currentLevelId: levelManager.currentLevelId,
      currentOverlaysCount: currentOverlays.length,
      selectedOverlay: selectedOverlay ? {
        id: selectedOverlay.id,
        levelId: selectedOverlay.levelId,
        hasPolygon: !!selectedOverlay.polygon
      } : null,
      allOverlaysInStore: Object.keys(overlayStore.overlays).length
    });
  }, [levelManager.currentLevelId, currentOverlays.length, selectedOverlay?.id, overlayStore.overlays]);

  // === CONVERT OVERLAYS TO CANVAS V2 FORMAT ===
  const convertToColorLayers = (overlays: any[]): ColorLayer[] => {
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

        // Debug για το πρώτο overlay
        if (index === 0) {
          // // console.log('🔍 convertToColorLayers - First overlay conversion:', {
          //   overlayId: overlay.id,
          //   originalPolygon: overlay.polygon.slice(0, 3), // Τα πρώτα 3 points
          //   convertedVertices: vertices.slice(0, 3), // Τα πρώτα 3 vertices
          //   color: overlay.color || '#ff6b6b'
          // });
        }

        return {
          id: overlay.id,
          name: `Layer ${index + 1}`,
          color: overlay.color || getStatusColors(overlay.status)?.fill || '#3b82f6',
          opacity: overlay.opacity || 0.7,  // Slightly transparent so we can see them
          visible: overlay.visible !== false,
          zIndex: index,
          polygons: [{
            id: `polygon_${overlay.id}`,
            vertices,
            fillColor: overlay.color || getStatusColors(overlay.status)?.fill || '#3b82f6',  // Use κεντρικά STATUS_COLORS
            strokeColor: overlay.selected ? '#ff0000' : '#000000',  // Black stroke for visibility
            strokeWidth: overlay.selected ? 3 : 2,  // Thicker stroke
            selected: overlay.id === overlayStore.selectedOverlayId
          }]
        };
      });
  };

  const colorLayers = convertToColorLayers(currentOverlays);

  // === 🎨 DRAWING SYSTEM ===
  // useDrawingHandlers για DXF entity drawing (Line, Circle, Rectangle, etc.)
  const drawingHandlers = useDrawingHandlers(
    activeTool,
    (entity) => {
      // Callback όταν δημιουργηθεί entity
      if (props.handleSceneChange && props.currentScene) {
        const updatedScene = {
          ...props.currentScene,
          entities: [...(props.currentScene.entities || []), entity] as any // ✅ Type assertion for entity union compatibility
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
      console.log('🎯 Auto-starting drawing for tool:', activeTool);
      drawingHandlersRef.current.startDrawing(activeTool as any);
    }
  }, [activeTool]);

  // 🔍 DEBUG - Check current overlays and colorLayers (LIMITED to prevent infinite re-render)
  React.useEffect(() => {
    // Only log if we actually have overlays or if it's been a while
    if (currentOverlays.length > 0 || colorLayers.length > 0) {
      // console.log('🔍 CanvasSection Overlays State:', {
      //   overlaysCount: currentOverlays.length,
      //   colorLayersCount: colorLayers.length,
      //   currentLevelId: levelManager.currentLevelId,
      //   sampleOverlay: currentOverlays.length > 0 ? {
      //     id: currentOverlays[0].id,
      //     hasPolygon: !!currentOverlays[0].polygon,
      //     polygonLength: currentOverlays[0].polygon?.length
      //   } : null,
      //   sampleColorLayer: colorLayers.length > 0 ? {
      //     id: colorLayers[0].id,
      //     name: colorLayers[0].name,
      //     color: colorLayers[0].color,
      //     polygonsCount: colorLayers[0].polygons?.length
      //   } : null
      // });
    }
  }, [currentOverlays.length, levelManager.currentLevelId]); // Dependency only on counts, not objects - removed colorLayers to prevent infinite loop

  // === CONVERT SCENE TO CANVAS V2 FORMAT ===
  const dxfScene: DxfScene | null = props.currentScene ? {
    entities: props.currentScene.entities?.map((entity): DxfEntityUnion | null => {
      // Get layer color information
      const layerInfo = props.currentScene?.layers?.[entity.layer];

      // Convert SceneEntity to DxfEntityUnion
      const base = {
        id: entity.id,
        layer: entity.layer,
        color: entity.color || layerInfo?.color || '#ffffff', // Use layer color if entity has no color
        lineWidth: entity.lineweight || 1,
        visible: entity.visible
      };

      switch (entity.type) {
        case 'line': {
          const lineEntity = entity as any;
          return { ...base, type: 'line' as const, start: lineEntity.start, end: lineEntity.end };
        }
        case 'circle': {
          const circleEntity = entity as any;
          return { ...base, type: 'circle' as const, center: circleEntity.center, radius: circleEntity.radius };
        }
        case 'polyline': {
          const polylineEntity = entity as any;
          return { ...base, type: 'polyline' as const, vertices: polylineEntity.vertices, closed: polylineEntity.closed };
        }
        case 'arc': {
          const arcEntity = entity as any;
          return { ...base, type: 'arc' as const, center: arcEntity.center, radius: arcEntity.radius, startAngle: arcEntity.startAngle, endAngle: arcEntity.endAngle };
        }
        case 'text': {
          const textEntity = entity as any;
          return { ...base, type: 'text' as const, position: textEntity.position, text: textEntity.text, height: textEntity.height, rotation: textEntity.rotation };
        }
        default:
          console.warn('🔍 Unsupported entity type for DxfCanvas:', entity.type);
          return null;
      }
    }).filter(Boolean) as DxfEntityUnion[] || [], // ✅ FIX: Convert and filter entities!
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


  // Drawing logic
  const handleOverlayClick = (overlayId: string, point: Point2D) => {
    // console.log('🔍 handleOverlayClick called:', { overlayId, point, overlayMode, activeTool });

    // 🚀 PROFESSIONAL CAD: Αυτόματη επιλογή layers όταν layering tool είναι ενεργό
    if (activeTool === 'layering' || overlayMode === 'select') {
      // console.log('🔍 Selecting overlay:', overlayId);
      handleOverlaySelect(overlayId);
      // 🔧 AUTO FIT TO VIEW - Zoom to selected overlay
      // console.log('🔍 Calling fitToOverlay in 100ms...');
      setTimeout(() => {
        // console.log('🔍 Now calling fitToOverlay:', overlayId);
        fitToOverlay(overlayId);
      }, 100); // Small delay to ensure selection state updates
    }
  };

  const handleCanvasClick = (point: Point2D) => {
    console.log('🔍 Canvas Click:', {
      overlayMode,
      activeTool,
      point,
      transform,
      draftPolygonLength: draftPolygon.length
    });

    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Route click to unified drawing system for drawing tools
    const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' || activeTool === 'polygon'
      || activeTool === 'rectangle' || activeTool === 'circle'; // ✅ Removed 'arc' - not in ToolType union

    if (isDrawingTool && drawingHandlersRef.current) {
      // ✅ UNIFIED DRAWING ENGINE: Route click to centralized drawing system
      console.log('🎨 Routing click to unified drawing system (drawing tool):', {
        activeTool,
        point
      });

      // 🔥 FIX: Use ONLY dxfCanvasRef for drawing tools (NOT overlayCanvasRef!)
      // Drawing tools (Line/Circle/Rectangle) draw on DxfCanvas
      // Color layers draw on LayerCanvas (overlayCanvasRef)
      const canvasElement = dxfCanvasRef.current?.getCanvas?.();
      if (!canvasElement) {
        console.error('❌ DXF Canvas element not found - cannot draw!');
        return;
      }

      const viewport = { width: canvasElement.clientWidth, height: canvasElement.clientHeight };
      console.log('🔥 VIEWPORT:', {
        canvasClientWidth: canvasElement.clientWidth,
        canvasClientHeight: canvasElement.clientHeight,
        viewport,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height
      });
      console.log('🔥 screenToWorld INPUT:', { point, transform, viewport });
      const worldPoint = CoordinateTransforms.screenToWorld(point, transform, viewport);
      console.log('🔥 screenToWorld OUTPUT:', { worldPoint });

      console.log('🔥 About to call onDrawingPoint:', { worldPoint, drawingHandlers: !!drawingHandlersRef.current, onDrawingPoint: !!drawingHandlersRef.current?.onDrawingPoint });
      // Call the centralized drawing handler - USE REF!
      drawingHandlersRef.current.onDrawingPoint(worldPoint);
      console.log('✅ onDrawingPoint called successfully');
      return;
    }

    // ✅ OVERLAY MODE: Use legacy overlay system with draftPolygon
    if (overlayMode === 'draw') {
      console.log('🎨 Legacy overlay mode - using draftPolygon:', { overlayMode, point });
      // 🔧 Use UNIFIED CoordinateTransforms για consistency
      const canvas = dxfCanvasRef.current || overlayCanvasRef.current;
      if (!canvas) return;

      const viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
      const worldPoint = CoordinateTransforms.screenToWorld(point, transform, viewport);
      const worldPointArray: [number, number] = [worldPoint.x, worldPoint.y];

      // console.log('🔍 Adding point to draft polygon:', {
      //   screenPoint: point,
      //   worldPoint,
      //   currentDraftLength: draftPolygon.length
      // });

      setDraftPolygon(prev => {
        const newPolygon = [...prev, worldPointArray];
        // console.log('🔍 Draft polygon updated:', {
        //   oldLength: prev.length,
        //   newLength: newPolygon.length,
        //   newPolygon: newPolygon.slice(0, 3) // First 3 points
        // });
        return newPolygon;
      });

      // Close polygon if clicking near first point
      if (draftPolygon.length >= 3) {
        const firstPoint = draftPolygon[0];
        const distance = calculateDistance(
          { x: worldPointArray[0], y: worldPointArray[1] },
          { x: firstPoint[0], y: firstPoint[1] }
        );

        // console.log('🔍 Checking polygon close:', {
        //   distance,
        //   threshold: 20 / transform.scale,
        //   shouldClose: distance < (20 / transform.scale)
        // });

        if (distance < (20 / transform.scale)) { // Close threshold adjusted for scale
          // console.log('🔍 Closing polygon - finishing drawing');
          finishDrawing();
          return;
        }
      }
    } else {
      // Clicked on empty space - deselect
      // console.log('🔍 Deselecting overlay (clicked empty space)');
      handleOverlaySelect(null);
    }
  };

  const finishDrawing = async () => {
    // Debug disabled to prevent console spam

    if (draftPolygon.length >= 3 && levelManager.currentLevelId) {
      try {
        const newOverlay = await overlayStore.add({
          levelId: levelManager.currentLevelId,
          kind: currentKind,
          polygon: draftPolygon,
          status: currentStatus,
          label: `Overlay ${Date.now()}`, // Temporary label
        });

        // console.log('🔍 New Overlay Created:', newOverlay);

      } catch (error) {
        console.error('Failed to create overlay:', error);
      }
    }
    setDraftPolygon([]);
  };

  // Handle fit-to-view event from useCanvasOperations fallback
  React.useEffect(() => {
    const handleFitToView = (e: CustomEvent) => {
      // 🚀 USE COMBINED BOUNDS - DXF + overlays
      const combinedBounds = createCombinedBounds(dxfScene, colorLayers);

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

  // 🎯 CANVAS ALIGNMENT TEST: Auto-test when layering is activated
  React.useEffect(() => {
    if (activeTool === 'layering' && showDxfCanvas && showLayerCanvas) {
      // Delay να φορτώσουν τα canvas πρώτα
      const testTimeout = setTimeout(() => {
        console.log('🎯 LAYERING ACTIVATED - RUNNING CANVAS ALIGNMENT TEST');

        const alignmentResult = CanvasAlignmentTester.testCanvasAlignment();
        const zIndexResult = CanvasAlignmentTester.testCanvasZIndex();
        const greenBorder = CanvasAlignmentTester.findGreenBorder();

        console.log('🎯 LAYERING CANVAS TESTS COMPLETED:', {
          alignment: alignmentResult,
          zIndex: zIndexResult,
          greenBorderFound: !!greenBorder,
          greenBorderElement: greenBorder
        });

        // 🔍 EXTRA DEBUG: Manual z-index check
        const dxfCanvasEl = document.querySelector('canvas[data-canvas-type="dxf"]');
        const layerCanvasEl = document.querySelector('canvas[data-canvas-type="layer"]');
        // Manual z-index check disabled for performance

        if (!alignmentResult.isAligned) {
          console.warn('⚠️ CANVAS MISALIGNMENT DETECTED DURING LAYERING!', alignmentResult.differences);
        }

        if (!zIndexResult.isCorrectOrder) {
          console.warn('⚠️ INCORRECT CANVAS Z-INDEX ORDER DURING LAYERING!', zIndexResult);
        }
      }, 1000); // 1 second delay για να φορτώσουν τα canvas

      return () => clearTimeout(testTimeout);
    }
  }, [activeTool, showDxfCanvas, showLayerCanvas]);

  // ❌ REMOVED: Duplicate zoom handlers - now using centralized zoomSystem.handleKeyboardZoom()
  // All keyboard zoom is handled through the unified system in the keyboard event handler above

  return (
    <>
      {/* Left Sidebar - REMOVED - FloatingPanelContainer handles this */}

      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        {/* DEBUG BUTTONS MOVED TO HEADER */}

        <div className="canvas-stack relative w-full h-full overflow-hidden">
          {/* 🔺 CANVAS V2: Layer Canvas - Background Overlays (Semi-transparent colored layers) */}
          {showLayerCanvas && (
            <LayerCanvas
              ref={overlayCanvasRef}
              layers={colorLayers}
              transform={transform}
              viewport={viewport} // ✅ CENTRALIZED: Pass centralized viewport
              activeTool={activeTool} // 🔥 ΚΡΙΣΙΜΟ: Pass activeTool για pan cursor
              layersVisible={showLayers} // ✅ ΥΠΑΡΧΟΝ SYSTEM: Existing layer visibility
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
                // ✅ ΔΙΟΡΘΩΣΗ: Καλώ και το props.onMouseMove για cursor-centered zoom
                if (props.onMouseMove) {
                  props.onMouseMove(point, null as any); // ✅ Pass null for event (not available in this context)
                }
              }}
              className="absolute inset-0 w-full h-full"
              style={{
                touchAction: 'none', // 🔥 QUICK WIN #1: Prevent browser touch gestures
                pointerEvents: (activeTool === 'line' || activeTool === 'polyline' ||
                                activeTool === 'polygon' || activeTool === 'circle' ||
                                activeTool === 'rectangle')
                                ? 'none'  // 🎯 CRITICAL: Disable clicks for drawing tools (let DxfCanvas handle)
                                : 'auto'  // Enable clicks for selection/other modes
              }}
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
              colorLayers={colorLayers} // ✅ FIX: Pass color layers για fit to view bounds
              crosshairSettings={crosshairSettings} // ✅ CONNECT TO EXISTING CURSOR SYSTEM
              gridSettings={gridSettings} // ✅ FIX: Enable grid rendering in DxfCanvas
              rulerSettings={{
                enabled: globalRulerSettings.horizontal.enabled && globalRulerSettings.vertical.enabled,
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
                minorTickColor: '#666666',
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
              className="absolute inset-0 w-full h-full z-0" // 🎯 Z-INDEX: DxfCanvas κάτω (z-0)
              onTransformChange={(newTransform) => {
                setTransform(newTransform); // ✅ SYNC: Κοινό transform state για DxfCanvas
                zoomSystem.setTransform(newTransform);
              }}
              onWheelZoom={zoomSystem.handleWheelZoom} // ✅ CONNECT ZOOM SYSTEM
              onMouseMove={(screenPos, worldPos) => {
                // ✅ ΔΙΟΡΘΩΣΗ: Περνάω το screenPos στο props.onMouseMove για cursor-centered zoom
                if (props.onMouseMove) {
                  props.onMouseMove(screenPos, null as any); // ✅ Pass null for event (not available in this context)
                }
              }}
              onCanvasClick={handleCanvasClick} // 🔥 FIX: Connect canvas clicks για drawing tools!
            />
          )}
        </div>
      </div>


      {/* Right Sidebar - MOVED TO DxfViewerContent */}
    </>
  );
};
