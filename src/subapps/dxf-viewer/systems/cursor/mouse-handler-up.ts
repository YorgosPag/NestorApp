/**
 * Mouse Up Handler — ADR-065 SRP split
 * Extracted from useCentralizedMouseHandlers.ts
 * Handles: pan cleanup, grip release, drawing clicks, marquee selection, point-click pipeline
 */

import { useCallback } from 'react';
import {
  CoordinateTransforms,
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot,
} from '../../rendering/core/CoordinateTransforms';
import { canvasEventBus } from '../../rendering/canvas/core/CanvasEventSystem';
import { isInDrawingMode } from '../tools/ToolStateManager';
import { UniversalMarqueeSelector } from '../selection/UniversalMarqueeSelection';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { CentralizedMouseHandlersProps, MouseHandlerRefs, SnapManagerAPI } from './mouse-handler-types';

interface MouseUpHandlerDeps {
  props: CentralizedMouseHandlersProps;
  cursor: ReturnType<typeof import('./CursorSystem').useCursor>;
  refs: MouseHandlerRefs;
  snap: SnapManagerAPI;
}

export function useMouseUpHandler({ props, cursor, refs, snap }: MouseUpHandlerDeps) {
  const {
    transform, viewport, onTransformChange, onEntitySelect, hitTestCallback,
    scene, colorLayers, onLayerSelected, onMultiLayerSelected, canvasRef,
    onCanvasClick, activeTool, overlayMode, onEntitiesSelected,
    onUnifiedMarqueeResult, onGripMouseUp,
  } = props;
  const { snapEnabled, findSnapPoint } = snap;

  return useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    cursor.setMouseDown(false);

    // Pan cleanup
    const panState = refs.panStateRef.current;
    const wasPanning = panState.isPanning;

    if (panState.isPanning) {
      panState.isPanning = false;
      panState.lastMousePos = null;

      if (panState.pendingTransform && onTransformChange) {
        onTransformChange(panState.pendingTransform);
        canvasEventBus.emitTransformChange(panState.pendingTransform, viewport, 'dxf-canvas');
        panState.pendingTransform = null;
      }

      if (panState.animationId) {
        cancelAnimationFrame(panState.animationId);
        panState.animationId = null;
      }
    }

    // Grip drag-release with snap
    if (e.button === 0 && onGripMouseUp) {
      const upSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (upSnap) {
        const upScreenPos = getScreenPosFromEvent(e, upSnap);
        let upWorldPos = screenToWorldWithSnapshot(upScreenPos, transform, upSnap);

        if (snapEnabled && findSnapPoint) {
          const snapResult = findSnapPoint(upWorldPos.x, upWorldPos.y);
          if (snapResult && snapResult.found && snapResult.snappedPoint) {
            upWorldPos = snapResult.snappedPoint;
          }
        }

        if (onGripMouseUp(upWorldPos)) {
          cursor.endSelection();
          return;
        }
      }
    }

    // Drawing tools click (left button only, not after pan)
    const isLeftClick = e.button === 0;

    if (onCanvasClick && isLeftClick && !cursor.isSelecting && !wasPanning) {
      const clickSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (!clickSnap) return;

      const freshScreenPos = getScreenPosFromEvent(e, clickSnap);
      let worldPoint = screenToWorldWithSnapshot(freshScreenPos, transform, clickSnap);

      if (snapEnabled && findSnapPoint) {
        const snapResult = findSnapPoint(worldPoint.x, worldPoint.y);
        if (snapResult && snapResult.found && snapResult.snappedPoint) {
          worldPoint = snapResult.snappedPoint;
        }
      }

      onCanvasClick(worldPoint, e.shiftKey);
    }

    // Marquee selection processing
    if (cursor.isSelecting && cursor.selectionStart && cursor.position) {
      processMarqueeSelection(e, {
        cursor, transform, viewport, canvasRef, colorLayers, scene,
        hitTestCallback, onEntitySelect, onCanvasClick, onLayerSelected,
        onMultiLayerSelected, onEntitiesSelected, onUnifiedMarqueeResult,
        activeTool, overlayMode,
      });
      cursor.endSelection();
    } else if (cursor.position && hitTestCallback) {
      // Single point hit-test (no marquee)
      const isDrawing = isInDrawingMode(activeTool, overlayMode);
      if (!isDrawing) {
        const canvasForHit = canvasRef?.current ?? null;
        const hitSnap = getPointerSnapshotFromElement(canvasForHit);
        if (!hitSnap) return;
        const hitResult = hitTestCallback(scene, cursor.position, transform, hitSnap.viewport);
        if (onEntitySelect) onEntitySelect(hitResult);
      }
    }
  }, [cursor, onTransformChange, viewport, hitTestCallback, scene, transform, onEntitySelect, colorLayers, onLayerSelected, onMultiLayerSelected, canvasRef, onCanvasClick, activeTool, overlayMode, snapEnabled, findSnapPoint, onGripMouseUp, onEntitiesSelected, onUnifiedMarqueeResult, refs]);
}

// ===== Marquee Selection Processing (extracted for readability) =====

interface MarqueeContext {
  cursor: ReturnType<typeof import('./CursorSystem').useCursor>;
  transform: CentralizedMouseHandlersProps['transform'];
  viewport: CentralizedMouseHandlersProps['viewport'];
  canvasRef: CentralizedMouseHandlersProps['canvasRef'];
  colorLayers: CentralizedMouseHandlersProps['colorLayers'];
  scene: CentralizedMouseHandlersProps['scene'];
  hitTestCallback: CentralizedMouseHandlersProps['hitTestCallback'];
  onEntitySelect: CentralizedMouseHandlersProps['onEntitySelect'];
  onCanvasClick: CentralizedMouseHandlersProps['onCanvasClick'];
  onLayerSelected: CentralizedMouseHandlersProps['onLayerSelected'];
  onMultiLayerSelected: CentralizedMouseHandlersProps['onMultiLayerSelected'];
  onEntitiesSelected: CentralizedMouseHandlersProps['onEntitiesSelected'];
  onUnifiedMarqueeResult: CentralizedMouseHandlersProps['onUnifiedMarqueeResult'];
  activeTool: CentralizedMouseHandlersProps['activeTool'];
  overlayMode: CentralizedMouseHandlersProps['overlayMode'];
}

function processMarqueeSelection(
  e: React.MouseEvent<HTMLCanvasElement>,
  ctx: MarqueeContext,
) {
  const { cursor, transform, canvasRef, colorLayers, scene,
    hitTestCallback, onEntitySelect, onCanvasClick,
    onLayerSelected, onMultiLayerSelected, onEntitiesSelected, onUnifiedMarqueeResult,
    activeTool, overlayMode } = ctx;

  const canvas = canvasRef?.current ?? null;
  const marqueeSnap = getPointerSnapshotFromElement(canvas);

  const hasMultiCallback = !!onMultiLayerSelected;
  const hasSingleCallback = !!onLayerSelected;
  const hasEntityCallback = !!onEntitiesSelected;
  const hasUnifiedCallback = !!onUnifiedMarqueeResult;

  if (!marqueeSnap || !(hasUnifiedCallback || hasMultiCallback || hasSingleCallback || hasEntityCallback)) return;

  const selectionResult = UniversalMarqueeSelector.performSelection(
    cursor.selectionStart!,
    cursor.position!,
    transform,
    marqueeSnap.rect,
    {
      colorLayers: colorLayers ?? [],
      entities: scene?.entities ?? [],
      tolerance: TOLERANCE_CONFIG.HIT_TEST_FALLBACK,
      enableDebugLogs: false,
      onLayerSelected: undefined,
      currentPosition: cursor.position!,
    }
  );

  if (selectionResult.selectedIds.length > 0) {
    const breakdown = selectionResult.breakdown;
    const layerAndOverlayIds = [...(breakdown?.layerIds ?? []), ...(breakdown?.overlayIds ?? [])];
    const entityIds = breakdown?.entityIds ?? [];

    if (hasUnifiedCallback) {
      onUnifiedMarqueeResult!({ layerIds: layerAndOverlayIds, entityIds });
    } else {
      if (layerAndOverlayIds.length > 0) {
        if (hasMultiCallback) onMultiLayerSelected!(layerAndOverlayIds);
        else if (hasSingleCallback) layerAndOverlayIds.forEach(id => onLayerSelected!(id, cursor.position!));
      }
      if (entityIds.length > 0 && hasEntityCallback) onEntitiesSelected!(entityIds);
    }
  } else {
    // Small selection = point click, large empty selection = deselect
    const selectionWidth = Math.abs(cursor.position!.x - cursor.selectionStart!.x);
    const selectionHeight = Math.abs(cursor.position!.y - cursor.selectionStart!.y);
    const MIN_MARQUEE_SIZE = 5;
    const isSmallSelection = selectionWidth < MIN_MARQUEE_SIZE && selectionHeight < MIN_MARQUEE_SIZE;

    if (isSmallSelection) {
      processPointClick(e, ctx);
    } else if (onCanvasClick) {
      const emptySnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (!emptySnap) return;
      const emptyScreenPos = getScreenPosFromEvent(e, emptySnap);
      const worldPt = screenToWorldWithSnapshot(emptyScreenPos, transform, emptySnap);
      onCanvasClick(worldPt, e.shiftKey);
    }
  }
}

function processPointClick(
  e: React.MouseEvent<HTMLCanvasElement>,
  ctx: MarqueeContext,
) {
  const { transform, colorLayers, hitTestCallback, onEntitySelect, onCanvasClick,
    onLayerSelected, onMultiLayerSelected, scene, activeTool, overlayMode } = ctx;

  const hitTestSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
  if (!hitTestSnap) return;
  const freshScreenPos = getScreenPosFromEvent(e, hitTestSnap);
  const worldPoint = screenToWorldWithSnapshot(freshScreenPos, transform, hitTestSnap);

  // Step 1: Check overlay polygons (point-in-polygon)
  let hitLayerId: string | null = null;
  if (colorLayers && colorLayers.length > 0) {
    for (const layer of colorLayers) {
      if (!layer.polygons || layer.polygons.length === 0) continue;
      for (const polygon of layer.polygons) {
        if (!polygon.vertices || polygon.vertices.length < 3) continue;
        const vertices = polygon.vertices;
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
          const xi = vertices[i].x, yi = vertices[i].y;
          const xj = vertices[j].x, yj = vertices[j].y;
          if (((yi > worldPoint.y) !== (yj > worldPoint.y)) &&
              (worldPoint.x < (xj - xi) * (worldPoint.y - yi) / (yj - yi) + xi)) {
            inside = !inside;
          }
        }
        if (inside) { hitLayerId = layer.id; break; }
      }
      if (hitLayerId) break;
    }
  }

  if (hitLayerId) {
    if (onMultiLayerSelected) onMultiLayerSelected([hitLayerId]);
    else if (onLayerSelected) onLayerSelected(hitLayerId, freshScreenPos);
  } else if (hitTestCallback && onEntitySelect) {
    const isDrawing = isInDrawingMode(activeTool, overlayMode);
    if (!isDrawing) {
      const hitResult = hitTestCallback(scene, freshScreenPos, transform, hitTestSnap.viewport);
      if (hitResult) onEntitySelect(hitResult);
    }
    if (onCanvasClick) onCanvasClick(worldPoint, e.shiftKey);
  } else if (onCanvasClick) {
    onCanvasClick(worldPoint, e.shiftKey);
  }
}
