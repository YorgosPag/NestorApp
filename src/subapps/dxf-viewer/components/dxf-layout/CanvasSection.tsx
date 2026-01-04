'use client';
import React, { useRef, useState } from 'react';
// === CANVAS V2 IMPORTS ===
import { DxfCanvas, LayerCanvas, type ColorLayer, type SnapSettings, type GridSettings, type RulerSettings, type SelectionSettings, type DxfScene, type DxfEntityUnion } from '../../canvas-v2';
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
import { useCursorSettings } from '../../systems/cursor';
import { globalRulerStore } from '../../settings-provider';
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
// ✅ ADR-006 FIX: Import CrosshairOverlay για crosshair rendering
import CrosshairOverlay from '../../canvas-v2/overlays/CrosshairOverlay';
// ✅ ADR-009: Import RulerCornerBox for interactive corner box (AutoCAD/Revit standard)
import RulerCornerBox from '../../canvas-v2/overlays/RulerCornerBox';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';

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
  const showLayerCanvas = showLayerCanvasDebug; // Debug toggleable

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
          //   color: overlay.color || UI_COLORS.OVERLAY_RED
          // });
        }

        return {
          id: overlay.id,
          name: `Layer ${index + 1}`,
          color: overlay.color || getStatusColors(overlay.status)?.fill || UI_COLORS.BUTTON_PRIMARY,
          opacity: overlay.opacity || 0.7,  // Slightly transparent so we can see them
          visible: overlay.visible !== false,
          zIndex: index,
          polygons: [{
            id: `polygon_${overlay.id}`,
            vertices,
            fillColor: overlay.color || getStatusColors(overlay.status)?.fill || UI_COLORS.BUTTON_PRIMARY,  // Use κεντρικά STATUS_COLORS
            strokeColor: overlay.selected ? UI_COLORS.SELECTED_RED : UI_COLORS.BLACK,  // Black stroke for visibility
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
    console.log('🎯 handleCanvasClick CALLED!', { point, activeTool });

    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Route click to unified drawing system for drawing tools
    const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' || activeTool === 'polygon'
      || activeTool === 'rectangle' || activeTool === 'circle'; // ✅ Removed 'arc' - not in ToolType union

    console.log('🎯 isDrawingTool:', isDrawingTool, 'drawingHandlersRef.current:', !!drawingHandlersRef.current);

    if (isDrawingTool && drawingHandlersRef.current) {
      // 🔥 FIX: Use ONLY dxfCanvasRef for drawing tools (NOT overlayCanvasRef!)
      // Drawing tools (Line/Circle/Rectangle) draw on DxfCanvas
      // Color layers draw on LayerCanvas (overlayCanvasRef)
      const canvasElement = dxfCanvasRef.current?.getCanvas?.();
      console.log('🎯 canvasElement:', !!canvasElement, 'dxfCanvasRef.current:', !!dxfCanvasRef.current);
      if (!canvasElement) {
        console.log('❌ canvasElement is null - returning early!');
        return;
      }

      const viewport = { width: canvasElement.clientWidth, height: canvasElement.clientHeight };
      const worldPoint = CoordinateTransforms.screenToWorld(point, transform, viewport);

      // Call the centralized drawing handler - USE REF!
      drawingHandlersRef.current.onDrawingPoint(worldPoint);
      return;
    }

    // ✅ OVERLAY MODE: Use legacy overlay system with draftPolygon
    if (overlayMode === 'draw') {
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
          className="canvas-stack relative w-full h-full overflow-hidden"
          style={{ cursor: 'none' }} // ✅ ADR-008 CAD-GRADE: ALWAYS hide CSS cursor - crosshair is the only cursor
        >
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
              className="absolute inset-0 w-full h-full z-0" // 🎯 Z-INDEX FIX: LayerCanvas BACKGROUND (z-0)
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
              className="absolute inset-0 w-full h-full z-10" // 🎯 Z-INDEX FIX: DxfCanvas FOREGROUND (z-10) - ΠΑΝΩ από LayerCanvas!
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
            className="absolute left-0 right-0 top-0 z-20 pointer-events-none"
            style={{ height: `calc(100% - ${rulerSettings.height ?? 30}px)` }}
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
              const combinedBounds = createCombinedBounds(dxfScene, colorLayers);
              if (combinedBounds && viewport.width > 0 && viewport.height > 0) {
                zoomSystem.zoomToFit(combinedBounds, viewport, true);
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
            className="z-30"
          />
        </div>
      </div>


      {/* Right Sidebar - MOVED TO DxfViewerContent */}
    </>
  );
};
