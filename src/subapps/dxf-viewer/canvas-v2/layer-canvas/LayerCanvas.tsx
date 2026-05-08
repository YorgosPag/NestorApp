/**
 * CANVAS V2 - LAYER CANVAS COMPONENT
 * Καθαρό Layer canvas για έγχρωμα layers + crosshair + snap indicators
 *
 * 🎯 ΚΡΙΣΙΜΟ: LAYER SELECTION DOCUMENTATION
 *
 * Για να δουλεύει το layer clicking (σταυρόνημα επιλέγει έγχρωμο layer):
 *
 * 1. ✅ COORDINATE CONVERSION: CanvasUtils.screenToCanvas() (όχι manual rect.left)
 * 2. ✅ HIT TESTING: LayerRenderer.hitTest() (όχι HitTestingService)
 * 3. ✅ COORDINATE SYSTEMS: CoordinateTransforms από rendering/core/
 *
 * ❌ ΣΥΧΝΑ ΛΑΘΗ:
 * - Χρήση HitTestingService αντί LayerRenderer.hitTest()
 * - Manual coordinate conversion αντί CanvasUtils.screenToCanvas()
 * - Duplicate coordinate functions αντί κεντρικό CoordinateTransforms
 *
 * Split: ADR-065 — Rendering logic extracted to layer-canvas-hooks.ts
 */

'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useCanvasResize } from '../../hooks/canvas';
import { LayerRenderer } from './LayerRenderer';
import { useCentralizedMouseHandlers } from '../../systems/cursor/useCentralizedMouseHandlers';
import { useCursor } from '../../systems/cursor/CursorSystem';
import { useCursorPosition } from '../../systems/cursor/useCursor';
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
import { createUnifiedCanvasSystem } from '../../rendering/canvas';
import type { CanvasManager, CanvasInstance } from '../../rendering/canvas/core/CanvasManager';
import type { CanvasEventSystem } from '../../rendering/canvas/core/CanvasEventSystem';
import type { CanvasSettings } from '../../rendering/canvas/core/CanvasSettings';
import { canvasUI } from '@/styles/design-tokens/canvas';
import { CANVAS_THEME } from '../../config/color-config';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import { subscribeToTransformChanges } from '../../rendering/canvas/core/CanvasEventSystem';
import { useLayerHitTest, useLayerCanvasRenderer } from './layer-canvas-hooks';
import type { ViewTransform, Viewport, Point2D, CanvasConfig } from '../../rendering/types/Types';
import type { SnapResult } from './layer-types';
import type { DxfScene } from '../dxf-canvas/dxf-types';
import type {
  ColorLayer,
  LayerRenderOptions,
  SnapSettings,
  GridSettings,
  RulerSettings,
  SelectionSettings
} from './layer-types';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
import type { CursorSettings } from '../../systems/cursor/config';

interface LayerCanvasProps {
  layers: ColorLayer[];
  transform: ViewTransform;
  viewport?: Viewport;
  activeTool?: string;
  overlayMode?: 'select' | 'draw' | 'edit';
  layersVisible?: boolean;
  dxfScene?: DxfScene | null;
  crosshairSettings: CrosshairSettings;
  cursorSettings: CursorSettings;
  snapSettings: SnapSettings;
  gridSettings: GridSettings;
  rulerSettings: RulerSettings;
  selectionSettings: SelectionSettings;
  renderOptions?: LayerRenderOptions;
  className?: string;
  style?: React.CSSProperties;
  onLayerClick?: (layerId: string, point: Point2D) => void;
  onMultiLayerClick?: (layerIds: string[]) => void;
  onCanvasClick?: (point: Point2D, shiftKey?: boolean) => void;
  isGripDragging?: boolean;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onTransformChange?: (transform: ViewTransform) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D) => void;
  onDrawingHover?: (worldPos: Point2D) => void;
  draggingOverlay?: {
    overlayId: string;
    delta: Point2D;
  } | null;
  useUnifiedUIRendering?: boolean;
  enableUnifiedCanvas?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const LayerCanvas = React.memo(React.forwardRef<HTMLCanvasElement, LayerCanvasProps>(({
  layers,
  transform,
  viewport: viewportProp,
  activeTool,
  overlayMode,
  layersVisible = true,
  dxfScene,
  crosshairSettings,
  cursorSettings,
  snapSettings,
  gridSettings,
  rulerSettings,
  selectionSettings,
  renderOptions = {
    showCrosshair: true,
    showCursor: true,
    showSnapIndicators: true,
    showGrid: true,
    showRulers: true,
    showSelectionBox: true,
    crosshairPosition: null,
    cursorPosition: null,
    snapResults: [],
    selectionBox: null
  },
  className = '',
  style,
  onLayerClick,
  onMultiLayerClick,
  onCanvasClick,
  isGripDragging = false,
  onMouseMove,
  onTransformChange,
  onWheelZoom,
  onDrawingHover,
  draggingOverlay = null,
  useUnifiedUIRendering = false,
  enableUnifiedCanvas = false,
  onContextMenu,
  ...props
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LayerRenderer | null>(null);

  // 🏢 ADR-118: Centralized canvas resize hook
  const { viewport, viewportRef, setInternalViewport } = useCanvasResize({
    canvasRef,
    viewportProp,
  });

  // 🏢 FIX: Transform/viewport refs for RAF callback — prevents stale closures
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const resolvedViewportRef = useRef(viewport);
  resolvedViewportRef.current = viewport;

  const cursor = useCursor();
  const cursorPosition = useCursorPosition();

  // ── Hit testing + selection (extracted hook) ───────────────────────
  const { layerHitTestCallback, handleLayerSelection } = useLayerHitTest({
    layers,
    activeTool,
    rendererRef,
    onLayerClick,
    cursorPosition,
  });

  // ── Centralized mouse handlers ─────────────────────────────────────
  const mouseHandlers = useCentralizedMouseHandlers({
    scene: dxfScene || null,
    transform,
    viewport,
    activeTool,
    overlayMode,
    onTransformChange,
    onEntitySelect: handleLayerSelection,
    onMouseMove,
    onWheelZoom,
    onCanvasClick,
    hitTestCallback: layerHitTestCallback,
    colorLayers: layers,
    onLayerSelected: onLayerClick,
    onMultiLayerSelected: onMultiLayerClick,
    canvasRef: canvasRef,
    isGripDragging,
    onDrawingHover
  });

  const { snapResults: rawSnapResults } = mouseHandlers;
  const snapResults: SnapResult[] = rawSnapResults
    .filter((s): s is typeof s & { type: 'endpoint' | 'midpoint' | 'center' | 'intersection' } =>
      s.type === 'endpoint' || s.type === 'midpoint' || s.type === 'center' || s.type === 'intersection')
    .map((s) => ({ point: s.point, type: s.type, entityId: s.entityId ?? undefined }));

  // ── Unified canvas system state ────────────────────────────────────
  const [_canvasManager, setCanvasManager] = useState<CanvasManager | null>(null);
  const [_canvasInstance, setCanvasInstance] = useState<CanvasInstance | null>(null);
  const [eventSystem, setEventSystem] = useState<CanvasEventSystem | null>(null);
  const [_canvasSettings, setCanvasSettings] = useState<CanvasSettings | null>(null);

  const canvasConfig: CanvasConfig = {
    devicePixelRatio: getDevicePixelRatio(),
    enableHiDPI: true,
    backgroundColor: CANVAS_THEME.LAYER_CANVAS
  };

  // ── Initialize unified canvas system and renderer ──────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      if (enableUnifiedCanvas) {
        const unifiedSystem = createUnifiedCanvasSystem({
          enableCoordination: true,
          enableMetrics: true,
          debugMode: false
        });

        setCanvasManager(unifiedSystem.manager);
        setEventSystem(unifiedSystem.eventSystem);
        setCanvasSettings(unifiedSystem.settings);

        const instance = unifiedSystem.manager.registerCanvas(
          'layer-canvas',
          'layer',
          canvas,
          {
            enableHiDPI: true,
            backgroundColor: CANVAS_THEME.LAYER_CANVAS,
            devicePixelRatio: getDevicePixelRatio(),
            imageSmoothingEnabled: true
          },
          10
        );

        setCanvasInstance(instance);
        rendererRef.current = new LayerRenderer(canvas, instance, unifiedSystem.eventSystem, unifiedSystem.settings);
      } else {
        rendererRef.current = new LayerRenderer(canvas);
      }

      if (enableUnifiedCanvas && eventSystem) {
        eventSystem.setDebugMode(false);
      }
    } catch (error) {
      console.error('LayerCanvas: Failed to initialize renderer:', error);
    }
  }, [enableUnifiedCanvas, activeTool]);

  // Subscribe to transform changes from DXF canvas
  useEffect(() => {
    const unsubscribe = subscribeToTransformChanges(() => {
      // Sync transform changes — re-render disabled to prevent infinite loops
    });
    return unsubscribe;
  }, []);

  // ── Canvas setup ───────────────────────────────────────────────────
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      CanvasUtils.setupCanvasContext(canvas, canvasConfig);
      const rect = canvas.getBoundingClientRect();
      const newViewport = { width: rect.width, height: rect.height };
      viewportRef.current = newViewport;
      setInternalViewport(newViewport);
    } catch (error) {
      console.error('Failed to setup Layer canvas:', error);
    }
  }, []);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  // Sync backing store when viewport changes (prevents ghost artifacts)
  const prevViewportRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // ── Rendering (extracted hook) ─────────────────────────────────────
  const { isDirtyRef } = useLayerCanvasRenderer({
    layers,
    rendererRef,
    transformRef,
    resolvedViewportRef,
    viewport,
    activeTool,
    layersVisible,
    draggingOverlay,
    cursor: {
      position: cursor.position,
      isSelecting: cursor.isSelecting,
      selectionStart: cursor.selectionStart,
      selectionCurrent: cursor.selectionCurrent,
    },
    snapResults,
    crosshairSettings,
    cursorSettings,
    snapSettings,
    gridSettings,
    rulerSettings,
    selectionSettings,
    renderOptions,
    useUnifiedUIRendering,
    transform,
  });

  // Viewport resize → re-setup canvas backing store
  useEffect(() => {
    if (!viewport.width || !viewport.height) return;

    const prevVp = prevViewportRef.current;
    if (prevVp.width === viewport.width && prevVp.height === viewport.height) return;

    prevViewportRef.current = { width: viewport.width, height: viewport.height };
    if (prevVp.width === 0 && prevVp.height === 0) return; // skip initial

    setupCanvas();
    isDirtyRef.current = true;
  }, [viewport.width, viewport.height, setupCanvas, isDirtyRef]);

  // ── JSX ────────────────────────────────────────────────────────────
  return (
    <canvas
      ref={(el) => {
        if (canvasRef.current !== el) {
          (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
        }
        if (typeof ref === 'function') {
          ref(el);
        } else if (ref && 'current' in ref) {
          (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
        }
      }}
      className={`layer-canvas ${className}`}
      {...props}
      style={{
        ...canvasUI.positioning.layers.layerCanvasWithTools(activeTool, crosshairSettings.enabled),
        touchAction: 'none',
        userSelect: 'none',
        ...style
      }}
      onPointerDown={() => {
        // Allow events to flow to centralized handler for selection
      }}
      onPointerUp={(e) => {
        if (activeTool === 'layering') {
          e.preventDefault();
          e.stopPropagation();

          if (canvasRef.current) {
            const canvasPos = CanvasUtils.screenToCanvas(
              { x: e.clientX, y: e.clientY },
              canvasRef.current
            );

            if (layerHitTestCallback) {
              try {
                const hitResult = layerHitTestCallback(null, canvasPos, transform, viewport);
                if (hitResult && handleLayerSelection) {
                  handleLayerSelection(hitResult);
                }
              } catch (error) {
                console.error('POINTER UP: Hit-test failed:', error);
              }
            }
          }
        }
      }}
      onMouseEnter={() => {
        // Handled by mouse handlers
      }}
      onMouseMove={(e) => mouseHandlers.handleMouseMove(e)}
      onMouseLeave={(e) => mouseHandlers.handleMouseLeave(e)}
      onClick={() => {
        // Handled by mouse handlers
      }}
      onMouseDown={(e) => mouseHandlers.handleMouseDown(e)}
      onMouseUp={(e) => mouseHandlers.handleMouseUp(e)}
      onWheel={(e) => mouseHandlers.handleWheel(e)}
      onAuxClick={(e) => e.preventDefault()}
      onContextMenu={onContextMenu}
    />
  );
}));

LayerCanvas.displayName = 'LayerCanvas';
