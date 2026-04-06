/**
 * CENTRALIZED MOUSE HANDLERS
 * Professional CAD-style mouse handling using the CursorSystem.
 * ADR-065 SRP split: 988 lines -> 4 files (types, move, up, main)
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import { useCursor } from './CursorSystem';
import { isPointInRulerArea } from './utils';
import {
  CoordinateTransforms,
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot,
} from '../../rendering/core/CoordinateTransforms';
import { canvasEventBus } from '../../rendering/canvas/core/CanvasEventSystem';
import type { Entity } from '../../types/entities';
import { isInDrawingMode } from '../tools/ToolStateManager';
import { clamp } from '../../rendering/entities/shared/geometry-utils';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { TRANSFORM_SCALE_LIMITS } from '../../config/transform-config';
import { EventBus } from '../../systems/events';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

// Re-export types for consumers
export type { SnapResultItem, ZoomConstraints, CentralizedMouseHandlersProps } from './mouse-handler-types';
import { DEBUG_MOUSE_HANDLERS } from './mouse-handler-types';
import type { CentralizedMouseHandlersProps, MouseHandlerRefs, SnapResultItem } from './mouse-handler-types';
import { useMouseMoveHandler } from './mouse-handler-move';
import { useMouseUpHandler } from './mouse-handler-up';

export function useCentralizedMouseHandlers(props: CentralizedMouseHandlersProps) {
  const {
    scene, transform, viewport, activeTool, overlayMode,
    onTransformChange, onEntitySelect, hitTestCallback,
    colorLayers, canvasRef, onCanvasClick,
    isGripDragging = false, onGripMouseDown, onHoverEntity,
  } = props;

  const cursor = useCursor();

  // Canvas ref (fallback if not provided)
  const safeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCanvasRef = canvasRef || safeCanvasRef;

  // Snap system
  const { snapEnabled } = useSnapContext();

  // Convert color layer polygons to snap-compatible entities
  const overlaySnapEntities = useMemo<Entity[]>(() => {
    if (!colorLayers || colorLayers.length === 0) return [];
    const entities: Entity[] = [];
    for (const layer of colorLayers) {
      if (!layer.visible || layer.isDraft) continue;
      for (const polygon of layer.polygons) {
        if (polygon.vertices.length < 2) continue;
        entities.push({
          id: `overlay_${layer.id}_${polygon.id}`,
          type: 'lwpolyline' as const,
          vertices: polygon.vertices,
          closed: true,
          layer: layer.name,
          color: layer.color,
        } satisfies Entity);
      }
    }
    return entities;
  }, [colorLayers]);

  const { findSnapPoint } = useSnapManager(activeCanvasRef, {
    scene: scene as import('../../types/scene').SceneModel | null,
    overlayEntities: overlaySnapEntities,
    scale: transform.scale,
    onSnapPoint: () => {}
  });

  const [snapResults, setSnapResults] = useState<SnapResultItem[]>([]);

  // Shared mutable refs
  const panStateRef = useRef<MouseHandlerRefs['panStateRef']['current']>({
    isPanning: false,
    lastMousePos: null,
    pendingTransform: null,
    animationId: null
  });

  const middleClickRef = useRef<{ lastClickTime: number; clickCount: number }>({
    lastClickTime: 0,
    clickCount: 0
  });

  const snapThrottleRef = useRef<MouseHandlerRefs['snapThrottleRef']['current']>({
    lastSnapTime: 0,
    pendingWorldPos: null,
    rafId: null,
    lastSnapFound: false,
    lastSnapX: NaN,
    lastSnapY: NaN
  });

  const cursorThrottleRef = useRef<{ lastUpdateTime: number }>({ lastUpdateTime: 0 });
  const hoverThrottleRef = useRef<number>(0);

  const refs: MouseHandlerRefs = { panStateRef, snapThrottleRef, cursorThrottleRef, hoverThrottleRef };
  const snap = { snapEnabled, findSnapPoint };

  // Apply pending transform (rAF callback)
  const applyPendingTransform = useCallback(() => {
    const panState = panStateRef.current;
    if (panState.pendingTransform && onTransformChange) {
      onTransformChange(panState.pendingTransform);
      canvasEventBus.emitTransformChange(panState.pendingTransform, viewport, 'dxf-canvas');
      panState.pendingTransform = null;
    }
    panState.animationId = null;
  }, [onTransformChange, viewport]);

  // ===== MOUSE DOWN =====
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pointerSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
    if (!pointerSnap) return;

    const screenPos = getScreenPosFromEvent(e, pointerSnap);
    cursor.updatePosition(screenPos);
    cursor.setMouseDown(true, e.button);
    cursor.setActive(true);

    // Middle button double-click → Fit to View
    if (e.button === 1) {
      const now = Date.now();
      const timeSinceLastClick = now - middleClickRef.current.lastClickTime;
      const DOUBLE_CLICK_THRESHOLD = PANEL_LAYOUT.TIMING.DOUBLE_CLICK_MS;

      if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD) {
        EventBus.emit('canvas-fit-to-view', { source: 'middle-double-click' });
        middleClickRef.current.clickCount = 0;
        middleClickRef.current.lastClickTime = 0;
        e.preventDefault();
        return;
      } else {
        middleClickRef.current.clickCount = 1;
        middleClickRef.current.lastClickTime = now;
      }
    }

    // Pan initialization
    const isToolInteractive = isInDrawingMode(activeTool, overlayMode);
    const shouldStartPan = (e.button === 1) || (activeTool === 'pan' && e.button === 0);

    if (shouldStartPan) {
      panStateRef.current.isPanning = true;
      panStateRef.current.lastMousePos = screenPos;
      panStateRef.current.pendingTransform = { ...transform };
      e.preventDefault();
      e.stopPropagation();
    }

    const worldPos = screenToWorldWithSnapshot(screenPos, transform, pointerSnap);
    cursor.updateWorldPosition(worldPos);

    // Grip drag-release (skip during drawing mode)
    if (e.button === 0 && !isToolInteractive && onGripMouseDown && onGripMouseDown(worldPos)) {
      return;
    }

    // Entity hit-test (select tool only, not drawing)
    if (hitTestCallback && onEntitySelect && !isToolInteractive && activeTool === 'select') {
      const hitEntityId = hitTestCallback(scene, screenPos, transform, pointerSnap.viewport);
      onEntitySelect(hitEntityId);
    }

    // Marquee selection start (left button, not pan, not drawing, not grip)
    const isRotationActive = activeTool === 'rotate';
    const isGuideToolActive = activeTool?.startsWith('guide-') ?? false;
    if (e.button === 0 && !e.shiftKey && activeTool !== 'pan' && !isToolInteractive && !shouldStartPan && !isGripDragging && !isRotationActive && !isGuideToolActive) {
      cursor.startSelection(screenPos);
    }
  }, [scene, transform, viewport, onEntitySelect, hitTestCallback, cursor, activeTool, overlayMode, isGripDragging, onGripMouseDown]);

  // ===== MOUSE MOVE (delegated) =====
  const handleMouseMove = useMouseMoveHandler({
    props, cursor, refs, snap, setSnapResults, applyPendingTransform,
    debugEnabled: DEBUG_MOUSE_HANDLERS,
  });

  // ===== MOUSE UP (delegated) =====
  const handleMouseUp = useMouseUpHandler({ props, cursor, refs, snap });

  // ===== MOUSE LEAVE =====
  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    if (!isPointInRulerArea(screenPoint, e.currentTarget)) {
      cursor.setActive(false);
    }
    cursor.setMouseDown(false);
    onHoverEntity?.(null);

    const panState = panStateRef.current;
    if (panState.isPanning) {
      panState.isPanning = false;
      panState.lastMousePos = null;
      if (panState.animationId) {
        cancelAnimationFrame(panState.animationId);
        panState.animationId = null;
      }
    }
  }, [cursor, onHoverEntity]);

  // ===== WHEEL (zoom / horizontal pan) =====
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    const pointerSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
    if (!pointerSnap) return;

    const zoomCenter = getScreenPosFromEvent(e, pointerSnap);
    const modifiers = { ctrlKey: e.ctrlKey || e.metaKey, shiftKey: e.shiftKey };

    // Shift+Wheel = Horizontal Pan (AutoCAD standard)
    if (modifiers.shiftKey) {
      e.preventDefault();
      const panSpeed = 2;
      const panDeltaX = e.deltaY * panSpeed;
      const newTransform = { ...transform, offsetX: transform.offsetX - panDeltaX };
      onTransformChange?.(newTransform);
      canvasEventBus.emitTransformChange(
        { scale: newTransform.scale, offsetX: newTransform.offsetX, offsetY: newTransform.offsetY },
        { width: viewport.width, height: viewport.height },
        'dxf-canvas'
      );
      return;
    }

    if (props.onWheelZoom) {
      props.onWheelZoom(e.deltaY, zoomCenter, undefined, modifiers);
    } else {
      // Fallback: Basic wheel zoom
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const canvas = e.currentTarget;
      const newTransform = CoordinateTransforms.calculateZoomTransform(
        transform, zoomFactor, zoomCenter,
        { width: canvas?.width || 0, height: canvas?.height || 0 }
      );
      onTransformChange?.(newTransform);
      canvasEventBus.emitTransformChange(
        { scale: newTransform.scale, offsetX: newTransform.offsetX, offsetY: newTransform.offsetY },
        { width: canvas?.width || 0, height: canvas?.height || 0 },
        'dxf-canvas'
      );
    }
  }, [transform, onTransformChange, props.onWheelZoom, viewport]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,
    cursorState: cursor,
    snapResults,
  };
}
