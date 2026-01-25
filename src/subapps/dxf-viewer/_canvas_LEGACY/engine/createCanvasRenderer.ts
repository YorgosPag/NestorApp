import React from 'react';

// ✅ Debug flag for canvas renderer logging
const DEBUG_CANVAS_CORE = false;
import type { SceneModel, AnySceneEntity } from '../../types/scene';
import type { Point2D, ViewTransform } from '../../systems/rulers-grid/config';
import { MARGINS } from '../../systems/rulers-grid/config';
import { UnifiedEntitySelection } from '../../utils/unified-entity-selection';
// Missing modules - creating mocks
// import { renderScene, type RenderOptions } from './scene-render';
// import { createTransformHelpers } from './transforms';

// Mock implementations
export interface RenderOptions {
  skipRulersGrid?: boolean;
}

const renderScene = (ctx: CanvasRenderingContext2D, scene: SceneModel, transform: ViewTransform, options?: RenderOptions) => {};

const createTransformHelpers = (transformRef: { current: ViewTransform }, canvas: HTMLCanvasElement) => ({
  worldToScreen: (point: Point2D, transform?: ViewTransform): Point2D => {
    const t = transform || transformRef.current;
    return {
      x: point.x * t.scale + t.offsetX,
      y: point.y * t.scale + t.offsetY
    };
  },
  screenToWorld: (point: Point2D, transform?: ViewTransform): Point2D => {
    const t = transform || transformRef.current;
    return {
      x: (point.x - t.offsetX) / t.scale,
      y: (point.y - t.offsetY) / t.scale
    };
  },
  worldToScreenOfficial: (point: Point2D): Point2D => {
    const t = transformRef.current;
    return {
      x: point.x * t.scale + t.offsetX,
      y: point.y * t.scale + t.offsetY
    };
  },
  setTransform: (transform: ViewTransform) => {
    transformRef.current = transform;
  },
  getRulerOffsetCss: () => 0
});
// ✅ ADR-010: Import FitToViewService for centralized fit-to-view operations
import { FitToViewService } from '../../services/FitToViewService';
// Old rulers-grid import removed - using new RulersGridSystem instead
import { EntityRenderer } from '../../utils/entity-renderer';
import type { GripSettings } from '../../types/gripSettings';
import type { GridSettings, RulerSettings } from '../../systems/rulers-grid/config';

export type CanvasRendererBounds = {
  min: Point2D;
  max: Point2D;
};

// Helper που βάλαμε για το empty-scene guard
export function normalizeEmptyBounds(bounds: CanvasRendererBounds): CanvasRendererBounds {
  const isEmpty =
    bounds.min.x === 0 &&
    bounds.min.y === 0 &&
    bounds.max.x === 0 &&
    bounds.max.y === 0;

  if (!isEmpty) return bounds;

  // το virtual 100×100 κουτί που συμφωνήσαμε
  return {
    min: { x: 0, y: 0 },
    max: { x: 100, y: 100 },
  };
}

export interface CanvasRenderer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  setScene: (s: SceneModel) => void;
  renderScene: (s: SceneModel, opts?: RenderOptions) => void;
  renderSceneImmediate: (s: SceneModel, opts?: RenderOptions) => void;
  clear: () => void;
  clearCanvas: () => void;
  fitToView: (s: SceneModel, mode?: string, overlayEntities?: unknown[]) => void;
  getTransform: () => ViewTransform;
  getCanvas: () => HTMLCanvasElement;
  getCoordinateManager: () => {
    screenToWorld: (p: Point2D) => Point2D;
    worldToScreen: (p: Point2D) => Point2D;
    setTransform: (t: ViewTransform) => void;
    getRulerOffsetCss: () => number;
  };
  findEntityAt: (point: Point2D, tolerance?: number) => AnySceneEntity | null;
  setSelectedEntityIds: (ids: string[]) => void;
  setGripSettings: (g: GripSettings) => void;
  // Undo/redo stubs
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  // Zoom methods
  zoom: (factor: number, center?: Point2D) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  // Pan methods  
  pan: (deltaX: number, deltaY: number) => void;
  activateZoomWindow: () => void;
  deactivateZoomWindow: () => void;
}

interface CreateCanvasRendererArgs {
  canvas: HTMLCanvasElement;
  gripSettings: GripSettings;
  entityRenderer: EntityRenderer;
  initialTransform: ViewTransform;
  alwaysShowCoarseGrid: boolean;
  onRendererReady?: (renderer: CanvasRenderer) => void;
  selectedIdsRef: React.MutableRefObject<Set<string>>;
  hoverIdRef: React.MutableRefObject<string | null>;
  previewOverrideRef: React.MutableRefObject<{ entityId: string; next: Record<string, unknown> } | null>; // ✅ overlay preview
  getRulersGridSettings?: () => { grid: GridSettings; rulers: RulerSettings; origin: Point2D };
}

export function createCanvasRenderer(args: CreateCanvasRendererArgs): CanvasRenderer {
  const {
    canvas,
    gripSettings,
    entityRenderer,
    initialTransform,
    alwaysShowCoarseGrid,
    onRendererReady,
    selectedIdsRef,
    hoverIdRef,
    previewOverrideRef,
    getRulersGridSettings
  } = args;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get 2D context');

  let currentTransform: ViewTransform = initialTransform;
  let currentScene: SceneModel | null = null;
  
  const currentTransformRef = {
    current: currentTransform
  };

  // Setup backing store
  const setupBackingStore = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    
    // 🎯 ChatGPT-5 FIX: σωστό transform για DPR
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  setupBackingStore();

  const transformHelpers = createTransformHelpers(currentTransformRef, canvas);

  const renderSceneInternal = (scene: SceneModel, options: RenderOptions = {}) => {
    // Get current rulers/grid settings if available
    const rulersGridSettings = getRulersGridSettings?.();
    if (DEBUG_CANVAS_CORE) console.log('🔍 [createCanvasRenderer] renderSceneInternal called');
    if (DEBUG_CANVAS_CORE) console.log('🔍 [createCanvasRenderer] getRulersGridSettings function exists:', !!getRulersGridSettings);
    if (DEBUG_CANVAS_CORE) console.log('🔍 [createCanvasRenderer] rulersGridSettings result:', !!rulersGridSettings);
    if (rulersGridSettings) {
      if (DEBUG_CANVAS_CORE) console.log('🔍 [createCanvasRenderer] Grid settings:', {
        enabled: rulersGridSettings.grid.visual.enabled,
        color: rulersGridSettings.grid.visual.color,
        step: rulersGridSettings.grid.visual.step
      });
    }
    
    renderScene(context, scene, currentTransformRef.current, options);
  };

  function clearCanvasHelper() {
    if (!context) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    // 🎯 ChatGPT-5 FIX: σωστό transform για DPR
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const performInitialRender = () => {
    clearCanvasHelper();
    
    // Old hardcoded rulers/grid drawing removed - using new RulersGridSystem
  };

  const realRenderer: CanvasRenderer = {
    canvas,
    context,
    setScene: (scene: SceneModel) => { 
      currentScene = scene;
      renderSceneInternal(scene); 
    },
    renderScene: renderSceneInternal,
    renderSceneImmediate: renderSceneInternal,
    clear: clearCanvasHelper,
    clearCanvas: () => realRenderer.clear(),
    fitToView: (scene: SceneModel, _mode: string = 'fitFullAnchorBL', _overlayEntities: unknown[] = []) => {
      // ✅ ADR-010: ACL Pattern - Use FitToViewService.calculateFitToViewFromBounds
      // This uses the scene's pre-calculated bounds directly, avoiding type conversion issues

      // Guard: No scene or no bounds
      if (!scene?.bounds) return;

      // Guard: handle empty scene bounds
      const bounds = normalizeEmptyBounds(scene.bounds);

      const rect = canvas.getBoundingClientRect();
      const viewport = { width: rect.width, height: rect.height };

      const result = FitToViewService.calculateFitToViewFromBounds(
        bounds,
        viewport,
        { padding: 0.1, alignToOrigin: false }
      );

      if (result.success && result.transform) {
        currentTransform = result.transform;
        currentTransformRef.current = currentTransform;
        renderSceneInternal(scene);
      }
    },
    getCanvas: () => canvas,
    getTransform: () => currentTransformRef.current,
    findEntityAt: (point: Point2D, tolerance = 8): AnySceneEntity | null => {
      if (!currentScene || !currentScene.entities || currentScene.entities.length === 0) return null;
      const viewTransform = currentTransformRef.current;
      const canvasRect = canvas.getBoundingClientRect();
      const hit = UnifiedEntitySelection.findEntityAtPoint(point, currentScene.entities, currentScene.layers, viewTransform, canvasRect, tolerance);
      return hit ? hit.entity : null;
    },
    getCoordinateManager: () => ({
      screenToWorld: transformHelpers.screenToWorld,
      worldToScreen: transformHelpers.worldToScreenOfficial,
      setTransform: transformHelpers.setTransform,
      getRulerOffsetCss: transformHelpers.getRulerOffsetCss
    }),
    undo: () => { if (DEBUG_CANVAS_CORE) console.log("Undo action called"); return false; },
    redo: () => { if (DEBUG_CANVAS_CORE) console.log("Redo action called"); return false; },
    canUndo: () => false,
    canRedo: () => false,
    zoom: (factor: number, center?: Point2D) => {
      const rect = canvas.getBoundingClientRect();
      const centerPoint = center || { x: rect.width / 2, y: rect.height / 2 };
      
      // Professional CAD-style cursor-centric zoom
      // Method: Keep world point fixed at screen position during scale change
      
      const { left, bottom } = MARGINS;
      const oldScale = currentTransform.scale;
      const newScale = Math.max(0.01, Math.min(200, oldScale * factor));
      
      // Convert cursor position to world coordinates using current transform
      // screenToWorld formula: world = (screen - margin - offset*scale) / scale
      const worldX = (centerPoint.x - left - currentTransform.offsetX * oldScale) / oldScale;
      const worldY = ((rect.height - bottom - centerPoint.y) - currentTransform.offsetY * oldScale) / oldScale;
      
      // Calculate new offsets so the same world point appears at the same screen position
      // Solve: centerPoint.x = left + (worldX + newOffsetX) * newScale
      // So: newOffsetX = (centerPoint.x - left) / newScale - worldX
      const newOffsetX = (centerPoint.x - left) / newScale - worldX;
      const newOffsetY = ((rect.height - bottom - centerPoint.y) / newScale) - worldY;
      
      currentTransform = {
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY
      };
      
      currentTransformRef.current = currentTransform;
      
      if (currentScene) {
        renderSceneInternal(currentScene);
      }
    },
    zoomIn: () => realRenderer.zoom(1.2),
    zoomOut: () => realRenderer.zoom(1/1.2),
    pan: (deltaX: number, deltaY: number) => {
      // Convert screen deltas to world deltas
      const worldDeltaX = deltaX / currentTransform.scale;
      const worldDeltaY = -deltaY / currentTransform.scale; // Flip Y for world coords
      
      currentTransform = {
        ...currentTransform,
        offsetX: currentTransform.offsetX + worldDeltaX,
        offsetY: currentTransform.offsetY + worldDeltaY
      };
      
      currentTransformRef.current = currentTransform;
      
      if (currentScene) {
        renderSceneInternal(currentScene);
      }
    },
    activateZoomWindow: () => {
      if (DEBUG_CANVAS_CORE) console.log("Zoom window activated");
    },
    deactivateZoomWindow: () => {
      if (DEBUG_CANVAS_CORE) console.log("Zoom window deactivated");
    },
    setSelectedEntityIds: (ids: string[]) => {
      if (currentScene) renderSceneInternal(currentScene); // Immediate for selection feedback
    },
    setGripSettings: (settings: GripSettings) => {
      entityRenderer.setGripSettings(settings);
    }
  };

  // ResizeObserver temporarily disabled to prevent infinite loop
  // TODO: Re-enable with proper debouncing after fixing root cause
  // const ro = new ResizeObserver(() => {
  //   setupBackingStore();
  // });
  // ro.observe(canvas.parentElement ?? canvas);

  // Initial render
  performInitialRender();

  // Notify parent
  onRendererReady?.(realRenderer);

  return realRenderer;
}