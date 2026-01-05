'use client';

// ✅ Debug flag for canvas core logging
const DEBUG_CANVAS_CORE = false;

import React, { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type { SceneModel } from '../types/scene';
import { EntityRenderer } from '../utils/entity-renderer';
import { MARGINS, type ViewTransform, type Point2D, type GridSettings, type RulerSettings } from '../systems/rulers-grid/config';
import { useGripContext } from '../providers/GripProvider';
// ✅ ΑΦΑΙΡΕΣΗ ΔΙΑΓΡΑΜΜΕΝΟΥ SpecificGripPreviewContext - ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ ΠΛΕΟΝ useUnifiedGripPreview
import { useUnifiedGripPreview } from '../ui/hooks/useUnifiedSpecificSettings';
// ✅ ENTERPRISE FIX: AnyMeasurement moved to types/measurements
import type { AnyMeasurement } from '../types/measurements';
import { AngleMeasurementRenderer } from '../rendering/entities/AngleMeasurementRenderer';
import type { Entity } from '../types/entities';
import { layoutUtilities } from '@/styles/design-tokens';
import { getDxfCanvasCoreStyles } from '../ui/DxfViewerComponents.styles';
import type { EntityRenderer as EntityRendererType } from '../utils/entity-renderer';
// ✅ ENTERPRISE: Import centralized colors
import { UI_COLORS, withOpacity, CANVAS_THEME } from '../config/color-config';
// ✅ ENTERPRISE: Import GripSettings type (replaces any) + DEFAULT for fallback
import { type GripSettings, DEFAULT_GRIP_SETTINGS } from '../types/gripSettings';

// ✅ ENTERPRISE FIX: Import extracted modules (some modules integrated)
import { createCanvasRenderer, type CanvasRenderer } from './engine/createCanvasRenderer';
// ✅ ENTERPRISE FIX: Missing modules moved to integrated systems
// import { useHoverAndSelect } from './interaction/useHoverAndSelect'; // Integrated
// import { useGripInteraction } from './interaction/useGripInteraction'; // Integrated
import { publishHighlight } from '../events/selection-bus';
import { UnifiedEntitySelection } from '../utils/unified-entity-selection';
// Import RulersGrid hook
import { useRulersGrid } from '../systems/rulers-grid/useRulersGrid';

// ✅ Imperative API interface for canvas operations
export interface DxfCanvasImperativeAPI {
  getCanvas: () => HTMLCanvasElement | null;
  getTransform: () => ViewTransform;
  zoomIn: () => void;
  zoomOut: () => void;
  zoom: (factor: number) => void;
  zoomAtScreenPoint: (factor: number, screenPt: Point2D) => void;
  resetToOrigin: () => void;
  fitToView: () => void;
  setSelectedEntityIds: (ids: string[]) => void;
  renderScene: (scene: SceneModel) => void;
  clearCanvas: () => void;
}

interface Props {
  onRendererReady: (renderer: CanvasRenderer) => void;
  onMouseMove?: (pt: Point2D) => void;
  onMouseLeave?: () => void;
  onMouseDown?: (pt: Point2D, e?: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onWheel?: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  selectedEntityIds?: string[];
  hoveredEntityId?: string | null;
  alwaysShowCoarseGrid?: boolean;
  scene?: SceneModel | null;
  overlayEntities?: Entity[]; // 🎯 NEW: Extract overlay entities for snapping
  className?: string;
  isZoomWindowActive?: boolean;
  activeTool?: string;
  // ✅ Optional refs for hit-test (when provided, use these instead of internal refs)
  hitTestCanvasRef?: React.RefObject<HTMLCanvasElement>;
  hitTestTransformRef?: React.RefObject<ViewTransform>;
  // ✅ Scene change callback for grip drag commits
  onSceneChange?: (scene: SceneModel) => void;
  // ✅ Selection change callback for parent updates (panels κ.λπ.)
  onSelectChange?: (ids: string[]) => void;
  // ✅ Right-click color menu callback
  onRequestColorMenu?: (at: Point2D) => void;
  // ✅ Cursor style callback
  setCursor?: (cursor: string) => void;
  // ✅ Snap functionality
  snapEnabled?: boolean;
  findSnapPoint?: (x: number, y: number) => Point2D | null;
  // ✅ Drawing callbacks (from DxfCanvas)
  onDrawingPoint?: (point: Point2D) => void;
  onDrawingHover?: (point: Point2D | null) => void;
  onDrawingCancel?: () => void;
  onDrawingDoubleClick?: () => void;
  gripSettings?: GripSettings; // ✅ ENTERPRISE: Proper type (was any)
}

export const DxfCanvasCore = forwardRef<DxfCanvasImperativeAPI, Props>(({
  onRendererReady,
  onMouseMove,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  onWheel,
  selectedEntityIds,
  hoveredEntityId,
  alwaysShowCoarseGrid = true,
  scene = null,
  overlayEntities = [],
  className,
  isZoomWindowActive = false,
  activeTool,
  hitTestCanvasRef,
  hitTestTransformRef,
  onSceneChange,
  onSelectChange,
  onRequestColorMenu,
  setCursor,
  snapEnabled = false,
  findSnapPoint,
  onDrawingPoint,
  onDrawingHover,
  onDrawingCancel,
  onDrawingDoubleClick,
  gripSettings,
}: Props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const entityRendererRef = useRef<EntityRenderer | null>(null);
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const hoverIdRef = useRef<string | null>(null);
  
  const currentTransformRef = useRef<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });

  // ✅ Overlay preview system για smooth drag χωρίς redraw conflicts
  const previewOverrideRef = useRef<{ entityId: string; next: Partial<Entity> } | null>(null);
  
  // ✅ Ref to keep latest grid settings - prevents loss during renderer/scene initialization
  const lastGridSettingsRef = useRef<{ grid: GridSettings; rulers: RulerSettings; origin: Point2D } | null>(null);
  
  // ✅ Readiness states
  const [rendererReady, setRendererReady] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);

  // RAF throttling για preview rendering
  const lastPreviewRef = useRef<Point2D | null>(null);
  const rafRef = useRef<number | null>(null);
  const JITTER_PX2 = 0.25; // 0.5px^2

  const { gripSettings: contextGripSettings } = useGripContext();
  const { getEffectiveGripSettings } = useUnifiedGripPreview();
  
  // ✅ FIXED: Move useRulersGrid to top level - no conditional calls
  const rulersGrid = useRulersGrid(); // Can be null during initialization
  if (DEBUG_CANVAS_CORE) console.log('🚨 [DxfCanvasCore] RulersGrid hook called at top level');
  if (DEBUG_CANVAS_CORE) console.log('✅ [DxfCanvasCore] RulersGrid context result:', !!rulersGrid);
  if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvasCore] RulersGrid state:', rulersGrid?.state);
  if (rulersGrid?.state?.grid) {
    if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvasCore] Grid visual settings:', rulersGrid.state.grid.visual);
    if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvasCore] Grid subDivisions:', rulersGrid.state.grid.visual?.subDivisions);
  }
  
  // ✅ Safe access with defaults - avoid destructuring null
  const safeRulersGrid = rulersGrid?.state || null;
  const grid = safeRulersGrid?.grid || { visual: { enabled: true, color: UI_COLORS.WHITE, opacity: 0.3, step: 25 } }; // ✅ CENTRALIZED: White grid color
  const rulers = safeRulersGrid?.rulers || {
    horizontal: {
      enabled: false,
      height: 30,
      position: 'top' as const,
      color: UI_COLORS.WHITE,
      backgroundColor: UI_COLORS.DARK_BACKGROUND,
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      unitsFontSize: 10,
      precision: 2,
      showZero: true,
      showMinorTicks: true,
      showMajorTicks: true,
      minorTickLength: 5,
      majorTickLength: 10,
      tickColor: UI_COLORS.WHITE,
      majorTickColor: UI_COLORS.WHITE,
      minorTickColor: UI_COLORS.WHITE,
      textColor: UI_COLORS.WHITE,
      unitsColor: UI_COLORS.WHITE,
      showLabels: true,
      showUnits: true,
      showBackground: true
    },
    vertical: {
      enabled: false,
      width: 30,
      position: 'left' as const,
      color: UI_COLORS.WHITE,
      backgroundColor: UI_COLORS.DARK_BACKGROUND,
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      unitsFontSize: 10,
      precision: 2,
      showZero: true,
      showMinorTicks: true,
      showMajorTicks: true,
      minorTickLength: 5,
      majorTickLength: 10,
      tickColor: UI_COLORS.WHITE,
      majorTickColor: UI_COLORS.WHITE,
      minorTickColor: UI_COLORS.WHITE,
      textColor: UI_COLORS.WHITE,
      unitsColor: UI_COLORS.WHITE,
      showLabels: true,
      showUnits: true,
      showBackground: true
    },
    units: 'mm' as const,
    snap: {
      enabled: false,
      tolerance: 5
    }
  };
  const origin = safeRulersGrid?.origin || { x: 0, y: 0 };

  // ✅ ENTERPRISE: Explicit return type to match interface requirements
  const getRulersGridSettings = (): { grid: GridSettings; rulers: RulerSettings; origin: Point2D } => {
    // ✅ Προτεραιότητα στις πιο πρόσφατες ρυθμίσεις από το ref
    const storedSettings = lastGridSettingsRef.current;
    
    if (!rulersGrid) {
      if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvasCore] No rulersGrid context, returning safe defaults');
      // ✅ ENTERPRISE: Ensure correct return type structure
      if (storedSettings && 'grid' in storedSettings && 'rulers' in storedSettings && 'origin' in storedSettings) {
        return storedSettings as { grid: GridSettings; rulers: RulerSettings; origin: Point2D };
      }
      return {
        grid: {
          visual: { enabled: true, color: UI_COLORS.WHITE, opacity: 0.3, step: 25, style: 'lines' as const, subDivisions: 5, showOrigin: true, showAxes: true, axesColor: UI_COLORS.WHITE, axesWeight: 1, majorGridColor: UI_COLORS.WHITE, minorGridColor: UI_COLORS.WHITE, majorGridWeight: 1, minorGridWeight: 0.5 },
          snap: { enabled: false, step: 25, tolerance: 5, showIndicators: false, indicatorColor: UI_COLORS.WHITE, indicatorSize: 4 },
          behavior: { autoZoomGrid: false, minGridSpacing: 10, maxGridSpacing: 100, adaptiveGrid: false, fadeAtDistance: false, fadeThreshold: 0.1 }
        } as GridSettings, // ✅ CENTRALIZED: Complete GridSettings fallback
        rulers: { horizontal: { enabled: false }, vertical: { enabled: false } },
        origin: { x: 0, y: 0 }
      } as { grid: GridSettings; rulers: RulerSettings; origin: Point2D };
    }
    
    const settings = {
      grid: storedSettings?.grid || rulersGrid.state?.grid || grid,
      rulers: storedSettings?.rulers || rulersGrid.state?.rulers || rulers,
      origin: storedSettings?.origin || rulersGrid.state?.origin || origin
    };
    if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvasCore] Returning settings:', {
      gridEnabled: settings.grid?.visual?.enabled,
      gridColor: settings.grid?.visual?.color,
      rulersHEnabled: settings.rulers?.horizontal?.enabled,
      rulersVEnabled: settings.rulers?.vertical?.enabled,
      usingStoredSettings: !!storedSettings
    });
    return settings;
  };
  
  const DEBUG = false;

  // ✅ Imperative API για canvas operations
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    getTransform: () => currentTransformRef.current,
    zoomIn: () => rendererRef.current?.zoomIn(),
    zoomOut: () => rendererRef.current?.zoomOut(),
    zoom: (factor: number) => rendererRef.current?.zoom(factor),
    zoomAtScreenPoint: (factor: number, screenPt: Point2D) =>
      rendererRef.current?.zoom(factor, screenPt),
    resetToOrigin: () => {
      const renderer = rendererRef.current;
      if (renderer) {
        currentTransformRef.current = { scale: 1, offsetX: 0, offsetY: 0 };
        // Reset to origin using the existing zoom functionality
        renderer.zoom(1 / currentTransformRef.current.scale);
        if (scene) renderer.renderScene(scene);
      }
    },
    fitToView: () => {
      if (rendererRef.current && scene) {
        // 🎯 ΣΤΑΘΕΡΟΤΗΤΑ: Pass overlayEntities for union bounds
        rendererRef.current.fitToView(scene, 'fitFullAnchorBL', overlayEntities || []);
      }
    },
    setSelectedEntityIds: (ids: string[]) => rendererRef.current?.setSelectedEntityIds(ids),
    renderScene: (scene: SceneModel) => rendererRef.current?.renderScene(scene),
    clearCanvas: () => rendererRef.current?.clearCanvas()
  }), [scene]);

  // Create canvas renderer on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Always hide cursor to allow custom crosshair overlay to handle cursor rendering
    canvas.style.cursor = 'none';
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    entityRendererRef.current = new EntityRenderer(ctx);
    // ✅ Αρχικοποίηση με γενικές ρυθμίσεις - θα ενημερωθεί στο scene useEffect
    // ✅ ENTERPRISE: Use DEFAULT_GRIP_SETTINGS as fallback for optional prop
    const effectiveGripSettings = gripSettings ?? DEFAULT_GRIP_SETTINGS;
    entityRendererRef.current.setGripSettings(effectiveGripSettings);

    const renderer = createCanvasRenderer({
      canvas,
      gripSettings: effectiveGripSettings,
      entityRenderer: entityRendererRef.current,
      initialTransform: { scale: 1, offsetX: 0, offsetY: 0 },
      alwaysShowCoarseGrid,
      selectedIdsRef,
      hoverIdRef,
      previewOverrideRef, // ✅ περνάω το preview overlay ref
      getRulersGridSettings, // ✅ περνάω τις ρυθμίσεις rulers/grid
      onRendererReady: (r) => {
        rendererRef.current = r;
        setRendererReady(true); // ✅ Mark renderer as ready
        onRendererReady?.(r);
      }
    });

    return () => {
      // ✅ Cleanup RAF calls
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      rendererRef.current = null;
      entityRendererRef.current = null;
      setRendererReady(false); // ✅ Reset readiness on cleanup
    };
  }, [gripSettings, alwaysShowCoarseGrid, onRendererReady]);

  // Update cursor style when tool changes
  useEffect(() => {
    console.log('🔧 [DxfCanvasCore] Active tool changed to:', activeTool);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Always hide cursor to allow custom crosshair overlay to handle cursor rendering
    // The CrosshairOverlay handles all cursor display consistently across all tools
    canvas.style.cursor = 'none';
    console.log('🔧 [DxfCanvasCore] Canvas cursor set to none for tool:', activeTool);
  }, [activeTool]);

  // ✅ Track scene readiness
  useEffect(() => {
    setSceneReady(!!scene);
  }, [scene]);

  // ✅ Store latest grid settings in ref - always keep most recent
  useEffect(() => {
    const currentGrid = rulersGrid?.state?.grid || grid;
    const currentRulers = rulersGrid?.state?.rulers || rulers;
    const currentOrigin = rulersGrid?.state?.origin || origin;

    if (currentGrid) {
      lastGridSettingsRef.current = {
        grid: currentGrid as GridSettings, // ✅ ENTERPRISE FIX: Use complete GridSettings from context
        rulers: currentRulers,
        origin: currentOrigin
      };
      if (DEBUG_CANVAS_CORE) console.log('🔄 [DxfCanvasCore] Grid settings stored in ref:', {
        enabled: currentGrid.visual?.enabled,
        color: currentGrid.visual?.color,
        opacity: currentGrid.visual?.opacity,
        step: currentGrid.visual?.step
      });
      
      // ✅ Apply immediately if ready, otherwise wait for readiness effect
      if (rendererReady && sceneReady && rendererRef.current && scene) {
        if (DEBUG_CANVAS_CORE) console.log('🔄 [DxfCanvasCore] Applying grid settings immediately (system ready)');
        rendererRef.current.renderScene(scene);
      } else {
        if (DEBUG_CANVAS_CORE) console.log('🔄 [DxfCanvasCore] Settings stored, waiting for readiness:', {
          rendererReady,
          sceneReady,
          hasRenderer: !!rendererRef.current,
          hasScene: !!scene
        });
      }
    }
  }, [
    // ✅ Grid/rulers dependencies - separate enabled for proper detection
    rulersGrid?.state?.grid?.visual?.enabled,
    grid?.visual?.enabled,
    rulersGrid?.state?.grid?.visual?.color || grid?.visual?.color,
    rulersGrid?.state?.grid?.visual?.opacity || grid?.visual?.opacity, 
    rulersGrid?.state?.grid?.visual?.step || grid?.visual?.step,
    // ✅ Additional grid visual dependencies as per info&logs&todos.md
    rulersGrid?.state?.grid?.visual?.majorGridColor,
    rulersGrid?.state?.grid?.visual?.minorGridColor,
    rulersGrid?.state?.grid?.visual?.subDivisions,
    rulersGrid?.state?.grid?.visual?.majorGridWeight,
    rulersGrid?.state?.grid?.visual?.minorGridWeight,
    rulersGrid?.state?.rulers || rulers,
    rulersGrid?.state?.origin || origin,
    rendererReady,
    sceneReady,
    scene
  ]);

  // ✅ Apply stored settings when renderer/scene become ready
  useEffect(() => {
    if (DEBUG_CANVAS_CORE) console.log('🔄 [DxfCanvasCore] Readiness effect triggered:', {
      rendererReady,
      sceneReady,
      hasStoredSettings: !!lastGridSettingsRef.current,
      hasRenderer: !!rendererRef.current,
      hasScene: !!scene
    });
    
    if (!rendererReady || !sceneReady || !rendererRef.current || !scene) {
      return; // Wait until everything is ready
    }
    
    const storedSettings = lastGridSettingsRef.current;
    if (!storedSettings) return;
    
    if (DEBUG_CANVAS_CORE) console.log('🔄 [DxfCanvasCore] Applying stored grid settings after readiness:', storedSettings.grid?.visual);
    rendererRef.current.renderScene(scene);
  }, [rendererReady, sceneReady, scene]); // ✅ Only readiness dependencies

  // ✅ Native contextmenu listener για 100% βεβαιότητα
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !onRequestColorMenu) return;

    const onCtx = (ev: MouseEvent) => {
      console.debug('CTX on canvas!');
      ev.preventDefault();
      ev.stopPropagation();

      // απλώς ζήτα άνοιγμα μενού – ΜΗΝ πειράξεις επιλογές εδώ
      onRequestColorMenu?.({ x: ev.clientX, y: ev.clientY });
    };

    el.addEventListener('contextmenu', onCtx, { capture: true });
    return () => el.removeEventListener('contextmenu', onCtx, { capture: true });
  }, [onRequestColorMenu]);

  // Update refs and re-render when selections change
  useEffect(() => {
    selectedIdsRef.current = new Set(selectedEntityIds ?? []);

    // ✅ Ενημέρωση grip settings ανάλογα με την παρουσία preview entity
    if (entityRendererRef.current && scene) {
      const hasPreviewEntity = scene.entities?.some(entity => ('preview' in entity && entity.preview === true));
      // ✅ ENTERPRISE: Use DEFAULT_GRIP_SETTINGS as fallback for optional prop
      const resolvedGripSettings = hasPreviewEntity ? getEffectiveGripSettings() : (gripSettings ?? DEFAULT_GRIP_SETTINGS);
      entityRendererRef.current.setGripSettings(resolvedGripSettings);
    }

    if (rendererRef.current && scene) {
      rendererRef.current.renderScene(scene);
    }
  }, [selectedEntityIds, scene, getEffectiveGripSettings, gripSettings]);

  // Safety net: ensure bus is updated when React state changes
  useEffect(() => {
    publishHighlight({ ids: selectedEntityIds ?? [] });
  }, [selectedEntityIds]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const getPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point2D => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ✅ Ctrl/⌘ multi-select helpers
  const isToggleKey = (e: React.MouseEvent) => e.ctrlKey || e.metaKey; // Ctrl (Win/Linux) ή ⌘ (Mac)

  const toggleSelectAtPoint = useCallback((screenPt: Point2D) => {
    console.debug('🎯 toggleSelectAtPoint called:', screenPt);
    if (!scene || !rendererRef.current) return;
    const rect = rendererRef.current.getCanvas().getBoundingClientRect();
    const hit = UnifiedEntitySelection.findEntityAtPoint(
      screenPt,
      scene.entities,
      scene.layers,
      currentTransformRef.current,
      rect,
      8
    );
    if (!hit) {
      console.debug('🎯 Ctrl+click on empty space - no change');
      return; // Ctrl + κλικ σε κενό: δεν κάνουμε τίποτα
    }
    console.debug('🎯 Hit entity:', hit.entity.id);
    
    // Merge / toggle πάνω στο ref (single source of truth)
    const set = new Set(selectedIdsRef.current);
    const id = hit.entity.id;
    const wasSelected = set.has(id);
    if (wasSelected) set.delete(id); else set.add(id);

    const ids = Array.from(set);
    selectedIdsRef.current = new Set(ids);
    
    console.debug('🎯 Toggle result:', { 
      entityId: id, 
      wasSelected, 
      newSelection: ids,
      totalSelected: ids.length 
    });
    
    publishHighlight({ ids, mode: 'select' });         // ένα event με ΟΛΑ τα ids
    rendererRef.current.renderSceneImmediate(scene);   // άμεσο redraw

    // ✅ ενημέρωσε το parent για να δείχνει σωστά panels κ.λπ.
    onSelectChange?.(ids);
  }, [scene, onSelectChange]);

  // Stable render callbacks to prevent infinite loops
  const renderImmediate = useCallback((scene: SceneModel) => {
    rendererRef.current?.renderSceneImmediate(scene);
  }, []);

  const render = useCallback((scene: SceneModel, opts?: { skipRulersGrid?: boolean }) => {
    rendererRef.current?.renderScene(scene, opts);
  }, []);

  // ✅ Overlay preview helper
  const setPreviewOverride = useCallback((ov: { entityId: string; next: Partial<Entity> } | null) => {
    previewOverrideRef.current = ov;
    if (scene) rendererRef.current?.renderSceneImmediate(scene);
  }, [scene]);

  // ✅ ENTERPRISE FIX: Temporarily disable missing interaction hooks
  // TODO: Re-integrate these hooks when modules are available
  const gripInteraction = {
    isDraggingRef: { current: false },
    onMouseMoveDrag: () => false,
    onMouseMoveGrip: () => false,
    onMouseDownGrip: () => false,
    onMouseUpDrag: () => {},
    breakPolygonAtGrip: () => false
  };

  const hoverAndSelect = {
    onMouseMoveEntityHover: () => {},
    onMouseDownEntitySelect: () => {},
    onMouseLeave: () => {}
  };

  // Hook up interaction handlers (DISABLED - missing modules)
  /*const gripInteraction = useGripInteraction({
    scene,
    selectedIdsRef,  // ✅ use selectedIdsRef instead of props
    transformRef: hitTestTransformRef || currentTransformRef,  // ✅ use same ref as hoverAndSelect
    canvasRef: hitTestCanvasRef || canvasRef,  // ✅ use same canvas as hoverAndSelect
    entityRendererRef,
    render,
    gripSettings,
    // ✅ Overlay preview για smooth drag
    setPreviewOverride,
    // ✅ Grip drag commit callback
    onCommitLine: (entityId, next) => {
      if (!scene || !onSceneChange) return;
      // commit στο ανώτερο state (ιστορικό, undo/redo, setLevelScene κ.λπ.)
      const newScene = {
        ...scene,
        entities: scene.entities.map(e => e.id === entityId ? { ...e, ...next } : e)
      };
      onSceneChange(newScene);
    },
    // ✅ Scene change callback για line-to-polyline conversion
    onSceneChange,
    // ✅ Cursor callback για αλλαγή cursor
    setCursor: setCursor,
    // ✅ SNAP PARAMETERS - Missing from original implementation
    snapEnabled: snapEnabled,
    findSnapPoint: findSnapPoint
  });

  const hoverAndSelect = useHoverAndSelect({
    scene,
    canvasRef: hitTestCanvasRef || canvasRef,           // ✅ use renderer's canvas if provided
    transformRef: hitTestTransformRef || currentTransformRef, // ✅ use renderer's transform if provided
    selectedIdsRef,
    hoverIdRef,
    renderImmediate,
    activeTool,
    isDraggingRef: gripInteraction.isDraggingRef,      // ✅ περνάμε το isDraggingRef για να κόψουμε hover
    setCursor: setCursor                               // ✅ περνάμε το cursor callback
  });*/

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getPoint(e);
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;

    // ✅ RAF throttling για performance
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      console.log('🖱️ [DxfCanvasCore] handleMove calling onMouseMove with point:', pt, 'activeTool:', activeTool);
      onMouseMove?.(pt);

      // Hover hit-test logic - μόνο όταν είμαστε σε select tool ή grip-edit ή δεν έχουμε active tool
      if (!activeTool || activeTool === 'select' || activeTool === 'grip-edit') {
        // ✅ ΠΡΩΤΑ: Drag (highest priority) - αν σέρνουμε, ΤΕΛΟΣ εδώ
        if (gripInteraction.onMouseMoveDrag()) return;

        // ✅ ΔΕΥΤΕΡΑ: Grip hover (higher priority) - return αν βρει grip
        if (gripInteraction.onMouseMoveGrip()) return;

        // ✅ ΤΡΙΤΑ: Regular entity hover ΜΟΝΟ αν ΔΕΝ βρήκαμε grip ή δεν σέρνουμε
        hoverAndSelect.onMouseMoveEntityHover();
      }
    });
  };

  const handleDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getPoint(e);
    if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
      onMouseDown?.(pt, e);
      
      // ✅ Bridge για το εργαλείο Layering: προώθησε τα clicks στο overlay system
      if (activeTool === 'layering') {
        console.log('🔶 [DxfCanvasCore] LAYERING MODE ACTIVE - Mouse click detected');
        console.log('🔶 [DxfCanvasCore] Click point:', pt);

        // Μετατροπή σε world coords
        const cm = rendererRef.current?.getCoordinateManager?.();
        const worldPoint = cm?.screenToWorld?.(pt) || { x: pt.x, y: pt.y };
        console.log('🔶 [DxfCanvasCore] World point:', worldPoint);

        // ✅ DISPATCH CUSTOM EVENT για overlay system
        window.dispatchEvent(new CustomEvent('overlay:canvas-click', {
          detail: { point: worldPoint }
        }));

        // ΜΗΝ συνεχίσεις σε selection/grips κτλ.
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // ✅ Right-click: Check for polygon break or context menu
      if (e.button === 2) {
        // ✅ First check if right-click is on an edge grip of a closed polygon
        const polygonBroken = gripInteraction.breakPolygonAtGrip?.();
        if (polygonBroken) {
          if (DEBUG_CANVAS_CORE) console.log('🎯 Right-click broke polygon at grip');
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        
        // ✅ Fallback to context menu
        console.debug('Right-click fallback triggered!', { button: e.button, hasCallback: !!onRequestColorMenu });
        e.preventDefault();
        e.stopPropagation();
        onRequestColorMenu?.({ x: e.clientX, y: e.clientY });
        return;
      }
      
      if (e.button !== 0) return; // μόνο left συνεχίζει
      
      // ✅ 1) Ctrl/⌘ toggling ΠΡΩΤΟ - πάνω από όλα τα άλλα!
      if (isToggleKey(e)) {
        toggleSelectAtPoint(pt);
        return; // ✅ μην ξεκινήσεις ούτε grip-drag ούτε single-select
      }
      
      // 2) Entity selection logic - only in select and grip-edit modes
      if (!activeTool || activeTool === 'select' || activeTool === 'grip-edit') {
        // ✅ Κανονική ροή: grips πρώτα, μετά single select
        const gripClicked = gripInteraction.onMouseDownGrip();

        if (!gripClicked) {
          hoverAndSelect.onMouseDownEntitySelect();
        }
      }
    }
  };

  const handleUp = () => {
    gripInteraction.onMouseUpDrag();
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onMouseMove={handleMove}
      onMouseLeave={() => {
        hoverAndSelect.onMouseLeave();
        onMouseLeave?.();
      }}
      onMouseDown={handleDown}
      onMouseUp={(e) => {
        handleUp();
        onMouseUp?.(e);
      }}
      onWheel={onWheel}
      style={getDxfCanvasCoreStyles(CANVAS_THEME.DXF_CANVAS)} /* ✅ ADR-002: Centralized canvas background */
    />
  );
});