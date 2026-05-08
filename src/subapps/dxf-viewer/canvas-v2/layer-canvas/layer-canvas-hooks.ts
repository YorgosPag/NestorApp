/**
 * LAYER CANVAS HOOKS
 * Extracted from LayerCanvas.tsx for SRP (ADR-065)
 *
 * Contains:
 * - useLayerHitTest: Layer hit testing + selection handler
 * - useLayerCanvasRenderer: Rendering callback + dirty flag + frame scheduler
 */

import { useRef, useCallback, useEffect } from 'react';
import type { LayerRenderer } from './LayerRenderer';
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';
import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DxfScene } from '../dxf-canvas/dxf-types';
import { ImmediatePositionStore } from '../../systems/cursor/ImmediatePositionStore';
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

// ── Types ────────────────────────────────────────────────────────────

interface SnapResult {
  point: Point2D;
  type: string;
  entityId?: string;
}

interface CursorState {
  position: Point2D | null;
  isSelecting: boolean;
  selectionStart: Point2D | null;
  selectionCurrent: Point2D | null;
}

interface LayerHitTestParams {
  layers: ColorLayer[];
  activeTool?: string;
  rendererRef: React.MutableRefObject<LayerRenderer | null>;
  onLayerClick?: (layerId: string, point: Point2D) => void;
  cursorPosition: Point2D | null;
}

interface LayerCanvasRendererParams {
  layers: ColorLayer[];
  rendererRef: React.MutableRefObject<LayerRenderer | null>;
  transformRef: React.MutableRefObject<ViewTransform>;
  resolvedViewportRef: React.MutableRefObject<Viewport>;
  viewport: Viewport;
  activeTool?: string;
  layersVisible: boolean;
  draggingOverlay: { overlayId: string; delta: Point2D } | null;
  cursor: CursorState;
  snapResults: SnapResult[];
  crosshairSettings: CrosshairSettings;
  cursorSettings: CursorSettings;
  snapSettings: SnapSettings;
  gridSettings: GridSettings;
  rulerSettings: RulerSettings;
  selectionSettings: SelectionSettings;
  renderOptions: LayerRenderOptions;
  useUnifiedUIRendering: boolean;
  transform: ViewTransform;
}

// ── useLayerHitTest ──────────────────────────────────────────────────

/**
 * Layer hit testing callback + selection handler.
 * Uses LayerRenderer.hitTest() for layer polygons (NOT HitTestingService).
 */
export function useLayerHitTest({
  layers,
  activeTool,
  rendererRef,
  onLayerClick,
  cursorPosition,
}: LayerHitTestParams) {
  const layerHitTestCallback = useCallback(
    (_scene: DxfScene | null, screenPos: Point2D, transform: ViewTransform, viewport: Viewport): string | null => {
      if (!layers || layers.length === 0) return null;

      try {
        const result = rendererRef.current?.hitTest(layers, screenPos, transform, viewport, 5);
        return result ?? null;
      } catch (error) {
        console.error('LayerCanvas LayerRenderer hitTest failed:', error);
        return null;
      }
    },
    [layers, activeTool, rendererRef],
  );

  const handleLayerSelection = useCallback(
    (layerId: string | null) => {
      if (
        layerId &&
        onLayerClick &&
        (activeTool === 'select' || activeTool === 'layering' || activeTool === 'move')
      ) {
        if (cursorPosition) {
          onLayerClick(layerId, cursorPosition);
        }
      }
    },
    [onLayerClick, activeTool, cursorPosition],
  );

  return { layerHitTestCallback, handleLayerSelection };
}

// ── useLayerCanvasRenderer ───────────────────────────────────────────

/**
 * Rendering callback + dirty-flag management + UnifiedFrameScheduler subscription.
 * Replaces scattered requestAnimationFrame calls with a single coordinated loop (ADR-119).
 */
export function useLayerCanvasRenderer(params: LayerCanvasRendererParams) {
  const {
    layers,
    rendererRef,
    transformRef,
    resolvedViewportRef,
    viewport,
    activeTool,
    layersVisible,
    draggingOverlay,
    cursor,
    snapResults,
    crosshairSettings,
    cursorSettings,
    snapSettings,
    gridSettings,
    rulerSettings,
    selectionSettings,
    renderOptions,
    transform,
  } = params;

  const isDirtyRef = useRef(true);

  // Event listeners that mark dirty
  useEffect(() => {
    const handleToggle = () => {
      isDirtyRef.current = true;
    };

    window.addEventListener('origin-markers-toggle', handleToggle as EventListener);
    window.addEventListener('ruler-debug-toggle', handleToggle as EventListener);

    return () => {
      window.removeEventListener('origin-markers-toggle', handleToggle as EventListener);
      window.removeEventListener('ruler-debug-toggle', handleToggle as EventListener);
    };
  }, []);

  // Core render callback
  const renderLayers = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer || !viewport.width || !viewport.height) return;

    try {
      // Selection box from cursor state
      const currentSelectionBox =
        cursor.isSelecting && cursor.selectionStart && cursor.selectionCurrent
          ? ({
              startPoint: cursor.selectionStart,
              endPoint: cursor.selectionCurrent,
              type: cursor.selectionCurrent.x > cursor.selectionStart.x ? 'window' : 'crossing',
            } as const)
          : null;

      // 🚀 PERF (2026-05-08): read live position from ImmediatePositionStore
      // instead of cursor.position (which on the new architecture is a getter
      // backed by the same store). Direct read avoids any context indirection
      // inside the hot render path.
      const centralizedPosition = ImmediatePositionStore.getPosition();
      const isPanToolActive = activeTool === 'pan';

      // Filter layers based on visibility + draft state
      let filteredLayers = layersVisible ? layers : layers.filter((l) => l.isDraft);

      // Ghost rendering during move tool drag
      if (draggingOverlay?.delta) {
        filteredLayers = filteredLayers.map((layer) => {
          if (layer.id === draggingOverlay.overlayId) {
            return {
              ...layer,
              polygons: layer.polygons.map((poly) => ({
                ...poly,
                vertices: poly.vertices.map((vertex: Point2D) => ({
                  x: vertex.x + draggingOverlay.delta.x,
                  y: vertex.y + draggingOverlay.delta.y,
                })),
              })),
            };
          }
          return layer;
        });
      }

      const layerSnapResults: LayerRenderOptions['snapResults'] = snapResults.map((snap) => ({
        point: snap.point,
        type: snap.type as LayerRenderOptions['snapResults'][number]['type'],
        entityId: snap.entityId ?? undefined,
      }));

      const finalRenderOptions = {
        ...renderOptions,
        showCrosshair: renderOptions.showCrosshair && !isPanToolActive,
        showCursor: renderOptions.showCursor && !isPanToolActive,
        crosshairPosition: isPanToolActive ? null : centralizedPosition,
        cursorPosition: isPanToolActive ? null : centralizedPosition,
        showSelectionBox: !isPanToolActive && cursor.isSelecting && currentSelectionBox !== null,
        selectionBox: isPanToolActive ? null : currentSelectionBox,
        snapResults: layerSnapResults,
      };

      // Use refs for transform/viewport — prevents RAF stale closure issue
      renderer.render(
        filteredLayers,
        transformRef.current,
        resolvedViewportRef.current,
        crosshairSettings,
        cursorSettings,
        snapSettings,
        gridSettings,
        rulerSettings,
        selectionSettings,
        finalRenderOptions,
      );
    } catch (error) {
      console.error('Failed to render Layer canvas:', error);
    }
  }, [
    layers,
    cursor.position,
    cursor.isSelecting,
    cursor.selectionStart,
    cursor.selectionCurrent,
    snapResults,
    activeTool,
    layersVisible,
    draggingOverlay,
    renderOptions,
    crosshairSettings,
    cursorSettings,
    snapSettings,
    gridSettings,
    rulerSettings,
    selectionSettings,
    viewport.width,
    viewport.height,
    rendererRef,
    transformRef,
    resolvedViewportRef,
  ]);

  // Register with UnifiedFrameScheduler (ADR-119)
  useEffect(() => {
    if (viewport.width > 0 && viewport.height > 0 && rendererRef.current) {
      const unsubscribe = registerRenderCallback(
        'layer-canvas',
        'Layer Canvas Renderer',
        RENDER_PRIORITIES.NORMAL,
        () => {
          renderLayers();
          isDirtyRef.current = false;
        },
        () => isDirtyRef.current,
      );
      return unsubscribe;
    }
  }, [renderLayers, viewport.width, viewport.height, rendererRef]);

  // Mark dirty when dependencies change
  // 🏢 ADR-030: settings deps included so panel changes (crosshair / cursor
  // pickbox / selection box / grid / ruler) flag the canvas dirty without
  // requiring a mouse move. Pairs with `markAllCanvasDirty()` in
  // CursorConfiguration.notifyListeners (singleton-side belt-and-suspenders).
  useEffect(() => {
    isDirtyRef.current = true;
  }, [
    layers,
    transform,
    viewport,
    cursor.position,
    cursor.isSelecting,
    cursor.selectionStart,
    cursor.selectionCurrent,
    snapResults,
    layersVisible,
    activeTool,
    draggingOverlay,
    crosshairSettings,
    cursorSettings,
    selectionSettings,
    gridSettings,
    rulerSettings,
  ]);

  return { isDirtyRef };
}
