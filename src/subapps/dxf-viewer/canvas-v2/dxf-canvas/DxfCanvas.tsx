/**
 * CANVAS V2 - DXF CANVAS COMPONENT
 * Καθαρό DXF canvas χωρίς legacy κώδικα
 *
 * Split: ADR-065 — Rendering logic extracted to dxf-canvas-renderer.ts
 */

'use client';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('DxfCanvas');

import React, { useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { DxfRenderer } from './DxfRenderer';
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
import { useCentralizedMouseHandlers } from '../../systems/cursor/useCentralizedMouseHandlers';
import { useCursor } from '../../systems/cursor/CursorSystem';
import { SelectionRenderer } from '../layer-canvas/selection/SelectionRenderer';
import type { ViewTransform, Viewport, Point2D, CanvasConfig } from '../../rendering/types/Types';
import type { DxfScene, DxfRenderOptions } from './dxf-types';
import { serviceRegistry } from '../../services';
import type { GridSettings, RulerSettings, ColorLayer } from '../layer-canvas/layer-types';
import { GridRenderer } from '../../rendering/ui/grid/GridRenderer';
import { RulerRenderer } from '../../rendering/ui/ruler/RulerRenderer';
import { GuideRenderer } from '../../systems/guides/guide-renderer';
import type { Guide, ConstructionPoint } from '../../systems/guides/guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import { canvasUI } from '@/styles/design-tokens/canvas';
import { CANVAS_THEME } from '../../config/color-config';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import { useCanvasResize } from '../../hooks/canvas';
import { RULERS_GRID_CONFIG } from '../../systems/rulers-grid/config';
import { useDxfCanvasRenderer } from './dxf-canvas-renderer';

const DEFAULT_RENDER_OPTIONS: DxfRenderOptions = {
  showGrid: false,
  showLayerNames: false,
  wireframeMode: false,
  selectedEntityIds: []
};

interface DxfCanvasProps {
  scene: DxfScene | null;
  transform: ViewTransform;
  viewport?: Viewport;
  crosshairSettings?: { enabled?: boolean };
  gridSettings?: GridSettings;
  rulerSettings?: RulerSettings;
  renderOptions?: DxfRenderOptions;
  className?: string;
  activeTool?: string;
  overlayMode?: 'select' | 'draw' | 'edit';
  colorLayers?: ColorLayer[];
  guides?: readonly Guide[];
  guidesVisible?: boolean;
  showGuideDimensions?: boolean;
  ghostGuide?: { axis: GridAxis; offset: number } | null;
  ghostDiagonalGuide?: { start: Point2D; end: Point2D } | null;
  highlightedGuideId?: string | null;
  selectedGuideIds?: ReadonlySet<string>;
  constructionPoints?: readonly ConstructionPoint[];
  highlightedPointId?: string | null;
  ghostSegmentLine?: { start: Point2D; end: Point2D } | null;
  onTransformChange?: (transform: ViewTransform) => void;
  onEntitySelect?: (entityId: string | null) => void;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D) => void;
  onCanvasClick?: (point: Point2D, shiftKey?: boolean) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onLayerSelected?: (layerId: string, position: Point2D) => void;
  onMultiLayerSelected?: (layerIds: string[]) => void;
  onEntitiesSelected?: (entityIds: string[]) => void;
  onUnifiedMarqueeResult?: (result: { layerIds: string[]; entityIds: string[] }) => void;
  isGripDragging?: boolean;
  onHoverEntity?: (entityId: string | null) => void;
  onHoverOverlay?: (overlayId: string | null) => void;
  onGripMouseDown?: (worldPos: Point2D) => boolean;
  onGripMouseUp?: (worldPos: Point2D) => boolean;
  entityPickingActive?: boolean;
}

export interface DxfCanvasRef {
  getCanvas: () => HTMLCanvasElement | null;
  getTransform: () => ViewTransform;
  fitToView: () => void;
  zoomAtScreenPoint: (factor: number, screenPoint: Point2D) => void;
}

export const DxfCanvas = React.memo(React.forwardRef<DxfCanvasRef, DxfCanvasProps>(({
  scene,
  transform,
  viewport: viewportProp,
  crosshairSettings,
  gridSettings,
  rulerSettings,
  renderOptions = DEFAULT_RENDER_OPTIONS,
  className = '',
  activeTool,
  overlayMode,
  colorLayers = [],
  guides,
  guidesVisible = true,
  showGuideDimensions = true,
  ghostGuide,
  ghostDiagonalGuide,
  highlightedGuideId,
  selectedGuideIds,
  constructionPoints,
  highlightedPointId,
  ghostSegmentLine,
  onTransformChange,
  onEntitySelect,
  onMouseMove,
  onWheelZoom,
  onCanvasClick,
  onContextMenu,
  onLayerSelected,
  onMultiLayerSelected,
  onEntitiesSelected,
  onUnifiedMarqueeResult,
  isGripDragging = false,
  onHoverEntity,
  onHoverOverlay,
  onGripMouseDown,
  onGripMouseUp,
  entityPickingActive,
  ...props
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DxfRenderer | null>(null);
  const selectionRendererRef = useRef<SelectionRenderer | null>(null);
  const gridRendererRef = useRef<GridRenderer | null>(null);
  const rulerRendererRef = useRef<RulerRenderer | null>(null);
  const guideRendererRef = useRef<GuideRenderer | null>(null);

  const { viewport, viewportRef, setInternalViewport } = useCanvasResize({ canvasRef, viewportProp });

  // Refs for RAF callback — prevents stale closures
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const resolvedViewportRef = useRef(viewport);
  resolvedViewportRef.current = viewport;

  const cursor = useCursor();

  // Selection state ref for RAF-synchronized rendering
  const selectionStateRef = useRef<{ isSelecting: boolean; selectionStart: Point2D | null; selectionCurrent: Point2D | null }>({
    isSelecting: false, selectionStart: null, selectionCurrent: null
  });
  selectionStateRef.current = {
    isSelecting: cursor.isSelecting,
    selectionStart: cursor.selectionStart ?? null,
    selectionCurrent: cursor.selectionCurrent ?? null
  };

  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  // Guide refs for RAF callback
  const guidesRef = useRef(guides);
  guidesRef.current = guides;
  const guidesVisibleRef = useRef(guidesVisible);
  guidesVisibleRef.current = guidesVisible;
  const showGuideDimensionsRef = useRef(showGuideDimensions);
  showGuideDimensionsRef.current = showGuideDimensions;
  const highlightedGuideIdRef = useRef(highlightedGuideId);
  highlightedGuideIdRef.current = highlightedGuideId;
  const selectedGuideIdsRef = useRef(selectedGuideIds);
  selectedGuideIdsRef.current = selectedGuideIds;
  const ghostGuideRef = useRef(ghostGuide);
  ghostGuideRef.current = ghostGuide;
  const ghostDiagonalGuideRef = useRef(ghostDiagonalGuide);
  ghostDiagonalGuideRef.current = ghostDiagonalGuide;
  const constructionPointsRef = useRef(constructionPoints);
  constructionPointsRef.current = constructionPoints;
  const highlightedPointIdRef = useRef(highlightedPointId);
  highlightedPointIdRef.current = highlightedPointId;
  const ghostSegmentLineRef = useRef(ghostSegmentLine);
  ghostSegmentLineRef.current = ghostSegmentLine;

  // Imperative handle
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    getTransform: () => transform,
    fitToView: () => {
      if (!onTransformChange) { logger.warn('fitToView: No onTransformChange callback'); return; }
      const fitToViewService = serviceRegistry.get('fit-to-view');
      const success = fitToViewService.performFitToView(scene, colorLayers, viewport, onTransformChange, { padding: 0.1, maxScale: 20, alignToOrigin: true });
      if (!success) logger.warn('fitToView: FitToViewService failed');
    },
    zoomAtScreenPoint: (factor: number, screenPoint: Point2D) => {
      if (onWheelZoom) {
        const wheelDelta = factor > 1 ? -120 : 120;
        onWheelZoom(wheelDelta, screenPoint);
      }
    }
  }), [scene, colorLayers, viewport, onTransformChange, onWheelZoom]);

  // Centralized mouse handlers
  const mouseHandlers = useCentralizedMouseHandlers({
    scene, transform, viewport, activeTool, overlayMode,
    onTransformChange, onEntitySelect, onMouseMove, onWheelZoom, onCanvasClick,
    colorLayers, onLayerSelected, onMultiLayerSelected, onEntitiesSelected,
    onUnifiedMarqueeResult, canvasRef, isGripDragging,
    onHoverEntity, onHoverOverlay, onGripMouseDown, onGripMouseUp, entityPickingActive,
    hitTestCallback: (scene, screenPos, transform, viewport) => {
      try {
        const hitTesting = serviceRegistry.get('hit-testing');
        const result = hitTesting.hitTest(screenPos, transform, viewport, {
          tolerance: TOLERANCE_CONFIG.ENTITY_HOVER_PIXELS, maxResults: 1
        });
        return result.entityId;
      } catch (error) {
        logger.error('hitTest failed', { error });
        return null;
      }
    }
  });

  const canvasConfig: CanvasConfig = {
    devicePixelRatio: getDevicePixelRatio(),
    enableHiDPI: true,
    backgroundColor: CANVAS_THEME.CONTAINER
  };

  // Initialize renderers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new DxfRenderer(canvas);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        selectionRendererRef.current = new SelectionRenderer(ctx);
        gridRendererRef.current = new GridRenderer();
        rulerRendererRef.current = new RulerRenderer();
        guideRendererRef.current = new GuideRenderer();
      }
    } catch (error) {
      logger.error('Failed to initialize DXF renderer', { error });
    }
  }, []);

  // Setup canvas
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;
    try {
      CanvasUtils.setupCanvasContext(canvas, canvasConfig);
      const rect = canvas.getBoundingClientRect();
      const newViewport = { width: rect.width, height: rect.height };
      viewportRef.current = newViewport;
      setInternalViewport(newViewport);
    } catch (error) {
      logger.error('Failed to setup DXF canvas', { error });
    }
  }, []);

  // Rendering (extracted hook)
  const { isDirtyRef } = useDxfCanvasRenderer({
    scene, renderOptions, gridSettings, rulerSettings, viewport,
    refs: {
      rendererRef, canvasRef, gridRendererRef, rulerRendererRef,
      guideRendererRef, selectionRendererRef, transformRef, resolvedViewportRef,
      selectionStateRef, activeToolRef,
      guidesRef, guidesVisibleRef, showGuideDimensionsRef, highlightedGuideIdRef,
      selectedGuideIdsRef, ghostGuideRef, ghostDiagonalGuideRef,
      constructionPointsRef, highlightedPointIdRef, ghostSegmentLineRef,
    },
    transform, guides, guidesVisible, showGuideDimensions,
    ghostGuide, ghostDiagonalGuide, highlightedGuideId,
    constructionPoints, highlightedPointId, ghostSegmentLine,
    cursorIsSelecting: cursor.isSelecting,
    cursorSelectionStartX: cursor.selectionStart?.x,
    cursorSelectionStartY: cursor.selectionStart?.y,
    cursorSelectionCurrentX: cursor.selectionCurrent?.x,
    cursorSelectionCurrentY: cursor.selectionCurrent?.y,
  });

  // Setup on mount
  useEffect(() => {
    setupCanvas();
    isDirtyRef.current = true;
  }, [setupCanvas, isDirtyRef]);

  // Viewport resize → re-setup backing store
  const prevViewportRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  useEffect(() => {
    if (!viewport.width || !viewport.height) return;
    const prev = prevViewportRef.current;
    if (prev.width === viewport.width && prev.height === viewport.height) return;
    prevViewportRef.current = { width: viewport.width, height: viewport.height };
    if (prev.width === 0 && prev.height === 0) return;
    setupCanvas();
    isDirtyRef.current = true;
  }, [viewport.width, viewport.height, setupCanvas, isDirtyRef]);

  // Initial transform: set world (0,0) at bottom-left ruler corner
  useEffect(() => {
    if (!viewport.width || !viewport.height || !onTransformChange) return;
    if (transform.offsetX === 0 && transform.offsetY === 0 && transform.scale === 1) {
      const RULER_WIDTH = RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH;
      const RULER_HEIGHT = RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT;
      onTransformChange({
        scale: 1,
        offsetX: RULER_WIDTH,
        offsetY: viewport.height - RULER_HEIGHT
      });
    }
  }, [viewport.width, viewport.height, transform.offsetX, transform.offsetY, transform.scale, onTransformChange]);

  return (
    <canvas
      ref={canvasRef}
      className={`dxf-canvas ${className}`}
      {...props}
      style={canvasUI.positioning.layers.dxfCanvasWithTools(activeTool, crosshairSettings?.enabled)}
      onMouseDown={(e) => mouseHandlers.handleMouseDown(e)}
      onMouseMove={(e) => mouseHandlers.handleMouseMove(e)}
      onMouseUp={mouseHandlers.handleMouseUp}
      onMouseLeave={(e) => mouseHandlers.handleMouseLeave(e)}
      onWheel={(e) => mouseHandlers.handleWheel(e)}
      onAuxClick={(e) => e.preventDefault()}
      onContextMenu={onContextMenu}
    />
  );
}));

DxfCanvas.displayName = 'DxfCanvas';
